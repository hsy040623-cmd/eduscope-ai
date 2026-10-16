-- Design Ref: §3.1 ②·"큰 PDF 처리" — PDF에서 꺼낸 글자를 임시로 담는 표. AI 정리 단계(작업 13)가 이 글자를 읽는다.
-- Plan SC: 작업 11 — PDF 글자 읽기. 글자를 꺼낸 뒤 PDF 원본은 바로 지우므로, 다시 시도할 때 파일을 다시 올리지 않도록 글자를 남겨 둔다.
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

create table if not exists public.institution_texts (
  institution_id uuid primary key references public.institutions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null,                                          -- 쪽마다 `[p.N]` 표시가 붙은 글자
  page_count integer not null check (page_count between 1 and 50),
  char_count integer not null check (char_count > 0),
  created_at timestamptz not null default now()
);

alter table public.institution_texts enable row level security;
revoke all on public.institution_texts from anon;

-- 본인 기관의 글자만 읽고 쓴다. 남의 기관 번호를 끼워 넣을 수 없다.
drop policy if exists institution_texts_owner_all on public.institution_texts;
create policy institution_texts_owner_all on public.institution_texts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.institutions i
      where i.id = institution_id and i.user_id = (select auth.uid())
    )
  );
