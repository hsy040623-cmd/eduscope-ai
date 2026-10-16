import Link from "next/link";
import { formatValue } from "@/components/result-table";
import type { CompareInstitution, CompareItem } from "@/lib/compare-data";

// Design Ref: §2.5 — 비교표: 항목은 행, 기관은 열. 칸마다 값 / "확인 불가" / "미조사"를 구분해 보여 주고, 값이 있는 기관이 2곳 미만인 항목은 "비교 불가"로 표시한다.
// 칸을 눌러 "출처·원문"을 펼치면 근거를 볼 수 있다. (마우스·휴대폰·키보드 모두 같은 방식)
// 작업 19: 마지막 열에 숫자 항목의 평균을 보여 준다. 확인 불가·미조사·단위가 다른 값은 평균에서 빼고 제외한 기관 수를 함께 적는다.
export function CompareTable({ institutions, items }: { institutions: CompareInstitution[]; items: CompareItem[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-foreground/25">
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth: `${160 + 150 + institutions.length * 170}px` }}>
        <caption className="sr-only">기관별 항목 비교표</caption>
        <thead className="bg-foreground/5 text-xs">
          <tr>
            <th scope="col" className="sticky left-0 w-40 bg-background px-3 py-2 font-medium text-foreground/70">
              항목
            </th>
            {institutions.map((institution) => (
              <th key={institution.id} scope="col" className="px-3 py-2 align-top font-medium">
                <Link href={`/institutions/${institution.id}`} className="break-words text-sm underline-offset-2 hover:underline">
                  {institution.name}
                </Link>
                <span className="block font-normal text-foreground/70">{institution.baseYear}년</span>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 align-top font-medium">
              평균
              <span className="block font-normal text-foreground/70">숫자 항목만</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name} className="border-t border-foreground/15 align-top">
              <th scope="row" className="sticky left-0 bg-background px-3 py-2 font-medium">
                {item.name}
                <span className="block text-xs font-normal text-foreground/60">{item.valueType === "number" ? "숫자" : "글"}</span>
                {!item.comparable && (
                  <span className="mt-1 inline-block rounded border border-foreground/40 px-1.5 py-0.5 text-xs font-medium">비교 불가</span>
                )}
              </th>
              {item.cells.map((cell, index) => (
                <td key={institutions[index].id} className="break-words px-3 py-2">
                  {cell.status === "confirmed" ? (
                    <>
                      <span className="font-medium">{formatValue(cell)}</span>
                      <span className="block text-xs text-foreground/60">{cell.valueYear ? `${cell.valueYear}년` : "연도 미상"}</span>
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-foreground/70">출처·원문</summary>
                        <p className="mt-1 break-all text-foreground/80">{cell.sourceRef}</p>
                        {cell.sourceQuote && (
                          <p className="mt-1 break-words rounded border border-foreground/15 bg-foreground/5 p-2 leading-5">{cell.sourceQuote}</p>
                        )}
                      </details>
                    </>
                  ) : cell.status === "unverifiable" ? (
                    <span className="text-foreground/60">확인 불가</span>
                  ) : (
                    <span className="text-foreground/60">미조사</span>
                  )}
                </td>
              ))}
              <td className="break-words bg-foreground/5 px-3 py-2">
                <AverageCell item={item} total={institutions.length} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 평균 칸: 값이 있으면 "평균 + 몇 곳 기준 + 몇 곳 제외", 없으면 이유를 적는다. 글 항목은 평균을 내지 않는다.
function AverageCell({ item, total }: { item: CompareItem; total: number }) {
  const stats = item.stats;
  if (!stats) return <span className="text-foreground/50">-</span>;
  if (stats.average === null) {
    return (
      <>
        <span className="text-foreground/60">평균 없음</span>
        <span className="block text-xs text-foreground/60">평균에 쓸 수 있는 값이 {stats.usedCount}곳이라 2곳 미만입니다.</span>
        {stats.unitMismatchCount > 0 && <span className="block text-xs text-foreground/60">단위가 달라 {stats.unitMismatchCount}곳 제외</span>}
      </>
    );
  }
  return (
    <>
      <span className="font-medium">
        {stats.average.toLocaleString("ko-KR")}
        {stats.unit ? ` ${stats.unit}` : ""}
      </span>
      <span className="block text-xs text-foreground/70">
        {stats.usedCount}곳 기준{stats.excludedCount > 0 ? ` · ${stats.excludedCount}곳 제외` : ` (${total}곳 모두)`}
      </span>
      {stats.unitMismatchCount > 0 && <span className="block text-xs text-foreground/60">단위가 달라 {stats.unitMismatchCount}곳 제외</span>}
    </>
  );
}
