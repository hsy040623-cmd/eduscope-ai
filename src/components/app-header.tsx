"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logOut } from "@/app/(auth)/login/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Icon, IconTile } from "@/components/icons";
import { NavLinks } from "@/components/nav-links";
import { isCurrentNav, NAV_ITEMS } from "@/lib/nav-items";

// Design Ref: §2.2 — 모든 화면 위쪽에 붙는 공통 머리글. 왼쪽 로고, 가운데 메뉴, 오른쪽 계정.
// 맑은 흰색 바탕에 살짝 흐림 효과가 있고 스크롤해도 위에 붙어 있다. 휴대폰에서는 "메뉴" 버튼으로 기능 목록이 펼쳐진다.
// userEmail: undefined = 로그인 여부 확인 중(로고만 표시), null = 로그아웃 상태, 문자열 = 로그인한 사용자.
export function AppHeader({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const isChecking = userEmail === undefined;
  const isLoggedIn = typeof userEmail === "string";

  // 휴대폰 메뉴는 "열린 화면의 경로"를 기억한다. 다른 화면으로 이동하면 경로가 달라져서 저절로 닫힌다.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-6">
            <BrandLogo />
          </div>

          {isLoggedIn && (
            <div className="hidden md:block">
              <NavLinks />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 text-sm">
            {!isChecking &&
              (isLoggedIn ? (
                <>
                  <span className="hidden max-w-[200px] truncate text-muted lg:inline">{userEmail}</span>
                  <form action={logOut} className="hidden md:block">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-foreground/80 transition-colors hover:border-brand hover:text-brand"
                    >
                      <Icon name="logout" className="h-4 w-4" />
                      로그아웃
                    </button>
                  </form>
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-lg border border-line text-brand md:hidden"
                    aria-expanded={menuOpen}
                    aria-controls="mobile-menu"
                    aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
                    onClick={() => setMenuPath(menuOpen ? null : pathname)}
                  >
                    <Icon name={menuOpen ? "close" : "menu"} />
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded-lg px-3.5 py-2 text-foreground/80 transition-colors hover:text-brand">
                    로그인
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-brand-gradient rounded-lg px-4 py-2 font-medium text-white shadow-[0_10px_22px_-10px_var(--brand)] transition-[filter,transform] hover:-translate-y-px hover:brightness-110"
                  >
                    회원가입
                  </Link>
                </>
              ))}
          </div>
        </div>
      {/* 휴대폰용 메뉴: 기능을 아이콘과 함께 큼직하게 보여 준다. */}
        {isLoggedIn && menuOpen && (
        <nav
          id="mobile-menu"
          aria-label="주 메뉴"
          className="absolute inset-x-0 top-full max-h-[calc(100svh-4rem)] overflow-y-auto border-b border-line bg-surface px-4 pb-8 pt-4 shadow-xl md:hidden"
        >
          <ul className="space-y-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrentNav(pathname, item.href) ? "page" : undefined}
                  className="flex items-center gap-4 rounded-xl border border-line p-4 aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft"
                  onClick={() => setMenuPath(null)}
                >
                  <IconTile name={item.icon} />
                  <span>
                    <span className="block text-base font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-sm text-muted">{item.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <form action={logOut} className="mt-6">
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm text-foreground/80">
              <Icon name="logout" className="h-4 w-4" />
              로그아웃
            </button>
          </form>
          <p className="mt-4 truncate text-center text-xs text-muted">{userEmail}</p>
        </nav>
      )}
      </header>

    </>
  );
}
