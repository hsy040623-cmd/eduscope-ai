import type { IconName } from "@/components/icons";

// Design Ref: §2.1·§2.2 — 로그인 후 상단 메뉴 항목. 서버·클라이언트 화면이 함께 쓰므로 "use client" 파일이 아닌 곳에 둔다.
// ready: 화면이 만들어졌는지. 아직 없는 화면은 눌러도 404가 되므로 눌리지 않게 보여 준다. 화면을 만들 때 true로 바꾼다.
export const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; description: string; icon: IconName; ready: boolean }> = [
  { href: "/institutions/new", label: "기관 등록", description: "홈페이지 주소나 PDF로 기관을 등록합니다", icon: "upload", ready: true },
  { href: "/institutions", label: "내 기관", description: "저장한 기관의 정리 결과를 봅니다", icon: "building", ready: true },
  { href: "/compare", label: "비교", description: "기관 2~5곳을 표·차트·분석으로 비교합니다", icon: "bars", ready: true },
  { href: "/items", label: "항목 관리", description: "AI가 찾을 항목을 추가하고 고칩니다", icon: "sliders", ready: true },
];

// 현재 화면이 어느 메뉴에 해당하는지. "내 기관"(/institutions)과 "기관 등록"(/institutions/new)은 주소가 겹치므로 따로 가른다.
export function isCurrentNav(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/institutions") {
    // 목록과 기관 결과 확인(/institutions/기관번호)은 "내 기관", 등록(/institutions/new)은 제외
    return pathname === "/institutions" || (pathname.startsWith("/institutions/") && !pathname.startsWith("/institutions/new"));
  }
  return pathname.startsWith(href);
}
