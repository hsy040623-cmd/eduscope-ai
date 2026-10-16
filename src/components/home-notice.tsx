"use client";

import { useSearchParams } from "next/navigation";

// 게스트 시작이 안 됐을 때(오늘 게스트 한도 300개 도달, 요청이 너무 많음 등) 홈으로 돌아오면서 붙는 안내. (/?guest=unavailable)
// 주소를 읽는 부분이라 <Suspense> 안에서 쓴다.
export function HomeNotice() {
  const params = useSearchParams();
  if (params.get("guest") !== "unavailable") return null;
  return (
    <div role="alert" className="border-b border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="mx-auto w-full max-w-6xl px-4 py-3 text-sm md:px-6">
        지금은 게스트로 시작할 수 없습니다. (오늘 만들 수 있는 게스트 수를 넘었거나 요청이 몰렸을 수 있어요.) 잠시 뒤 다시 시도하거나 회원가입 후 이용해 주세요.
      </p>
    </div>
  );
}
