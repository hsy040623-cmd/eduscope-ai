import "server-only";

import { listItems } from "@/lib/items";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §2.1 — 내 기관 목록(/institutions)에는 "저장됨" 기관만 나온다. 처리 중·확인 대기·실패 기관은 나타나지 않는다. (본인 기관만 읽힌다)
// Plan SC: 작업 16 — 저장된 기관 목록. 항목별로 몇 개가 "확인됨"인지 함께 센다.
export type SavedInstitution = {
  id: string;
  name: string;
  baseYear: number;
  sourceType: "url" | "pdf";
  sourceRef: string;
  savedAt: string;
  confirmedCount: number;
  itemCount: number;
};

export async function listSavedInstitutions(): Promise<SavedInstitution[]> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: institutions, error } = await supabase
    .from("institutions")
    .select("id, name, base_year, source_type, source_ref, saved_at")
    .eq("status", "saved")
    .order("saved_at", { ascending: false });
  if (error) throw new Error("기관 목록을 불러오지 못했습니다.");
  if (!institutions || institutions.length === 0) return [];

  const [items, valuesResult] = await Promise.all([
    listItems(),
    supabase
      .from("extracted_values")
      .select("institution_id, item_id")
      .eq("status", "confirmed")
      .in("institution_id", institutions.map((institution) => institution.id)),
  ]);
  if (valuesResult.error) throw new Error("기관 목록을 불러오지 못했습니다.");

  // 지운 항목의 값은 세지 않는다. (화면의 항목 수와 같은 기준)
  const activeItemIds = new Set(items.map((item) => item.id));
  const confirmed = new Map<string, number>();
  for (const value of valuesResult.data ?? []) {
    if (!activeItemIds.has(value.item_id)) continue;
    confirmed.set(value.institution_id, (confirmed.get(value.institution_id) ?? 0) + 1);
  }

  return institutions.map((institution) => ({
    id: institution.id,
    name: institution.name,
    baseYear: institution.base_year ?? 0,
    sourceType: institution.source_type === "pdf" ? "pdf" : "url",
    sourceRef: institution.source_ref,
    savedAt: institution.saved_at ?? "",
    confirmedCount: confirmed.get(institution.id) ?? 0,
    itemCount: items.length,
  }));
}
