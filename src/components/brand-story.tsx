"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Icon, IconTile, type IconName } from "@/components/icons";
import { Reveal } from "@/components/reveal";

// 브랜드 이야기: "EduScope"가 무엇과 무엇이 합쳐진 이름인지, 그 렌즈가 하는 일이 무엇인지를 글 대신 움직임으로 보여 주는 구역이다.
// 시험용이라 이 파일 하나로 끝나게 만들었다. (모션 키프레임도 아래 <style>에 함께 들어 있다)
// 빼려면: 이 파일을 지우고, `src/app/page.tsx`의 BrandStory 불러오기·사용 두 줄만 지우면 된다. 다른 파일은 건드리지 않았다.
// 화면에 보일 때 한 번 시작하고(IntersectionObserver), "움직임 줄이기" 설정이면 모션 없이 완성된 모습만 보여 준다.

const PARTS: { icon: IconName; word: string; caption: string }[] = [
  { icon: "building", word: "Edu", caption: "교육기관" },
  { icon: "scope", word: "Scope", caption: "들여다보는 렌즈" },
  { icon: "sparkle", word: "AI", caption: "대신 읽고 정리" },
];

// 문서 모양의 막대(가로 길이 %), highlight: 렌즈가 지나갈 때 값이 잡히는 줄
const DOC_LINES: { width: number; hit?: 1 | 2 | 3 }[] = [
  { width: 78 },
  { width: 92, hit: 1 },
  { width: 64 },
  { width: 86, hit: 2 },
  { width: 70 },
  { width: 88, hit: 3 },
  { width: 52 },
];

const CHIPS = [
  { label: "교육과정 수", value: "60개", source: "13쪽" },
  { label: "이수기준", value: "60점 이상", source: "7쪽" },
  { label: "수료율", value: "88.4%", source: "5쪽" },
];

const BARS = [46, 82, 64];

// 이름 풀이 한 칸이 떠오르기 시작할 시각(--d)
function delay(value: string): CSSProperties {
  return { "--d": value } as CSSProperties;
}

export function BrandStory() {
  const rootRef = useRef<HTMLElement>(null);

  // 화면에 들어오면 모션을 시작한다. (처음 한 번만. 상태를 쓰지 않고 표시만 바꿔 다시 그리지 않는다)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === "undefined") {
      root.dataset.play = "true";
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          root.dataset.play = "true";
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={rootRef} className="bs-root relative isolate overflow-hidden" aria-labelledby="brand-story-heading">
      <style>{STYLES}</style>
      {/* 바탕: 위(첫 화면에서 이어짐)와 아래(주요 기능으로 이어짐)는 배경색으로 사라지고, 가운데만 파랗게 번진다. 선·경계가 없다. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-brand-soft/70 to-background" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: "radial-gradient(55% 38% at 50% 34%, color-mix(in srgb, var(--brand-light) 20%, transparent), transparent 70%)" }}
      />
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-6 md:py-28">
        <Reveal>
          <p className="text-sm font-semibold tracking-wide text-brand">브랜드 이야기</p>
          <h2 id="brand-story-heading" className="mt-2 break-keep text-3xl font-bold tracking-tight md:text-4xl">
            교육기관을 들여다보는 <span className="text-gradient">렌즈</span>, EduScope
          </h2>
        </Reveal>

        {/* ① 이름 풀이: Edu + Scope + AI = EduScope AI */}
        <div role="img" aria-label="Edu(교육기관) 더하기 Scope(들여다보는 렌즈) 더하기 AI(대신 읽고 정리)는 EduScope AI" className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-6 md:gap-x-6">
          {PARTS.map((part, index) => (
            <div key={part.word} className="contents">
              {index > 0 && (
                <span aria-hidden="true" className="bs-pop text-3xl font-light text-brand/70 md:text-4xl" style={delay(`${index * 0.14 - 0.06}s`)}>
                  +
                </span>
              )}
              <div aria-hidden="true" className="bs-pop flex w-28 flex-col items-center text-center md:w-36" style={delay(`${index * 0.14}s`)}>
                <span className={part.word === "Scope" ? "bs-wobble" : part.word === "AI" ? "bs-twinkle" : "bs-rise"}>
                  <IconTile name={part.icon} size="lg" />
                </span>
                <span className="mt-3 text-xl font-bold md:text-2xl">{part.word}</span>
                <span className="mt-0.5 text-xs text-muted md:text-sm">{part.caption}</span>
              </div>
            </div>
          ))}
          <span aria-hidden="true" className="bs-pop text-3xl font-light text-brand/70 md:text-4xl" style={delay("0.35s")}>
            =
          </span>
          <div aria-hidden="true" className="bs-pop bs-result flex flex-col items-center rounded-2xl border border-brand/30 bg-surface px-6 py-5 text-center" style={delay("0.42s")}>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-gradient text-white shadow-[0_10px_22px_-10px_var(--brand)]">
              <Icon name="scope" className="h-6 w-6" />
            </span>
            <span className="mt-3 text-xl font-bold tracking-tight md:text-2xl">
              EduScope <span className="text-gradient">AI</span>
            </span>
          </div>
        </div>

        {/* ② 그 렌즈가 하는 일: 읽기 → 값 + 출처 → 비교 */}
        <div aria-hidden="true" className="mt-16 grid items-center gap-6 md:grid-cols-[1.1fr_auto_1fr_auto_0.8fr]">
          {/* 문서와 렌즈 */}
          <div>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div className="space-y-3.5">
                {DOC_LINES.map((line, index) => (
                  <div key={index} className="relative h-3 rounded-full bg-foreground/10" style={{ width: `${line.width}%` }}>
                    {line.hit && <span className={`bs-hl bs-hl-${line.hit} absolute inset-0 rounded-full bg-brand/35`} />}
                  </div>
                ))}
              </div>
              <span className="bs-lens absolute left-0 top-0 text-brand drop-shadow-[0_8px_14px_rgba(37,99,235,0.35)]">
                <Icon name="scope" className="h-14 w-14" />
              </span>
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-muted">① 읽고</p>
          </div>

          <Icon name="arrow" className="bs-arrow mx-auto h-6 w-6 rotate-90 text-brand md:rotate-0" />

          {/* 값과 출처 */}
          <div>
            <ul className="space-y-3">
              {CHIPS.map((chip, index) => (
                <li key={chip.label} className={`bs-chip bs-chip-${index + 1} flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-sm`}>
                  <span className="text-sm text-muted">{chip.label}</span>
                  <span className="flex items-center gap-2">
                    <strong className="text-base">{chip.value}</strong>
                    <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand">출처 {chip.source}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center text-sm font-semibold text-muted">② 값과 출처를 남기고</p>
          </div>

          <Icon name="arrow" className="bs-arrow mx-auto h-6 w-6 rotate-90 text-brand md:rotate-0" />

          {/* 비교 */}
          <div>
            <div className="relative flex h-36 items-end justify-around gap-3 rounded-2xl border border-line bg-surface px-5 pb-4 pt-6 shadow-sm">
              {BARS.map((height, index) => (
                <span key={index} className="bs-bar bg-brand-gradient w-9 rounded-t-lg" style={{ height: `${height}%` }} />
              ))}
              <span className="absolute inset-x-4 top-1/2 border-t border-dashed border-brand-strong/60" />
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-muted">③ 나란히 비교</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const STYLES = `
/* 시작 전에는 모두 멈춰 있다가, 화면에 들어오면(data-play) 움직인다 */
.bs-root:not([data-play="true"]) * { animation-play-state: paused !important; }

/* 전체 시간표: 화면에 들어오고 1.7초 안에 "이름 풀이 → 읽고 → 값과 출처 → 나란히 비교"가 모두 나타난다. 그 뒤 6초 주기로 되풀이한다. */

/* 이름 풀이: 한 칸씩 0.18초 간격으로 빠르게 떠오른다 (0~0.9초) */
.bs-pop { opacity: 0; transform: translateY(14px) scale(0.92); }
.bs-root[data-play="true"] .bs-pop { animation: bs-pop 0.46s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; animation-delay: var(--d, 0s); }
@keyframes bs-pop { to { opacity: 1; transform: none; } }

/* 떠오른 뒤 계속 살짝 움직인다: 렌즈는 흔들리고, AI는 반짝이고, Edu는 위아래로 */
.bs-wobble, .bs-twinkle, .bs-rise { display: inline-block; }
.bs-root[data-play="true"] .bs-wobble { animation: bs-wobble 3.2s ease-in-out 0.8s infinite; transform-origin: 30% 30%; }
.bs-root[data-play="true"] .bs-twinkle { animation: bs-twinkle 2.6s ease-in-out 0.8s infinite; }
.bs-root[data-play="true"] .bs-rise { animation: bs-rise 3.6s ease-in-out 0.8s infinite; }
@keyframes bs-wobble { 0%,100% { transform: rotate(-9deg) translateX(-3px); } 50% { transform: rotate(9deg) translateX(4px); } }
@keyframes bs-twinkle { 0%,100% { transform: scale(1) rotate(0); filter: brightness(1); } 50% { transform: scale(1.12) rotate(10deg); filter: brightness(1.15); } }
@keyframes bs-rise { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

/* 합쳐진 결과 상자는 은은하게 빛난다 */
.bs-root[data-play="true"] .bs-result { animation: bs-pop 0.46s cubic-bezier(0.2, 0.8, 0.2, 1) forwards, bs-glow 3.4s ease-in-out 1s infinite; animation-delay: var(--d, 0s), 1s; }
@keyframes bs-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); } 50% { box-shadow: 0 18px 40px -18px rgba(37,99,235,0.55); } }

/* 읽고 → 값과 출처 → 비교는 이름 풀이와 동시에 시작한다. (3.6초 주기: 0~1.7초에 모두 나타나고, 2.9초까지 잠깐 보여 준 뒤 0.4초 만에 사라지고 곧바로 다시 시작) */
.bs-lens { animation: bs-sweep 3.6s ease-in-out infinite; }
@keyframes bs-sweep {
  0%   { left: 2%;  top: 2%; }
  11%  { left: 50%; top: 16%; }
  23%  { left: 18%; top: 38%; }
  36%  { left: 58%; top: 52%; }
  47%  { left: 30%; top: 70%; }
  58%  { left: 46%; top: 42%; }
  80%  { left: 46%; top: 42%; }
  100% { left: 2%;  top: 2%; }
}
.bs-hl { opacity: 0; transform: scaleX(0.2); transform-origin: left; animation: bs-hl 3.6s ease-in-out infinite; }
.bs-hl-1 { animation-delay: 0s; }
.bs-hl-2 { animation-delay: 0.46s; }
.bs-hl-3 { animation-delay: 0.92s; }
@keyframes bs-hl {
  0%, 7%    { opacity: 0; transform: scaleX(0.2); }
  17%, 80%  { opacity: 1; transform: scaleX(1); }
  92%, 100% { opacity: 0; transform: scaleX(1); }
}
.bs-chip { opacity: 0; transform: translateX(-12px); animation: bs-chip 3.6s ease-out infinite; }
.bs-chip-1 { animation-delay: 0.34s; }
.bs-chip-2 { animation-delay: 0.71s; }
.bs-chip-3 { animation-delay: 1.08s; }
@keyframes bs-chip {
  0%   { opacity: 0; transform: translateX(-12px); }
  12%, 80% { opacity: 1; transform: none; }
  92%, 100% { opacity: 0; transform: translateX(8px); }
}
.bs-bar { transform-origin: bottom; transform: scaleY(0); animation: bs-bar 3.6s cubic-bezier(0.2, 0.7, 0.2, 1) infinite; }
.bs-bar:nth-child(2) { animation-delay: 0.12s; }
.bs-bar:nth-child(3) { animation-delay: 0.24s; }
@keyframes bs-bar {
  0%, 23% { transform: scaleY(0); }
  43%, 80% { transform: scaleY(1); }
  92%, 100% { transform: scaleY(0); }
}
.bs-arrow { animation: bs-arrow 1.8s ease-in-out infinite; }
@keyframes bs-arrow { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }

/* 움직임 줄이기 설정: 모션 없이 완성된 모습만 보여 준다 */
@media (prefers-reduced-motion: reduce) {
  .bs-root * { animation: none !important; }
  .bs-pop { opacity: 1; transform: none; }
  .bs-lens { left: 40%; top: 30%; }
  .bs-hl { opacity: 1; transform: none; }
  .bs-chip { opacity: 1; transform: none; }
  .bs-bar { transform: none; }
}
`;
