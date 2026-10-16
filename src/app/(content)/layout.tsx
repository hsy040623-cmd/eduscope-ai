// Design Ref: 사이트 디자인 — 기능 화면(기관 등록·결과 확인·항목 관리·비교): 은은한 파란 배경 위에 흰 판을 얹고 그 안에 내용을 둔다. 화면이 열릴 때 부드럽게 떠오른다.
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <div className="animate-fade-up rounded-2xl bg-surface p-5 shadow-[0_30px_70px_-45px_rgba(37,99,235,0.45)] ring-1 ring-line md:p-10">{children}</div>
    </div>
  );
}
