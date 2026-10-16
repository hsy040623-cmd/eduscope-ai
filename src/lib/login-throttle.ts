import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §3.3·§7 — 이메일별 로그인 시도 제한. 같은 이메일로 10분 안에 10번 틀리면 그 이메일만 10분간 막는다. (DB 함수 login_is_blocked 등이 센다)
// Plan SC: 보안 점검(22번) CHECK P1-2 — Supabase의 제한은 IP 하나 기준이라 서버가 대신 로그인하면 모든 사용자가 함께 막힐 수 있다.
// 막힌 동안에는 Supabase에 요청 자체를 보내지 않으므로 Supabase의 제한 한도도 쓰지 않는다.
// 이메일은 소문자로 맞춘 뒤 해시(64자)로만 DB에 보낸다. 이메일이 있는 계정이든 없는 계정이든 똑같이 센다. (계정 존재 여부가 드러나지 않는다)
export const LOGIN_BLOCKED_MESSAGE = "로그인 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

// 확인에 실패하면(DB 오류 등) 막지 않는다. 제한 장치 고장이 정상 로그인을 막으면 안 된다.
export async function isLoginBlocked(supabase: Client, email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("login_is_blocked", { p_email_hash: hashEmail(email) });
  return !error && data === true;
}

export async function recordLoginFailure(supabase: Client, email: string): Promise<void> {
  await supabase.rpc("login_record_failure", { p_email_hash: hashEmail(email) });
}
