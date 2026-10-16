import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompareAnalysis } from "@/components/compare-analysis";
import { CompareCharts, type ChartData } from "@/components/compare-charts";
import { CompareTable } from "@/components/compare-table";
import { getComparison } from "@/lib/compare-data";

// 비교 선택(기관 목록)으로 돌아가는 버튼. 화면 위·아래에 같은 모양으로 둔다.
const BACK_BUTTON =
  "inline-flex items-center gap-1 rounded-md border border-foreground/25 px-3 py-1.5 text-sm font-medium hover:bg-foreground/10";

// Vercel 함수 최대 실행 시간(초). 이 화면에서 부르는 서버 작업(자료 읽기·AI 정리·차이 분석)이 끝날 때까지 기다릴 수 있게 한다.
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "비교 결과 · EduScope AI",
};

// Design Ref: §2.5 — 비교 결과(`/compare/result?ids=…`): 비교표와 평균, 숫자 항목 막대차트, 차이 분석(작업 20).
// Plan SC: 작업 18 — 주소의 기관 번호는 서버가 다시 검사한다. 로그인·주소를 읽는 부분은 <Suspense> 안에 둔다. (cacheComponents)
async function ResultContent({ searchParams }: { searchParams: PageProps<"/compare/result">["searchParams"] }) {
  const { ids } = await searchParams;
  const comparison = await getComparison(Array.isArray(ids) ? ids[0] : ids);

  if (comparison.status === "error") {
    return (
      <div role="alert" className="rounded-md border border-red-500/50 p-4 text-sm">
        <p className="text-red-600 dark:text-red-400">{comparison.message}</p>
        <Link href="/compare" className="mt-3 inline-block rounded-md bg-foreground px-3 py-1.5 font-medium text-background">
          비교 선택으로 돌아가기
        </Link>
      </div>
    );
  }

  const { institutions, items, years } = comparison;
  const unusable = items.filter((item) => !item.comparable).length;

  // 차트: 숫자 항목 중 평균에 쓸 값이 2곳 이상인 항목만 그린다. 그릴 값은 서버가 계산한 것을 그대로 넘긴다.
  const charts: ChartData[] = items.flatMap((item) => {
    const stats = item.stats;
    if (!stats || stats.average === null || stats.chartPoints.length < 2) return [];
    return [
      {
        name: item.name,
        unit: stats.unit,
        average: stats.average,
        usedCount: stats.usedCount,
        excludedCount: stats.excludedCount,
        points: stats.chartPoints.map((point) => {
          const institution = institutions[point.index];
          const shortName = institution.name.length > 8 ? `${institution.name.slice(0, 8)}…` : institution.name;
          return { label: `${shortName} ${institution.baseYear}`, full: `${institution.name} (${institution.baseYear}년)`, value: point.value };
        }),
      },
    ];
  });
  const numericItems = items.filter((item) => item.stats).length;

  return (
    <div className="space-y-4">
      {years.length > 1 && (
        <p role="status" className="rounded-md border border-foreground/40 p-3 text-sm leading-6">
          ⚠ 기준연도가 서로 다릅니다 ({institutions.map((institution) => `${institution.name} ${institution.baseYear}`).join(" / ")}). 비교는 할 수
          있지만 같은 해의 자료가 아닐 수 있습니다.
        </p>
      )}

      <p className="text-sm text-foreground/70">
        {institutions.length}개 기관의 {items.length}개 항목입니다. 값은 원문에서 확인된 것만 보여 주고, 칸의 &quot;출처·원문&quot;을 누르면 근거를
        볼 수 있습니다.
        {unusable > 0 && ` 값이 있는 기관이 2곳 미만이라 "비교 불가"인 항목이 ${unusable}개 있습니다.`}
      </p>

      <CompareTable institutions={institutions} items={items} />

      <section aria-labelledby="charts-heading" className="space-y-3">
        <h2 id="charts-heading" className="text-lg font-semibold">
          숫자 항목 차트
        </h2>
        {charts.length > 0 ? (
          <CompareCharts charts={charts} />
        ) : (
          <p className="rounded-md border border-foreground/15 p-4 text-sm text-foreground/70">
            {numericItems === 0
              ? "숫자 항목이 없어 차트를 그리지 않습니다."
              : "평균에 쓸 수 있는 값이 2곳 이상인 숫자 항목이 없어 차트를 그리지 않습니다."}
          </p>
        )}
      </section>

      <section aria-labelledby="analysis-heading" className="space-y-3">
        <h2 id="analysis-heading" className="text-lg font-semibold">
          차이 분석
        </h2>
        {/* key: 고른 기관 조합이 바뀌면 이전에 만든 차이 분석 결과·진행 상태가 남지 않고 처음 상태로 새로 시작한다. (화면 전환 때 이전 조합의 상태가 재사용되는 것을 막는다) */}
        <CompareAnalysis
          key={institutions.map((institution) => institution.id).join(",")}
          idsParam={institutions.map((institution) => institution.id).join(",")}
          hasComparableItems={items.some((item) => item.comparable)}
        />
      </section>

      <ul className="list-disc space-y-1 pl-5 text-xs text-foreground/60">
        <li>확인 불가: 자료를 읽었지만 값이 없거나 원문에서 확인하지 못한 경우</li>
        <li>미조사: 기관을 저장한 뒤에 추가한 항목이라 아직 조사하지 않은 경우</li>
        <li>비교 불가: 값이 확인된 기관이 2곳 미만인 항목</li>
        <li>평균·차트: 숫자 항목만. 확인 불가·미조사 값과 단위가 다른 값은 빼고, 뺀 기관 수를 함께 적습니다. 쓸 값이 2곳 미만이면 평균을 내지 않습니다.</li>
      </ul>

      <div className="pt-2">
        <Link href="/compare" className={BACK_BUTTON}>
          ← 비교 선택으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

export default function CompareResultPage(props: PageProps<"/compare/result">) {
  return (
    <section className="break-keep">
      <p className="text-sm text-foreground/60">
        <Link href="/compare" className="underline">
          비교 선택
        </Link>{" "}
        / 비교 결과
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">비교 결과</h1>
        <Link href="/compare" className={BACK_BUTTON}>
          ← 비교 선택으로 돌아가기
        </Link>
      </div>
      <div className="mt-6">
        <Suspense fallback={<p className="text-foreground/60">불러오는 중…</p>}>
          <ResultContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </section>
  );
}
