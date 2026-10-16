// Design Ref: §2.4 — 항목별 정리 결과 표(항목·값·연도·출처·상태). 출처를 펼치면 원문 발췌 1문장이 나온다.
// "확인 불가"(읽었지만 없거나 불분명), "미조사"(저장한 뒤에 추가한 항목), "연도 미상"(값은 있는데 연도를 모름)을 서로 다르게 보여 준다.
export type ResultRow = {
  name: string;
  status: "confirmed" | "unverifiable" | "not_checked";
  valueText: string | null;
  valueNumber: number | null;
  unit: string | null;
  valueYear: number | null;
  sourceRef: string | null;
  sourceQuote: string | null;
  reason: string | null;
};

export function formatValue(row: ResultRow): string {
  if (row.valueNumber !== null) return `${row.valueNumber.toLocaleString("ko-KR")}${row.unit ? ` ${row.unit}` : ""}`;
  return row.valueText ?? "";
}

const STATUS_LABEL = { confirmed: "확인됨", unverifiable: "확인 불가", not_checked: "미조사" } as const;

export function ResultTable({ rows }: { rows: ResultRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-foreground/25">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">항목별 정리 결과</caption>
        <thead className="bg-foreground/5 text-xs text-foreground/70">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">항목</th>
            <th scope="col" className="px-3 py-2 font-medium">값</th>
            <th scope="col" className="px-3 py-2 font-medium">연도</th>
            <th scope="col" className="px-3 py-2 font-medium">출처</th>
            <th scope="col" className="px-3 py-2 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const confirmed = row.status === "confirmed";
            return (
              <tr key={row.name} className="border-t border-foreground/15 align-top">
                <th scope="row" className="px-3 py-2 font-medium">{row.name}</th>
                <td className="break-words px-3 py-2">
                  {confirmed ? formatValue(row) : <span className="text-foreground/60">{STATUS_LABEL[row.status]}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {confirmed ? (row.valueYear ? `${row.valueYear}년` : "연도 미상") : "-"}
                </td>
                <td className="break-all px-3 py-2 text-xs">
                  {confirmed ? (
                    <>
                      {row.sourceRef}
                      {row.sourceQuote && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-foreground/70">원문 보기</summary>
                          <p className="mt-1 break-words rounded border border-foreground/15 bg-foreground/5 p-2 leading-5">
                            {row.sourceQuote}
                          </p>
                        </details>
                      )}
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="whitespace-nowrap">{STATUS_LABEL[row.status]}</span>
                  {row.status === "unverifiable" && row.reason && (
                    <p className="mt-1 text-xs text-foreground/60">{row.reason}</p>
                  )}
                  {row.status === "not_checked" && (
                    <p className="mt-1 text-xs text-foreground/60">이 기관을 저장한 뒤에 추가한 항목</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
