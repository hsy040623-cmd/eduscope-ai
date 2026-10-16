// 사이트 전체에서 쓰는 아이콘. 새 라이브러리를 쓰지 않고 SVG 경로를 직접 담았다. 색은 부모의 글자색(currentColor)을 따른다.
const PATHS = {
  building: "M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18",
  upload: "M12 16V4m0 0 4 4m-4-4L8 8M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3",
  scope: "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm5.2 11.2L20 20",
  bars: "M5 20V11M12 20V4M19 20v-6",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3ZM9 12l2 2 4-4",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  logout: "M15 17l5-5-5-5M20 12H9M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// 파란 그라데이션 아이콘 타일. 주요 기능 아이콘은 모두 이 모양으로 통일한다. (soft: 연한 파란 바탕에 파란 아이콘)
export function IconTile({ name, size = "md", soft = false }: { name: IconName; size?: "sm" | "md" | "lg"; soft?: boolean }) {
  const box = size === "sm" ? "h-9 w-9 rounded-lg" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  const icon = size === "sm" ? "h-4.5 w-4.5" : size === "lg" ? "h-7 w-7" : "h-5.5 w-5.5";
  return (
    <span
      className={`grid shrink-0 place-items-center ${box} ${
        soft ? "bg-brand-soft text-brand" : "bg-brand-gradient text-white shadow-[0_10px_22px_-10px_var(--brand)]"
      }`}
    >
      <Icon name={name} className={icon} />
    </span>
  );
}
