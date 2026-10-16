"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §3.1 ⑤ — 저장 요청에는 기관 번호와 기준연도(와 덮어쓰기 승인 여부)만 담긴다. 값은 서버에 이미 있는 것만 쓰므로 바뀌어 들어올 수 없다.
// Plan SC: 작업 14 — 기준연도 확인 후 저장, 같은 기관·같은 연도면 덮어쓰기 확인. (실제 저장·덮어쓰기는 DB 함수 save_institution이 한 번에 처리한다)
export type SaveResult =
  | { status: "saved" }
  | { status: "needs-overwrite" }
  | { status: "error"; message: string };

const SaveSchema = z.object({
  institutionId: z.uuid(),
  baseYear: z.number().int().min(1900).max(2100),
  overwrite: z.boolean(),
});

export async function saveInstitution(input: { institutionId: string; baseYear: number; overwrite: boolean }): Promise<SaveResult> {
  await requireUser();
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "기준연도는 1900~2100 사이의 숫자로 입력해 주세요." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_institution", {
    p_id: parsed.data.institutionId,
    p_year: parsed.data.baseYear,
    p_overwrite: parsed.data.overwrite,
  });
  if (error) return { status: "error", message: "저장 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." };

  if (data === "needs_overwrite") return { status: "needs-overwrite" };
  if (data === "bad_year") return { status: "error", message: "기준연도는 1900~2100 사이의 숫자로 입력해 주세요." };
  if (data !== "saved") return { status: "error", message: "저장할 수 있는 기관을 찾을 수 없습니다. 이미 저장했거나 삭제된 기관일 수 있습니다." };

  revalidatePath(`/institutions/${parsed.data.institutionId}`);
  revalidatePath("/institutions");
  return { status: "saved" };
}

export type RenameResult = { status: "renamed"; name: string } | { status: "error"; message: string };

const RenameSchema = z.object({
  institutionId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, { error: "기관 이름을 입력해 주세요." })
    .max(100, { error: "기관 이름은 100자 이하여야 합니다." }),
});

// 기관 이름만 고친다. 값·출처·기준연도는 그대로다. (본인 기관만, 확인 대기·저장됨 상태일 때만)
// 처리 중인 기관은 AI가 이름을 읽고 있어서 고치지 않는다. 같은 이름·같은 기준연도로 저장된 기관이 이미 있으면 DB의 유일 규칙이 막는다.
export async function renameInstitution(input: { institutionId: string; name: string }): Promise<RenameResult> {
  await requireUser();
  const parsed = RenameSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "기관 이름을 확인해 주세요." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("institutions")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.institutionId)
    .in("status", ["pending_review", "saved"])
    .select("id");
  if (error) {
    if (error.code === "23505") return { status: "error", message: "같은 이름·같은 기준연도로 저장된 기관이 이미 있습니다. 다른 이름을 입력해 주세요." };
    return { status: "error", message: "이름을 바꾸는 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." };
  }
  if (!data || data.length === 0) return { status: "error", message: "이름을 바꿀 수 있는 기관을 찾을 수 없습니다. (처리 중이거나 삭제된 기관은 바꿀 수 없습니다)" };

  revalidatePath(`/institutions/${parsed.data.institutionId}`);
  revalidatePath("/institutions");
  revalidatePath("/compare");
  return { status: "renamed", name: parsed.data.name };
}

export type DeleteResult ={ status: "deleted" } | { status: "error"; message: string };

// 기관을 지운다. 값과 읽어 둔 글자는 함께 지워지고, 아직 남은 PDF 원본이 있으면 그것도 지운다. (본인 기관만 지워진다)
export async function deleteInstitution(institutionId: string): Promise<DeleteResult> {
  const user = await requireUser();
  const id = z.uuid().safeParse(institutionId);
  if (!id.success) return { status: "error", message: "기관을 찾을 수 없습니다." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("institutions").delete().eq("id", id.data).select("id");
  if (error) return { status: "error", message: "삭제 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." };
  if (!data || data.length === 0) return { status: "error", message: "기관을 찾을 수 없습니다." };

  await supabase.storage.from("uploads").remove([`${user.id}/${id.data}.pdf`]);
  revalidatePath("/institutions");
  return { status: "deleted" };
}
