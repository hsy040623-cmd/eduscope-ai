import "server-only";

import { pickLinksWithAi } from "@/lib/ai-links";
import { splitPages } from "@/lib/extraction-verify";
import { decodeHtml, extractVisibleText, WebTextError } from "@/lib/html-text";
import { extractLinkCandidates, isFollowableLink, normalizeUrl, MAX_FOLLOWED_PAGES } from "@/lib/page-links";
import { extractPdfText } from "@/lib/pdf-text";
import { FETCH_TIMEOUT_MS, MAX_PDF_PAGES, MAX_PDF_TEXT_CHARS, PDF_TEXT_TIMEOUT_MS } from "@/lib/registration-limits";
import { safeFetchPage } from "@/lib/safe-fetch";

// Design Ref: §3.1 ②-B — 링크 따라가기: 입력한 페이지에서 AI가 고른 같은 사이트 링크(최대 5개, 1단계)를 안전하게 가져와 글자를 합친다.
// Plan SC: 링크 탐색 — 가져오는 주소마다 safeFetchPage의 안전 검사를 다시 거친다. 따라간 페이지 안의 링크는 더 따라가지 않는다.

export type Section = { ref: string; text: string };
export type FollowedPage = { url: string; kind: "web" | "pdf"; sections: number };

export type LinkReadResult = {
  content: string; // `[s.1] 출처\n…[s.2] 출처\n…`
  pageCount: number; // 합친 부분(쪽·페이지) 수
  charCount: number;
  followed: FollowedPage[]; // 입력한 페이지 말고 추가로 읽은 페이지
};

// DB의 쪽수 규칙(institution_texts.page_count 1~300)과 같은 숫자
const MAX_SECTIONS = MAX_PDF_PAGES;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("TIMEOUT")), ms)))]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// 링크 하나를 가져와 글자를 꺼낸다. 하나라도 문제가 있으면 null (그 페이지만 건너뛴다)
async function readOne(url: string, startUrl: string): Promise<{ page: FollowedPage; sections: Section[] } | null> {
  try {
    const fetched = await safeFetchPage(url, FETCH_TIMEOUT_MS);
    // 다른 사이트로 넘겨졌으면(리다이렉트) 같은 사이트가 아니므로 읽지 않는다.
    if (!isFollowableLink(fetched.finalUrl, startUrl)) return null;
    const ref = normalizeUrl(fetched.finalUrl);
    if (!ref) return null;

    if (fetched.kind === "pdf") {
      const header = new TextDecoder("latin1").decode(fetched.bytes.slice(0, 1024));
      if (!header.includes("%PDF-")) return null;
      const pdf = await withTimeout(extractPdfText(fetched.bytes), PDF_TEXT_TIMEOUT_MS);
      const pages = splitPages(pdf.content).pages;
      const sections = pages.map((page) => ({ ref: `${ref}, ${page.page}쪽`, text: page.text }));
      return { page: { url: ref, kind: "pdf", sections: sections.length }, sections };
    }

    const web = extractVisibleText(decodeHtml(fetched.bytes, fetched.charset));
    return { page: { url: ref, kind: "web", sections: 1 }, sections: [{ ref, text: web.content.replace(/^\[web\]\n?/, "") }] };
  } catch (error) {
    if (error instanceof WebTextError) return null; // 본문이 없거나 너무 긴 페이지
    return null; // 접속 실패·시간 초과·PDF 읽기 실패 등: 덤으로 읽는 페이지라서 건너뛴다
  }
}

// 입력한 페이지(startSection)에 AI가 고른 링크의 글자를 덧붙인다. 덧붙일 것이 없으면 null을 돌려주고, 호출한 쪽은 입력한 페이지만으로 계속한다.
export async function readWithFollowedLinks(args: {
  institutionName: string;
  items: Array<{ name: string; description: string | null }>;
  startUrl: string; // 사용자가 입력한 주소 (출처로 표시된다)
  pageUrl: string; // 실제로 읽은 페이지 주소 (링크 상대 경로의 기준)
  html: string;
  title: string;
  startText: string; // 입력한 페이지의 본문 글자 (`[web]` 표시 제외)
}): Promise<LinkReadResult | null> {
  const candidates = extractLinkCandidates(args.html, args.pageUrl);
  if (candidates.length === 0) return null;

  const picks = await pickLinksWithAi({ institutionName: args.institutionName, pageTitle: args.title, items: args.items, candidates });
  if (picks.length === 0) return null;

  // 고른 링크마다 안전 검사를 한 번 더 하고(후보는 이미 걸렀지만 방어를 겹쳐 둔다), 최대 5개를 동시에 가져온다.
  const targets = picks
    .map((index) => candidates[index].url)
    .filter((url) => isFollowableLink(url, args.pageUrl))
    .slice(0, MAX_FOLLOWED_PAGES);
  const results = await Promise.all(targets.map((url) => readOne(url, args.pageUrl)));

  const sections: Section[] = [{ ref: args.startUrl, text: args.startText }];
  let chars = args.startText.length;
  const followed: FollowedPage[] = [];
  const usedRefs = new Set<string>([normalizeUrl(args.startUrl) ?? args.startUrl, normalizeUrl(args.pageUrl) ?? args.pageUrl]);

  // AI가 고른 순서대로, 글자 상한(40만 자)과 부분 수 상한(300)을 넘지 않는 페이지만 넣는다. 넘는 페이지는 통째로 건너뛴다.
  for (const result of results) {
    if (!result || usedRefs.has(result.page.url)) continue;
    const addChars = result.sections.reduce((sum, section) => sum + section.text.length, 0);
    if (addChars === 0 || chars + addChars > MAX_PDF_TEXT_CHARS - 5_000) continue; // 5천 자는 `[s.N] 출처` 줄 몫
    if (sections.length + result.sections.length > MAX_SECTIONS) continue;
    usedRefs.add(result.page.url);
    sections.push(...result.sections);
    chars += addChars;
    followed.push(result.page);
  }
  if (followed.length === 0) return null;

  return { content: composeSections(sections), pageCount: sections.length, charCount: chars, followed };
}

export function composeSections(sections: Section[]): string {
  return sections.map((section, index) => `[s.${index + 1}] ${section.ref}\n${section.text}`).join("\n\n");
}

