import type { Metadata } from "next";
import { Suspense } from "react";
import { InstitutionRegisterForm } from "@/components/institution-register-form";
import { getTodayRegistrationCount } from "@/lib/registration";

// 항목 정리(AI)는 최대 120초까지 걸릴 수 있어, 이 화면에서 부르는 서버 작업의 최대 실행 시간을 늘려 둔다.
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "기관 등록 · EduScope AI",
};

// Design Ref: §2.3 — 기관 등록(`/institutions/new`). 오늘 등록 횟수를 읽는 부분은 <Suspense> 안에 둔다. (cacheComponents)
async function RegisterContent() {
  const usedToday = await getTodayRegistrationCount();
  return <InstitutionRegisterForm usedToday={usedToday} />;
}

export default function NewInstitutionPage() {
  return (
    <section className="max-w-2xl break-keep">
      <h1 className="text-2xl font-semibold tracking-tight">기관 등록</h1>

      <div className="mt-4 rounded-md border border-foreground/25 bg-foreground/5 p-4 text-sm leading-6">
        <p className="font-medium">※ 등록하기 전에 확인해 주세요</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/80">
          <li>누구나 볼 수 있는 공개 자료만 올려 주세요. 대외비·내부용 문서는 올리지 마세요.</li>
          <li>자료 내용은 분석을 위해 외부 AI 서비스로 전송됩니다. 소속 기관의 외부 AI 서비스 이용 정책을 먼저 확인해 주세요.</li>
        </ul>
      </div>

      <div className="mt-8">
        <Suspense fallback={<p className="text-foreground/60">불러오는 중…</p>}>
          <RegisterContent />
        </Suspense>
      </div>
    </section>
  );
}
