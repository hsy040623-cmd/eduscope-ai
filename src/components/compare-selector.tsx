"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MAX_COMPARE_INSTITUTIONS, MIN_COMPARE_INSTITUTIONS } from "@/lib/compare-limits";
import type { SavedInstitution } from "@/lib/institution-list";

// Design Ref: §2.1 — 비교 선택(`/compare`): 저장된 기관 2~5개를 고른다. 5개를 넘게 고를 수 없다.
// Plan SC: 작업 17·18. [비교하기]를 누르면 고른 기관 번호를 주소에 담아 비교 결과 화면으로 간다. (번호는 그 화면에서 서버가 다시 검사한다)
export function CompareSelector({ institutions }: { institutions: (SavedInstitution & { savedDate: string })[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();

  // 이 화면을 떠나면(다른 화면으로 가서 가려지거나 사라지면) 고른 기관을 모두 비운다. 상단 "비교"를 다시 누르면 아무것도 고르지 않은 처음 상태다.
  // (Next.js는 이전 화면의 상태를 남겨 두므로, 떠날 때 직접 비워야 한다)
  useEffect(() => () => setSelected([]), []);

  const count = selected.length;
  const full = count >= MAX_COMPARE_INSTITUTIONS;
  const canCompare = count >= MIN_COMPARE_INSTITUTIONS && count <= MAX_COMPARE_INSTITUTIONS;
  const chosen = selected.flatMap((id) => institutions.filter((institution) => institution.id === id));
  const years = [...new Set(chosen.map((institution) => institution.baseYear))].sort();

  // 전체 선택: 저장된 기관을 모두 고른다. 이미 모두 선택되어 있으면 한 번 더 눌러 전부 해제한다.
  // 비교는 최대 5곳이라, 5곳을 넘게 골랐을 때는 [비교하기]를 막고 몇 곳을 해제해야 하는지 알려 준다.
  const allSelected = institutions.length > 0 && institutions.every((institution) => selected.includes(institution.id));
  const tooMany = count > MAX_COMPARE_INSTITUTIONS;

  function toggleAll() {
    setSelected(allSelected ? [] : institutions.map((institution) => institution.id));
  }

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= MAX_COMPARE_INSTITUTIONS) return current;
      return [...current, id];
    });
  }

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="text-sm">
        <strong>
          {count} / {MAX_COMPARE_INSTITUTIONS}
        </strong>
        곳 선택{" "}
        <span className="text-foreground/60">
          ({MIN_COMPARE_INSTITUTIONS}~{MAX_COMPARE_INSTITUTIONS}곳을 고를 수 있습니다)
        </span>
        {full && !tooMany && <span className="ml-2 text-foreground/70">최대 {MAX_COMPARE_INSTITUTIONS}곳까지 고를 수 있어 더 고를 수 없습니다.</span>}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleAll}
          disabled={institutions.length === 0}
          aria-pressed={allSelected}
          className="rounded-md border border-foreground/25 px-3 py-1.5 text-sm font-medium hover:bg-foreground/10 disabled:opacity-50"
        >
          {allSelected ? "전체 선택 해제" : "전체 선택"}
        </button>
      </div>

      <ul className="space-y-2">
        {institutions.map((institution) => {
          const checked = selected.includes(institution.id);
          const disabled = !checked && full;
          return (
            <li key={institution.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                  checked ? "border-foreground bg-foreground/5" : "border-foreground/25"
                } ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-foreground/5"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(institution.id)}
                  className="mt-1 h-4 w-4"
                />
                <span className="min-w-0">
                  <span className="block break-words font-medium">
                    {institution.name} <span className="font-normal text-foreground/70">· {institution.baseYear}년</span>
                  </span>
                  <span className="block text-sm text-foreground/70">
                    확인된 항목 {institution.confirmedCount}/{institution.itemCount} · 저장 {institution.savedDate}
                  </span>
                  <span className="block break-all text-xs text-foreground/60">
                    자료: {institution.sourceType === "pdf" ? `PDF 파일 ${institution.sourceRef}` : institution.sourceRef}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {years.length > 1 && (
        <p role="status" className="rounded-md border border-foreground/40 p-3 text-sm">
          ⚠ 고른 기관의 기준연도가 서로 다릅니다 ({years.join(" / ")}년). 비교는 할 수 있지만 같은 해의 자료인지 확인해 주세요.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canCompare}
          onClick={() => router.push(`/compare/result?ids=${selected.join(",")}`)}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          비교하기
        </button>
        {tooMany && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            비교는 최대 {MAX_COMPARE_INSTITUTIONS}곳까지 할 수 있습니다. {count - MAX_COMPARE_INSTITUTIONS}곳을 해제해 주세요.
          </span>
        )}
        {count < MIN_COMPARE_INSTITUTIONS && (
          <span className="text-sm text-foreground/60">
            {count === 0 ? `기관을 ${MIN_COMPARE_INSTITUTIONS}곳 이상 고르세요.` : `${MIN_COMPARE_INSTITUTIONS - count}곳 이상 더 고르세요.`}
          </span>
        )}
        {count > 0 && (
          <button type="button" onClick={() => setSelected([])} className="text-sm underline">
            선택 모두 해제
          </button>
        )}
      </div>

    </div>
  );
}
