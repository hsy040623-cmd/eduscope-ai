-- Design Ref: §3.3 — 게스트(로그인 없이 시작) 계정. 게스트는 임시 계정(user_metadata.guest = true)이며, 브라우저를 닫으면 쿠키가 사라져 다시 들어갈 수 없다.
-- 1) 하루에 만들 수 있는 게스트 계정 수를 300개로 막는다. (한국시간 0시 기준. 봇이 계정을 무한정 만드는 것을 막는 안전장치)
-- 2) 만든 지 24시간이 지난 게스트 계정과 그 자료(기관·값·읽은 글자 등, 계정이 지워지면 함께 지워진다)를 정리하는 함수.
--    게스트 시작 때마다 한 번 불러서, 별도 예약 작업 없이도 오래된 게스트 자료가 쌓이지 않게 한다.
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

create or replace function public.guard_guest_signups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_start timestamptz;
  total integer;
begin
  if coalesce(new.raw_user_meta_data ->> 'guest', '') <> 'true' then
    return new;  -- 게스트가 아닌 일반 가입은 건드리지 않는다
  end if;
  day_start := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  perform pg_advisory_xact_lock(hashtext('guests:daily'));
  select count(*) into total
    from auth.users
    where raw_user_meta_data ->> 'guest' = 'true' and created_at >= day_start;
  if total >= 300 then
    raise exception 'GUEST_LIMIT: 오늘 만들 수 있는 게스트 계정 수(300개)에 도달했습니다.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists guest_signup_guard on auth.users;
create trigger guest_signup_guard
  before insert on auth.users
  for each row execute function public.guard_guest_signups();

revoke all on function public.guard_guest_signups() from public, anon, authenticated;

create or replace function public.cleanup_expired_guests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  with doomed as (
    select id from auth.users
    where raw_user_meta_data ->> 'guest' = 'true' and created_at < now() - interval '24 hours'
    limit 100
  )
  delete from auth.users u using doomed d where u.id = d.id;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.cleanup_expired_guests() from public, anon;
grant execute on function public.cleanup_expired_guests() to authenticated;
