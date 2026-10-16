# EduScope AI

> 교육기관을 들여다보는 렌즈. **Edu**(교육기관) + **Scope**(들여다보는 렌즈) + **AI**

공공 교육기관의 **홈페이지 주소**나 **교육계획서 PDF**를 AI가 읽어 정해진 항목(교육과정 수, 온라인 교육 형태, 이수기준, 수료율 등)을 **출처와 함께** 정리하고, **2~5개 기관을 표·차트·차이 분석**으로 비교해 주는 교육 담당자용 웹 서비스입니다.

- 배포 주소: https://eduscope-ai.vercel.app
- 저장소: https://github.com/hsy040623-cmd/eduscope-ai
- 기획서 [PRD.md](PRD.md) · 설계서 [DESIGN.md](DESIGN.md) · 개발 계획 [PLAN.md](PLAN.md) · 점검 기록 [CHECK.md](CHECK.md) · 정확도 측정 [MEASURE.md](MEASURE.md)

## 이런 문제를 풉니다

기관마다 교육 현황이 홈페이지·PDF 여기저기에 흩어져 있어서, 비교하려면 사람이 일일이 찾아 옮겨 적어야 합니다. EduScope AI는 이 과정을 자동화하되, **AI가 지어낸 값은 절대 보여 주지 않도록** 설계했습니다.

## 주요 기능

0. **게스트로 바로 시작** — 첫 화면은 로그인 없이 열리고, 로그인 없이도 등록·저장·비교를 모두 쓸 수 있습니다. 대신 **브라우저를 닫으면 자료를 다시 볼 수 없고**(24시간 뒤 서버에서도 삭제), 회원가입한 계정으로 옮겨지지 않습니다. 오래 보관하려면 회원가입하세요.
1. **기관 등록** — 홈페이지 주소(웹페이지·PDF 링크) 또는 PDF 파일. 웹페이지는 AI가 같은 사이트의 관련 링크를 최대 5개까지 골라 함께 읽습니다.
2. **AI 항목 정리** — 기본 6개 항목(+사용자 추가 최대 4개)을 값·연도·**출처(주소·쪽수)·원문 문장**과 함께 정리합니다. 찾지 못하면 "확인 불가"로 남깁니다.
3. **결과 확인·저장** — 사람이 값과 출처를 확인하고 기준연도를 정해 저장합니다.
4. **비교** — 저장한 기관 2~5곳을 표·막대차트·평균으로 비교하고, 값과 맞는 문장만 남기는 **차이 분석**을 만듭니다.
5. **항목 관리** — 정리할 항목을 추가·수정·삭제합니다.

## 신뢰를 위한 규칙

- 값마다 **출처가 필수**입니다. 출처 표시율 100%를 측정으로 확인했습니다. ([MEASURE.md](MEASURE.md))
- AI의 답을 그대로 믿지 않고, 서버가 **원문과 대조**해 통과한 값만 "확인됨"으로 표시합니다. (원문에 없는 문장·숫자·연도는 거부)
- 자료 속에 숨은 명령문(프롬프트 삽입)은 따르지 않으며, 값으로 올라오면 걸러 냅니다.
- 세 가지 상태를 구분합니다: **확인 불가**(읽었지만 없음) · **미조사**(저장 뒤에 추가한 항목) · **연도 미상**.
- 공개 자료만 처리합니다. 내부 주소·localhost 같은 곳으로의 접속은 차단합니다(SSRF 방어).

## 기술 스택

| 영역 | 사용 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| 스타일 | Tailwind CSS v4 |
| 로그인·DB·파일 | Supabase (Auth, Postgres + 행 단위 접근 규칙(RLS), Storage) |
| AI | OpenAI API (`gpt-5.4-mini`, 구조화된 JSON 답변) |
| 자료 읽기 | unpdf(PDF), cheerio(HTML) |
| 검증·차트 | Zod, Recharts |
| 배포 | Vercel |

## 로컬에서 실행

필요: Node.js 20 이상, Supabase 프로젝트, OpenAI API 키.

```bash
npm install
cp .env.example .env     # 값을 채웁니다 (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY)
npm run dev              # http://localhost:3000
```

데이터베이스는 `supabase/migrations/`의 SQL을 순서대로 적용하면 만들어집니다. (표·접근 규칙·한도 규칙·저장 함수 포함) 시험용 SQL은 `supabase/tests/`에 있습니다.

```bash
npm run lint       # 코드 검사
npm run build      # 배포용 빌드
```

> 테스트 실행기는 없습니다. 정확도는 PRD §3 방식의 측정(기관 10곳 × 6항목)으로 확인합니다.

## 환경변수

서버에서만 읽습니다. 브라우저로 노출되는 `NEXT_PUBLIC_` 접두사는 쓰지 않습니다.

| 이름 | 용도 |
|---|---|
| `OPENAI_API_KEY` | AI 항목 정리·차이 분석 |
| `SUPABASE_URL` | Supabase 프로젝트 주소 |
| `SUPABASE_ANON_KEY` | Supabase anon 키 (행 접근 규칙이 계정별로 데이터를 막습니다) |

`.env`는 저장소에 올리지 않습니다. (`.gitignore`) 배포·관리용 토큰(GitHub·Vercel·Supabase 액세스 토큰)은 앱에 등록하지 않습니다.

## 한도

PDF 20MB·300쪽 이하(추출 글자 40만 자 이하) · 계정당 하루 등록 20곳(서비스 전체 하루 200곳, 게스트 하루 300개) · 비교 2~5곳 · 차이 분석 하루 30회 · 기관 1곳 AI 처리 3분 이내. 로그인은 이메일 기준 10분에 10번 실패하면 잠시 막습니다.

## 폴더 구조

```
src/app/        화면과 서버 작업 (홈, 로그인, 기관 등록·결과·목록, 비교, 항목 관리)
src/components/ 화면 조각 (비교표, 차트, 브랜드 이야기 등)
src/lib/        자료 읽기(safe-fetch·pdf-text·html-text), AI(ai-extract·ai-analyze),
                검증(extraction-verify·analysis-verify), 한도·접근 규칙
supabase/       migrations(DB 만들기), tests(DB 규칙 시험 SQL)
```

## 이번 범위에서 하지 않은 것

기관 검색, 스캔 이미지 글자 인식(OCR), .hwp 읽기, 정기 재수집, 홈페이지 전체 자동 탐색(같은 사이트 링크 5개까지만).

## 배포

Vercel에 배포합니다. 환경변수 3개(`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`)만 등록합니다.

```bash
npx vercel deploy --prod   # Vercel CLI (VERCEL_TOKEN 필요)
```

`.vercelignore`가 `.env` 같은 비밀 값 파일이 배포 파일에 올라가지 않게 막습니다. 함수 지역은 Supabase와 같은 서울(`icn1`)입니다.

## 알려진 한계

- 자바스크립트로 그려지는 메뉴의 링크는 서버가 실행하지 않아 따라가지 못합니다.
- AI 답이 실행마다 조금 달라질 수 있습니다. (정확도 측정 결과는 [MEASURE.md](MEASURE.md))
- 게스트 모드가 있어 가입 없이도 계정이 만들어집니다. CAPTCHA·이메일 확인은 아직 켜지 않았습니다. ([CHECK.md](CHECK.md)의 보안 점검 참고)
