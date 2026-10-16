import "server-only";

import { listItems } from "@/lib/items";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ResultRow } from "@/components/result-table";

// Design Ref: §2.4 — 기관 결과 확인 화면에 보여 줄 기관 정보와 항목별 값. 본인 기관만 읽힌다. (접근 규칙 + requireUser)
// Plan SC: 작업 14 — 값이 없는 항목은 "미조사"(기관을 저장한 뒤에 추가한 항목), 값이 있으면 확인됨/확인 불가.
export type InstitutionDetail = {
  id: string;
  name: string;
  sourceType: "url" | "pdf";
  sourceRef: string;
  baseYear: number | null;
  status: "processing" | "pending_review" | "saved" | "failed";
  failureReason: string | null;
  savedAt: string | null;
  pageCount: number | null;
  charCount: number | null;
  readPages: string[]; // 링크를 따라가 여러 페이지를 읽었을 때 읽은 페이지 주소 (입력한 페이지가 첫 번째). 한 페이지만 읽었으면 비어 있다
  rows: ResultRow[];
};

export async function getInstitutionDetail(institutionId: string): Promise<InstitutionDetail | null> {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name, source_type, source_ref, base_year, status, failure_reason, saved_at")
    .eq("id", institutionId)
    .maybeSingle();
  if (!institution) return null;

  const [items, valuesResult, textResult, sourcesResult] = await Promise.all([
    listItems(),
    supabase
      .from("extracted_values")
      .select("item_id, status, value_text, value_number, unit, value_year, source_ref, source_quote, unverifiable_reason")
      .eq("institution_id", institution.id),
    supabase.from("institution_texts").select("page_count, char_count").eq("institution_id", institution.id).maybeSingle(),
    supabase.rpc("read_sources", { p_id: institution.id }),
  ]);
  if (valuesResult.error) throw new Error("정리 결과를 불러오지 못했습니다.");

  const byItem = new Map((valuesResult.data ?? []).map((value) => [value.item_id, value]));
  const rows: ResultRow[] = items.map((item) => {
    const value = byItem.get(item.id);
    if (!value) {
      return { name: item.name, status: "not_checked", valueText: null, valueNumber: null, unit: null, valueYear: null, sourceRef: null, sourceQuote: null, reason: null };
    }
    return {
      name: item.name,
      status: value.status === "confirmed" ? "confirmed" : "unverifiable",
      valueText: value.value_text,
      valueNumber: value.value_number,
      unit: value.unit,
      valueYear: value.value_year,
      sourceRef: value.source_ref,
      sourceQuote: value.source_quote,
      reason: value.unverifiable_reason,
    };
  });

  return {
    id: institution.id,
    name: institution.name,
    sourceType: institution.source_type === "pdf" ? "pdf" : "url",
    sourceRef: institution.source_ref,
    baseYear: institution.base_year,
    status: institution.status as InstitutionDetail["status"],
    failureReason: institution.failure_reason,
    savedAt: institution.saved_at,
    pageCount: textResult.data?.page_count ?? null,
    charCount: textResult.data?.char_count ?? null,
    readPages: sourcesResult.error ? [] : (sourcesResult.data ?? []),
    rows,
  };
}
