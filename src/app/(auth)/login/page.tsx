import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "로그인 · EduScope AI",
};

// Design Ref: §2.1 — 로그인 화면(`/login`)은 로그인하지 않아도 들어올 수 있다. 서비스 소개는 (auth) 레이아웃의 왼쪽에 보여 준다.
export default function LoginPage() {
  return (
    <div className="break-keep">
      <h1 className="text-2xl font-bold tracking-tight">로그인</h1>
      <p className="mt-2 text-sm leading-6 text-muted">내 계정에 저장한 기관은 나만 볼 수 있습니다. 공개된 교육기관 자료만 사용합니다.</p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
