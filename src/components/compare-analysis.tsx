"use client";

import { useState } from "react";
import { generateAnalysis, type AnalysisResult } from "@/app/(content)/compare/result/actions";

// Design Ref: §2.5 — 차이 분석: 항목별로 문장을 보여 주고, 문장마다 근거 항목을 붙인다.
// Plan SC: 작업 20 — AI가 쓴 문장이며 표의 값과 맞는 것만 보여 준다. 버튼을 눌러야 만든다. (새로고침마다 AI 비용이 들지 않게)
export function CompareAnalysis({ idsParam, hasComparableItems }: { idsParam: string; hasComparableItems: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(await generateAnalysis(idsParam));
    } catch {
      setResult({ status: "error", message: "차이 분석을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요." });
    }
    setBusy(false);
  }

  if (!hasComparableItems) {
    return (
      <p className="rounded-md border border-foreground/15 p-4 text-sm text-foreground/70">
        값이 확인된 기관이 2곳 이상인 항목이 없어 차이 분석 문장을 만들지 않습니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {busy ? "분석하는 중…" : result ? "다시 만들기" : "차이 분석 만들기"}
        </button>
        {busy && <span aria-live="polite" className="text-sm text-foreground/70">AI가 비교표를 읽고 있습니다. 10~30초 걸립니다.</span>}
      </div>

      {result?.status === "error" && (
        <p role="alert" className="rounded-md border border-red-500/50 p-3 text-sm text-red-600 dark:text-red-400">
          {result.message}
        </p>
      )}
      {result?.status === "empty" && <p className="rounded-md border border-foreground/25 p-3 text-sm">{result.message}</p>}

      {result?.status === "ok" && (
        <div className="space-y-4">
          <ul className="space-y-3">
            {result.groups.map((group) => (
              <li key={group.itemName} className="rounded-md border border-foreground/25 p-4">
                <h3 className="text-sm font-semibold">{group.itemName}</h3>
                <ul className="mt-2 space-y-2">
                  {group.sentences.map((sentence) => (
                    <li key={sentence} className="text-sm leading-6">
                      {sentence}{" "}
                      <span className="whitespace-nowrap rounded border border-foreground/25 px-1.5 py-0.5 text-xs text-foreground/70">
                        근거: {group.itemName}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="text-xs text-foreground/60">
            AI가 쓴 문장입니다. 비교표의 값과 맞는지 코드로 검사해서 맞는 문장만 보여 줍니다
            {result.droppedCount > 0 ? ` (맞지 않아 뺀 문장 ${result.droppedCount}개)` : ""}. 중요한 판단 전에는 위 표와 출처를 함께 확인해 주세요.
          </p>
        </div>
      )}
    </div>
  );
}
