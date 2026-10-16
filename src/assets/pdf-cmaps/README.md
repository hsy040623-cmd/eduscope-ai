# PDF 글자 변환표 (CMap)

한국어·중국어·일본어 PDF는 글자를 코드 번호로 저장하는 경우가 많고, 그 번호를 실제 글자로 바꾸는 표(CMap)가 필요합니다.
이 표가 없으면 PDF에서 한글이 빠지고 숫자와 기호만 읽힙니다. (이 프로젝트에서 직접 확인함)

- 출처: pdfjs-dist 6.4.299 의 `cmaps/` 폴더 (Mozilla pdf.js, Apache License 2.0 — 같은 폴더의 `LICENSE` 참고)
- 사용하는 곳: `src/lib/pdf-text.ts` (`cMapUrl`로 이 폴더를 지정)
- 배포: `next.config.ts`의 `outputFileTracingIncludes`로 서버 번들에 함께 올립니다.
- 업데이트: unpdf를 올릴 때 pdf.js 버전이 바뀌면 같은 버전의 `cmaps/`로 교체하고, 한글 PDF로 글자가 읽히는지 다시 확인하세요.
