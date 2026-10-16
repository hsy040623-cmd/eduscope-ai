import Link from "next/link";

// 게스트(로그인 없이 시작) 안내 띠. 브라우저를 닫으면 자료가 사라진다는 것과, 계속 쓰려면 가입·로그인하라는 것을 알린다.
export function GuestNotice() {
  return (
    <div role="status" className="border-b border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm md:px-6">
        <p className="break-keep">
          <strong className="font-semibold">게스트로 사용 중입니다.</strong> 브라우저를 닫으면 등록한 기관과 비교 결과가 사라지고, 24시간 뒤 자동 삭제됩니다.
        </p>
        <p className="shrink-0">
          계속 보관하려면{" "}
          <Link href="/login" className="font-semibold underline underline-offset-2">
            로그인
          </Link>{" "}
          또는{" "}
          <Link href="/signup" className="font-semibold underline underline-offset-2">
            회원가입
          </Link>
          <span className="ml-1 text-xs opacity-70">(지금 자료는 옮겨지지 않습니다)</span>
        </p>
      </div>
    </div>
  );
}
