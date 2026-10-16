"use client";

import { useActionState, useState } from "react";
import { deleteItem, updateItem, type ItemFormState } from "@/app/(content)/items/actions";
import type { Item } from "@/lib/items";

const INITIAL_STATE: ItemFormState = { status: "idle" };

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-foreground/25 bg-background px-3 py-2 text-base outline-none focus:border-foreground";

const TYPE_LABEL = { number: "숫자", text: "글" } as const;

// Design Ref: §4 — 기본 항목은 설명만 수정할 수 있고 지울 수 없다. 추가 항목은 이름·설명·유형을 고치거나 지울 수 있다.
export function ItemRow({ item }: { item: Item }) {
  const [editing, setEditing] = useState(false);

  // 저장에 성공하면 수정 화면을 닫는다.
  const [updateState, updateAction, isUpdating] = useActionState(
    async (previous: ItemFormState, formData: FormData) => {
      const result = await updateItem(previous, formData);
      if (result.status === "success") setEditing(false);
      return result;
    },
    INITIAL_STATE,
  );
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteItem, INITIAL_STATE);
  const errors = updateState.fieldErrors ?? {};
  const typeLabel = item.value_type === "number" || item.value_type === "text" ? TYPE_LABEL[item.value_type] : "?";

  if (editing) {
    return (
      <li className="rounded-md border border-foreground/25 p-4">
        <form action={updateAction} noValidate className="space-y-3">
          <input type="hidden" name="id" value={item.id} />
          {updateState.status === "error" && updateState.message && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {updateState.message}
            </p>
          )}

          {item.is_default ? (
            <>
              <p className="font-medium">
                {item.name} <span className="ml-1 text-sm font-normal text-foreground/60">({typeLabel}, 기본 항목)</span>
              </p>
              <input type="hidden" name="name" value={item.name} />
              <input type="hidden" name="valueType" value={item.value_type} />
            </>
          ) : (
            <>
              <div>
                <label htmlFor={`name-${item.id}`} className="text-sm font-medium">
                  항목 이름
                </label>
                <input
                  id={`name-${item.id}`}
                  name="name"
                  type="text"
                  maxLength={50}
                  required
                  defaultValue={updateState.values?.name ?? item.name}
                  aria-invalid={errors.name ? true : undefined}
                  className={INPUT_CLASS}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor={`type-${item.id}`} className="text-sm font-medium">
                  값의 유형
                </label>
                <select
                  id={`type-${item.id}`}
                  name="valueType"
                  defaultValue={updateState.values?.valueType || item.value_type}
                  className={INPUT_CLASS}
                >
                  <option value="text">글</option>
                  <option value="number">숫자</option>
                </select>
                <p className="mt-1 text-xs text-foreground/60">바꾼 유형은 이후 등록하는 기관부터 적용됩니다.</p>
              </div>
            </>
          )}

          <div>
            <label htmlFor={`desc-${item.id}`} className="text-sm font-medium">
              설명
            </label>
            <input
              id={`desc-${item.id}`}
              name="description"
              type="text"
              maxLength={200}
              defaultValue={updateState.values?.description ?? item.description ?? ""}
              aria-invalid={errors.description ? true : undefined}
              className={INPUT_CLASS}
            />
            {errors.description && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isUpdating}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60"
            >
              {isUpdating ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-foreground/25 px-3 py-1.5 text-sm hover:bg-foreground/10"
            >
              취소
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-foreground/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {item.name}{" "}
            <span className="ml-1 rounded bg-foreground/10 px-1.5 py-0.5 align-middle text-xs font-normal">{typeLabel}</span>
          </p>
          <p className="mt-1 text-sm text-foreground/70">{item.description || "설명이 없습니다."}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-foreground/25 px-3 py-1.5 text-sm hover:bg-foreground/10"
          >
            {item.is_default ? "설명 수정" : "수정"}
          </button>

          {!item.is_default && (
            <form
              action={deleteAction}
              onSubmit={(event) => {
                // 실수로 지우지 않도록 한 번 더 묻는다.
                if (!window.confirm(`"${item.name}" 항목을 삭제할까요?\n이미 정리된 값은 그대로 남습니다.`)) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                disabled={isDeleting}
                className="rounded-md border border-red-500/50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
              >
                {isDeleting ? "삭제 중…" : "삭제"}
              </button>
            </form>
          )}
        </div>
      </div>

      {deleteState.status === "error" && deleteState.message && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {deleteState.message}
        </p>
      )}
    </li>
  );
}
