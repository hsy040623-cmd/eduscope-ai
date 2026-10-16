import { Icon } from "@/components/icons";

// 공공기관 누리집처럼 맨 위에 붙는 얇은 안내 띠. 이 서비스가 지키는 원칙을 항상 보여 준다.
export function TopNotice() {
  return (
    <div className="bg-[#0b2a6b] text-[12.5px] text-white/90">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-4 py-2 md:justify-between md:px-6">
        <span className="flex items-center gap-1.5">
          <Icon name="shield" className="h-3.5 w-3.5 text-sky-300" />
          공개된 교육기관 자료만 사용합니다
        </span>
        <span className="hidden md:inline">모든 값에 출처를 표시하고, 확인되지 않은 값은 지어내지 않습니다</span>
      </div>
    </div>
  );
}
