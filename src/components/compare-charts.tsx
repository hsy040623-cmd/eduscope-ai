"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/reveal";
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Design Ref: §2.5 — 숫자 항목 막대차트. 글 항목은 그리지 않는다. 평균에 쓴 기관만 막대로 그리고, 평균은 점선으로 보여 준다.
// Plan SC: 작업 19 — 차트에 쓴 값과 제외한 기관 수는 서버가 코드로 계산해서 넘겨 준다. (여기서는 그리기만 한다)
export type ChartData = {
  name: string; // 항목 이름
  unit: string;
  average: number;
  usedCount: number;
  excludedCount: number;
  points: { label: string; full: string; value: number }[]; // label: 축에 쓰는 짧은 이름(이름은 줄이고 연도는 항상 보임), full: 전체 이름
};

const BAR_DELAY_MS = 250; // 카드가 나타난 뒤 막대가 자라기 시작할 때까지
const BAR_DURATION_MS = 1100; // 막대가 자라는 시간
const ROW_HEIGHT = 56; // 비교표와 같은 가로 폭으로 키운 만큼 막대 한 줄의 높이도 키웠다

export function CompareCharts({ charts }: { charts: ChartData[] }) {
  return (
    <div className="grid gap-4">
      {charts.map((chart, chartIndex) => (
        <ChartCard key={chart.name} chart={chart} chartIndex={chartIndex} />
      ))}
    </div>
  );
}

// 차트 한 개. 카드가 위로 떠오르며 나타나고, 화면에 보이면 막대가 왼쪽에서 오른쪽으로 자라며 값이 올라오고, 막대가 다 자란 뒤 평균 점선이 나타난다.
// (화면 밖에 있을 때 미리 그리면 모션을 놓치므로, 보일 때 처음 그린다. "움직임 줄이기" 설정이면 모션 없이 바로 그린다)
function ChartCard({ chart, chartIndex }: { chart: ChartData; chartIndex: number }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [showAverage, setShowAverage] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      // 모션 없이 바로 그린다. (다음 화면 그리기 때 상태를 바꾼다)
      const frame = requestAnimationFrame(() => {
        setReduceMotion(reduce);
        setSeen(true);
        setShowAverage(true);
      });
      return () => cancelAnimationFrame(frame);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setSeen(true);
        timer = setTimeout(() => setShowAverage(true), BAR_DELAY_MS + BAR_DURATION_MS);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(holder);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const gradientId = `bar-gradient-${chartIndex}`;
  const unitText = chart.unit ? ` ${chart.unit}` : "";
  const summary = `${chart.name} 막대차트. ${chart.points.map((point) => `${point.full} ${point.value}${unitText}`).join(", ")}. 평균 ${chart.average}${unitText}.`;
  return (
    <Reveal as="figure" delay={Math.min(chartIndex, 2) * 0.1} className="rounded-xl border border-line bg-background/60 p-4 sm:p-6">
            <figcaption className="text-base font-semibold">
              {chart.name}
              {chart.unit && <span className="ml-1 font-normal text-foreground/60">(단위: {chart.unit})</span>}
            </figcaption>
            <div ref={holderRef} role="img" aria-label={summary} className="mt-2 text-foreground" style={{ height: chart.points.length * ROW_HEIGHT + 56 }}>
              {seen && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.points} layout="vertical" margin={{ top: 8, right: 64, bottom: 8, left: 8 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1d4ed8" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.15} />
                  <XAxis type="number" tick={{ fill: "currentColor", fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={170}
                    interval={0}
                    tick={{ fill: "currentColor", fontSize: 13 }}
                    stroke="currentColor"
                    strokeOpacity={0.4}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}${unitText}`, chart.name]}
                    labelFormatter={(label) => chart.points.find((point) => point.label === label)?.full ?? label}
                    contentStyle={{ fontSize: 12, background: "var(--background)", color: "var(--foreground)", border: "1px solid color-mix(in srgb, var(--foreground) 25%, transparent)" }}
                    cursor={{ fill: "#2563eb", fillOpacity: 0.08 }}
                  />
                  <Bar
                    dataKey="value"
                    fill={`url(#${gradientId})`}
                    radius={[0, 6, 6, 0]}
                    barSize={30}
                    isAnimationActive={!reduceMotion}
                    animationBegin={BAR_DELAY_MS}
                    animationDuration={BAR_DURATION_MS}
                    animationEasing="ease-out"
                  >
                    <LabelList dataKey="value" position="right" fill="currentColor" fontSize={13} />
                  </Bar>
                  {showAverage && <ReferenceLine x={chart.average} stroke="#0b2a6b" strokeDasharray="4 3" strokeOpacity={0.75} />}
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground/70">
              점선은 평균 {chart.average.toLocaleString("ko-KR")}
              {unitText} · {chart.usedCount}곳 기준
              {chart.excludedCount > 0 ? ` · ${chart.excludedCount}곳 제외(확인 불가·미조사·단위 다름)` : ""}
            </p>
    </Reveal>
  );
}
