import "server-only";

import { z } from "zod";
import type { ResultRow } from "@/components/result-table";
import { MAX_COMPARE_INSTITUTIONS, MIN_COMPARE_INSTITUTIONS } from "@/lib/compare-limits";
import { computeNumericStats, type NumericStats } from "@/lib/compare-stats";
import { listItems } from "@/lib/items";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §2.5·§3.2 — 비교표에 쓸 값을 서버가 읽는다. 저장된 기관만, 본인 기관만 읽힌다. (접근 규칙 + requireUser)
// Plan SC: 작업 18·19 — 값이 있는(확인됨) 기관이 2곳 미만인 항목은 "비교 불가". 숫자 항목은 평균·차트에 쓸 값을 코드로 계산한다. (AI 없음)
export type CompareInstitution = {
  id: string;
  name: string;
  baseYear: number;
  sourceType: "url" | "pdf";
  sourceRef: string;
};

export type CompareItem = {
  name: string;
  valueType: "number" | "text";
  cells: ResultRow[]; // institutions와 같은 순서
  confirmedCount: number;
  comparable: boolean; // 확인됨 값이 있는 기관이 2곳 이상
  stats: NumericStats | null; // 숫자 항목만. 평균·차트에 쓴 값과 제외한 기관 수 (글 항목은 null)
};

export type ComparisonResult =
  | { status: "error"; message: string }
  | { status: "ok"; institutions: CompareInstitution[]; items: CompareItem[]; years: number[] };

const IdsSchema = z.array(z.uuid()).min(MIN_COMPARE_INSTITUTIONS).max(MAX_COMPARE_INSTITUTIONS);

// 주소의 기관 번호 목록(쉼표로 구분)을 검사해서 비교 결과를 만든다. 번호가 잘못됐거나 남의 기관·저장 전 기관이 섞이면 만들지 않는다.
export async function getComparison(idsParam: string | undefined): Promise<ComparisonResult> {
  await requireUser();

  const rawIds = (idsParam ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const uniqueIds = [...new Set(rawIds)];
  const parsed = IdsSchema.safeParse(uniqueIds);
  if (!parsed.success) {
    return { status: "error", message: `비교할 기관은 ${MIN_COMPARE_INSTITUTIONS}~${MAX_COMPARE_INSTITUTIONS}곳이어야 합니다. 비교 선택 화면에서 다시 골라 주세요.` };
  }
  const ids = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase
    .from("institutions")
    .select("id, name, base_year, source_type, source_ref")
    .eq("status", "saved")
    .in("id", ids);
  if (error) throw new Error("비교할 기관을 불러오지 못했습니다.");

  // 선택한 순서를 그대로 유지한다. 하나라도 없으면(삭제·저장 전·남의 기관) 전체를 만들지 않는다.
  const byId = new Map((rows ?? []).map((row) => [row.id, row]));
  if (ids.some((id) => !byId.has(id))) {
    return { status: "error", message: "선택한 기관 중 찾을 수 없는 기관이 있습니다. 삭제되었거나 저장되지 않은 기관일 수 있습니다. 비교 선택 화면에서 다시 골라 주세요." };
  }
  const institutions: CompareInstitution[] = ids.map((id) => {
    const row = byId.get(id)!;
    return {
      id: row.id,
      name: row.name,
      baseYear: row.base_year ?? 0,
      sourceType: row.source_type === "pdf" ? "pdf" : "url",
      sourceRef: row.source_ref,
    };
  });

  const [items, valuesResult] = await Promise.all([
    listItems(),
    supabase
      .from("extracted_values")
      .select("institution_id, item_id, status, value_text, value_number, unit, value_year, source_ref, source_quote, unverifiable_reason")
      .in("institution_id", ids),
  ]);
  if (valuesResult.error) throw new Error("비교할 값을 불러오지 못했습니다.");

  const valueByKey = new Map((valuesResult.data ?? []).map((value) => [`${value.institution_id}:${value.item_id}`, value]));

  const compareItems: CompareItem[] = items.map((item) => {
    const cells: ResultRow[] = institutions.map((institution) => {
      const value = valueByKey.get(`${institution.id}:${item.id}`);
      // 값 행이 아예 없으면 "미조사"(저장한 뒤에 추가한 항목)
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
    const confirmedCount = cells.filter((cell) => cell.status === "confirmed").length;
    return {
      name: item.name,
      valueType: item.value_type === "number" ? "number" : "text",
      cells,
      confirmedCount,
      comparable: confirmedCount >= 2,
      stats: item.value_type === "number" ? computeNumericStats(cells) : null,
    };
  });

  const years = [...new Set(institutions.map((institution) => institution.baseYear))].sort((a, b) => a - b);
  return { status: "ok", institutions, items: compareItems, years };
}
