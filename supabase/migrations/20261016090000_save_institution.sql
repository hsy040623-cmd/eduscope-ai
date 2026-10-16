-- Design Ref: §3.1 ⑤·§4 — 결과 확인 후 저장: 기준연도를 정해 "저장됨"으로 바꾸고, 같은 기관·같은 연도가 이미 있으면 덮어쓰기를 한 번에 처리한다.
-- Plan SC: 작업 14 — 기준연도 확인·수정 후 저장, 같은 기관·같은 연도 재등록 시 덮어쓰기 확인.
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

-- 1. "확인 불가"의 이유를 남긴다. (결과 확인 화면에서 왜 비었는지 알 수 있도록. 확인됨 값에는 넣지 않는다)
alter table public.extracted_values add column if not exists unverifiable_reason text;
alter table public.extracted_values drop constraint if exists extracted_values_reason_rules;
alter table public.extracted_values add constraint extracted_values_reason_rules check (
  coalesce(length(unverifiable_reason), 0) <= 200
  and (status = 'unverifiable' or unverifiable_reason is null)
);

-- 2. 저장 함수: 호출한 사람의 권한(접근 규칙)으로 실행되므로 본인 기관만 다룰 수 있다.
--    결과: 'saved' 저장됨 / 'needs_overwrite' 같은 기관·같은 연도가 있어 확인 필요 / 'not_found' 없거나 저장할 수 없는 상태 / 'bad_year' 연도 오류
create or replace function public.save_institution(p_id uuid, p_year integer, p_overwrite boolean)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  inst_name text;
  inst_status text;
  dup_id uuid;
  dup_home boolean := false;
begin
  if p_year is null or p_year < 1900 or p_year > 2100 then
    return 'bad_year';
  end if;

  -- 본인 기관만 보인다. (다른 사람의 번호면 "없음"과 같은 결과)
  select normalized_name, status into inst_name, inst_status
    from public.institutions where id = p_id for update;
  if not found or inst_status <> 'pending_review' then
    return 'not_found';
  end if;

  select id, is_home into dup_id, dup_home
    from public.institutions
    where normalized_name = inst_name and base_year = p_year and status = 'saved' and id <> p_id
    for update;

  if dup_id is not null then
    if not p_overwrite then
      return 'needs_overwrite';
    end if;
    delete from public.institutions where id = dup_id;  -- 값·글자는 함께 지워진다
  end if;

  update public.institutions
    set base_year = p_year, status = 'saved', step = null, saved_at = now(), is_home = coalesce(dup_home, false)
    where id = p_id;
  return 'saved';
end;
$$;

revoke all on function public.save_institution(uuid, integer, boolean) from public, anon;
grant execute on function public.save_institution(uuid, integer, boolean) to authenticated;
