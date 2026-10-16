import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { BrandLogo } from "@/components/brand-logo";
import { SessionHeader } from "@/components/session-header";
import { TopNotice } from "@/components/top-notice";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduScope AI",
  description: "여러 교육기관의 운영 현황을 자동으로 모아 비교하고 차이를 분석하는 서비스",
};

// 로그인 정보와 현재 주소를 읽는 동안 잠깐 보이는 머리글. 로고만 보여 준다.
function HeaderFallback() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 md:px-6">
        <BrandLogo />
      </div>
    </header>
  );
}

// Design Ref: §2.2 — 위쪽 메뉴 + 아래 화면별 내용. 본문 틀은 화면 종류별 레이아웃이 정한다: 홈은 틀 없이 구역마다 자유롭게, (auth)는 왼쪽 소개 + 오른쪽 카드, (content)는 흰 판 위의 본문. 맨 위에는 공공기관 누리집 같은 안내 띠가 붙는다. 로그인 정보는 Suspense 뒤에서 읽어 나머지 화면이 먼저 보이게 한다.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TopNotice />
        <Suspense fallback={<HeaderFallback />}>
          <SessionHeader />
        </Suspense>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
