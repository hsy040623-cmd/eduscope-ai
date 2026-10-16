"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logIn, type LoginState } from "@/app/(auth)/login/actions";
import { PasswordInput } from "@/components/password-input";

const INITIAL_STATE: LoginState = { status: "idle" };

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-foreground/25 bg-background px-3 py-2 text-base outline-none focus:border-foreground";

// Design Ref: §2.1 — 로그인 화면(`/login`). 이메일·비밀번호만 받는다.
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(logIn, INITIAL_STATE);
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
          비밀번호
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          hasError={Boolean(errors.password)}
          describedBy={errors.password ? "password-error" : undefined}
        />
        {errors.password && (
          <p id="password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-foreground px-4 py-2.5 font-medium text-background disabled:opacity-60"
      >
        {isPending ? "로그인 중…" : "로그인"}
      </button>

      <p className="text-center text-sm text-foreground/70">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
