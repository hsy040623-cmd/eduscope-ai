-- Design Ref: §3.1 ④·§4 — "출처 없는 확인됨 값 저장 불가"를 빈 문자열로 피할 수 없게 DB가 직접 막는다.
-- Plan SC: 작업 13 (CHECK 2-4) — 빈 문자열·공백만 있는 출처, 비정상적으로 긴 값 거부
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

alter table public.extracted_values drop constraint if exists extracted_values_confirmed_needs_source;
alter table public.extracted_values add constraint extracted_values_confirmed_needs_source check (
  status <> 'confirmed'
  or (
    length(btrim(coalesce(source_ref, ''))) > 0
    and length(btrim(coalesce(source_quote, ''))) > 0
    and (length(btrim(coalesce(value_text, ''))) > 0 or value_number is not null)
  )
);

-- 길이 한도: 서버 검증(extraction-verify.ts)의 한도보다 넉넉하게 잡은 마지막 방어선
alter table public.extracted_values drop constraint if exists extracted_values_sizes;
alter table public.extracted_values add constraint extracted_values_sizes check (
  coalesce(length(value_text), 0) <= 500
  and coalesce(length(source_quote), 0) <= 600
  and coalesce(length(source_ref), 0) <= 500
  and coalesce(length(unit), 0) <= 20
);
