// Design Ref: §3.1 ②·④ — 읽은 글자를 가지런히 정리한다. PDF와 웹페이지가 같은 규칙을 쓴다.
// Plan SC: 작업 11·12 — 본문 속에 적힌 `[p.3]`·`[s.2]`·`[web]` 같은 출처 표시는 지운다. 표시는 서버가 붙인 것만 믿는다. (CHECK 2-10)

// 눈에 안 보이는 제어 문자(폭 없는 공백, 방향 제어 등)
const INVISIBLE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g;

export function cleanReadText(raw: string): string {
  return raw
    .replace(/\[\s*(?:[ps]\.\s*\d+|web)\s*\]/gi, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
