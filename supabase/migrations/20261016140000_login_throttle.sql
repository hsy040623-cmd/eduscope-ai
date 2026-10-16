-- Design Ref: §3.3·§7 — 로그인 시도 제한: 같은 이메일로 10분 안에 10번 틀리면 그 이메일만 10분간 로그인 시도를 막는다.
-- Plan SC: 보안 점검(22번) CHECK P1-2 — Supabase의 제한은 IP 하나 기준이라, 서버가 대신 로그인하면 모든 사용자가 한 덩어리로 막힌다. 이메일 단위로 따로 센다.
-- 이메일은 해시(64자)로만 저장한다. 표에는 아무도 직접 접근할 수 없고(접근 규칙 없음), 아래 함수 3개로만 쓴다.
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

create table if not exists public.login_failures (
  id bigint generated always as identity primary key,
  email_hash text not null check (length(email_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists login_failures_hash_time_idx on public.login_failures (email_hash, created_at);
create index if not exists login_failures_time_idx on public.login_failures (created_at);

alter table public.login_failures enable row level security;
revoke all on public.login_failures from anon, authenticated;  -- 접근 규칙(정책)도 만들지 않는다: 함수로만 다룬다

-- 막혀 있는지: 10분 안에 10번 이상 틀렸으면 true
create or replace function public.login_is_blocked(p_email_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email_hash is null or length(p_email_hash) <> 64 then
    return false;
  end if;
  return (
    select count(*) >= 10
    from public.login_failures
    where email_hash = p_email_hash and created_at > now() - interval '10 minutes'
  );
end;
$$;

-- 틀린 시도 기록: 한 이메일에 10분 동안 최대 20줄까지만 쌓는다(표가 무한히 불어나지 않게). 하루 지난 기록은 가끔 지운다.
create or replace function public.login_record_failure(p_email_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email_hash is null or length(p_email_hash) <> 64 then
    return;
  end if;
  if (select count(*) from public.login_failures where email_hash = p_email_hash and created_at > now() - interval '10 minutes') >= 20 then
    return;
  end if;
  insert into public.login_failures (email_hash) values (p_email_hash);
  if random() < 0.01 then
    delete from public.login_failures where created_at < now() - interval '1 day';
  end if;
end;
$$;

revoke all on function public.login_is_blocked(text) from public;
revoke all on function public.login_record_failure(text) from public;
grant execute on function public.login_is_blocked(text) to anon, authenticated;
grant execute on function public.login_record_failure(text) to anon, authenticated;
