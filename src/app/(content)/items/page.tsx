import type { Metadata } from "next";
import { Suspense } from "react";
import { ItemAddForm } from "@/components/item-add-form";
import { ItemRow } from "@/components/item-row";
import { listItems, MAX_ADDED_ITEMS } from "@/lib/items";

export const metadata: Metadata = {
  title: "항목 관리 · EduScope AI",
};

// Design Ref: §2.1 — 항목 관리(`/items`): 기본 6개 보기, 항목 추가·수정·삭제.
// Plan SC: 작업 9 — 로그인 정보를 읽는 부분은 <Suspense> 안에 둔다. (cacheComponents)
async function ItemsContent() {
  const items = await listItems();
  const defaults = items.filter((item) => item.is_default);
  const added = items.filter((item) => !item.is_default);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold">기본 항목 ({defaults.length})</h2>
        <p className="mt-1 text-sm text-foreground/70">
          가입하면 자동으로 만들어지는 항목입니다. 지울 수 없고 설명만 고칠 수 있습니다.
        </p>
        <ul className="mt-4 space-y-3">
          {defaults.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          추가한 항목 ({added.length}/{MAX_ADDED_ITEMS})
        </h2>
        {added.length === 0 ? (
          <p className="mt-3 rounded-md border border-foreground/15 p-4 text-sm text-foreground/70">
            아직 추가한 항목이 없습니다. 아래에서 AI가 찾을 항목을 직접 추가할 수 있습니다.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {added.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">항목 추가</h2>
        <div className="mt-4 max-w-xl">
          <ItemAddForm addedCount={added.length} maxAdded={MAX_ADDED_ITEMS} />
        </div>
      </section>
    </div>
  );
}

export default function ItemsPage() {
  return (
    <section className="break-keep">
      <h1 className="text-2xl font-semibold tracking-tight">항목 관리</h1>
      <p className="mt-2 text-sm text-foreground/70">
        AI가 기관 자료에서 찾아 정리할 항목입니다. 항목을 바꾸면 이후 등록하는 기관부터 적용되고, 이미 정리된 값은 그대로
        남습니다.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-foreground/60">불러오는 중…</p>}>
          <ItemsContent />
        </Suspense>
      </div>
    </section>
  );
}
