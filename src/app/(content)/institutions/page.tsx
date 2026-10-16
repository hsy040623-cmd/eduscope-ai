import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { InstitutionListItem } from "@/components/institution-list-item";
import { listSavedInstitutions } from "@/lib/institution-list";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "내 기관 · EduScope AI",
};

// 저장한 날짜는 한국시간 기준으로 보여 준다.
const savedDateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

// Design Ref: §2.1 — 내 기관(`/institutions`)은 로그인한 사람이 저장한 기관만 모아 보는 화면이다. 눌러서 결과를 보거나 삭제한다.
// (원래 홈에 있던 목록을 사이트 디자인 개편 때 이 화면으로 나눴다. 홈은 소개·기능 안내만 보여 준다.)
// Plan SC: 작업 16 — 로그인 정보를 읽는 부분은 <Suspense> 안에 둔다. (cacheComponents)
async function InstitutionsContent() {
  const user = await requireUser();
  const institutions = await listSavedInstitutions();

  return (
    <>
      <p className="mt-2 text-sm text-muted">
        {user.email} 님이 저장한 기관 <strong className="text-foreground">{institutions.length}곳</strong>
      </p>

      {institutions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-background/60 p-8 text-center text-sm text-muted">
          <p>저장한 기관이 아직 없습니다. 기관을 등록하고 결과를 확인해 저장하면 여기에 나타납니다.</p>
          <Link href="/institutions/new" className="mt-4 inline-block rounded-lg bg-foreground px-5 py-2.5 font-medium text-background">
            기관 등록하기
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {institutions.map((institution) => (
              <InstitutionListItem
                key={institution.id}
                institution={institution}
                savedDate={institution.savedAt ? savedDateFormat.format(new Date(institution.savedAt)) : ""}
              />
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            결과 확인 후 저장한 기관만 나타납니다. 둘 이상 저장했다면 상단 메뉴의 &quot;비교&quot;에서 기관을 골라 비교할 수 있습니다.
          </p>
        </>
      )}
    </>
  );
}

export default function InstitutionsPage() {
  return (
    <section className="break-keep">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand">내 기관</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">저장한 기관</h1>
        </div>
        <Link
          href="/institutions/new"
          className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-brand hover:text-brand"
        >
          <Icon name="upload" className="h-4 w-4 text-brand" />
          기관 등록
        </Link>
      </div>
      <Suspense fallback={<p className="mt-6 text-muted">불러오는 중…</p>}>
        <InstitutionsContent />
      </Suspense>
    </section>
  );
}
