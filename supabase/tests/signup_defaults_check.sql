-- Design Ref: §3.3·§4 — 가입하면 기본 항목 6개가 자동으로 생기는지 확인하는 검사.
-- 가짜 사용자를 만들어 확인하고, 마지막에 일부러 오류를 내서 모든 변경을 되돌린다. (자료가 남지 않는다)
-- 결과는 오류 메시지의 "RESULT:" 뒤에 나온다. 전부 ok이면 정상이다.
do $$
declare
  a uuid := gen_random_uuid();
  n integer;
  res text := '';
begin
  insert into auth.users (id, aud, role, email) values (a, 'authenticated', 'authenticated', 'check-signup@example.invalid');

  select count(*) into n from public.items where user_id = a and is_default;
  res := res || case when n = 6 then 'ok 기본항목6개;' else 'FAIL 기본항목수(' || n || ');' end;

  select count(*) into n from public.items
    where user_id = a and sort_order between 1 and 6
      and ((name in ('교육과정 수', '참여율', '수료율') and value_type = 'number')
        or (name in ('온라인 교육 형태', '참여형 교육 운영 현황', '이수기준') and value_type = 'text'));
  res := res || case when n = 6 then 'ok 이름과유형;' else 'FAIL 이름과유형(' || n || ');' end;

  -- 본인으로 로그인한 상태에서도 6개가 보여야 한다
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.items;
  res := res || case when n = 6 then 'ok 본인에게6개보임;' else 'FAIL 본인에게보임(' || n || ');' end;

  begin  -- 앱이 이 함수를 직접 부를 수 없어야 한다
    perform public.create_default_items_for_new_user();
    res := res || 'FAIL 함수직접호출;';
  exception when insufficient_privilege then res := res || 'ok 함수직접호출거부;'; end;

  reset role;
  raise exception 'RESULT: %', res;  -- 일부러 오류를 내서 위의 모든 변경을 되돌린다
end $$;
