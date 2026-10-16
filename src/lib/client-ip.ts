import "server-only";

import { isIP } from "node:net";
import { headers } from "next/headers";

// Design Ref: §3.3·§7 — 접속한 사람의 IP. 로그인·가입을 서버가 대신 처리하면 Supabase는 "서버 IP 하나"만 보게 되어
// 사용자 전체가 같은 제한 한도를 나눠 쓴다. 접속자 IP를 `sb-forwarded-for` 헤더로 넘겨 주면(Supabase 인증 설정에서 켜야 함) 접속자별로 제한된다. (CHECK P1-2)
// Vercel은 `x-vercel-forwarded-for`·`x-real-ip`·`x-forwarded-for`를 접속 IP로 덮어써서 보내므로 브라우저가 속일 수 없다.
// 형식이 IP가 아니면 쓰지 않는다. (헤더에 엉뚱한 글자를 넣는 것을 막는다)
export async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const candidates = [
    requestHeaders.get("x-vercel-forwarded-for"),
    requestHeaders.get("x-real-ip"),
    requestHeaders.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isIP(value) !== 0) return value;
  }
  return null;
}
