"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_ADDED_ITEMS } from "@/lib/items";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §4·§6 — 항목 추가·수정·삭제. 기본 6개는 설명만 수정할 수 있고 지울 수 없다. 추가 항목은 최대 4개.
// Plan SC: 작업 9 — 항목 추가·수정·삭제 (모든 동작은 먼저 로그인 확인, 규칙은 DB도 한 번 더 지킨다)

export type ItemFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "description" | "valueType", string>>;
  values?: { name: string; description: string; valueType: string };
};

const NameSchema = z
  .string()
  .trim()
  .min(1, { error: "항목 이름을 입력해 주세요." })
  .max(50, { error: "항목 이름은 50자 이하여야 합니다." });
const DescriptionSchema = z.string().trim().max(200, { error: "설명은 200자 이하여야 합니다." });
const ValueTypeSchema = z.enum(["number", "text"], { error: "값의 유형을 골라 주세요." });

const AddSchema = z.object({ name: NameSchema, description: DescriptionSchema, valueType: ValueTypeSchema });
const IdSchema = z.uuid();

type DbError = { code?: string; message?: string };

// DB가 돌려주는 오류를 사용자가 이해할 문장으로 바꾼다. 내부 오류 내용은 그대로 보여 주지 않는다.
function describeDbError(error: DbError): ItemFormState {
  if (error.code === "23505") {
    return { status: "error", fieldErrors: { name: "이미 같은 이름의 항목이 있습니다." } };
  }
  if (error.message?.includes("ITEM_LIMIT")) {
    return { status: "error", message: `추가 항목은 최대 ${MAX_ADDED_ITEMS}개까지 만들 수 있습니다.` };
  }
  if (error.message?.includes("DEFAULT_ITEM_LOCKED")) {
    return { status: "error", message: "기본 항목은 설명만 수정할 수 있습니다." };
  }
  return { status: "error", message: "저장 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요." };
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    valueType: String(formData.get("valueType") ?? ""),
  };
}

function toFieldErrors(error: z.ZodError): NonNullable<ItemFormState["fieldErrors"]> {
  const fieldErrors: NonNullable<ItemFormState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "name" || field === "description" || field === "valueType") && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

export async function addItem(_previous: ItemFormState, formData: FormData): Promise<ItemFormState> {
  await requireUser();
  const raw = readForm(formData);

  const parsed = AddSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values: raw };
  }

  const supabase = await createSupabaseServerClient();

  // 새 항목은 맨 뒤에 놓는다.
  const { data: last } = await supabase
    .from("items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("items").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
    value_type: parsed.data.valueType,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) return { ...describeDbError(error), values: raw };

  revalidatePath("/items");
  return { status: "success", message: `"${parsed.data.name}" 항목을 추가했습니다.` };
}

// 기본 항목은 설명만, 추가 항목은 이름·설명·유형을 고칠 수 있다.
export async function updateItem(_previous: ItemFormState, formData: FormData): Promise<ItemFormState> {
  await requireUser();
  const id = IdSchema.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "항목을 찾을 수 없습니다." };

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("items")
    .select("id, is_default")
    .eq("id", id.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (!current) return { status: "error", message: "항목을 찾을 수 없습니다." };

  const raw = readForm(formData);

  if (current.is_default) {
    const description = DescriptionSchema.safeParse(raw.description);
    if (!description.success) {
      return { status: "error", fieldErrors: { description: description.error.issues[0]?.message }, values: raw };
    }
    const { error } = await supabase
      .from("items")
      .update({ description: description.data || null })
      .eq("id", current.id);
    if (error) return { ...describeDbError(error), values: raw };
  } else {
    const parsed = AddSchema.safeParse(raw);
    if (!parsed.success) {
      return { status: "error", fieldErrors: toFieldErrors(parsed.error), values: raw };
    }
    const { error } = await supabase
      .from("items")
      .update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        value_type: parsed.data.valueType,
      })
      .eq("id", current.id);
    if (error) return { ...describeDbError(error), values: raw };
  }

  revalidatePath("/items");
  return { status: "success", message: "저장했습니다." };
}

// 지워도 이미 정리된 값은 남아야 하므로, 실제로 지우지 않고 삭제 시각만 기록한다. 기본 항목은 지울 수 없다.
export async function deleteItem(_previous: ItemFormState, formData: FormData): Promise<ItemFormState> {
  await requireUser();
  const id = IdSchema.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "항목을 찾을 수 없습니다." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("is_default", false)
    .is("deleted_at", null)
    .select("id");

  if (error) return describeDbError(error);
  if (!data || data.length === 0) return { status: "error", message: "삭제할 수 있는 항목이 아닙니다." };

  revalidatePath("/items");
  return { status: "success", message: "삭제했습니다." };
}
