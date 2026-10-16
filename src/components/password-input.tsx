"use client";

import { useState } from "react";

// UX 개선: 비밀번호를 입력하는 동안 "보기"를 눌러 오타를 바로 확인할 수 있게 한다.
// 가입·로그인 화면이 함께 쓴다. (Design Ref: §2.1 회원가입·로그인 화면)
export function PasswordInput({
  id,
  name,
  autoComplete,
  describedBy,
  hasError,
}: {
  id: string;
  name: string;
  autoComplete: "new-password" | "current-password";
  describedBy?: string;
  hasError?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-1">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        // 보이는 상태에서 브라우저가 글자를 멋대로 고치거나 대문자로 바꾸지 않게 한다.
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-md border border-foreground/25 bg-background py-2 pl-3 pr-16 text-base outline-none focus:border-foreground"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        className="absolute inset-y-0 right-1 my-1 rounded px-2 text-sm text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
      >
        {visible ? "숨기기" : "보기"}
      </button>
    </div>
  );
}
