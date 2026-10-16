"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  analyzeInstitution,
  finalizePdfRegistration,
  finalizeUrlRegistration,
  prepareRegistration,
  type RegistrationResult,
} from "@/app/(content)/institutions/new/actions";
import { DAILY_REGISTRATION_LIMIT, MAX_PDF_BYTES, MAX_URL_LENGTH } from "@/lib/registration-limits";

type Phase = "idle" | "checking" | "uploading" | "verifying" | "reading" | "organizing";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-foreground/25 bg-background px-3 py-2 text-base outline-none focus:border-foreground";

const ERROR_CLASS = "mt-1 text-sm text-red-600 dark:text-red-400";

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Design Ref: §2.3·§3.1 ① — 기관 등록 화면. 홈페이지 주소 또는 교육계획서 PDF를 등록한다.
// PDF는 서버 요청 한도(4.5MB) 때문에 서버가 준 업로드 주소로 브라우저가 직접 올린다. 브라우저에는 Supabase 키가 없다.
export function InstitutionRegisterForm({ usedToday }: { usedToday: number }) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"url" | "pdf">("url");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<{ name?: string; url?: string; file?: string; message?: string }>({});
  const isBusy = phase !== "idle";
  const limitReached = usedToday >= DAILY_REGISTRATION_LIMIT;

  function showResultError(result: Extract<RegistrationResult, { status: "error" }>) {
    setErrors({ ...result.fieldErrors, message: result.message });
    setPhase("idle");
  }

  // 글자 읽기가 끝나면 이어서 AI가 항목별로 정리한다. (서버가 DB에 저장해 둔 글자·항목만 쓴다)
  // 정리가 끝나면 결과 확인 화면으로 이동해서 값과 기준연도를 확인하고 저장한다. (작업 14)
  async function organize(institutionId: string) {
    setPhase("organizing");
    const analyzed = await analyzeInstitution(institutionId);
    if (analyzed.status === "error") {
      router.refresh();
      return showResultError(analyzed);
    }
    router.push(`/institutions/${analyzed.institutionId}`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy || limitReached) return;
    setErrors({});

    // 브라우저에서 먼저 확인해 불필요한 요청을 줄인다. (같은 검사를 서버가 다시 한다)
    if (sourceType === "pdf" && file && file.size > MAX_PDF_BYTES) {
      setErrors({ file: `PDF는 20MB 이하만 올릴 수 있습니다. (선택한 파일 ${formatMegabytes(file.size)})` });
      return;
    }

    setPhase("checking");
    const prepared = await prepareRegistration({
      name,
      sourceType,
      url: sourceType === "url" ? url : undefined,
      fileName: sourceType === "pdf" ? file?.name : undefined,
      fileSize: sourceType === "pdf" ? file?.size : undefined,
    });

    if (prepared.status === "error") return showResultError(prepared);

    // 홈페이지 주소: 서버가 페이지를 안전하게 가져와 본문 글자를 읽는다. (주소는 서버에 저장된 값을 쓴다)
    if (prepared.status === "url-ready") {
      setPhase("reading");
      const read = await finalizeUrlRegistration(prepared.institutionId);
      router.refresh();
      if (read.status === "error") return showResultError(read);
      if (read.status === "accepted") return organize(read.institutionId);
      setPhase("idle");
      return;
    }

    if (prepared.status !== "pdf-ready") return setPhase("idle");

    // PDF: 서버가 준 주소로 직접 올린다.
    if (!file) return setPhase("idle");
    setPhase("uploading");
    let uploadFailed = false;
    try {
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const response = await fetch(prepared.uploadUrl, { method: "PUT", body });
      uploadFailed = !response.ok;
    } catch {
      uploadFailed = true;
    }

    // 올리기에 실패해도 서버에 알려서 접수한 기관을 "실패"로 정리한다.
    setPhase("verifying");
    const finalized = await finalizePdfRegistration(prepared.institutionId);
    router.refresh();

    if (finalized.status === "error") return showResultError(finalized);
    if (uploadFailed) {
      setErrors({ message: "파일을 올리지 못했습니다. 다시 시도해 주세요." });
      setPhase("idle");
      return;
    }
    if (finalized.status === "accepted") return organize(finalized.institutionId);
    setPhase("idle");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {errors.message && (
        <p role="alert" className="rounded-md border border-red-500/50 p-3 text-sm text-red-600 dark:text-red-400">
          {errors.message}
        </p>
      )}

      <div>
        <label htmlFor="institution-name" className="text-sm font-medium">
          기관 이름
        </label>
        <input
          id="institution-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          required
          disabled={isBusy}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "institution-name-error" : undefined}
          className={INPUT_CLASS}
        />
        {errors.name && (
          <p id="institution-name-error" className={ERROR_CLASS}>
            {errors.name}
          </p>
        )}
      </div>

      <fieldset disabled={isBusy} className="space-y-4">
        <legend className="text-sm font-medium">자료 등록 방법</legend>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sourceType"
              value="url"
              checked={sourceType === "url"}
              onChange={() => setSourceType("url")}
            />
            홈페이지 주소
          </label>
          {sourceType === "url" && (
            <div className="mt-2 pl-6">
              <label htmlFor="institution-url" className="sr-only">
                홈페이지 주소
              </label>
              <input
                id="institution-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
                maxLength={MAX_URL_LENGTH}
                aria-invalid={errors.url ? true : undefined}
                aria-describedby="institution-url-help"
                className={INPUT_CLASS}
              />
              <p id="institution-url-help" className="mt-1 text-xs text-foreground/60">
                교육계획서가 있는 페이지(또는 PDF 파일)의 주소를 입력하세요. 입력한 페이지를 읽고, 필요하면 AI가 같은 사이트의 관련 페이지(최대 5개)도 함께 읽습니다.
              </p>
              {errors.url && <p className={ERROR_CLASS}>{errors.url}</p>}
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sourceType"
              value="pdf"
              checked={sourceType === "pdf"}
              onChange={() => setSourceType("pdf")}
            />
            교육계획서 PDF <span className="text-foreground/60">(20MB·300쪽 이하)</span>
          </label>
          {sourceType === "pdf" && (
            <div className="mt-2 pl-6">
              <label htmlFor="institution-file" className="sr-only">
                PDF 파일
              </label>
              <input
                id="institution-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                aria-invalid={errors.file ? true : undefined}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-foreground/25 file:bg-background file:px-3 file:py-1.5 file:text-sm"
              />
              {file && (
                <p className="mt-1 text-xs text-foreground/60">
                  선택한 파일: {file.name} ({formatMegabytes(file.size)})
                </p>
              )}
              {errors.file && <p className={ERROR_CLASS}>{errors.file}</p>}
            </div>
          )}
        </div>
      </fieldset>

      <div className="space-y-3">
        <p className="text-sm text-foreground/70">
          오늘 등록 <strong>{usedToday}</strong> / {DAILY_REGISTRATION_LIMIT}
          {limitReached && " — 오늘 한도를 모두 사용했습니다. 내일 0시(한국시간) 이후에 다시 등록할 수 있습니다."}
        </p>

        <button
          type="submit"
          disabled={isBusy || limitReached}
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
        >
          {isBusy ? "처리 중…" : "등록하기"}
        </button>

        {isBusy && <ProgressSteps sourceType={sourceType} phase={phase} />}
      </div>
    </form>
  );
}

// 진행 단계 표시: 지나간 단계는 ✓, 지금 단계는 ●, 남은 단계는 ○
function ProgressSteps({ sourceType, phase }: { sourceType: "url" | "pdf"; phase: Phase }) {
  const steps: { phase: Phase; label: string }[] =
    sourceType === "url"
      ? [
          { phase: "checking", label: "검사 중" },
          { phase: "reading", label: "페이지 읽는 중" },
          { phase: "organizing", label: "항목 정리 중 (1분 안팎)" },
        ]
      : [
          { phase: "checking", label: "검사 중" },
          { phase: "uploading", label: "파일 올리는 중" },
          { phase: "verifying", label: "파일 확인 중" },
          { phase: "organizing", label: "항목 정리 중 (1분 안팎)" },
        ];
  const current = steps.findIndex((step) => step.phase === phase);
  return (
    <ol aria-live="polite" className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground/70">
      {steps.map((step, index) => (
        <li key={step.phase} className={index === current ? "font-medium text-foreground" : ""}>
          {index < current ? "✓" : index === current ? "●" : "○"} {step.label}
        </li>
      ))}
    </ol>
  );
}
