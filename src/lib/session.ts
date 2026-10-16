import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §3.3·§5.3 — 요청마다 서버가 "누구인지" 확인한다. 쿠키를 읽으므로 반드시 <Suspense> 안에서 호출한다. (cacheComponents)
// Plan SC: 작업 6 — 로그인 전·후 구분, 로그인하지 않으면 접근 막기

export type CurrentUser = { id: string; email: string; isGuest: boolean }; // isGuest: 로그인 없이 시작한 임시(게스트) 계정

// getUser는 쿠키 내용을 믿지 않고 Supabase 서버에 다시 물어 확인한다. 같은 요청 안에서는 한 번만 묻는다.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // 로그인 확인(Supabase)은 요청이 들어온 뒤에 실행해야 한다. 이게 없으면 Next.js가 화면을 미리 그리는 중에 Date.now()를
  // 만나 오류를 내고, 로그인한 채로 화면을 새로 열 때 "불러오는 중…"에서 멈춘다. (항목 관리 화면을 확인하다 발견)
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "", isGuest: data.user.user_metadata?.guest === true };
});

export async function getCurrentUserEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  return user ? user.email : null;
}

// 로그인한 사용자만 볼 수 있는 화면에서 쓴다. 로그인하지 않았으면 로그인 화면으로 보낸다. (proxy.ts가 먼저 막지만 한 번 더 확인)
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
