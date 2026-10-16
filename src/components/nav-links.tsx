"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrentNav, NAV_ITEMS } from "@/lib/nav-items";

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        if (!item.ready) {
          return (
            <span key={item.href} title="준비 중" className="cursor-not-allowed rounded-lg px-3.5 py-2 text-sm opacity-40">
              {item.label}
            </span>
          );
        }
        const current = isCurrentNav(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
              current ? "bg-brand-soft font-semibold text-brand" : "text-foreground/70 hover:bg-brand-soft/70 hover:text-brand"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
