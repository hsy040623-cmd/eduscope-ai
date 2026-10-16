import "server-only";

import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { isPublicAddress } from "@/lib/ip-guard";
import { FETCH_TIMEOUT_MS, MAX_HTML_BYTES, MAX_PDF_BYTES, MAX_REDIRECTS } from "@/lib/registration-limits";

// Design Ref: §3.1 ② URL 안전 규칙 — 사용자가 입력한 주소로 서버가 접속하는 유일한 통로다. 다른 곳에서 직접 접속하지 않는다.
// Plan SC: 작업 12 (CHECK 2-1·2-7·2-9·2-10)
//  1) http·https, 80·443 포트만
//  2) 주소를 한 번만 조회해 모든 IP가 공인 주소인지 검사하고, 접속은 "검사한 그 IP"로만 한다 (DNS 재바인딩 방어)
//  3) 다른 주소로 넘겨지면(리다이렉트) 직접 따라가며 매번 1)~2)를 다시 검사한다 (최대 3번)
//  4) 웹페이지 2MB, PDF 20MB는 신고된 크기가 아니라 실제로 받은 바이트로 센다. 전체 15초.

export type SafeFetchErrorCode =
  | "NOT_ALLOWED" // 허용되지 않는 주소(내부 주소, 이상한 포트 등)와 이름 조회 실패. 내부 구조를 알려 주지 않도록 하나로 묶는다.
  | "CONNECT_FAILED"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "UNSUPPORTED_TYPE"
  | "TOO_LARGE"
  | "TOO_MANY_REDIRECTS";

export class SafeFetchError extends Error {
  constructor(
    public readonly code: SafeFetchErrorCode,
    public readonly status?: number,
  ) {
    super(code);
  }
}

export type FetchedPage = {
  finalUrl: string;
  kind: "html" | "pdf";
  charset: string | null; // 응답 헤더에 적힌 글자 인코딩 (HTML만)
  bytes: Uint8Array;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function parseAllowedUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafeFetchError("NOT_ALLOWED");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeFetchError("NOT_ALLOWED");
  if (url.username || url.password) throw new SafeFetchError("NOT_ALLOWED");
  // 포트는 비워 두거나 80·443만 허용한다. (내부 서비스 포트 탐색 방지)
  if (url.port !== "" && url.port !== "80" && url.port !== "443") throw new SafeFetchError("NOT_ALLOWED");
  const host = url.hostname.toLowerCase();
  if (host === "" || host === "localhost" || host.endsWith(".localhost")) throw new SafeFetchError("NOT_ALLOWED");
  return url;
}

function remainingMs(deadline: number): number {
  const left = deadline - Date.now();
  if (left <= 0) throw new SafeFetchError("TIMEOUT");
  return left;
}

async function withDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SafeFetchError("TIMEOUT")), remainingMs(deadline));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// 이름을 IP로 바꾸고, 나온 모든 IP가 공인 주소일 때만 그중 하나를 돌려준다. 하나라도 내부 주소면 거부한다.
async function resolvePublicAddress(url: URL, deadline: number): Promise<{ address: string; family: 4 | 6 }> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const literal = isIP(host);
  if (literal) {
    if (!isPublicAddress(host)) throw new SafeFetchError("NOT_ALLOWED");
    return { address: host, family: literal as 4 | 6 };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await withDeadline(dns.lookup(host, { all: true, verbatim: true }), deadline);
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    throw new SafeFetchError("NOT_ALLOWED"); // 없는 이름도 내부 주소와 같은 문구로 알린다.
  }
  if (records.length === 0 || records.some((record) => !isPublicAddress(record.address))) {
    throw new SafeFetchError("NOT_ALLOWED");
  }
  const chosen = records.find((record) => record.family === 4) ?? records[0];
  return { address: chosen.address, family: chosen.family as 4 | 6 };
}

type OnceResult =
  | { type: "redirect"; location: string }
  | { type: "page"; kind: "html" | "pdf"; charset: string | null; bytes: Uint8Array };

// 한 번 접속한다. 이름 조회를 다시 하지 않고, 위에서 검사한 IP로만 연결한다.
function requestOnce(url: URL, target: { address: string; family: 4 | 6 }, deadline: number): Promise<OnceResult> {
  return new Promise<OnceResult>((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const timer = setTimeout(() => request.destroy(new SafeFetchError("TIMEOUT")), remainingMs(deadline));
    const finish = (action: () => void) => {
      clearTimeout(timer);
      action();
    };

    const request = lib.request(
      {
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent: false, // 연결을 재사용하지 않는다. (다른 주소로 가는 연결에 섞이지 않게)
        headers: {
          "User-Agent": "EduScopeReader/1.0",
          Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9",
          "Accept-Encoding": "identity", // 압축 폭탄을 막으려고 압축하지 않은 응답만 받는다.
        },
        // 이름 조회 결과를 우리가 검사한 IP로 고정한다. (조회가 다시 일어나도 다른 IP로 갈 수 없다)
        lookup: (_hostname, options, callback) => {
          if (options && typeof options === "object" && "all" in options && options.all) {
            (callback as unknown as (error: null, addresses: Array<{ address: string; family: number }>) => void)(null, [
              { address: target.address, family: target.family },
            ]);
          } else {
            callback(null, target.address, target.family);
          }
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;

        if (REDIRECT_STATUSES.has(status)) {
          const location = response.headers.location;
          response.resume();
          if (!location) return finish(() => reject(new SafeFetchError("HTTP_ERROR", status)));
          return finish(() => resolve({ type: "redirect", location }));
        }
        if (status < 200 || status >= 300 || status === 204) {
          response.resume();
          return finish(() => reject(new SafeFetchError("HTTP_ERROR", status)));
        }

        const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
        const encoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
        const kind = contentType.includes("application/pdf")
          ? "pdf"
          : contentType.includes("text/html") || contentType.includes("application/xhtml+xml")
            ? "html"
            : null;
        if (!kind || (encoding !== "identity" && encoding !== "")) {
          response.resume();
          return finish(() => reject(new SafeFetchError("UNSUPPORTED_TYPE")));
        }

        const limit = kind === "pdf" ? MAX_PDF_BYTES : MAX_HTML_BYTES;
        const declared = Number(response.headers["content-length"]);
        if (Number.isFinite(declared) && declared > limit) {
          response.resume();
          return finish(() => reject(new SafeFetchError("TOO_LARGE")));
        }

        const charset = /charset\s*=\s*"?([\w\-:.]+)/i.exec(contentType)?.[1] ?? null;
        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > limit) {
            // 신고한 크기와 상관없이, 실제로 받은 양이 한도를 넘으면 바로 끊는다.
            request.destroy(new SafeFetchError("TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => finish(() => resolve({ type: "page", kind, charset, bytes: new Uint8Array(Buffer.concat(chunks)) })));
        response.on("error", (error) => finish(() => reject(error)));
      },
    );

    request.on("error", (error) => finish(() => reject(error)));
    request.end();
  });
}

function toSafeFetchError(error: unknown): SafeFetchError {
  if (error instanceof SafeFetchError) return error;
  return new SafeFetchError("CONNECT_FAILED");
}

// timeoutMs: 기본은 15초. 시간 제한이 실제로 동작하는지 시험할 때만 줄여서 쓴다.
export async function safeFetchPage(inputUrl: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<FetchedPage> {
  const deadline = Date.now() + timeoutMs;
  let url = parseAllowedUrl(inputUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    try {
      const target = await resolvePublicAddress(url, deadline);
      const result = await requestOnce(url, target, deadline);

      if (result.type === "page") {
        return { finalUrl: url.href, kind: result.kind, charset: result.charset, bytes: result.bytes };
      }
      // 넘겨진 주소도 처음부터 다시 검사한다. (공개 주소가 내부 주소로 넘기는 수법 방어)
      url = parseAllowedUrl(new URL(result.location, url).href);
    } catch (error) {
      throw toSafeFetchError(error);
    }
  }
  throw new SafeFetchError("TOO_MANY_REDIRECTS");
}

// 사용자에게 보여 줄 안내 문장. 내부 주소 거부와 이름 조회 실패는 같은 문구로 알려 내부 구조를 드러내지 않는다.
export function describeSafeFetchError(error: SafeFetchError): string {
  switch (error.code) {
    case "NOT_ALLOWED":
      return "이 주소는 읽을 수 없습니다. 인터넷에 공개된 http:// 또는 https:// 주소인지 확인해 주세요.";
    case "CONNECT_FAILED":
      return "페이지에 접속하지 못했습니다. 주소를 확인하거나 잠시 뒤 다시 시도해 주세요.";
    case "TIMEOUT":
      return "페이지를 읽는 데 시간이 너무 오래 걸립니다. (15초 제한)";
    case "HTTP_ERROR":
      if (error.status === 401 || error.status === 403) {
        return "이 페이지는 접근이 막혀 있습니다. 로그인이 필요하거나 자동 접속을 막았을 수 있어요. 교육계획서를 PDF로 올려 주세요.";
      }
      if (error.status === 404 || error.status === 410) return "페이지를 찾을 수 없습니다. 주소를 확인해 주세요.";
      return `페이지가 오류를 돌려주었습니다. (HTTP ${error.status ?? "?"})`;
    case "UNSUPPORTED_TYPE":
      return "웹페이지(HTML)나 PDF 파일 주소만 읽을 수 있습니다.";
    case "TOO_LARGE":
      return "페이지가 너무 커서 읽을 수 없습니다. (웹페이지 2MB, PDF 20MB 이하)";
    case "TOO_MANY_REDIRECTS":
      return "주소가 너무 여러 번 다른 곳으로 넘겨집니다. 자동 접속을 막는 사이트일 수 있어요. 최종 페이지의 주소를 직접 입력하거나 교육계획서를 PDF로 올려 주세요.";
  }
}
