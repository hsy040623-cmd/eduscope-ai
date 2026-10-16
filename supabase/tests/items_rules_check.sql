-- Design Ref: §4 — 항목 규칙(기본 항목 보호, 추가 최대 4개, 계정 분리)이 실제로 동작하는지 확인하는 검사.
-- 가짜 사용자 2명을 만들어 확인하고, 마지막에 일부러 오류를 내서 모든 변경을 되돌린다. (자료가 남지 않는다)
-- 결과는 오류 메시지의 "RESULT:" 뒤에 나온다. 전부 ok이면 정상이다.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  a_default uuid;
  a_added uuid;
  n integer;
  res text := '';
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'items-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'items-b@example.invalid');
  select id into a_default from public.items where user_id = a and name = '수료율';

  -- ── A로 로그인 ──
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.items set description = '고친 설명' where id = a_default;
  get diagnostics n = row_count;
  res := res || case when n = 1 then 'ok 기본항목설명수정;' else 'FAIL 기본항목설명수정;' end;

  begin update public.items set name = '다른 이름' where id = a_default; res := res || 'FAIL 기본항목이름변경;';
  exception when check_violation then res := res || 'ok 기본항목이름변경거부;'; end;

  begin update public.items set value_type = 'text' where id = a_default; res := res || 'FAIL 기본항목유형변경;';
  exception when check_violation then res := res || 'ok 기본항목유형변경거부;'; end;

  begin update public.items set deleted_at = now() where id = a_default; res := res || 'FAIL 기본항목삭제표시;';
  exception when check_violation then res := res || 'ok 기본항목삭제표시거부;'; end;

  begin update public.items set is_default = false where id = a_default; res := res || 'FAIL 기본여부해제;';
  exception when check_violation then res := res || 'ok 기본여부해제거부;'; end;

  delete from public.items where id = a_default;
  get diagnostics n = row_count;
  res := res || case when n = 0 then 'ok 기본항목실제삭제거부;' else 'FAIL 기본항목삭제됨;' end;

  begin insert into public.items (name, value_type, is_default) values ('가짜 기본', 'text', true); res := res || 'FAIL 기본항목직접생성;';
  exception when insufficient_privilege then res := res || 'ok 기본항목직접생성거부;'; end;

  insert into public.items (name, value_type, sort_order) values ('추가1', 'text', 7) returning id into a_added;
  insert into public.items (name, value_type, sort_order) values ('추가2', 'number', 8);
  insert into public.items (name, value_type, sort_order) values ('추가3', 'text', 9);
  insert into public.items (name, value_type, sort_order) values ('추가4', 'text', 10);
  res := res || 'ok 추가4개;';

  begin insert into public.items (name, value_type, sort_order) values ('추가5', 'text', 11); res := res || 'FAIL 5번째추가;';
  exception when check_violation then res := res || 'ok 5번째추가거부;'; end;

  begin insert into public.items (name, value_type) values ('추가1', 'text'); res := res || 'FAIL 이름중복;';
  exception when unique_violation or check_violation then res := res || 'ok 이름중복거부;'; end;

  update public.items set deleted_at = now() where id = a_added;  -- 추가 항목 삭제(표시)
  insert into public.items (name, value_type, sort_order) values ('추가5', 'text', 11);
  res := res || 'ok 삭제후다시추가;';

  begin update public.items set deleted_at = null where id = a_added; res := res || 'FAIL 가득찬상태에서되살리기;';
  exception when check_violation then res := res || 'ok 가득찬상태되살리기거부;'; end;

  -- ── B로 전환: A의 항목이 보이거나 바뀌면 안 된다 ──
  reset role;
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.items;
  res := res || case when n = 6 then 'ok B는자기기본6개만보임;' else 'FAIL B에게보이는수(' || n || ');' end;

  update public.items set description = 'B가 몰래 수정' where id = a_added;
  get diagnostics n = row_count;
  res := res || case when n = 0 then 'ok B의남의항목수정무효;' else 'FAIL B가남의항목수정;' end;

  delete from public.items where id = a_added;
  get diagnostics n = row_count;
  res := res || case when n = 0 then 'ok B의남의항목삭제무효;' else 'FAIL B가남의항목삭제;' end;

  begin insert into public.items (user_id, name, value_type) values (a, 'B가A에게추가', 'text'); res := res || 'FAIL B가A명의로추가;';
  exception when insufficient_privilege then res := res || 'ok B가A명의로추가거부;'; end;

  reset role;
  raise exception 'RESULT: %', res;  -- 일부러 오류를 내서 위의 모든 변경을 되돌린다
end $$;
