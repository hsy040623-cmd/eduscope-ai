import "server-only";

import { DAILY_REGISTRATION_LIMIT } from "@/lib/registration-limits";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Design Ref: §4 — 하루는 한국시간 0시부터 센다. (DB의 `usage_log` 한도 규칙과 같은 기준)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstDayStartIso(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const startOfKstDayAsUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  return new Date(startOfKstDayAsUtc - KST_OFFSET_MS).toISOString();
}

// 오늘 이미 등록한 횟수. (본인 기록만 센다 — 접근 규칙이 보장한다)
export async function getTodayRegistrationCount(): Promise<number> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("usage_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", kstDayStartIso());

  if (error) throw new Error("오늘 등록 횟수를 불러오지 못했습니다.");
  return Math.min(count ?? 0, DAILY_REGISTRATION_LIMIT);
}
