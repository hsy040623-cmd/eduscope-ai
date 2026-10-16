import { extractNumbers } from "@/lib/extraction-verify";

// Design Ref: §3.2 — 차이 분석 문장은 AI가 쓰지만 믿지 않는다. 입력은 비교표 값뿐이고, 문장마다 근거 항목을 붙이게 하며,
// 근거가 표에 없거나 문장 속 숫자가 표의 값·차이·평균·기준연도와 맞지 않으면 그 문장을 버린다.
// Plan SC: 작업 20 — 값이 있는 기관이 2곳 미만인 항목은 문장을 만들지 않는다. 항목당 최대 3문장. (순수 함수라서 화면 없이 규칙을 시험할 수 있다)
export type AnalysisInstitution = { key: string; label: string; baseYear: number };

// 문장 근거가 될 수 있는 칸. 확인됨 값만 넘긴다. (확인 불가·미조사는 표에서 뺀다)
export type AnalysisCell = { institutionKey: string; valueText: string | null; valueNumber: number | null; unit: string | null };

export type AnalysisItem = {
  key: string;
  name: string;
  valueType: "number" | "text";
  cells: AnalysisCell[]; // 확인됨 값만, 2곳 이상
  average: number | null;
};

export type RawSentence = {
  item_key: string;
  text: string;
  relation: "higher" | "lower" | "equal" | "qualitative";
  subject_key: string | null;
  other_key: string | null;
};

export type AnalysisGroup = { itemKey: string; itemName: string; sentences: string[] };
export type DroppedSentence = { text: string; reason: string };
export type VerifiedAnalysis = { groups: AnalysisGroup[]; dropped: DroppedSentence[] };

export const ANALYSIS_LIMITS = { maxPerItem: 3, minChars: 8, maxChars: 300, tolerance: 0.005 } as const;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const normalizeUnit = (unit: string | null) => (unit ?? "").replace(/\s+/g, "");

// 방향을 나타내는 말. 구조화된 관계(higher/lower)와 문장 속 말이 정반대면 그 문장은 버린다. (정확히 맞는지까지는 가릴 수 없는 보조 검사)
const HIGHER_WORDS = ["많다", "많은", "많으며", "많고", "높다", "높은", "높으며", "높고", "크다", "큰", "크며", "크고", "웃돌", "상회"];
const LOWER_WORDS = ["적다", "적은", "적으며", "적고", "낮다", "낮은", "낮으며", "낮고", "작다", "작은", "작으며", "작고", "밑돌", "하회"];
const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

// 문장에 이름이 나온 기관의 값에서 온 숫자만 허용한다. ("가나교육원은 평가 60점"처럼 다른 기관의 숫자를 잘못 붙인 문장을 걸러 낸다)
function allowedNumbers(item: AnalysisItem, named: AnalysisInstitution[]): number[] {
  const namedKeys = new Set(named.map((institution) => institution.key));
  const cells = item.cells.filter((cell) => namedKeys.has(cell.institutionKey));
  const allowed: number[] = named.map((institution) => institution.baseYear);
  if (item.valueType === "number") {
    const numbers = cells.flatMap((cell) => (cell.valueNumber === null ? [] : [{ value: cell.valueNumber, unit: normalizeUnit(cell.unit) }]));
    for (const entry of numbers) allowed.push(entry.value);
    // 같은 단위끼리의 차이만 허용한다.
    for (let i = 0; i < numbers.length; i += 1) {
      for (let j = i + 1; j < numbers.length; j += 1) {
        if (numbers[i].unit === numbers[j].unit) allowed.push(round2(Math.abs(numbers[i].value - numbers[j].value)));
      }
    }
    if (item.average !== null) allowed.push(item.average);
  } else {
    for (const cell of cells) if (cell.valueText) allowed.push(...extractNumbers(cell.valueText));
  }
  return allowed;
}

// 문장 속 기관 이름·항목 이름에 들어 있는 숫자("비교기관 1")는 값으로 세지 않으므로 먼저 지운다.
function stripNames(text: string, institutions: AnalysisInstitution[], itemName: string): string {
  let result = text;
  const names = [...institutions.map((institution) => institution.label), itemName].sort((a, b) => b.length - a.length);
  for (const name of names) result = result.split(name).join(" ");
  return result;
}

function checkSentence(raw: RawSentence, item: AnalysisItem, institutions: AnalysisInstitution[]): string | null {
  const text = raw.text.trim();
  if (text.length < ANALYSIS_LIMITS.minChars) return "문장이 너무 짧음";
  if (text.length > ANALYSIS_LIMITS.maxChars) return "문장이 너무 김";
  if (/https?:|<|>|\[\[|```/.test(text)) return "주소나 표시 문자가 들어 있음";

  const byKey = new Map(institutions.map((institution) => [institution.key, institution]));
  const cellByKey = new Map(item.cells.map((cell) => [cell.institutionKey, cell]));

  // 이름 검사: 문장에 나오는 기관은 목록에 있는 이름 그대로여야 한다.
  const subject = raw.subject_key ? byKey.get(raw.subject_key) : undefined;
  const other = raw.other_key ? byKey.get(raw.other_key) : undefined;
  if ((raw.subject_key && !subject) || (raw.other_key && !other)) return "표에 없는 기관을 가리킴";
  if (subject && other && subject.key === other.key) return "같은 기관끼리 비교함";
  if (subject && !text.includes(subject.label)) return "문장에 기관 이름이 없음";
  if (other && !text.includes(other.label)) return "문장에 기관 이름이 없음";
  if (!institutions.some((institution) => text.includes(institution.label))) return "문장에 기관 이름이 없음";
  if ((subject && !cellByKey.has(subject.key)) || (other && !cellByKey.has(other.key))) return "값이 없는 기관을 근거로 씀";

  // 관계 검사: 크다/작다/같다는 같은 단위의 숫자 항목에서 실제 값과 맞아야 한다.
  if (raw.relation !== "qualitative") {
    if (item.valueType !== "number") return "글 항목에 크기 비교를 씀";
    if (!subject || !other) return "비교할 두 기관이 없음";
    const a = cellByKey.get(subject.key);
    const b = cellByKey.get(other.key);
    if (!a || !b || a.valueNumber === null || b.valueNumber === null) return "숫자 값이 없음";
    if (normalizeUnit(a.unit) !== normalizeUnit(b.unit)) return "단위가 달라 크기를 비교할 수 없음";
    const diff = a.valueNumber - b.valueNumber;
    const equal = Math.abs(diff) < ANALYSIS_LIMITS.tolerance;
    if (raw.relation === "equal" && !equal) return "같다고 했지만 값이 다름";
    if (raw.relation === "higher" && !(diff > 0 && !equal)) return "크다고 했지만 값이 맞지 않음";
    if (raw.relation === "lower" && !(diff < 0 && !equal)) return "작다고 했지만 값이 맞지 않음";
    // "A가 B보다 많다"처럼 주어가 비교 대상보다 먼저 나와야 한다. (순서가 바뀌면 크다/작다 말이 같아도 뜻이 정반대가 된다)
    if (text.indexOf(subject.label) > text.indexOf(other.label)) return "문장 속 기관 순서가 관계와 다름";
    const higherSaid = hasAny(text, HIGHER_WORDS);
    const lowerSaid = hasAny(text, LOWER_WORDS);
    if (raw.relation === "higher" && lowerSaid && !higherSaid) return "문장의 방향이 관계와 반대임";
    if (raw.relation === "lower" && higherSaid && !lowerSaid) return "문장의 방향이 관계와 반대임";
  }

  // 숫자 검사: 문장의 모든 숫자는 (문장에 이름이 나온 기관의) 표의 값·같은 단위 값의 차이·평균·기준연도 중 하나여야 한다.
  const named = institutions.filter((institution) => text.includes(institution.label));
  const allowed = allowedNumbers(item, named);
  for (const value of extractNumbers(stripNames(text, institutions, item.name))) {
    if (!allowed.some((candidate) => Math.abs(candidate - value) < ANALYSIS_LIMITS.tolerance)) return `표와 맞지 않는 숫자(${value})`;
  }
  return null;
}

export function verifyAnalysis(args: { raw: RawSentence[]; institutions: AnalysisInstitution[]; items: AnalysisItem[] }): VerifiedAnalysis {
  const { raw, institutions, items } = args;
  const itemByKey = new Map(items.map((item) => [item.key, item]));
  const itemByName = new Map(items.map((item) => [item.name.trim(), item]));
  const grouped = new Map<string, string[]>();
  const dropped: DroppedSentence[] = [];

  for (const sentence of raw ?? []) {
    const text = typeof sentence?.text === "string" ? sentence.text.trim() : "";
    // AI가 번호 대신 항목 이름을 적는 경우도 짝을 맞춘다. (짝이 틀려도 아래 검사를 통과해야만 쓰인다)
    const key = typeof sentence?.item_key === "string" ? sentence.item_key.trim() : "";
    const item = itemByKey.get(key) ?? itemByName.get(key);
    if (!item) {
      dropped.push({ text, reason: "근거 항목이 표에 없음" });
      continue;
    }
    // 값이 있는 기관이 2곳 미만인 항목은 목록에 넣지 않으므로 여기까지 오지 않는다. 그래도 한 번 더 막는다.
    if (item.cells.length < 2) {
      dropped.push({ text, reason: "값이 있는 기관이 2곳 미만인 항목" });
      continue;
    }
    const list = grouped.get(item.key) ?? [];
    if (list.length >= ANALYSIS_LIMITS.maxPerItem) {
      dropped.push({ text, reason: "항목당 3문장을 넘음" });
      continue;
    }
    const problem = checkSentence(sentence, item, institutions);
    if (problem) {
      dropped.push({ text, reason: problem });
      continue;
    }
    if (list.includes(text)) {
      dropped.push({ text, reason: "같은 문장이 반복됨" });
      continue;
    }
    list.push(text);
    grouped.set(item.key, list);
  }

  // 표의 항목 순서대로 보여 준다.
  const groups: AnalysisGroup[] = items.flatMap((item) => {
    const sentences = grouped.get(item.key);
    return sentences && sentences.length > 0 ? [{ itemKey: item.key, itemName: item.name, sentences }] : [];
  });
  return { groups, dropped };
}
