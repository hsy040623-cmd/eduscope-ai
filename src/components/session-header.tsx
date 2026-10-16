import { AppHeader } from "@/components/app-header";
import { GuestNotice } from "@/components/guest-notice";
import { getCurrentUser } from "@/lib/session";

// Design Ref: §5.3 — 로그인 정보를 읽는 부분이라 <Suspense> 안에서만 쓴다. (cacheComponents)
// 게스트(로그인 없이 시작)이면 머리글에 "게스트"를 표시하고, 아래에 "브라우저를 닫으면 사라집니다" 안내 띠를 붙인다.
export async function SessionHeader() {
  const user = await getCurrentUser();
  return (
    <>
      <AppHeader userEmail={user ? user.email : null} isGuest={user?.isGuest ?? false} />
      {user?.isGuest && <GuestNotice />}
    </>
  );
}
