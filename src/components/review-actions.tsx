"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteInstitution, saveInstitution } from "@/app/(content)/institutions/[id]/actions";

const BUTTON = "rounded-md border border-foreground/25 px-3 py-1.5 text-sm hover:bg-foreground/10 disabled:opacity-60";
const DELETE_BUTTON =
  "btn-red rounded-md border border-red-500/50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400";
const PRIMARY = "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60";

// Design Ref: §2.4 — 기준연도만 고칠 수 있고, 기준연도가 비어 있으면 [저장]이 눌리지 않는다. 같은 기관·같은 연도면 덮어쓰기 확인을 한다.
// Plan SC: 작업 14. 저장 요청에는 기관 번호와 기준연도만 보낸다.
export function ReviewActions({
  institutionId,
  name,
  initialYear,
  canSave,
}: {
  institutionId: string;
  name: string;
  initialYear: number | null;
  canSave: boolean; // 확인 대기 상태일 때만 저장할 수 있다
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear ? String(initialYear) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [askOverwrite, setAskOverwrite] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const yearNumber = Number(year);
  const yearValid = /^\d{4}$/.test(year.trim()) && yearNumber >= 1900 && yearNumber <= 2100;

  async function save(overwrite: boolean) {
    if (busy || !yearValid) return;
    setBusy(true);
    setMessage(null);
    const result = await saveInstitution({ institutionId, baseYear: yearNumber, overwrite });
    if (result.status === "needs-overwrite") {
      setAskOverwrite(true);
      setBusy(false);
      return;
    }
    if (result.status === "error") {
      setAskOverwrite(false);
      setMessage(result.message);
      setBusy(false);
      return;
    }
    setAskOverwrite(false);
    router.refresh();
    setBusy(false);
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await deleteInstitution(institutionId);
    if (result.status === "error") {
      setMessage(result.message);
      setBusy(false);
      setAskDelete(false);
      return;
    }
    router.push("/institutions");
  }

  return (
    <div className="space-y-3">
      {message && (
        <p role="alert" className="rounded-md border border-red-500/50 p-3 text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}

      {canSave && (
        <div>
          <label htmlFor="base-year" className="text-sm font-medium">
            기준연도
          </label>
          <input
            id="base-year"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={(event) => {
              setYear(event.target.value.replace(/\D/g, ""));
              setAskOverwrite(false);
            }}
            disabled={busy}
            aria-describedby="base-year-help"
            aria-invalid={year !== "" && !yearValid ? true : undefined}
            className="mt-1 block w-28 rounded-md border border-foreground/25 bg-background px-3 py-2 text-base outline-none focus:border-foreground"
          />
          <p id="base-year-help" className="mt-1 text-xs text-foreground/60">
            {year === "" ? "자료에서 기준연도를 찾지 못했습니다. 직접 입력해야 저장할 수 있습니다. " : ""}
            값은 고칠 수 없고 기준연도만 고칠 수 있습니다.
          </p>
        </div>
      )}

      {askOverwrite && (
        <div role="alertdialog" aria-label="덮어쓰기 확인" className="rounded-md border border-foreground/40 p-4 text-sm">
          <p className="font-medium">
            이미 저장된 &quot;{name}&quot; ({yearNumber}년)이 있습니다. 새 자료로 바꿀까요?
          </p>
          <p className="mt-1 text-foreground/70">바꾸면 기존에 저장된 값은 지워지고 되돌릴 수 없습니다.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => save(true)} disabled={busy} className={PRIMARY}>
              바꾸고 저장
            </button>
            <button type="button" onClick={() => setAskOverwrite(false)} disabled={busy} className={BUTTON}>
              취소
            </button>
          </div>
        </div>
      )}

      {askDelete && (
        <div role="alertdialog" aria-label="삭제 확인" className="rounded-md border border-foreground/40 p-4 text-sm">
          <p className="font-medium">&quot;{name}&quot; 기관과 정리된 값을 삭제할까요?</p>
          <p className="mt-1 text-foreground/70">삭제하면 되돌릴 수 없습니다.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={remove} disabled={busy} className={PRIMARY}>
              삭제
            </button>
            <button type="button" onClick={() => setAskDelete(false)} disabled={busy} className={BUTTON}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* 맨 아래 단추 줄: 저장(크게) 옆에 삭제 */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {canSave && (
          <button type="button" onClick={() => save(false)} disabled={busy || !yearValid} className={PRIMARY}>
            {busy ? "처리 중…" : "저장"}
          </button>
        )}
        <button type="button" onClick={() => setAskDelete(true)} disabled={busy || askDelete} className={DELETE_BUTTON}>
          삭제
        </button>
      </div>

      <p className="text-sm leading-6 text-foreground/70">
        {canSave && (
          <>
            <strong className="font-medium text-foreground">저장</strong>하면 &quot;내 기관&quot;에 저장되어 목록과 비교에서 쓸 수 있습니다.{" "}
          </>
        )}
        <strong className="font-medium text-foreground">삭제</strong>하면 이 기관과 정리된 데이터가 모두 지워지고 되돌릴 수 없습니다.
      </p>
    </div>
  );
}
