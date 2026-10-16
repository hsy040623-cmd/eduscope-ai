import { Icon } from "@/components/icons";

// 메인 첫 화면 오른쪽의 "화면 예시". 실제 데이터가 아니라 서비스가 어떤 모습인지 보여 주는 가상 데이터 목업이다. (아래에 그렇게 적어 둔다)
// 막대가 아래에서 자라나고, 떠 있는 카드 두 장이 천천히 위아래로 움직인다. (움직임 줄이기 설정이면 멈춘다)
const BARS = [
  { label: "기관 A", value: 55 },
  { label: "기관 B", value: 80 },
  { label: "기관 C", value: 64 },
];

const TABS = ["교육과정", "운영 방식", "교육성과"];

export function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* 뒤에서 번지는 파란 빛 */}
      <div aria-hidden="true" className="animate-glow-drift absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-sky-300/35 via-blue-400/25 to-indigo-300/30 blur-3xl" />

      <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_40px_90px_-40px_rgba(37,99,235,0.55)] ring-1 ring-slate-900/5">
        <div className="flex items-center gap-2 bg-[#0f2557] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-[11px] text-white/80">
            <Icon name="lock" className="h-3 w-3" />
            eduscope.ai/compare
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold">교육기관 비교 분석</p>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">예시 화면</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {TABS.map((tab, index) => (
              <div
                key={tab}
                className={`flex flex-col gap-2 rounded-xl p-3 text-xs font-medium ${
                  index === 0 ? "bg-brand-soft text-brand ring-1 ring-brand/30" : "bg-background text-foreground/70"
                }`}
              >
                <Icon name="bars" className="h-4.5 w-4.5 text-brand" />
                {tab}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-background p-4">
            <div className="flex h-44 items-end justify-around gap-4 border-b border-line/80 px-2">
              {BARS.map((bar, index) => (
                <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-xs font-semibold text-brand">{bar.value}</span>
                  <div
                    className="animate-bar-grow w-full max-w-[64px] rounded-t-lg bg-gradient-to-t from-blue-700 via-blue-500 to-sky-300"
                    style={{ height: `${bar.value}%`, animationDelay: `${0.2 + index * 0.15}s` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-around text-xs text-muted">
              {BARS.map((bar) => (
                <span key={bar.label}>{bar.label}</span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted">가상 데이터로 구성한 화면 예시입니다.</p>
        </div>
      </div>

      <div className="animate-float absolute -top-5 right-2 flex items-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-[0_20px_40px_-18px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 lg:-right-6">
        <span className="bg-brand-gradient grid h-9 w-9 place-items-center rounded-lg text-white">
          <Icon name="shield" className="h-5 w-5" />
        </span>
        <span className="text-xs leading-5">
          <b className="block text-[13px]">출처 확인 완료</b>
          <span className="text-muted">값마다 원문 근거 표시</span>
        </span>
      </div>

      <div className="animate-float-delay absolute -bottom-6 left-2 flex items-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-[0_20px_40px_-18px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 lg:-left-6">
        <span className="bg-brand-gradient grid h-9 w-9 place-items-center rounded-lg text-white">
          <Icon name="sparkle" className="h-5 w-5" />
        </span>
        <span className="text-xs leading-5">
          <b className="block text-[13px]">AI 차이 분석</b>
          <span className="text-muted">기관 B가 기관 A보다 25 높음</span>
        </span>
      </div>
    </div>
  );
}
