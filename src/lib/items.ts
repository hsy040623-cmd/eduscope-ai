import "server-only";

import type { Database } from "@/lib/database.types";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §4 — 정리 항목은 계정 단위이며, 지운 항목(deleted_at)은 목록에서 뺀다.
// Plan SC: 작업 9 — 항목 조회. (본인 항목만 읽는 것은 DB의 접근 규칙이 보장한다)
export type Item = Pick<
  Database["public"]["Tables"]["items"]["Row"],
  "id" | "name" | "description" | "value_type" | "is_default" | "sort_order"
>;

// 추가 항목은 최대 4개. 같은 숫자를 DB 규칙(items_guard)도 지킨다.
export const MAX_ADDED_ITEMS = 4;

export async function listItems(): Promise<Item[]> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("items")
    .select("id, name, description, value_type, is_default, sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error("항목을 불러오지 못했습니다.");
  return data;
}
