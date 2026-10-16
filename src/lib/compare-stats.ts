// Design Ref: §3.2 — 평균·차트는 AI 없이 코드로 계산한다. 확인 불가·미조사 값과, 숫자로 바꿀 수 없거나 단위가 다른 값은 평균·차트에서 빼고 제외한 기관 수를 표시한다.
// Plan SC: 작업 19 — 순수 함수라서 화면 없이 규칙을 시험할 수 있다. (이 파일은 서버·브라우저 어디서나 쓴다)
export type StatCell = {
  status: "confirmed" | "unverifiable" | "not_checked";
  valueNumber: number | null;
  unit: string | null;
};

export type NumericStats = {
  average: number | null; // 계산에 쓴 값이 2곳 미만이면 null (평균을 내지 않는다)
  unit: string; // 계산에 쓴 값의 단위 ("" = 단위 없음)
  usedCount: number; // 평균·차트에 쓴 기관 수
  excludedCount: number; // 빠진 기관 수 = 전체 − 쓴 기관 수
  unitMismatchCount: number; // 빠진 기관 중 "숫자인데 단위가 달라서" 빠진 수
  chartPoints: { index: number; value: number }[]; // 쓴 기관의 열 번호(0부터)와 값. 쓴 값이 2곳 미만이면 비어 있다
};

const MIN_USED = 2; // 값이 있는 기관이 2곳 미만이면 비교 불가

// 소수 둘째 자리까지 반올림 (부동소수점 오차로 91.50000000001처럼 보이지 않게)
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeUnit(unit: string | null): string {
  return (unit ?? "").replace(/\s+/g, "").trim();
}

// 칸마다 "확인됨 + 숫자 값"만 후보로 삼고, 단위가 가장 많이 같은 무리를 계산에 쓴다.
// 가장 많은 무리가 여럿이면 열 순서가 앞선 기관이 속한 무리를 쓴다. (항상 같은 결과가 나오도록)
export function computeNumericStats(cells: StatCell[]): NumericStats {
  const candidates = cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.status === "confirmed" && cell.valueNumber !== null && Number.isFinite(cell.valueNumber));

  const groups = new Map<string, { index: number; value: number }[]>();
  for (const { cell, index } of candidates) {
    const key = normalizeUnit(cell.unit);
    const list = groups.get(key) ?? [];
    list.push({ index, value: cell.valueNumber as number });
    groups.set(key, list);
  }

  let best: { key: string; list: { index: number; value: number }[] } | null = null;
  for (const [key, list] of groups) {
    if (!best || list.length > best.list.length || (list.length === best.list.length && list[0].index < best.list[0].index)) {
      best = { key, list };
    }
  }

  const used = best?.list ?? [];
  const unit = best ? (cells[best.list[0].index].unit ?? "").trim() : "";
  const unitMismatchCount = candidates.length - used.length;
  const enough = used.length >= MIN_USED;

  return {
    average: enough ? round2(used.reduce((sum, point) => sum + point.value, 0) / used.length) : null,
    unit,
    usedCount: used.length,
    excludedCount: cells.length - used.length,
    unitMismatchCount,
    chartPoints: enough ? used.map((point) => ({ index: point.index, value: point.value })) : [],
  };
}
