import type { Metadata } from "next";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = {
  title: "회원가입 · EduScope AI",
};

// Design Ref: §2.1 — 회원가입 화면(`/signup`)은 로그인하지 않아도 들어올 수 있다.
export default function SignupPage() {
  return (
    <section className="mx-auto max-w-md break-keep">
      <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
      <p className="mt-2 text-sm text-foreground/70">
        이메일과 비밀번호로 가입합니다. 저장한 자료는 내 계정에서만 볼 수 있습니다.
      </p>
      <div className="mt-6">
        <SignupForm />
      </div>
    </section>
  );
}
