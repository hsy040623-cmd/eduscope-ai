// Design Ref: §3.1 ④ — 서버 검증: AI의 답을 그대로 믿지 않고, 규칙을 통과한 값만 "확인됨"으로 인정한다.
// Plan SC: 작업 13 (CHECK 2-2 글 값도 원문 포함 확인, 2-4 빈 문자열 금지, 2-6 출처는 서버가 채움, 2-10 숫자 경계·쪽 확인)
// 이 파일은 AI와 무관한 순수 규칙이라 다른 파일을 불러오지 않는다. (단독으로 시험할 수 있게)

export type ValueType = "number" | "text";

export type ItemSpec = { id: string; key: string; name: string; valueType: ValueType };

// AI가 정해진 JSON 모양으로 돌려주는 항목 하나
export type RawItem = {
  item_key: string;
  found: boolean;
  value_text: string | null;
  value_number: number | null;
  unit: string | null;
  value_year: number | null;
  quote: string | null;
};

export type RawExtraction = { base_year: number | null; items: RawItem[] };

export type VerifiedValue = {
  itemId: string;
  name: string;
  valueType: ValueType;
  status: "confirmed" | "unverifiable";
  valueText: string | null;
  valueNumber: number | null;
  unit: string | null;
  valueYear: number | null;
  sourceRef: string | null; // 서버가 채운 출처: 웹페이지는 주소, PDF는 "파일 이름 또는 주소, N쪽"
  sourceQuote: string | null;
  reason: string | null; // "확인 불가"인 이유 (화면 안내용, DB에는 저장하지 않는다)
};

export type VerifiedResult = { baseYear: number | null; values: VerifiedValue[] };

export const LIMITS = {
  minQuoteChars: 4, // 공백을 뺀 원문 발췌의 최소 글자 수
  maxQuoteChars: 400,
  maxValueTextChars: 300,
  maxUnitChars: 20,
  minYear: 1990,
  maxYear: 2100,
} as const;

type Page = { page: number | null; text: string; ref?: string }; // ref: 여러 곳을 합친 자료에서 이 부분의 출처(서버가 붙인 주소 또는 "주소, N쪽")

// `[web]\n…`(웹페이지), `[p.1]\n…[p.2]\n…`(PDF), `[s.1] 출처\n…[s.2] 출처\n…`(링크를 따라가 여러 곳을 합친 자료) 형태의 읽은 글자를 나눈다. 표시는 서버가 붙인 것만 있다.
// 합친 자료의 `[s.N] 출처` 줄은 서버만 만든다. 페이지 본문 속에 같은 모양이 있으면 글자를 읽을 때 이미 지워져(text-clean) 출처를 속일 수 없다.
export function splitPages(content: string): { kind: "web" | "pdf" | "multi"; pages: Page[] } {
  if (content.startsWith("[web]")) return { kind: "web", pages: [{ page: null, text: content.replace(/^\[web\]\n?/, "") }] };
  if (/^\[s\.1\] \S/.test(content)) {
    const sections: Page[] = [];
    const sectionMarker = /^\[s\.(\d+)\] (\S[^\n]*)\n/gm;
    const marks: Array<{ ref: string; start: number; bodyStart: number }> = [];
    let found: RegExpExecArray | null;
    while ((found = sectionMarker.exec(content)) !== null) {
      marks.push({ ref: found[2].trim(), start: found.index, bodyStart: found.index + found[0].length });
    }
    marks.forEach((mark, index) => {
      const end = index + 1 < marks.length ? marks[index + 1].start : content.length;
      sections.push({ page: null, text: content.slice(mark.bodyStart, end), ref: mark.ref });
    });
    return { kind: "multi", pages: sections };
  }
  const pages: Page[] = [];
  const marker = /^\[p\.(\d+)\]\n/gm;
  const found: Array<{ page: number; start: number; bodyStart: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(content)) !== null) {
    found.push({ page: Number(match[1]), start: match.index, bodyStart: match.index + match[0].length });
  }
  found.forEach((entry, index) => {
    const end = index + 1 < found.length ? found[index + 1].start : content.length;
    pages.push({ page: entry.page, text: content.slice(entry.bodyStart, end) });
  });
  return { kind: "pdf", pages };
}

// 공백·줄바꿈 차이를 무시하고 글자만 비교하기 위한 모양
function squash(value: string): string {
  return value.normalize("NFC").replace(/[\s​-‍﻿]+/g, "").toLowerCase();
}

// 숫자 토큰: 더 큰 숫자의 일부(예: 1995 속의 95)는 숫자로 세지 않는다. 쉼표(1,234)와 소수점(91.5)은 하나의 숫자로 본다.
export function extractNumbers(text: string): number[] {
  const numbers: number[] = [];
  const pattern = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    numbers.push(Number(`${match[1].replace(/,/g, "")}${match[2] ?? ""}`));
  }
  return numbers;
}

// 개인정보 모양(이메일·전화번호)은 값과 원문 발췌에서 지운다. 이름은 코드로 걸러 낼 수 없어 AI 지시와 사용자 검토에 맡긴다.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PHONE_KR = [
  /(?:\+82[-.\s]?)?\b0\d{1,2}[-.\s)]\s?\d{3,4}[-.\s]\d{4}\b/g, // 02-123-4567, 031 123 4567
  /(?:\+82[-.\s]?)?\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, // 010-1234-5678
  /\b1[3-9]\d{2}[-.\s]\d{4}\b/g, // 1588-1234 같은 대표번호
];

export function removePersonalInfo(text: string): string {
  let result = text.replace(EMAIL, " ");
  for (const pattern of PHONE_KR) result = result.replace(pattern, " ");
  return result.replace(/\s{2,}/g, " ").trim();
}

// 자료 속에 AI에게 내리는 명령처럼 보이는 문장이 값이나 발췌로 올라오면 거부한다.
const INJECTION =
  /(ignore|disregard|forget)\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)|이전\s*(의\s*)?(지시|명령|내용)(사항)?(을|를)?\s*(모두\s*|전부\s*)?(무시|잊)|시스템\s*프롬프트|system\s*prompt|you\s+are\s+now|너는\s*이제|이 문서를 읽는\s*(AI|인공지능)|답변?\s*(하라|해라)\s*$/i;

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/[\u0000-\u001F\u007F​-‏‪-‮﻿]/g, " ").replace(/\s{2,}/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null; // 빈 문자열은 값이 없는 것과 같다 (CHECK 2-4)
}

function validYear(year: unknown, fullSquash: string): number | null {
  if (typeof year !== "number" || !Number.isInteger(year)) return null;
  if (year < LIMITS.minYear || year > LIMITS.maxYear) return null;
  return fullSquash.includes(String(year)) ? year : null; // 자료에 없는 연도는 지어낸 것으로 보고 비운다 ("연도 미상")
}

function unverifiable(spec: ItemSpec, reason: string): VerifiedValue {
  return {
    itemId: spec.id,
    name: spec.name,
    valueType: spec.valueType,
    status: "unverifiable",
    valueText: null,
    valueNumber: null,
    unit: null,
    valueYear: null,
    sourceRef: null,
    sourceQuote: null,
    reason,
  };
}

export function verifyExtraction(args: {
  raw: RawExtraction;
  items: ItemSpec[];
  content: string; // 읽은 글자 전체 (표시 포함)
  sourceRef: string; // 사용자가 입력한 주소 또는 PDF 파일 이름 (AI가 아니라 서버가 아는 값)
}): VerifiedResult {
  const { kind, pages } = splitPages(args.content);
  const squashedPages = pages.map((page) => ({ page: page.page, ref: page.ref, squashed: squash(page.text) }));
  const fullSquash = squashedPages.map((page) => page.squashed).join("");

  // AI가 번호 대신 "[1]"이나 항목 이름을 적는 경우가 있어, 번호 → 괄호 제거 → 정확히 같은 항목 이름 순으로 짝을 맞춘다.
  // (짝이 틀려도 아래에서 값을 원문과 대조하므로 지어낸 값이 통과하지는 않는다)
  const byKey = new Map<string, RawItem>();
  for (const item of args.raw.items ?? []) {
    if (!item || typeof item.item_key !== "string") continue;
    const key = item.item_key.trim().replace(/^\[|\]$/g, "").trim();
    if (!byKey.has(key)) byKey.set(key, item);
  }

  const values = args.items.map((spec): VerifiedValue => {
    const raw = byKey.get(spec.key) ?? byKey.get(spec.name.trim());
    if (!raw) return unverifiable(spec, "AI 답변에 이 항목이 없음");
    if (!raw.found) return unverifiable(spec, "자료에서 찾지 못함");

    // 1. 원문 발췌: 있어야 하고, 너무 짧거나 길면 안 된다
    const quote = trimOrNull(raw.quote);
    if (!quote) return unverifiable(spec, "출처(원문 발췌)가 없음");
    const quoteSquash = squash(quote);
    if (quoteSquash.length < LIMITS.minQuoteChars) return unverifiable(spec, "원문 발췌가 너무 짧음");
    if (quote.length > LIMITS.maxQuoteChars) return unverifiable(spec, "원문 발췌가 너무 김");

    // 2. 원문 발췌가 읽어 온 글자 안에 실제로 있는지 대조하고, 몇 쪽인지는 서버가 정한다 (AI가 말한 쪽은 믿지 않는다)
    const where = squashedPages.find((page) => page.squashed.includes(quoteSquash));
    if (!where) return unverifiable(spec, "원문 발췌가 자료에서 확인되지 않음");

    // 3. 값 검사
    let valueText: string | null = null;
    let valueNumber: number | null = null;
    let unit: string | null = null;

    if (spec.valueType === "number") {
      if (typeof raw.value_number !== "number" || !Number.isFinite(raw.value_number)) return unverifiable(spec, "숫자 값이 없음");
      // 더 큰 숫자의 일부로 우연히 같은 경우(1995 속의 95)는 인정하지 않는다
      if (!extractNumbers(quote).some((n) => Math.abs(n - (raw.value_number as number)) < 1e-9)) {
        return unverifiable(spec, "숫자가 원문 발췌에서 확인되지 않음");
      }
      valueNumber = raw.value_number;
      const rawUnit = trimOrNull(raw.unit);
      unit = rawUnit && rawUnit.length <= LIMITS.maxUnitChars ? rawUnit : null;
    } else {
      const text = trimOrNull(raw.value_text);
      if (!text) return unverifiable(spec, "값이 비어 있음");
      if (text.length > LIMITS.maxValueTextChars) return unverifiable(spec, "값이 너무 김");
      // 글 값도 원문 발췌에서 그대로 가져온 부분이어야 한다 (자료 속 지시문이 값으로 둔갑하는 것을 막는다)
      if (!quoteSquash.includes(squash(text))) return unverifiable(spec, "값이 원문 발췌에 그대로 있지 않음");
      valueText = text;
    }

    // 4. 자료 속 지시문처럼 보이는 문장은 거부
    if (INJECTION.test(quote) || (valueText && INJECTION.test(valueText))) {
      return unverifiable(spec, "자료 속 지시문으로 보여 제외함");
    }

    // 5. 원문 대조가 끝난 뒤에 개인정보 모양을 지운다
    const cleanedQuote = trimOrNull(removePersonalInfo(quote));
    const cleanedText = valueText === null ? null : trimOrNull(removePersonalInfo(valueText));
    if (!cleanedQuote || (valueText !== null && !cleanedText)) return unverifiable(spec, "개인정보 제거 후 남은 내용이 없음");

    return {
      itemId: spec.id,
      name: spec.name,
      valueType: spec.valueType,
      status: "confirmed",
      valueText: cleanedText,
      valueNumber,
      unit,
      valueYear: validYear(raw.value_year, fullSquash),
      // 출처는 AI가 아니라 서버가 채운다. PDF는 서버가 찾은 쪽 번호를 붙인다.
      sourceRef: where.ref ?? (kind === "pdf" && where.page !== null ? `${args.sourceRef}, ${where.page}쪽` : args.sourceRef),
      sourceQuote: cleanedQuote,
      reason: null,
    };
  });

  return { baseYear: validYear(args.raw.base_year, fullSquash), values };
}
