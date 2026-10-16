"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GUEST_COOKIE } from "@/lib/supabase/cookie-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §3.3 — 이메일·비밀번호 회원가입. 이메일 확인 메일은 끄고(실습용) 가입하면 바로 로그인된다.
// Plan SC: 작업 5 — 이메일·비밀번호 회원가입

export type SignupState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "passwordConfirm", string>>;
  email?: string; // 오류가 나도 입력한 이메일은 남겨 둔다. (비밀번호는 절대 돌려보내지 않는다)
};

const SignupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: "이메일 형식이 올바르지 않습니다." })),
    password: z
      .string()
      .min(8, { error: "비밀번호는 8자 이상이어야 합니다." })
      .max(72, { error: "비밀번호는 72자 이하여야 합니다." }),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    error: "비밀번호가 서로 다릅니다.",
  });

export async function signUp(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const rawEmail = String(formData.get("email") ?? "");

  const parsed = SignupSchema.safeParse({
    email: rawEmail,
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: NonNullable<SignupState["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "email" || field === "password" || field === "passwordConfirm") && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { status: "error", fieldErrors, email: rawEmail };
  }

  // persistent: 게스트 상태에서 가입해도 계속 보관되는 로그인 쿠키로 만든다.
  const supabase = await createSupabaseServerClient({ forwardClientIp: true, persistent: true });
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // 비밀번호나 서버 오류 내용은 화면과 로그에 그대로 내보내지 않고, 사용자가 이해할 문장으로만 알린다.
    if (error.code === "user_already_exists") {
      return { status: "error", fieldErrors: { email: "이미 가입된 이메일입니다." }, email: rawEmail };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "더 안전한 비밀번호를 사용해 주세요." }, email: rawEmail };
    }
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return { status: "error", message: "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.", email: rawEmail };
    }
    return {
      status: "error",
      message: "가입 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.",
      email: rawEmail,
    };
  }

  // 이메일 확인을 끈 설정이라 가입하면 바로 로그인 상태(쿠키)가 된다. 홈으로 보낸다.
  if (data.session) {
    (await cookies()).delete(GUEST_COOKIE); // 이제 게스트가 아니다
    redirect("/");
  }

  // 이메일 확인이 켜져 있으면 로그인 상태가 아니므로, 안내만 보여 준다.
  return { status: "success" };
}
