import { BrandStory } from "@/components/brand-story";
import { HomeFeatures, HomeSteps } from "@/components/home-features";
import { HomeHero } from "@/components/home-hero";

// Design Ref: 사이트 디자인 — 홈(`/`)은 서비스 소개(HomeHero), 브랜드 이야기, 이용 방법, 주요 기능 카드 순서로 보여 준다.
// 구역 사이는 선 대신 파란 그라데이션이 서서히 번졌다 사라지게 이어 붙여, 한 장으로 이어진 화면처럼 보이게 한다.
// 저장한 기관 목록은 별도 화면(`/institutions`, 상단 메뉴의 "내 기관")으로 나눴다. 로그인하지 않은 사람은 proxy가 로그인 화면으로 보낸다.
export default function Home() {
  return (
    <>
      <HomeHero />
      <BrandStory />
      <HomeSteps />
      <HomeFeatures />
    </>
  );
}
