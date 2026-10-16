-- Design Ref: §3.1 ⑤ — 결과 확인 후 저장(save_institution)과 덮어쓰기 규칙이 동작하는지 확인하는 검사.
-- 가짜 사용자 2명을 만들어 확인하고, 마지막에 일부러 오류를 내서 모든 변경을 되돌린다. (자료가 남지 않는다)
-- 결과는 오류 메시지의 "RESULT:" 뒤에 나온다. 전부 ok이면 정상이다.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  x uuid; y uuid; y2 uuid;
  item uuid;
  r text;
  n integer;
  res text := '';
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'save-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'save-b@example.invalid');

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select id into item from public.items order by sort_order limit 1;
  insert into public.institutions (name, source_type, source_ref, status) values ('교육원', 'pdf', 'a.pdf', 'pending_review') returning id into x;
  insert into public.extracted_values (institution_id, item_id, status, unverifiable_reason) values (x, item, 'unverifiable', '자료에서 찾지 못함');
  res := res || 'ok 확인불가이유저장;';

  begin  -- 확인됨 값에는 "이유"를 둘 수 없다
    update public.extracted_values set status = 'confirmed', value_text = '값', source_ref = 'a.pdf', source_quote = '원문 문장', unverifiable_reason = '이유' where institution_id = x;
    res := res || 'FAIL 확인됨에이유;';
  exception when check_violation then res := res || 'ok 확인됨에이유거부;'; end;

  r := public.save_institution(x, null, false);
  res := res || case when r = 'bad_year' then 'ok 연도없음거부;' else 'FAIL 연도없음 ' || r || ';' end;
  r := public.save_institution(x, 1800, false);
  res := res || case when r = 'bad_year' then 'ok 연도범위거부;' else 'FAIL 연도범위 ' || r || ';' end;

  r := public.save_institution(x, 2025, false);
  select count(*) into n from public.institutions where id = x and status = 'saved' and base_year = 2025 and saved_at is not null and step is null;
  res := res || case when r = 'saved' and n = 1 then 'ok 저장;' else 'FAIL 저장 ' || r || ';' end;

  r := public.save_institution(x, 2025, false);
  res := res || case when r = 'not_found' then 'ok 이미저장된것다시저장거부;' else 'FAIL 재저장 ' || r || ';' end;

  -- 같은 기관(공백·대소문자만 다름)·같은 연도: 확인 없이는 저장되지 않는다
  update public.institutions set is_home = true where id = x;
  insert into public.institutions (name, source_type, source_ref, status) values ('  교육원 ', 'url', 'https://example.org', 'pending_review') returning id into y;
  insert into public.extracted_values (institution_id, item_id, status) values (y, item, 'unverifiable');
  r := public.save_institution(y, 2025, false);
  select count(*) into n from public.institutions where id in (x, y) and ((id = x and status = 'saved') or (id = y and status = 'pending_review'));
  res := res || case when r = 'needs_overwrite' and n = 2 then 'ok 덮어쓰기확인요구;' else 'FAIL 덮어쓰기확인 ' || r || ';' end;

  -- 다른 사람(B)은 A의 기관을 저장할 수 없다
  reset role;
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.save_institution(y, 2030, true);
  res := res || case when r = 'not_found' then 'ok B가A기관저장거부;' else 'FAIL B저장 ' || r || ';' end;

  -- 다시 A: 덮어쓰기 승인
  reset role;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.save_institution(y, 2025, true);
  select count(*) into n from public.institutions where id = x;
  res := res || case when r = 'saved' and n = 0 then 'ok 덮어쓰기_옛기관삭제;' else 'FAIL 덮어쓰기 ' || r || ' ' || n || ';' end;
  select count(*) into n from public.extracted_values where institution_id = x;
  res := res || case when n = 0 then 'ok 옛값함께삭제;' else 'FAIL 옛값남음;' end;
  select count(*) into n from public.institutions where id = y and status = 'saved' and is_home;
  res := res || case when n = 1 then 'ok 소속기관표시이어받음;' else 'FAIL 소속기관표시;' end;
  select count(*) into n from public.extracted_values where institution_id = y;
  res := res || case when n = 1 then 'ok 새값유지;' else 'FAIL 새값;' end;

  -- 연도가 다르면 별도로 저장된다
  insert into public.institutions (name, source_type, source_ref, status) values ('교육원', 'pdf', 'b.pdf', 'pending_review') returning id into y2;
  r := public.save_institution(y2, 2024, false);
  select count(*) into n from public.institutions where status = 'saved' and normalized_name = '교육원';
  res := res || case when r = 'saved' and n = 2 then 'ok 다른연도별도저장;' else 'FAIL 다른연도 ' || r || ' ' || n || ';' end;

  -- 로그인하지 않은 사람은 실행할 수 없다
  reset role;
  set local role anon;
  begin perform public.save_institution(y2, 2024, false); res := res || 'FAIL anon실행;';
  exception when insufficient_privilege then res := res || 'ok anon실행거부;'; end;

  reset role;
  raise exception 'RESULT: %', res;  -- 일부러 오류를 내서 위의 모든 변경을 되돌린다
end $$;
