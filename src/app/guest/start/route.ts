import { randomBytes, randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { getClientIp } from "@/lib/client-ip";
import { serverEnv } from "@/lib/env";
import { GUEST_COOKIE, guestMarkerOptions, hardenCookieOptions } from "@/lib/supabase/cookie-options";

// Design Ref: §3.3 — 게스트 시작: 로그인 없이 바로 쓸 수 있게, 임시 계정(user_metadata.guest = true)을 만들어 로그인 상태로 보낸다.
// 게스트의 로그인 쿠키는 세션 쿠키라서 브라우저를 닫으면 사라지고, 24시간이 지난 게스트 자료는 DB 함수(cleanup_expired_guests)가 지운다.
// 이 주소는 세션을 "만드는" 유일한 곳이라 requireUser()를 쓰지 않는다. (프로젝트 규칙의 예외. 아래에서 이미 로그인한 사람은 그대로 돌려보낸다)
// 남용 방지: 하루 게스트 계정 수는 DB 규칙(guard_guest_signups, 300개)이 막고, 링크 미리 불러오기(prefetch)로는 만들지 않는다. (proxy.ts)

// 돌아갈 주소는 이 사이트 안의 경로만 허용한다. (열린 리다이렉트 방지)
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.startsWith("/guest")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));
  const clientIp = await getClientIp();

  const supabase = createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    ...(clientIp ? { global: { headers: { "sb-forwarded-for": clientIp } } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, hardenCookieOptions(options, true));
      },
    },
  });

  // 이미 로그인(또는 게스트)한 사람은 계정을 새로 만들지 않는다.
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user) return response;

  const { data, error } = await supabase.auth.signUp({
    email: `guest-${randomUUID()}@guest.example.com`,
    password: randomBytes(24).toString("base64url"),
    options: { data: { guest: true } },
  });
  if (error || !data.session) {
    // 하루 게스트 한도(300개)에 닿았거나 Supabase 요청 제한에 걸린 경우 등. 홈으로 보내 안내한다.
    return NextResponse.redirect(new URL("/?guest=unavailable", request.url));
  }

  response.cookies.set(GUEST_COOKIE, "1", guestMarkerOptions());
  // 오래된 게스트 자료 정리. 실패해도 게스트 시작에는 영향이 없다.
  await supabase.rpc("cleanup_expired_guests");
  return response;
}
