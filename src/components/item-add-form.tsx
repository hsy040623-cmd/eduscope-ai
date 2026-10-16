"use client";

import { useActionState } from "react";
import { addItem, type ItemFormState } from "@/app/(content)/items/actions";

const INITIAL_STATE: ItemFormState = { status: "idle" };

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-foreground/25 bg-background px-3 py-2 text-base outline-none focus:border-foreground";

// Design Ref: §2.1·§4 — 항목 관리 화면의 "항목 추가". 추가 항목은 최대 4개라서 가득 차면 입력을 막고 이유를 알려 준다.
export function ItemAddForm({ addedCount, maxAdded }: { addedCount: number; maxAdded: number }) {
  const [state, formAction, isPending] = useActionState(addItem, INITIAL_STATE);
  const isFull = addedCount >= maxAdded;
  const errors = state.fieldErrors ?? {};

  if (isFull) {
    return (
      <p className="rounded-md border border-foreground/15 p-4 text-sm text-foreground/70">
        추가 항목을 {maxAdded}개까지 모두 만들었습니다. 새 항목을 추가하려면 기존 추가 항목을 먼저 삭제해 주세요.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-md border border-red-500/50 p-3 text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "success" && state.message && (
        <p role="status" className="rounded-md border border-foreground/25 p-3 text-sm">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="add-name" className="text-sm font-medium">
          항목 이름
        </label>
        <input
          id="add-name"
          name="name"
          type="text"
          maxLength={50}
          required
          defaultValue={state.values?.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "add-name-error" : undefined}
          className={INPUT_CLASS}
        />
        {errors.name && (
          <p id="add-name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="add-description" className="text-sm font-medium">
          설명 <span className="font-normal text-foreground/60">(선택)</span>
        </label>
        <input
          id="add-description"
          name="description"
          type="text"
          maxLength={200}
          defaultValue={state.values?.description}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby="add-description-help"
          className={INPUT_CLASS}
        />
        <p id="add-description-help" className="mt-1 text-xs text-foreground/60">
          AI가 자료에서 무엇을 찾아야 하는지 알려 주는 설명입니다. 구체적일수록 정확합니다.
        </p>
        {errors.description && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>}
      </div>

      <div>
        <label htmlFor="add-type" className="text-sm font-medium">
          값의 유형
        </label>
        <select
          id="add-type"
          name="valueType"
          defaultValue={state.values?.valueType || "text"}
          aria-describedby="add-type-help"
          className={INPUT_CLASS}
        >
          <option value="text">글 (문장으로 된 내용)</option>
          <option value="number">숫자 (개수·비율처럼 계산할 값)</option>
        </select>
        <p id="add-type-help" className="mt-1 text-xs text-foreground/60">
          차트와 평균은 숫자 항목에만 쓰이고, 글 항목은 표에 그대로 보여 줍니다.
        </p>
        {errors.valueType && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.valueType}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
      >
        {isPending ? "추가 중…" : "항목 추가"}
      </button>
    </form>
  );
}
