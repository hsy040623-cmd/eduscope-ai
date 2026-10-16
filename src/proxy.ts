import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { hardenCookieOptions } from "@/lib/supabase/cookie-options";

// Design Ref: §2.1·§5.3 — 로그인하지 않은 사람은 로그인·회원가입 화면만 볼 수 있다. 로그인한 사람이 그 화면에 오면 홈으로 보낸다.
// Plan SC: 작업 6 — 로그인하지 않으면 접근 막기 (여기는 빠른 1차 확인이고, 화면 코드에서도 requireUser()로 한 번 더 확인한다)
const PUBLIC_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // 로그인 시간이 지나 갱신된 쿠키를 이후 처리와 브라우저 양쪽에 전달한다.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenCookieOptions(options));
        }
      },
    },
  });

  // getUser는 쿠키를 믿지 않고 Supabase 서버에 다시 물어 확인한다. 화면 코드(session.ts)와 판단이 항상 같아야 한다.
  // (쿠키의 서명·만료만 보는 getClaims를 쓰면, 계정이 지워진 뒤 쿠키가 남았을 때 proxy는 "로그인", 화면은 "로그아웃"이라고 판단해
  //  /login 과 / 사이를 계속 오가게 된다.)
  const { data } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(data.user);
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  const redirectTo = (path: string) => {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    return redirectResponse;
  };

  if (!isLoggedIn && !isPublicPath) return redirectTo("/login");
  if (isLoggedIn && isPublicPath) return redirectTo("/");
  return response;
}

// 정적 파일(_next, 이미지 등)에는 적용하지 않는다.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
