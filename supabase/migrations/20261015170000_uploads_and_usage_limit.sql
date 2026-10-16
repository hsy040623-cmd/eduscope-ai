-- Design Ref: §3.1 ①·"큰 PDF 처리", §4 — PDF 임시 보관함과 하루 등록 한도(20곳)를 DB가 직접 지킨다.
-- Plan SC: 작업 10 — 기관 등록 화면 (PDF 20MB 한도, 하루 20곳 한도, 사용자별 업로드 경로)
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

-- 1. 임시 보관함: 비공개, PDF만, 20MB까지. 처리가 끝나면 파일은 지우고 원본은 보관하지 않는다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 20971520,
      allowed_mime_types = array['application/pdf'];

-- 2. 보관함 접근 규칙: 로그인한 본인 폴더(`{user_id}/…`)만 읽고·올리고·지울 수 있다. 수정은 막는다.
drop policy if exists uploads_owner_select on storage.objects;
create policy uploads_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists uploads_owner_insert on storage.objects;
create policy uploads_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists uploads_owner_delete on storage.objects;
create policy uploads_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3. 하루 등록 한도: 한국시간 0시부터 하루로 세고, 20곳을 넘기면 기록할 수 없다.
create or replace function public.guard_usage_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  used integer;
  day_start timestamptz;
begin
  day_start := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  -- 동시에 여러 번 등록해도 20곳을 넘지 못하게 계정별로 순서를 세운다.
  perform pg_advisory_xact_lock(hashtext('usage:' || new.user_id::text));
  select count(*) into used
    from public.usage_log
    where user_id = new.user_id and created_at >= day_start;
  if used >= 20 then
    raise exception 'DAILY_LIMIT: 하루 등록 한도(20곳)를 모두 사용했습니다.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists usage_log_limit on public.usage_log;
create trigger usage_log_limit
  before insert on public.usage_log
  for each row execute function public.guard_usage_limit();
