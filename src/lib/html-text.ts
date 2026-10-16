import "server-only";

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { MAX_PDF_TEXT_CHARS, MIN_WEB_TEXT_CHARS } from "@/lib/registration-limits";
import { cleanReadText } from "@/lib/text-clean";

// Design Ref: §3.1 ② — 웹페이지 본문 글자 꺼내기: 메뉴·광고·숨긴 글자를 빼고 "화면에 보이는 본문"만 읽는다.
// Plan SC: 작업 12 (CHECK 2-5) — 숨긴 글자로 가짜 값을 끼워 넣는 것을 막는다. 대조(④)는 이 글자만 대상으로 한다.
// 한계: 외부 스타일시트(CSS 파일)는 해석하지 않는다. 그래서 CSS 파일로만 숨긴 글자는 걸러지지 않는다.

export type WebTextErrorCode = "NO_TEXT" | "TOO_LONG";

export class WebTextError extends Error {
  constructor(
    public readonly code: WebTextErrorCode,
    public readonly detail?: { charCount?: number },
  ) {
    super(code);
  }
}

export type WebText = {
  charCount: number;
  content: string; // `[web]\n…` 형태. 출처 표시는 서버가 붙인 것만 쓴다.
};

// 눈에 안 보이게 만드는 대표적인 인라인 스타일을 찾는다.
// 정규식 하나로 `style` 전체를 되짚어 가며 찾으면, 같은 선언을 수십만 번 반복한 페이지(2MB)에서 시간이 제곱으로 늘어나 서버가 몇 분 멈춘다. (CHECK P1-3)
// 그래서 `;`로 선언을 하나씩 나눠 각각 짧은 검사만 한다. 걸리는 시간은 style 길이에 비례한다.
const MAX_STYLE_LENGTH = 4000; // 이보다 긴 style은 정상 페이지에서 거의 없다. 검사하지 않고 숨긴 것으로 본다. (본문에 끼워 넣을 수 없게 하는 쪽이 안전하다)

const ZERO = /^0(\.0+)?(px|pt|em|rem|%)?$/;
const NEGATIVE_FAR = /^-\s*\d{3,}/; // 화면 밖으로 멀리 밀어낸 위치·들여쓰기 (-999px 등)

export function isHiddenStyle(style: string): boolean {
  if (style.length > MAX_STYLE_LENGTH) return true;

  let zeroSize = false; // width 또는 height가 0
  let overflowHidden = false;
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).replace(/!\s*important/i, "").trim().toLowerCase();

    if (name === "display" && value === "none") return true;
    if (name === "visibility" && (value === "hidden" || value === "collapse")) return true;
    if (name === "opacity" && ZERO.test(value)) return true;
    if (name === "font-size" && ZERO.test(value)) return true;
    if ((name === "left" || name === "right" || name === "top" || name === "bottom") && NEGATIVE_FAR.test(value)) return true;
    if (name === "text-indent" && NEGATIVE_FAR.test(value)) return true;
    if (name === "clip" && /^rect\(\s*0/.test(value)) return true;
    if (name === "clip-path" && /^inset\(\s*(50|100)%/.test(value)) return true;
    if ((name === "width" || name === "height") && (value === "0" || value === "0px")) zeroSize = true;
    if (name === "overflow" && value === "hidden") overflowHidden = true;
    if (zeroSize && overflowHidden) return true; // 폭·높이가 0이고 넘치는 부분을 잘라 내는 조합 (순서 상관없음)
  }
  return false;
}

// 글자를 숨길 때 흔히 쓰는 클래스 이름. (이름이 정확히 같을 때만. `overflow-hidden` 같은 것은 해당 없음)
const HIDDEN_CLASS_TOKENS = new Set([
  "hidden", "hide", "sr-only", "screen-reader-text", "visually-hidden", "visuallyhidden", "d-none", "invisible", "offscreen", "display-none",
]);

// 메뉴·광고·알림창 같은 본문이 아닌 영역의 흔한 이름 (한국 공공기관 사이트의 gnb·lnb 포함)
const NOISE_NAME = /(^|[\s_-])(gnb|lnb|snb|breadcrumbs?|sitemap|skip[_-]?(nav|menu|navigation)?|quick[_-]?menu|cookie|popup|advert|banner)($|[\s_-])/i;

const BLOCK_TAGS = "p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, table, ul, ol, dl, dt, dd, blockquote, pre, figure, figcaption, address";

// 응답 헤더나 `<meta>`에 적힌 글자 인코딩으로 바이트를 글자로 바꾼다. (예: 옛 공공기관 사이트의 EUC-KR)
export function decodeHtml(bytes: Uint8Array, headerCharset: string | null): string {
  let label = headerCharset;
  if (!label) {
    const head = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
    label =
      /<meta[^>]+charset\s*=\s*["']?\s*([\w\-:.]+)/i.exec(head)?.[1] ??
      /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w\-:.]+)/i.exec(head)?.[1] ??
      "utf-8";
  }
  try {
    return new TextDecoder(label.trim().toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function isHiddenElement($el: cheerio.Cheerio<AnyNode>): boolean {
  const style = $el.attr("style");
  if (style && isHiddenStyle(style)) return true;
  const classes = ($el.attr("class") ?? "").split(/\s+/).filter(Boolean);
  return classes.some((token) => HIDDEN_CLASS_TOKENS.has(token.toLowerCase()));
}

export function extractVisibleText(html: string): WebText {
  const $ = cheerio.load(html);
  const title = cleanReadText($("title").first().text()).slice(0, 150);

  // 1) 글자가 아닌 것, 화면에 안 그려지는 것
  $("script, style, noscript, template, head, svg, canvas, iframe, object, embed, link, meta, input, select, option, textarea, button").remove();
  $("[hidden], [aria-hidden='true'], dialog:not([open])").remove();

  // 2) 스타일·클래스로 숨긴 것, 메뉴·광고 영역
  $("*").each((_, element) => {
    const $el = $(element);
    if (isHiddenElement($el)) {
      $el.remove();
      return;
    }
    const nameText = `${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`;
    if (nameText.trim() && NOISE_NAME.test(nameText)) $el.remove();
  });
  $("nav, footer, aside, [role='navigation'], [role='contentinfo'], [role='complementary'], [role='banner']").remove();
  // 사이트 머리글만 뺀다. 본문(main·article) 안의 header(글 제목 등)는 둔다.
  $("header").each((_, element) => {
    if ($(element).closest("main, article, [role='main']").length === 0) $(element).remove();
  });

  // 3) 줄바꿈·표 칸 구분을 글자로 바꿔 둔다.
  $("br").replaceWith("\n");
  $("td, th").append(" | ");
  $(BLOCK_TAGS).append("\n").prepend("\n");

  // 4) 본문 영역 고르기: main·article이 있으면 그 안만, 글자가 너무 적으면 body 전체
  const visibleLength = (text: string) => text.replace(/\s/g, "").length;
  let rootText = "";
  for (const selector of ["main", "[role='main']", "article"]) {
    const text = $(selector).first().text();
    if (visibleLength(text) >= 200) {
      rootText = text;
      break;
    }
  }
  if (!rootText) rootText = $("body").text() || $.root().text();

  const body = cleanReadText(rootText).replace(/ \|\s*(?=\n|$)/g, "").replace(/\|\s*\|/g, "|");
  const text = title ? `제목: ${title}\n${body}` : body;

  const visible = visibleLength(body);
  if (visible < MIN_WEB_TEXT_CHARS) throw new WebTextError("NO_TEXT", { charCount: visible });
  if (text.length > MAX_PDF_TEXT_CHARS) throw new WebTextError("TOO_LONG", { charCount: text.length });

  return { charCount: text.length, content: `[web]\n${text}` };
}

// 본문이 비어 있을 때만 쓴다: 다른 주소로 넘기는 아주 단순한 페이지의 목적지를 찾는다.
//  - `<meta http-equiv="refresh" content="0;url=…">`
//  - 스크립트 한 줄의 `location.href = "…"`, `location.replace("…")`
// 그 밖의 복잡한 자바스크립트는 해석하지 않는다. (서버에서 자바스크립트를 실행하지 않는다)
// 찾은 주소는 호출한 쪽이 처음부터 다시 안전 검사를 거쳐서만 따라간다.
export function findClientRedirect(html: string): string | null {
  const $ = cheerio.load(html);

  const refresh = $("meta[http-equiv]")
    .filter((_, element) => ($(element).attr("http-equiv") ?? "").toLowerCase() === "refresh")
    .first()
    .attr("content");
  const fromMeta = refresh ? /url\s*=\s*['"]?([^'";\s]+)/i.exec(refresh)?.[1] : undefined;
  if (fromMeta) return fromMeta;

  const scripts = $("script")
    .map((_, element) => $(element).html() ?? "")
    .get()
    .join("\n");
  const fromScript =
    /(?:window\.|document\.|self\.|top\.)?location(?:\.href)?\s*=\s*["']([^"'\s]+)["']/i.exec(scripts)?.[1] ??
    /location\.(?:replace|assign)\(\s*["']([^"'\s]+)["']\s*\)/i.exec(scripts)?.[1];
  return fromScript ?? null;
}
