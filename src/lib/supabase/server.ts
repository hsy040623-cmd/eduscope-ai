import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { getClientIp } from "@/lib/client-ip";
import { serverEnv } from "@/lib/env";
import { GUEST_COOKIE, hardenCookieOptions } from "@/lib/supabase/cookie-options";

// Design Ref: §3.3·§5.2 — 가입·로그인은 서버에서만 처리하고, 로그인 상태는 쿠키에 저장한다. 브라우저에는 Supabase 키를 내보내지 않는다.
// Plan SC: 작업 5 — 회원가입에 쓰는 서버용 Supabase 연결 (작업 6의 로그인도 같은 연결을 쓴다)
// forwardClientIp: 로그인·가입처럼 Supabase 인증 서버에 요청할 때 접속자 IP를 `sb-forwarded-for` 헤더로 함께 넘긴다.
// (Supabase 인증 설정을 켜기 전에는 무시된다. 켜면 로그인·가입 제한이 서버 IP 하나가 아니라 접속자별로 걸린다. CHECK P1-2)
// persistent: 로그인·가입처럼 "계속 보관되는 계정"의 쿠키를 만들 때 true. (게스트 표시 쿠키가 남아 있어도 세션 쿠키로 만들지 않는다)
export async function createSupabaseServerClient(options?: { forwardClientIp?: boolean; persistent?: boolean }) {
  const cookieStore = await cookies();
  const clientIp = options?.forwardClientIp ? await getClientIp() : null;
  // 게스트는 브라우저를 닫으면 사라지는 세션 쿠키로 로그인 상태를 유지한다.
  const sessionOnly = !options?.persistent && cookieStore.has(GUEST_COOKIE);

  return createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    ...(clientIp ? { global: { headers: { "sb-forwarded-for": clientIp } } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenCookieOptions(options, sessionOnly));
          }
        } catch {
          // 화면(서버 컴포넌트)에서 부르면 쿠키를 쓸 수 없다. 쿠키를 쓰는 일은 서버 동작(Server Action)에서만 한다.
        }
      },
    },
  });
}
