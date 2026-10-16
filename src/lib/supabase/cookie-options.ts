// Design Ref: §3.3·§7 — 로그인 쿠키는 서버만 읽고 쓰므로, 브라우저의 스크립트가 읽지 못하게(httpOnly) 만든다.
// Plan SC: 작업 6 — 로그인 쿠키 보호
type CookieOptions = Record<string, unknown>;

// 게스트(로그인 없이 시작) 표시 쿠키. 게스트의 로그인 쿠키는 "브라우저를 닫으면 사라지는" 세션 쿠키로 만든다.
export const GUEST_COOKIE = "eduscope_guest";

// sessionOnly: true면 만료 시각(maxAge·expires)을 지워 세션 쿠키로 만든다. 브라우저를 닫으면 쿠키가 사라져 게스트 자료에 다시 들어갈 수 없다.
export function hardenCookieOptions(options: CookieOptions | undefined, sessionOnly = false): CookieOptions {
  const hardened: CookieOptions = {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    // 배포(Vercel, https)에서만 secure를 켠다. 내 컴퓨터(http://localhost)에서는 켜면 일부 브라우저에서 로그인이 안 된다.
    secure: process.env.VERCEL === "1",
  };
  if (sessionOnly) {
    delete hardened.maxAge;
    delete hardened.expires;
  }
  return hardened;
}

// 게스트 표시 쿠키 자체의 설정 (세션 쿠키)
export function guestMarkerOptions(): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: process.env.VERCEL === "1", path: "/" };
}
