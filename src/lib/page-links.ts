import * as cheerio from "cheerio";
import { isHiddenElement } from "@/lib/html-text";
import { MAX_URL_LENGTH } from "@/lib/registration-limits";
import { cleanReadText } from "@/lib/text-clean";

// Design Ref: §3.1 ②-B — 같은 사이트의 링크 고르기: 입력한 페이지 안의 링크 중 "따라가도 되는 것"만 후보로 뽑는다.
// Plan SC: 링크 탐색(1단계·같은 사이트·최대 5페이지) — 이 파일은 AI와 무관한 순수 규칙이라 단독으로 시험할 수 있다.
// 링크 글자와 주소는 외부 사람이 쓴 글이므로 AI에게 명령이 아니라 "자료"로만 준다. AI는 번호만 답하고, 접속 주소는 여기서 만든 후보 목록에서만 나온다.

export type LinkCandidate = { url: string; text: string };

export const MAX_LINK_CANDIDATES = 200; // AI에 보여 주는 후보 수 상한
export const MAX_FOLLOWED_PAGES = 5; // 따라가는 페이지 수 상한 (입력한 페이지 제외)
const MAX_ANCHORS_SCANNED = 3000; // 링크가 아주 많은 페이지에서 시간을 아끼기 위한 상한
const MAX_LINK_TEXT = 60;

// 글 읽기에 쓸 수 없는 파일 형식. (PDF는 교육계획서일 수 있어 허용한다)
const SKIP_EXTENSION = /\.(?:jpe?g|png|gif|svg|webp|bmp|ico|zip|7z|rar|hwp|hwpx|docx?|xlsx?|pptx?|mp[34]|avi|mov|wmv|exe|apk|css|js|json|xml)(?:$|[?#])/i;

// 같은 사이트인지 보는 기준: 호스트 이름이 같다. (앞의 www.만 같은 것으로 본다)
export function siteKey(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// 같은 페이지를 가리키는 주소끼리 같게 만든다: # 뒷부분 제거, 끝의 / 제거
export function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    // 서버가 주소 뒤에 붙이는 접속 번호(;jsessionid=…)는 출처에 남기지 않는다. (같은 페이지가 접속할 때마다 다른 주소로 보이는 것도 막는다)
    parsed.pathname = parsed.pathname.replace(/;jsessionid=[^/?#]*/gi, "");
    const href = parsed.href;
    return href.endsWith("/") && parsed.pathname !== "/" ? href.slice(0, -1) : href;
  } catch {
    return null;
  }
}

// 따라가도 되는 링크인가: http·https, 계정 정보 없음, 길이 한도, 같은 사이트, 글을 읽을 수 없는 파일 형식 아님
export function isFollowableLink(target: string, startUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.href.length > MAX_URL_LENGTH) return false; // 출처 칸에 그대로 저장되므로 입력 주소와 같은 길이 한도를 쓴다
  if (siteKey(target) === null || siteKey(target) !== siteKey(startUrl)) return false;
  if (SKIP_EXTENSION.test(parsed.pathname + parsed.search)) return false;
  return true;
}

// 페이지(HTML)에서 후보 링크를 뽑는다. 메뉴(nav 등)에 있는 링크도 포함한다. 숨겨 둔 링크는 뺀다.
export function extractLinkCandidates(html: string, pageUrl: string): LinkCandidate[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, template").remove();
  const startKey = normalizeUrl(pageUrl);

  const seen = new Set<string>(startKey ? [startKey] : []);
  const result: LinkCandidate[] = [];
  let scanned = 0;

  for (const element of $("a[href]").toArray()) {
    if (result.length >= MAX_LINK_CANDIDATES || scanned >= MAX_ANCHORS_SCANNED) break;
    scanned += 1;
    const $a = $(element);

    // 자기 자신이나 윗 요소가 숨겨져 있으면 사람 눈에 안 보이는 링크다. (AI를 속이려는 숨은 링크 방어)
    const hidden = [element, ...$a.parents().toArray()].some((node) => {
      const $node = $(node);
      return $node.is("[hidden], [aria-hidden='true']") || isHiddenElement($node);
    });
    if (hidden) continue;

    const href = ($a.attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^(?:javascript|mailto|tel|sms|data):/i.test(href)) continue;

    let absolute: string;
    try {
      absolute = new URL(href, pageUrl).href;
    } catch {
      continue;
    }
    if (!isFollowableLink(absolute, pageUrl)) continue;
    const key = normalizeUrl(absolute);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const label = cleanReadText($a.text() || $a.attr("title") || $a.find("img[alt]").first().attr("alt") || "")
      .replace(/\s+/g, " ")
      .slice(0, MAX_LINK_TEXT);
    result.push({ url: key, text: label });
  }
  return result;
}
