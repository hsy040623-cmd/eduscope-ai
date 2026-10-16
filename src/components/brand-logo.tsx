import Link from "next/link";
import { Icon } from "@/components/icons";

// 로고: 파란 그라데이션 타일 안의 돋보기 + 글자. 머리글과 임시 머리글이 함께 쓴다.
export function BrandLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="EduScope AI 홈">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-white shadow-[0_10px_22px_-10px_var(--brand)]">
        <Icon name="scope" className="h-5 w-5" />
      </span>
      <span className="text-[19px] font-bold tracking-tight">
        EduScope <span className="text-gradient">AI</span>
      </span>
    </Link>
  );
}
