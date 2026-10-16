"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { renameInstitution } from "@/app/(content)/institutions/[id]/actions";

const BUTTON = "rounded-md border border-foreground/25 px-3 py-1.5 text-sm hover:bg-foreground/10 disabled:opacity-60";
const PRIMARY = "rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60";

// 기관 이름(제목)을 보여 주고, 고칠 수 있으면 [이름 수정]으로 바꾼다. 서버 작업(renameInstitution)이 본인 기관만 고친다.
export function InstitutionNameEditor({ institutionId, name, canEdit }: { institutionId: string; name: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function startEdit() {
    setValue(name);
    setMessage(null);
    setEditing(true);
  }

  async function save() {
    if (busy) return;
    if (value.trim() === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await renameInstitution({ institutionId, name: value });
    if (result.status === "error") {
      setMessage(result.message);
      setBusy(false);
      return;
    }
    setEditing(false);
    setBusy(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{name}</h1>
        {canEdit && (
          <button type="button" onClick={startEdit} className={BUTTON}>
            이름 수정
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label htmlFor="institution-name" className="text-sm font-medium">
        기관 이름
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="institution-name"
          type="text"
          value={value}
          maxLength={100}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
          }}
          disabled={busy}
          autoFocus
          aria-invalid={message ? true : undefined}
          className="w-full max-w-md rounded-md border border-foreground/25 bg-background px-3 py-2 text-base outline-none focus:border-foreground"
        />
        <button type="submit" disabled={busy || value.trim() === ""} className={PRIMARY}>
          {busy ? "저장 중…" : "저장"}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={busy} className={BUTTON}>
          취소
        </button>
      </div>
      {message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}
    </form>
  );
}
