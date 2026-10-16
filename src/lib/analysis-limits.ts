// Design Ref: §3.2 — 차이 분석(AI) 호출 한도. 화면(브라우저)과 서버가 같은 숫자를 쓰도록 한곳에 둔다. (DB의 guard_analysis_limit 트리거도 같은 30을 지킨다)
// Plan SC: 보안 점검(22번) CHECK P1-1 — 한 계정이 AI 호출을 무제한으로 쓰지 못하게 한다.
export const DAILY_ANALYSIS_LIMIT = 30;
