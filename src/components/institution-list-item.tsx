"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteInstitution } from "@/app/(content)/institutions/[id]/actions";
import type { SavedInstitution } from "@/lib/institution-list";

const BUTTON = "rounded-md border border-foreground/25 px-3 py-1.5 text-sm hover:bg-foreground/10 disabled:opacity-60";
// 결과 보기: 파란 버튼. 삭제: 빨간 테두리·글자 (결과 확인 화면의 삭제 버튼과 같은 모양)
const BLUE_BUTTON =
  "bg-brand-gradient rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-[0_8px_18px_-8px_var(--brand)] hover:brightness-110";
const DELETE_BUTTON =
  "btn-red rounded-md border border-red-500/50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400";
const PRIMARY = "rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60";

// Design Ref: §2.1 — 내 기관 목록의 한 줄: 이름·기준연도·출처·확인된 항목 수, 결과 보기, 삭제(확인 후).
// Plan SC: 작업 16. 삭제는 결과 확인 화면과 같은 서버 작업(deleteInstitution)을 쓴다. (본인 기관만 지워진다)
export function InstitutionListItem({ institution, savedDate }: { institution: SavedInstitution; savedDate: string }) {
  const router = useRouter();
  const [askDelete, setAskDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await deleteInstitution(institution.id);
    if (result.status === "error") {
      setMessage(result.message);
      setBusy(false);
      setAskDelete(false);
      return;
    }
    router.refresh();
  }

  return (
    <li className="rounded-md border border-foreground/25 p-4">
      {/* 모든 항목이 같은 배치: 글자는 왼쪽, 버튼은 오른쪽 위. 자료 주소가 아무리 길어도 버튼이 아래로 내려가지 않는다. (좁은 화면에서만 버튼이 글 아래로 내려온다) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <h2 className="break-words text-lg font-semibold">
            <Link href={`/institutions/${institution.id}`} className="underline-offset-2 hover:underline">
              {institution.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            기준연도 <strong>{institution.baseYear}년</strong> · 확인된 항목 {institution.confirmedCount}/{institution.itemCount} ·
            저장 {savedDate}
          </p>
          <p className="mt-1 break-all text-xs text-foreground/60">
            자료: {institution.sourceType === "pdf" ? `PDF 파일 ${institution.sourceRef}` : institution.sourceRef}
          </p>
        </div>
        {!askDelete && (
          <div className="flex shrink-0 gap-2">
            <Link href={`/institutions/${institution.id}`} className={BLUE_BUTTON}>
              결과 보기
            </Link>
            <button type="button" onClick={() => setAskDelete(true)} disabled={busy} className={DELETE_BUTTON}>
              삭제
            </button>
          </div>
        )}
      </div>

      {message && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}

      {askDelete && (
        <div role="alertdialog" aria-label={`${institution.name} 삭제 확인`} className="mt-3 rounded-md border border-foreground/40 p-3 text-sm">
          <p className="font-medium">
            &quot;{institution.name}&quot;({institution.baseYear}년)과 정리된 값을 삭제할까요?
          </p>
          <p className="mt-1 text-foreground/70">삭제하면 되돌릴 수 없습니다.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={remove} disabled={busy} className={PRIMARY}>
              {busy ? "삭제 중…" : "삭제"}
            </button>
            <button type="button" onClick={() => setAskDelete(false)} disabled={busy} className={BUTTON}>
              취소
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
