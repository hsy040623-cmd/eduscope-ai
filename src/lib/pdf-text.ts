import "server-only";

import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { cleanReadText } from "@/lib/text-clean";
import {
  MAX_PDF_PAGES,
  MAX_PDF_TEXT_CHARS,
  MIN_PDF_TEXT_CHARS,
  MIN_PDF_TEXT_CHARS_PER_PAGE,
} from "@/lib/registration-limits";

// Design Ref: §3.1 ② — PDF에서 글자 꺼내기: 300쪽 이하인지 확인한 뒤 쪽마다 `[p.N]` 표시를 붙여 꺼낸다.
// Plan SC: 작업 11 — PDF 글자 읽기 (글자를 읽을 수 없는 PDF는 알리고 거부)

// 글자 변환표(CMap) 폴더. 이게 없으면 한국어 PDF에서 한글이 빠지고 숫자·기호만 읽힌다. (src/assets/pdf-cmaps/README.md 참고)
// 경로 끝의 구분 문자(/)가 있어야 pdf.js가 파일을 찾는다.
const CMAP_DIR = path.join(process.cwd(), "src", "assets", "pdf-cmaps") + path.sep;

export type PdfTextErrorCode = "UNREADABLE" | "TOO_MANY_PAGES" | "NO_TEXT" | "TOO_LONG";

export class PdfTextError extends Error {
  constructor(
    public readonly code: PdfTextErrorCode,
    public readonly detail?: { pageCount?: number; charCount?: number },
  ) {
    super(code);
  }
}

export type PdfText = {
  pageCount: number;
  charCount: number; // 쪽 표시를 뺀 글자 수 (공백 포함)
  content: string; // `[p.1]\n…\n\n[p.2]\n…` 형태
};

export async function extractPdfText(bytes: Uint8Array): Promise<PdfText> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // 설치된 pdf.js(unpdf 1.8)에는 글꼴 처리로 코드가 실행되는 옵션(isEvalSupported)과 그 경로가 이미 없다. unpdf를 올릴 때 다시 확인한다.
    pdf = await getDocumentProxy(bytes, { cMapUrl: CMAP_DIR, cMapPacked: true });
  } catch {
    throw new PdfTextError("UNREADABLE");
  }

  try {
    const pageCount = pdf.numPages;
    // 글자를 꺼내기 전에 쪽수부터 확인한다. 쪽이 너무 많은 파일은 열어서 읽지 않는다.
    if (pageCount > MAX_PDF_PAGES) throw new PdfTextError("TOO_MANY_PAGES", { pageCount });

    let pages: string[];
    try {
      pages = (await extractText(pdf, { mergePages: false })).text.map(cleanReadText);
    } catch {
      throw new PdfTextError("UNREADABLE");
    }

    const charCount = pages.reduce((sum, page) => sum + page.length, 0);
    const visibleChars = pages.reduce((sum, page) => sum + page.replace(/\s/g, "").length, 0);

    // 스캔한 이미지로 된 PDF처럼 글자가 거의 없으면 거부한다. (이미지 속 글자 인식은 이번 실습에서 제외)
    if (visibleChars < MIN_PDF_TEXT_CHARS || visibleChars / pageCount < MIN_PDF_TEXT_CHARS_PER_PAGE) {
      throw new PdfTextError("NO_TEXT", { pageCount, charCount: visibleChars });
    }
    if (charCount > MAX_PDF_TEXT_CHARS) throw new PdfTextError("TOO_LONG", { pageCount, charCount });

    const content = pages.map((text, index) => `[p.${index + 1}]\n${text}`).join("\n\n");
    return { pageCount, charCount, content };
  } finally {
    await pdf.cleanup();
  }
}
