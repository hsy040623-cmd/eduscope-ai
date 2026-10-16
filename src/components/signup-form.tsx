"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type SignupState } from "@/app/(auth)/signup/actions";
import { PasswordInput } from "@/components/password-input";

const INITIAL_STATE: SignupState = { status: "idle" };

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-foreground/25 bg-background px-3 py-2 text-base outline-none focus:border-foreground";

// Design Ref: §2.1 — 회원가입 화면(`/signup`). 이메일·비밀번호만 받는다.
export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signUp, INITIAL_STATE);

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-md border border-foreground/25 p-4">
        <p className="font-medium">가입이 완료되었습니다.</p>
        <p className="mt-2 text-sm text-foreground/70">
          기본 정리 항목 6개가 준비되었습니다.{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            로그인
          </Link>
          해 주세요.
        </p>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.message && (
        <p role="alert" className="rounded-md border border-red-500/50 p-3 text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="email" className="text-sm font-medium">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={INPUT_CLASS}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium">
          비밀번호 <span className="font-normal text-foreground/60">(8자 이상)</span>
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          hasError={Boolean(errors.password)}
          describedBy={errors.password ? "password-error" : undefined}
        />
        {errors.password && (
          <p id="password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.password}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="passwordConfirm" className="text-sm font-medium">
          비밀번호 확인
        </label>
        <PasswordInput
          id="passwordConfirm"
          name="passwordConfirm"
          autoComplete="new-password"
          hasError={Boolean(errors.passwordConfirm)}
          describedBy={errors.passwordConfirm ? "passwordConfirm-error" : undefined}
        />
        {errors.passwordConfirm && (
          <p id="passwordConfirm-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.passwordConfirm}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-foreground px-4 py-2.5 font-medium text-background disabled:opacity-60"
      >
        {isPending ? "가입 중…" : "회원가입"}
      </button>
    </form>
  );
}
