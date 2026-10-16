-- Design Ref: §3.1 ① — 서비스 전체 하루 등록 한도(200곳). 계정을 많이 만들어도 OpenAI 비용이 무한정 늘지 않게 한다.
-- 기존 계정별 한도(하루 20곳)는 그대로 두고, 같은 규칙 함수가 "모든 계정의 오늘 등록 합계"도 센다.
-- 합계는 다른 사람의 기록까지 세야 해서 security definer로 바꿨다. (읽는 것은 개수뿐이고, 행 접근 규칙은 그대로다)
-- 하루는 한국시간 0시부터. 동시에 여러 번 등록해도 200곳을 넘지 못하게 전체용 잠금을 따로 둔다.
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

create or replace function public.guard_usage_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
  total integer;
  day_start timestamptz;
begin
  day_start := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';

  -- 1) 계정별: 하루 20곳
  perform pg_advisory_xact_lock(hashtext('usage:' || new.user_id::text));
  select count(*) into used
    from public.usage_log
    where user_id = new.user_id and created_at >= day_start;
  if used >= 20 then
    raise exception 'DAILY_LIMIT: 하루 등록 한도(20곳)를 모두 사용했습니다.' using errcode = 'check_violation';
  end if;

  -- 2) 서비스 전체: 하루 200곳
  perform pg_advisory_xact_lock(hashtext('usage:service'));
  select count(*) into total
    from public.usage_log
    where created_at >= day_start;
  if total >= 200 then
    raise exception 'SERVICE_LIMIT: 서비스 전체 하루 등록 한도(200곳)에 도달했습니다.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- 트리거 전용 함수라 직접 부를 수 없게 한다.
revoke all on function public.guard_usage_limit() from public, anon, authenticated;
