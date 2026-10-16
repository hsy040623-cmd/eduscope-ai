import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompareSelector } from "@/components/compare-selector";
import { MAX_COMPARE_INSTITUTIONS, MIN_COMPARE_INSTITUTIONS } from "@/lib/compare-limits";
import { listSavedInstitutions } from "@/lib/institution-list";

export const metadata: Metadata = {
  title: "비교 선택 · EduScope AI",
};

const savedDateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

// Design Ref: §2.1 — 비교 선택(`/compare`): 저장된 기관 2~5개 고르기. 저장된 기관만 고를 수 있다.
// Plan SC: 작업 17 — 로그인 정보를 읽는 부분은 <Suspense> 안에 둔다. (cacheComponents)
async function CompareContent() {
  const institutions = await listSavedInstitutions();

  if (institutions.length < MIN_COMPARE_INSTITUTIONS) {
    return (
      <div className="rounded-md border border-foreground/15 p-5 text-sm text-foreground/70">
        <p>
          비교하려면 저장된 기관이 {MIN_COMPARE_INSTITUTIONS}곳 이상 필요합니다. 지금은 {institutions.length}곳입니다.
        </p>
        <Link href="/institutions/new" className="mt-3 inline-block rounded-md bg-foreground px-3 py-1.5 font-medium text-background">
          기관 등록하기
        </Link>
      </div>
    );
  }

  return (
    <CompareSelector
      institutions={institutions.map((institution) => ({
        ...institution,
        savedDate: institution.savedAt ? savedDateFormat.format(new Date(institution.savedAt)) : "",
      }))}
    />
  );
}

export default function ComparePage() {
  return (
    <section className="break-keep">
      <h1 className="text-2xl font-semibold tracking-tight">비교 선택</h1>
      <p className="mt-2 text-sm text-foreground/70">
        저장된 기관 중 비교할 기관을 {MIN_COMPARE_INSTITUTIONS}~{MAX_COMPARE_INSTITUTIONS}곳 고르세요. 결과 확인 후 저장한 기관만 나타납니다.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-foreground/60">불러오는 중…</p>}>
          <CompareContent />
        </Suspense>
      </div>
    </section>
  );
}
