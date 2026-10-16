-- Design Ref: §3.1 ③·§4 — 같은 요청이 동시에 여러 번 들어와도 AI·자료 읽기가 한 번만 실행되게 하고, 차이 분석(AI) 호출에 하루 한도를 둔다.
-- Plan SC: 보안 점검(22번) CHECK P1-1 — (다) 작업을 "차지"하는 단계 값, (나) 차이 분석 하루 30회 한도
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

-- 1. 진행 단계 값 추가: 앱이 읽기·AI 정리를 시작하기 직전에 `reading → busy_reading`, `organizing → busy_organizing`으로
--    "조건부 갱신"을 해서 성공한 요청 하나만 일을 진행한다. (DB가 한 줄 갱신을 한 번에 하나씩만 허용하므로 동시에 와도 안전하다)
alter table public.institutions drop constraint if exists institutions_step_check;
alter table public.institutions add constraint institutions_step_check
  check (step in ('reading', 'busy_reading', 'organizing', 'busy_organizing'));

-- 2. 차이 분석 호출 기록: 한국시간 하루 30회까지. 등록 한도(usage_log)와 같은 방식이다.
create table if not exists public.analysis_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists analysis_log_user_time_idx on public.analysis_log (user_id, created_at);

alter table public.analysis_log enable row level security;
revoke all on public.analysis_log from anon;
revoke update, delete on public.analysis_log from authenticated;  -- 고치거나 지워서 한도를 우회할 수 없게

drop policy if exists analysis_log_owner_select on public.analysis_log;
create policy analysis_log_owner_select on public.analysis_log
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists analysis_log_owner_insert on public.analysis_log;
create policy analysis_log_owner_insert on public.analysis_log
  for insert to authenticated with check (user_id = (select auth.uid()));

create or replace function public.guard_analysis_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  used integer;
  day_start timestamptz;
begin
  day_start := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  -- 동시에 여러 번 눌러도 한도를 넘지 못하게 계정별로 순서를 세운다.
  perform pg_advisory_xact_lock(hashtext('analysis:' || new.user_id::text));
  select count(*) into used
    from public.analysis_log
    where user_id = new.user_id and created_at >= day_start;
  if used >= 30 then
    raise exception 'DAILY_ANALYSIS_LIMIT: 하루 차이 분석 한도(30회)를 모두 사용했습니다.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists analysis_log_limit on public.analysis_log;
create trigger analysis_log_limit
  before insert on public.analysis_log
  for each row execute function public.guard_analysis_limit();
