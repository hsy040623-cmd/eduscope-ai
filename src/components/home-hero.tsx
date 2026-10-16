import Link from "next/link";
import { HeroMockup } from "@/components/hero-mockup";
import { Icon } from "@/components/icons";

// Design Ref: 사이트 디자인 — 홈 첫 화면: 왼쪽에 서비스 소개와 시작 버튼, 오른쪽에 화면 예시. 부드러운 파란 그라데이션 바탕.
const TRUST = ["공개 자료만 사용", "모든 값에 출처 표시", "확인 불가는 지어내지 않음"];

export function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-[#e8f0ff] via-[#e1f1ff] to-[#eef0ff] dark:from-[#0b1730] dark:via-[#0a1c3a] dark:to-[#0d1530]" />
      {/* 아래쪽을 배경색으로 서서히 이어 붙여 구역 경계가 딱딱하게 보이지 않게 한다. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-b from-transparent to-background" />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:px-6 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20">
        <div>
          <span className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-1.5 text-sm font-medium text-brand ring-1 ring-brand/15">
            <Icon name="sparkle" className="h-4 w-4" />
            공공 교육기관 비교 분석 서비스
          </span>

          <h1 className="animate-fade-up mt-6 break-keep text-[40px] font-extrabold leading-[1.15] tracking-tight [animation-delay:0.12s] md:text-[56px]">
            교육기관 운영 현황,
            <br />
            <span className="text-gradient animate-shimmer">한눈에 비교하세요</span>
          </h1>

          <p className="animate-fade-up mt-6 max-w-xl break-keep text-lg leading-8 text-muted [animation-delay:0.26s]">
            공식 홈페이지와 교육계획서를 바탕으로 AI가 확인 가능한 정보만 항목별로 정리하고, 여러 기관의 차이를 표·차트·분석으로 보여 드립니다.
          </p>

          <div className="animate-fade-up mt-9 flex flex-wrap gap-3 [animation-delay:0.4s]">
            <Link
              href="/institutions/new"
              className="bg-brand-gradient animate-cta-glow inline-flex items-center gap-2 rounded-xl px-7 py-4 text-base font-semibold text-white transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-110"
            >
              기관 등록하기
              <Icon name="arrow" className="h-5 w-5" />
            </Link>
            <Link
              href="/compare"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-7 py-4 text-base font-semibold shadow-sm transition-colors hover:border-brand hover:text-brand"
            >
              <Icon name="bars" className="h-5 w-5 text-brand" />
              기관 비교하기
            </Link>
          </div>

          <p className="animate-fade-up mt-5 text-sm text-muted [animation-delay:0.47s]">
            로그인 없이 바로 써 볼 수 있어요. 게스트로 쓰면 브라우저를 닫을 때 자료가 사라집니다.
          </p>

          <ul className="animate-fade-up mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-foreground/80 [animation-delay:0.54s]">
            {TRUST.map((text) => (
              <li key={text} className="flex items-center gap-2">
                <span className="bg-brand-gradient grid h-5 w-5 place-items-center rounded-full text-white">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-up [animation-delay:0.3s]">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
