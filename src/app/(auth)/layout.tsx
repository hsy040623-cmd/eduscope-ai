import { Icon, IconTile } from "@/components/icons";

// Design Ref: 사이트 디자인 — 로그인·가입 화면: 왼쪽에 서비스 소개, 오른쪽에 흰 카드. (휴대폰에서는 카드만 보인다)
const POINTS = [
  { icon: "upload", title: "주소나 PDF만 올리면 끝", text: "기관 홈페이지 주소나 교육계획서를 올리면 AI가 항목별로 정리합니다." },
  { icon: "shield", title: "모든 값에 출처 표시", text: "확인되지 않은 값은 지어내지 않고 \"확인 불가\"로 표시합니다." },
  { icon: "bars", title: "여러 기관을 한눈에 비교", text: "표·차트·차이 분석으로 기관 2~5곳을 나란히 비교합니다." },
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-[#e8f0ff] via-[#e1f1ff] to-[#eef0ff] dark:from-[#0b1730] dark:via-[#0a1c3a] dark:to-[#0d1530]" />
      <div className="mx-auto grid min-h-[calc(100svh-6.5rem)] w-full max-w-6xl items-center gap-12 px-5 py-10 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <div className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-1.5 text-sm font-medium text-brand ring-1 ring-brand/15">
            <Icon name="sparkle" className="h-4 w-4" />
            공공 교육기관 비교 분석 서비스
          </span>
          <h2 className="mt-6 break-keep text-5xl font-extrabold leading-[1.15] tracking-tight">
            교육기관 운영 현황,
            <br />
            <span className="text-gradient">한눈에 비교하세요</span>
          </h2>
          <ul className="mt-10 space-y-6">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-4">
                <IconTile name={point.icon} />
                <div>
                  <p className="font-semibold">{point.title}</p>
                  <p className="mt-1 break-keep text-sm leading-6 text-muted">{point.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-up mx-auto w-full max-w-md rounded-2xl bg-surface p-7 shadow-[0_40px_90px_-45px_rgba(37,99,235,0.55)] ring-1 ring-line sm:p-9">{children}</div>
      </div>
    </div>
  );
}
