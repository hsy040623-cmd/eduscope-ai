-- Design Ref: §3.1 ③ — 진행 단계(작업 차지용 값)와 차이 분석 하루 한도가 동작하는지 확인하는 검사.
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
    (a, 'authenticated', 'authenticated', 'claim-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'claim-b@example.invalid');

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 진행 단계: 새 값 허용, 엉뚱한 값 거부, 조건부 갱신은 한 번만 성공
  insert into public.institutions (name, source_type, source_ref, status, step) values ('차지 시험', 'url', 'https://example.org', 'processing', 'organizing') returning id into inst;
  update public.institutions set step = 'busy_organizing' where id = inst and status = 'processing' and step = 'organizing';
  get diagnostics n = row_count;
  res := res || case when n = 1 then 'ok 처음요청이작업차지;' else 'FAIL 차지 ' || n || ';' end;
  update public.institutions set step = 'busy_organizing' where id = inst and status = 'processing' and step = 'organizing';
  get diagnostics n = row_count;
  res := res || case when n = 0 then 'ok 두번째요청은차지못함;' else 'FAIL 중복차지 ' || n || ';' end;
  begin
    update public.institutions set step = 'busy_reading' where id = inst; res := res || 'ok busy_reading값허용;';
  exception when check_violation then res := res || 'FAIL busy_reading거부;'; end;
  begin
    update public.institutions set step = 'whatever' where id = inst; res := res || 'FAIL 엉뚱한단계허용;';
  exception when check_violation then res := res || 'ok 엉뚱한단계거부;'; end;

  -- 차이 분석 한도: 30번까지 기록되고 31번째는 거부
  for i in 1..30 loop insert into public.analysis_log default values; end loop;
  res := res || 'ok 30회기록;';
  begin
    insert into public.analysis_log default values; res := res || 'FAIL 31번째기록;';
  exception when check_violation then res := res || 'ok 31번째거부;'; end;

  -- 기록을 고치거나 지워서 우회할 수 없다
  begin
    update public.analysis_log set created_at = created_at - interval '2 days'; res := res || 'FAIL 기록수정;';
  exception when insufficient_privilege then res := res || 'ok 기록수정거부;'; end;
  begin
    delete from public.analysis_log; res := res || 'FAIL 기록삭제;';
  exception when insufficient_privilege then res := res || 'ok 기록삭제거부;'; end;

  -- 다른 사용자(B)는 한도가 따로 계산되고, A의 기록은 보이지 않는다
  reset role;
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.analysis_log default values;
  select count(*) into n from public.analysis_log;
  res := res || case when n = 1 then 'ok B한도따로·A기록안보임;' else 'FAIL B기록 ' || n || ';' end;
  begin
    insert into public.analysis_log (user_id) values (a); res := res || 'FAIL B가A이름으로기록;';
  exception when insufficient_privilege or check_violation then res := res || 'ok B가A이름으로기록거부;'; end;

  -- 어제 기록은 오늘 한도에 세지 않는다 (한국시간 0시 기준)
  reset role;
  update public.analysis_log set created_at = created_at - interval '2 days' where user_id = a;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.analysis_log default values;
  res := res || 'ok 이틀전기록은한도에안셈;';

  -- 로그인하지 않은 사람은 쓸 수 없다
  reset role;
  set local role anon;
  begin insert into public.analysis_log (user_id) values (a); res := res || 'FAIL anon쓰기;';
  exception when insufficient_privilege then res := res || 'ok anon쓰기거부;'; end;

  reset role;
  raise exception 'RESULT: %', res;  -- 일부러 오류를 내서 위의 모든 변경을 되돌린다
end $$;
