import Link from "next/link";
import { Icon, IconTile } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { NAV_ITEMS } from "@/lib/nav-items";

const STEPS = [
  { title: "자료 등록", text: "기관 홈페이지 주소나 교육계획서 PDF를 올립니다." },
  { title: "결과 확인·저장", text: "AI가 정리한 값과 출처를 확인하고 기준연도를 정해 저장합니다." },
  { title: "비교·분석", text: "저장한 기관 2~5곳을 골라 표·차트·차이 분석으로 비교합니다." },
];

// 홈의 "이용 방법" 구역. 스크롤해서 보이면 제목과 카드가 차례로 떠오른다.
// 바탕은 위가 배경색으로 시작해 가운데에서 연한 파랑이 번지고 아래에서 다시 배경색으로 돌아오므로, 앞뒤 구역과 선 없이 이어진다.
export function HomeSteps() {
  return (
    <section className="bg-gradient-to-b from-background via-brand-soft/45 to-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-6 md:py-20">
        <Reveal>
          <p className="text-sm font-semibold tracking-wide text-brand">이용 방법</p>
          <h2 className="mt-2 break-keep text-3xl font-bold tracking-tight md:text-4xl">세 단계로 끝나는 기관 비교</h2>
        </Reveal>

        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={0.12 + index * 0.14} className="relative rounded-2xl bg-background p-6 ring-1 ring-line">
              <span className="bg-brand-gradient grid h-10 w-10 place-items-center rounded-full text-base font-bold text-white shadow-[0_10px_22px_-10px_var(--brand)]">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 break-keep text-sm leading-6 text-muted">{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// 홈의 "주요 기능" 구역(눌러서 바로 이동하는 카드). 홈의 마지막 구역이라 바탕이 아래로 갈수록 연한 파랑으로 마무리된다.
export function HomeFeatures() {
  return (
    <section className="bg-gradient-to-b from-background to-brand-soft/80">
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-16 md:px-6 md:pb-32 md:pt-20">
        <Reveal>
          <p className="text-sm font-semibold tracking-wide text-brand">주요 기능</p>
          <h2 className="mt-2 break-keep text-3xl font-bold tracking-tight md:text-4xl">필요한 기능을 바로 눌러서 시작하세요</h2>
        </Reveal>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_ITEMS.map((item, index) => (
            <Reveal as="li" key={item.href} delay={0.1 + index * 0.1}>
              <Link
                href={item.href}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_24px_50px_-28px_var(--brand)]"
              >
                <IconTile name={item.icon} size="lg" />
                <h3 className="mt-5 text-lg font-bold">{item.label}</h3>
                <p className="mt-2 flex-1 break-keep text-sm leading-6 text-muted">{item.description}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                  바로가기
                  <Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
