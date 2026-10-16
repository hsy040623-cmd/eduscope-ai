-- Design Ref: §3.1 ②-B — 링크를 따라가 여러 페이지를 읽은 기관의 "읽은 페이지 목록".
-- 읽어 둔 글자(institution_texts.content)에서 `[s.N] 출처` 줄을 찾아 출처 주소를 순서대로(PDF는 쪽수를 떼고 중복 없이) 돌려준다.
-- security invoker: 호출한 사용자의 권한(행 접근 규칙)으로 실행되므로 본인 기관의 글자만 볼 수 있다.
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

create or replace function public.read_sources(p_id uuid)
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select s.ref
  from (
    select regexp_replace(x.m[1], ', [0-9]+쪽$', '') as ref, min(x.o) as first_at
    from public.institution_texts t,
         lateral regexp_matches(t.content, '^\[s\.[0-9]+\] ([^\n]+)', 'gn') with ordinality as x(m, o)
    where t.institution_id = p_id
    group by 1
  ) s
  order by s.first_at;
$$;

revoke all on function public.read_sources(uuid) from public, anon;
grant execute on function public.read_sources(uuid) to authenticated;
