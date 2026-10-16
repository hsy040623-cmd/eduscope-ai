import "server-only";

// Design Ref: §5.2·§7 — API 키는 서버 코드에서만 읽고, 브라우저로 나가는 NEXT_PUBLIC_ 변수에는 비밀 값을 두지 않는다.
// Plan SC: 작업 2 — `.env`의 키를 서버 코드에서만 읽는 공통 설정 만들기

// 이름에 이 단어가 들어간 NEXT_PUBLIC_ 변수는 비밀 값으로 보고 막는다.
const SECRET_NAME_PATTERN = /KEY|TOKEN|SECRET|PASSWORD/;

// NEXT_PUBLIC_ 변수는 빌드할 때 브라우저 코드에 그대로 들어가므로, 키·토큰이 여기 있으면 바로 멈춘다.
function assertNoPublicSecrets(): void {
  const risky = Object.keys(process.env).filter(
    (name) => name.startsWith("NEXT_PUBLIC_") && SECRET_NAME_PATTERN.test(name),
  );
  if (risky.length > 0) {
    throw new Error(
      `브라우저에 노출되는 NEXT_PUBLIC_ 변수에 비밀 값을 두면 안 됩니다: ${risky.join(", ")} (.env에서 이름을 바꿔 주세요)`,
    );
  }
}

// 값이 없으면 변수 이름만 알려 준다. 값 자체는 오류 메시지나 로그에 절대 넣지 않는다.
function readRequired(name: string): string {
  assertNoPublicSecrets();
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`환경변수 ${name}의 값이 없습니다. .env 파일을 확인해 주세요.`);
  }
  return value;
}

// 앱이 실행 중에 쓰는 키만 여기에 둔다. 값은 쓰는 순간에 읽으므로, 키가 없어도 해당 기능을 쓰기 전까지는 앱이 정상 동작한다.
// GITHUB_TOKEN·VERCEL_TOKEN·SUPABASE_ACCESS_TOKEN은 CLI 작업용이라 앱 코드에서 읽지 않는다.
// Supabase 접속 정보(주소·공개용 키)도 NEXT_PUBLIC_ 없이 서버에서만 읽는다. (DESIGN §3.3: 브라우저에는 키를 내보내지 않는다)
export const serverEnv = {
  get openaiApiKey(): string {
    return readRequired("OPENAI_API_KEY");
  },
  get supabaseUrl(): string {
    return readRequired("SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return readRequired("SUPABASE_ANON_KEY");
  },
};
