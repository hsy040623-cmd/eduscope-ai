"use server";

import { AiError, describeAiError } from "@/lib/ai-extract";
import { writeAnalysisWithAi } from "@/lib/ai-analyze";
import { verifyAnalysis, type AnalysisInstitution, type AnalysisItem } from "@/lib/analysis-verify";
import { DAILY_ANALYSIS_LIMIT } from "@/lib/analysis-limits";
import { getComparison } from "@/lib/compare-data";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §3.2 — 차이 분석: 비교표 값만 AI에 보내 문장을 받고, 서버가 표와 대조해 맞는 문장만 돌려준다.
// Plan SC: 작업 20 — 기관 번호는 이 작업에서 다시 검사한다. (2~5개, 저장된 본인 기관만) 값이 있는 기관이 2곳 미만인 항목은 문장을 만들지 않는다.
export type AnalysisResult =
  | { status: "error"; message: string }
  | { status: "empty"; message: string }
  | { status: "ok"; groups: { itemName: string; sentences: string[] }[]; droppedCount: number };

export async function generateAnalysis(idsParam: string): Promise<AnalysisResult> {
  await requireUser();
  const comparison = await getComparison(typeof idsParam === "string" ? idsParam.slice(0, 400) : undefined);
  if (comparison.status === "error") return { status: "error", message: comparison.message };

  // 기관 이름 칸: 이름이 겹치면(같은 기관의 다른 연도) 연도를 붙여 구분한다.
  const nameCount = new Map<string, number>();
  for (const institution of comparison.institutions) nameCount.set(institution.name, (nameCount.get(institution.name) ?? 0) + 1);
  const institutions: AnalysisInstitution[] = comparison.institutions.map((institution, index) => ({
    key: String.fromCharCode(65 + index),
    label: (nameCount.get(institution.name) ?? 0) > 1 ? `${institution.name}(${institution.baseYear}년)` : institution.name,
    baseYear: institution.baseYear,
  }));

  // 값이 확인된 기관이 2곳 이상인 항목만 문장의 근거가 된다. (표의 "비교 불가" 항목은 뺀다)
  const items: AnalysisItem[] = comparison.items
    .filter((item) => item.comparable)
    .map((item, index) => ({
      key: String(index + 1),
      name: item.name,
      valueType: item.valueType,
      average: item.stats?.average ?? null,
      cells: item.cells.flatMap((cell, column) =>
        cell.status === "confirmed"
          ? [{ institutionKey: institutions[column].key, valueText: cell.valueText, valueNumber: cell.valueNumber, unit: cell.unit }]
          : [],
      ),
    }));

  if (items.length === 0) {
    return { status: "empty", message: "값이 확인된 기관이 2곳 이상인 항목이 없어 차이 분석 문장을 만들지 않습니다." };
  }

  // AI를 부르기 전에 호출 1회를 기록한다. 하루 한도(30회)를 넘으면 DB가 기록을 거부한다. 동시에 여러 번 눌러도 한도를 넘지 못한다. (CHECK P1-1)
  const supabase = await createSupabaseServerClient();
  const { error: logError } = await supabase.from("analysis_log").insert({});
  if (logError) {
    if (logError.message?.includes("DAILY_ANALYSIS_LIMIT")) {
      return { status: "error", message: `오늘 차이 분석 한도(${DAILY_ANALYSIS_LIMIT}회)를 모두 사용했습니다. 내일 0시(한국시간) 이후에 다시 만들 수 있습니다.` };
    }
    return { status: "error", message: "차이 분석을 시작하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }

  try {
    const ai = await writeAnalysisWithAi({ institutions, items });
    const verified = verifyAnalysis({ raw: ai.sentences, institutions, items });
    if (verified.groups.length === 0) {
      return { status: "empty", message: "표의 값과 맞는 분석 문장을 만들지 못했습니다. 다시 시도해 보세요." };
    }
    return {
      status: "ok",
      groups: verified.groups.map((group) => ({ itemName: group.itemName, sentences: group.sentences })),
      droppedCount: verified.dropped.length,
    };
  } catch (error) {
    if (error instanceof AiError) return { status: "error", message: describeAiError(error) };
    return { status: "error", message: "차이 분석을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}
