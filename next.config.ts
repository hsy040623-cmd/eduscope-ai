import type { NextConfig } from "next";

// Design Ref: §7 — 모든 응답에 붙이는 보안 헤더. (CHECK.md 1-1)
// 다른 사이트가 우리 화면을 겹쳐 띄워 클릭을 가로채는 것(클릭재킹)과, 브라우저가 파일 종류를 멋대로 추측하는 것을 막는다.
// script-src 같은 스크립트 제한은 넣지 않았다. Next.js 화면이 쓰는 인라인 스크립트가 막혀 앱이 멈출 수 있어, 별도 작업(nonce)으로 다룬다.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // PDF 글자 변환표(CMap) 파일은 코드에서 직접 불러오므로, 배포할 때 빠지지 않게 서버 번들에 포함시킨다. (작업 11)
  outputFileTracingIncludes: {
    "/institutions/new": ["./src/assets/pdf-cmaps/**/*"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
