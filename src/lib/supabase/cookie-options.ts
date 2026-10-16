// Design Ref: §3.3·§7 — 로그인 쿠키는 서버만 읽고 쓰므로, 브라우저의 스크립트가 읽지 못하게(httpOnly) 만든다.
// Plan SC: 작업 6 — 로그인 쿠키 보호
type CookieOptions = Record<string, unknown>;

export function hardenCookieOptions(options: CookieOptions | undefined): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    // 배포(Vercel, https)에서만 secure를 켠다. 내 컴퓨터(http://localhost)에서는 켜면 일부 브라우저에서 로그인이 안 된다.
    secure: process.env.VERCEL === "1",
  };
}
