// Design Ref: §2.1·PRD §5 — 한 번에 비교하는 기관은 2~5개. 화면(브라우저)과 서버가 같은 숫자를 쓰도록 한곳에 둔다.
// Plan SC: 작업 17 — 기관 2~5개 선택. (5개를 넘는 비교는 만들지 않는다)
export const MIN_COMPARE_INSTITUTIONS = 2;
export const MAX_COMPARE_INSTITUTIONS = 5;
