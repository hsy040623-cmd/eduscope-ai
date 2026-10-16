import { AppHeader } from "@/components/app-header";
import { getCurrentUserEmail } from "@/lib/session";

// Design Ref: §5.3 — 로그인 정보를 읽는 부분이라 <Suspense> 안에서만 쓴다. (cacheComponents)
export async function SessionHeader() {
  const userEmail = await getCurrentUserEmail();
  return <AppHeader userEmail={userEmail} />;
}
