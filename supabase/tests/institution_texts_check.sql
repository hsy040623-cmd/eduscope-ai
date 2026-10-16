-- Design Ref: §3.1 ② — 추출한 글자 표의 접근 규칙이 동작하는지 확인하는 검사.
-- 가짜 사용자 2명을 만들어 확인하고, 마지막에 일부러 오류를 내서 모든 변경을 되돌린다. (자료가 남지 않는다)
-- 결과는 오류 메시지의 "RESULT:" 뒤에 나온다. 전부 ok이면 정상이다.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  inst uuid;
  n integer;
  res text := '';
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'text-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'text-b@example.invalid');

  -- A로 로그인해서 자기 기관에 글자 저장
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.institutions (name, source_type, source_ref) values ('글자 기관', 'pdf', 'x.pdf') returning id into inst;
  insert into public.institution_texts (institution_id, content, page_count, char_count) values (inst, E'[p.1]\n안녕하세요', 1, 5);
  res := res || 'ok 자기기관글자저장;';

  begin  -- 글자 수가 0이면 저장할 수 없다
    update public.institution_texts set char_count = 0 where institution_id = inst; res := res || 'FAIL 글자수0;';
  exception when check_violation then res := res || 'ok 글자수0거부;'; end;

  -- 쪽수: 코드의 한도(MAX_PDF_PAGES)와 같은 300쪽까지 저장되고 301쪽부터 거부된다
  update public.institution_texts set page_count = 300 where institution_id = inst;
  res := res || 'ok 300쪽저장;';
  begin
    update public.institution_texts set page_count = 301 where institution_id = inst; res := res || 'FAIL 301쪽;';
  exception when check_violation then res := res || 'ok 301쪽거부;'; end;
  update public.institution_texts set page_count = 1 where institution_id = inst;

  -- B로 전환: A의 글자를 보거나 쓰거나 지울 수 없다
  reset role;
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.institution_texts;
  res := res || case when n = 0 then 'ok B에게A글자안보임;' else 'FAIL B가A글자봄;' end;

  begin  -- B가 A의 기관 번호로 글자를 끼워 넣기
    insert into public.institution_texts (institution_id, content, page_count, char_count) values (inst, '가짜', 1, 2);
    res := res || 'FAIL B가A기관에쓰기;';
  exception when insufficient_privilege or unique_violation then res := res || 'ok B가A기관에쓰기거부;'; end;

  delete from public.institution_texts where institution_id = inst;
  get diagnostics n = row_count;
  res := res || case when n = 0 then 'ok B의삭제무효;' else 'FAIL B가삭제;' end;

  -- 로그인하지 않은 사람
  reset role;
  set local role anon;
  begin perform 1 from public.institution_texts; res := res || 'FAIL anon읽기;';
  exception when insufficient_privilege then res := res || 'ok anon읽기거부;'; end;

  reset role;
  -- 기관을 지우면 글자도 함께 지워진다
  delete from public.institutions where id = inst;
  select count(*) into n from public.institution_texts where institution_id = inst;
  res := res || case when n = 0 then 'ok 기관삭제시글자도삭제;' else 'FAIL 글자남음;' end;

  raise exception 'RESULT: %', res;  -- 일부러 오류를 내서 위의 모든 변경을 되돌린다
end $$;
