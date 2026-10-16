"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLoginBlocked, LOGIN_BLOCKED_MESSAGE, recordLoginFailure } from "@/lib/login-throttle";
import { GUEST_COOKIE } from "@/lib/supabase/cookie-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §3.3 — 이메일·비밀번호 로그인과 로그아웃은 모두 서버에서 처리한다.
// Plan SC: 작업 6 — 로그인·로그아웃

export type LoginState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  email?: string; // 오류가 나도 입력한 이메일은 남겨 둔다. (비밀번호는 절대 돌려보내지 않는다)
};

const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "이메일 형식이 올바르지 않습니다." })),
  password: z.string().min(1, { error: "비밀번호를 입력해 주세요." }),
});

export async function logIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "");

  const parsed = LoginSchema.safeParse({
    email: rawEmail,
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: NonNullable<LoginState["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "email" || field === "password") && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { status: "error", fieldErrors, email: rawEmail };
  }

  // persistent: 게스트 상태에서 로그인해도 계속 보관되는 로그인 쿠키로 만든다.
  const supabase = await createSupabaseServerClient({ forwardClientIp: true, persistent: true });

  // 같은 이메일로 너무 많이 틀렸으면 Supabase에 요청하지 않고 바로 알린다. (이메일이 있는 계정인지와 상관없이 같은 문구)
  if (await isLoginBlocked(supabase, parsed.data.email)) {
    return { status: "error", message: LOGIN_BLOCKED_MESSAGE, email: rawEmail };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // 이메일이 틀렸는지 비밀번호가 틀렸는지는 알려 주지 않는다. (계정이 있는지 알아내는 것을 막기 위해)
    if (error.code === "invalid_credentials") {
      await recordLoginFailure(supabase, parsed.data.email);
      return { status: "error", message: "이메일 또는 비밀번호가 올바르지 않습니다.", email: rawEmail };
    }
    // Supabase의 요청 횟수 제한(429)에 걸린 경우: 비밀번호가 틀렸다는 뜻이 아니므로 따로 알린다.
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return { status: "error", message: "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.", email: rawEmail };
    }
    return {
      status: "error",
      message: "로그인 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.",
      email: rawEmail,
    };
  }

  (await cookies()).delete(GUEST_COOKIE); // 이제 게스트가 아니다
  redirect("/");
}

export async function logOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" }); // 이 기기의 로그인만 끝낸다.
  (await cookies()).delete(GUEST_COOKIE);
  redirect("/");
}
