-- Design Ref: §3.3·§4 — 가입하면 기본 항목 6개가 그 계정에 자동으로 만들어진다.
-- Plan SC: 작업 5 — 이메일·비밀번호 회원가입 (가입 직후 기본 항목 준비)
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

create or replace function public.create_default_items_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.items (user_id, name, description, value_type, is_default, sort_order)
  values
    (new.id, '교육과정 수', '해당 기준연도에 운영한 교육과정의 총 개수', 'number', true, 1),
    (new.id, '온라인 교육 형태', '온라인으로 제공하는 교육의 형태 (실시간 화상, 녹화 강의 등)', 'text', true, 2),
    (new.id, '참여형 교육 운영 현황', '토론·실습·워크숍 등 참여형 교육의 운영 방식과 현황', 'text', true, 3),
    (new.id, '이수기준', '교육을 이수한 것으로 인정하는 기준 (출석률, 평가 점수 등)', 'text', true, 4),
    (new.id, '참여율', '교육 대상자 중 실제로 참여한 비율 (%)', 'number', true, 5),
    (new.id, '수료율', '교육 참여자 중 수료한 비율 (%)', 'number', true, 6)
  on conflict do nothing;
  return new;
end;
$$;

-- 이 함수는 가입 때 자동으로만 실행되며, 앱이 직접 부를 수 없게 한다.
revoke execute on function public.create_default_items_for_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_default_items on auth.users;
create trigger on_auth_user_created_default_items
  after insert on auth.users
  for each row execute function public.create_default_items_for_new_user();
