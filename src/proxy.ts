import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { GUEST_COOKIE, hardenCookieOptions } from "@/lib/supabase/cookie-options";

// Design Ref: §2.1·§5.3 — 홈과 게스트 시작 주소는 로그인 없이 볼 수 있다. 그 밖의 화면에 로그인 없이 오면 "게스트로 시작"으로 보낸다.
// (게스트 = 로그인 없이 시작한 임시 계정. 브라우저를 닫으면 사라진다.) 로그인한 일반 사용자가 로그인·가입 화면에 오면 홈으로 보낸다. 게스트는 로그인·가입 화면에 올 수 있다.
// Plan SC: 작업 6 — 로그인하지 않으면 접근 막기 (여기는 빠른 1차 확인이고, 화면 코드에서도 requireUser()로 한 번 더 확인한다)
const AUTH_PATHS = ["/login", "/signup"];
const OPEN_PATHS = ["/", "/guest/start"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // 로그인 시간이 지나 갱신된 쿠키를 이후 처리와 브라우저 양쪽에 전달한다. 게스트의 쿠키는 계속 세션 쿠키로 둔다.
        const sessionOnly = request.cookies.has(GUEST_COOKIE);
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenCookieOptions(options, sessionOnly));
        }
      },
    },
  });

  // getUser는 쿠키를 믿지 않고 Supabase 서버에 다시 물어 확인한다. 화면 코드(session.ts)와 판단이 항상 같아야 한다.
  // (쿠키의 서명·만료만 보는 getClaims를 쓰면, 계정이 지워진 뒤 쿠키가 남았을 때 proxy는 "로그인", 화면은 "로그아웃"이라고 판단해
  //  /login 과 / 사이를 계속 오가게 된다.)
  const { data } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(data.user);
  const isGuest = data.user?.user_metadata?.guest === true;
  const path = request.nextUrl.pathname;
  const isAuthPath = AUTH_PATHS.includes(path);
  const isOpenPath = OPEN_PATHS.includes(path);

  const redirectTo = (target: string) => {
    const redirectResponse = NextResponse.redirect(new URL(target, request.url));
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    return redirectResponse;
  };

  if (!isLoggedIn) {
    if (isAuthPath || isOpenPath) return response;
    // 링크를 미리 불러오는 요청(prefetch)으로는 게스트 계정을 만들지 않는다. 실제로 눌렀을 때만 만든다.
    // Next는 proxy에 prefetch 헤더를 넘기지 않고, 미리 읽기 주소(/경로.segments/…)로만 알려 준다. 그래서 헤더와 주소를 둘 다 본다.
    const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`;
    const isPrefetch =
      Boolean(request.headers.get("next-router-prefetch")) || purpose.includes("prefetch") || /\.segments?(\/|$)/.test(path);
    if (isPrefetch) return new NextResponse(null, { status: 204 });
    return redirectTo(`/guest/start?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  }
  if (isAuthPath && !isGuest) return redirectTo("/");
  return response;
}

// 정적 파일(_next, 이미지 등)에는 적용하지 않는다.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
