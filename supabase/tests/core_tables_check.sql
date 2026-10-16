-- Design Ref: §4 — 표 구조와 접근 규칙이 실제로 동작하는지 확인하는 검사.
-- 가짜 사용자 2명을 만들어 확인하고, 마지막에 일부러 오류를 내서 모든 변경을 되돌린다. (자료가 남지 않는다)
-- 결과는 오류 메시지의 "RESULT:" 뒤에 나온다. 전부 ok이면 정상이다.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  it uuid;
  inst uuid;
  n integer;
  res text := '';
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'check-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'check-b@example.invalid');

  -- ── 사용자 A로 로그인한 것처럼 동작 ──
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into items (name, value_type) values ('검사용 항목', 'number') returning id into it;
  insert into institutions (name, source_type, source_ref)
    values ('  ○○ 교육원  ', 'url', 'https://example.invalid') returning id into inst;

  select count(*) into n from institutions where id = inst and normalized_name = '○○ 교육원';
  res := res || case when n = 1 then 'ok 정리한이름;' else 'FAIL 정리한이름;' end;

  begin  -- 출처 없는 "확인됨"은 저장할 수 없다
    insert into extracted_values (institution_id, item_id, status, value_number) values (inst, it, 'confirmed', 5);
    res := res || 'FAIL 출처없음;';
  exception when check_violation then res := res || 'ok 출처없음거부;'; end;

  begin  -- "확인 불가"인데 값이 있으면 저장할 수 없다
    insert into extracted_values (institution_id, item_id, status, value_text) values (inst, it, 'unverifiable', '지어낸 값');
    res := res || 'FAIL 확인불가+값;';
  exception when check_violation then res := res || 'ok 확인불가값거부;'; end;

  insert into extracted_values (institution_id, item_id, status, value_number, unit, value_year, source_ref, source_quote)
    values (inst, it, 'confirmed', 42, '개', 2025, 'plan.pdf p.3', '교육과정은 총 42개이다.');
  res := res || 'ok 정상저장;';

  begin  -- 같은 기관·같은 항목의 값은 하나만
    insert into extracted_values (institution_id, item_id, status) values (inst, it, 'unverifiable');
    res := res || 'FAIL 중복값;';
  exception when unique_violation then res := res || 'ok 중복값거부;'; end;

  begin  -- 기준연도 없이 "저장됨"으로 바꿀 수 없다
    update institutions set status = 'saved', saved_at = now() where id = inst;
    res := res || 'FAIL 연도없이저장;';
  exception when check_violation then res := res || 'ok 연도없이저장거부;'; end;

  update institutions set base_year = 2025, status = 'saved', saved_at = now() where id = inst;

  begin  -- 공백·대소문자만 다른 같은 기관, 같은 연도는 한 번만 저장
    insert into institutions (name, source_type, source_ref, base_year, status, saved_at)
      values ('○○   교육원', 'pdf', 'x.pdf', 2025, 'saved', now());
    res := res || 'FAIL 같은기관중복;';
  exception when unique_violation then res := res || 'ok 같은기관중복거부;'; end;

  insert into institutions (name, source_type, source_ref, base_year, status, saved_at)
    values ('○○ 교육원', 'pdf', 'x.pdf', 2024, 'saved', now());
  res := res || 'ok 다른연도는별도저장;';

  insert into usage_log default values;
  begin  -- 사용 기록은 고치거나 지울 수 없다
    update usage_log set created_at = now() - interval '2 days';
    res := res || 'FAIL 기록수정;';
  exception when insufficient_privilege then res := res || 'ok 기록수정거부;'; end;

  -- ── 사용자 B로 전환: A의 자료가 보이면 안 된다 ──
  reset role;
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 가입하면 기본 항목 6개가 자동으로 생기므로, B가 볼 수 있는 항목은 B 자신의 기본 6개뿐이어야 한다.
  select ((select count(*) from items) - 6) + (select count(*) from institutions)
       + (select count(*) from extracted_values) + (select count(*) from usage_log) into n;
  res := res || case when n = 0 then 'ok B에게A자료안보임;' else 'FAIL B가A자료봄(' || n || ');' end;

  begin  -- B가 A의 기관에 값을 끼워 넣을 수 없다
    insert into extracted_values (institution_id, item_id, status) values (inst, it, 'unverifiable');
    res := res || 'FAIL 남의기관에쓰기;';
  exception when insufficient_privilege then res := res || 'ok 남의기관에쓰기거부;'; end;

  -- ── 로그인하지 않은 사람(anon) ──
  reset role;
  set local role anon;
  begin
    perform 1 from institutions;
    res := res || 'FAIL anon읽기;';
  exception when insufficient_privilege then res := res || 'ok anon읽기거부;'; end;

  reset role;
  raise exception 'RESULT: %', res;  -- 일부러 오류를 내서 위의 모든 변경을 되돌린다
end $$;
