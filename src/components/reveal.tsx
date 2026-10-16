"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

// 스크롤해서 화면에 보이게 되면 아래에서 살짝 떠오르며 나타나는 모션. 홈 화면의 각 구역에서 쓴다.
// 화면에 들어올 때 한 번만 움직이고(그 뒤에는 그대로 둔다), "움직임 줄이기" 설정이면 모션 없이 바로 보인다. (globals.css의 .reveal)
// delay: 같은 줄의 카드가 차례로 나타나게 하는 지연(초)
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      element.dataset.in = "true";
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.dataset.in = "true";
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ "--rd": `${delay}s` } as CSSProperties}>
      {children}
    </Tag>
  );
}
