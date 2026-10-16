import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { InstitutionNameEditor } from "@/components/institution-name-editor";
import { ResultTable } from "@/components/result-table";
import { ReviewActions } from "@/components/review-actions";
import { getInstitutionDetail } from "@/lib/institution-detail";

export const metadata: Metadata = {
  title: "기관 결과 확인 · EduScope AI",
};

const STATUS_TEXT = {
  processing: "처리 중",
  pending_review: "확인 대기",
  saved: "저장됨",
  failed: "실패",
} as const;

// Design Ref: §2.4 — 기관 결과 확인(`/institutions/[id]`): AI가 정리한 값 확인, 기준연도 수정(값은 수정 불가), 저장·삭제.
// Plan SC: 작업 14 — 로그인·주소 번호를 읽는 부분은 <Suspense> 안에 둔다. (cacheComponents)
async function DetailContent({ params }: { params: PageProps<"/institutions/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getInstitutionDetail(id);
  if (!detail) notFound(); // 없거나 남의 기관이면 똑같이 "없음"

  const sourceLabel = detail.sourceType === "pdf" ? `PDF 파일 ${detail.sourceRef}` : detail.sourceRef;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-foreground/60">
          <Link href="/institutions" className="underline">
            내 기관
          </Link>{" "}
          / 기관 결과 확인
        </p>
        <InstitutionNameEditor
          key={`${detail.id}-${detail.name}`}
          institutionId={detail.id}
          name={detail.name}
          canEdit={detail.status === "pending_review" || detail.status === "saved"}
        />
        <p className="mt-2 text-sm text-foreground/70">
          상태: <strong>{STATUS_TEXT[detail.status]}</strong>
          {detail.status === "saved" && detail.baseYear ? ` · 기준연도 ${detail.baseYear}년` : ""}
          {" · "}
          <span className="break-all">자료: {sourceLabel}</span>
          {detail.pageCount && detail.charCount
            ? ` (${detail.sourceType === "pdf" ? `${detail.pageCount}쪽, ` : ""}${detail.charCount.toLocaleString("ko-KR")}자를 읽음)`
            : ""}
        </p>
        {detail.readPages.length > 1 && (
          <details className="mt-3 rounded-md border border-foreground/25 p-3 text-sm">
            <summary className="cursor-pointer font-medium">AI가 읽은 페이지 {detail.readPages.length}개 (입력한 페이지 + 같은 사이트의 관련 페이지)</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 break-all text-foreground/70">
              {detail.readPages.map((url, index) => (
                <li key={url}>
                  {url}
                  {index === 0 ? " (입력한 페이지)" : ""}
                </li>
              ))}
            </ol>
          </details>
        )}
      </header>

      {detail.status === "failed" && (
        <p role="alert" className="rounded-md border border-red-500/50 p-3 text-sm text-red-600 dark:text-red-400">
          정리하지 못했습니다. {detail.failureReason ?? "이유를 알 수 없습니다."} (다시 시도 기능은 다음 작업에서 연결됩니다.)
        </p>
      )}
      {detail.status === "processing" && (
        <p className="rounded-md border border-foreground/25 p-3 text-sm text-foreground/80">
          아직 정리가 끝나지 않았거나 중간에 멈춘 기관입니다. 진행 상태 표시와 다시 시도는 다음 작업에서 연결됩니다.
        </p>
      )}
      {detail.status === "pending_review" && (
        <p className="rounded-md border border-foreground/25 bg-foreground/5 p-3 text-sm leading-6">
          AI가 정리한 결과입니다. 값은 원문에서 확인된 것만 &quot;확인됨&quot;으로 표시합니다. 출처의 &quot;원문 보기&quot;로 근거 문장을
          확인하고, 기준연도가 맞는지 확인한 뒤 저장하세요. 저장하기 전에는 기관 목록과 비교에 나타나지 않습니다.
        </p>
      )}
      {detail.status === "saved" && (
        <p className="rounded-md border border-foreground/25 bg-foreground/5 p-3 text-sm">
          저장되었습니다. 이제 &quot;내 기관&quot; 목록에서 볼 수 있습니다. 기관 2곳 이상을 저장하면 상단 메뉴의 &quot;비교&quot;에서 고를 수 있습니다.
        </p>
      )}

      {(detail.status === "pending_review" || detail.status === "saved") && <ResultTable rows={detail.rows} />}

      <ReviewActions
        key={`${detail.id}-${detail.status}`}
        institutionId={detail.id}
        name={detail.name}
        initialYear={detail.baseYear}
        canSave={detail.status === "pending_review"}
      />
    </div>
  );
}

export default function InstitutionDetailPage(props: PageProps<"/institutions/[id]">) {
  return (
    <section className="break-keep">
      <Suspense fallback={<p className="text-foreground/60">불러오는 중…</p>}>
        <DetailContent params={props.params} />
      </Suspense>
    </section>
  );
}
