// Design Ref: §3.1 ①·PRD §5 — 기관 등록 한도. 화면(브라우저)과 서버가 같은 숫자를 쓰도록 한곳에 둔다.
// Plan SC: 작업 10 — 20MB·300쪽·하루 20곳 한도. (DB의 보관함 설정과 `usage_log` 규칙도 같은 숫자를 지킨다)
export const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_PDF_PAGES = 300;
export const DAILY_REGISTRATION_LIMIT = 20;
// 주소는 출처로 DB에 그대로 저장되는데 출처 칸 한도가 500자라서, 그 안에 들어가는 길이만 받는다. (작업 13)
export const MAX_URL_LENGTH = 450;
export const MAX_FILE_NAME_LENGTH = 200;

// Design Ref: §3.1 ② — PDF 글자 읽기 한도. (작업 11)
// 글자 수 상한: 실제로 막는 것은 쪽수보다 이 글자 수다. 모델이 한 번에 받을 수 있는 입력이 27.2만 토큰이고 한글 40만 자가 약 26.4만 토큰이라 더 늘릴 수 없다. (재어 확인: 40만 자는 약 30초에 처리, 85만 자는 56만 토큰이라 거부됨)
// 그래서 300쪽 PDF도 글자가 40만 자 이하(쪽당 평균 약 1,300자 이하)일 때만 읽는다. 넘으면 이유를 알리고 거부한다.
export const MAX_PDF_TEXT_CHARS = 400_000;
// 공백을 뺀 글자가 이보다 적거나 쪽당 평균이 적으면 "글자를 읽을 수 없는 PDF(스캔 이미지 등)"로 본다.
export const MIN_PDF_TEXT_CHARS = 100;
export const MIN_PDF_TEXT_CHARS_PER_PAGE = 20;
// 글자를 꺼내는 데 허용하는 시간. 넘으면 폭탄 PDF로 보고 포기한다.
export const PDF_TEXT_TIMEOUT_MS = 20_000;

// Design Ref: §3.1 ② URL 안전 규칙 — 홈페이지 주소를 읽을 때의 한도. (작업 12, CHECK 2-1·2-7·2-9·2-10)
export const MAX_HTML_BYTES = 2 * 1024 * 1024; // 웹페이지는 2MB까지 (실제로 받은 바이트로 센다)
export const FETCH_TIMEOUT_MS = 15_000; // 주소 조회·접속·내려받기 전체에 15초
export const MAX_REDIRECTS = 3; // 다른 주소로 넘겨지는 것은 3번까지, 넘겨질 때마다 다시 검사한다
// 공백을 뺀 본문 글자가 이보다 적으면 "읽을 본문이 없는 페이지"로 본다. (자바스크립트로 그려지는 페이지 등)
export const MIN_WEB_TEXT_CHARS = 100;
