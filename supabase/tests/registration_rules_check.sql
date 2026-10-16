-- Design Ref: §3.1 ①·§4 — 하루 20곳 한도와 PDF 임시 보관함 설정이 실제로 동작하는지 확인하는 검사.
-- 가짜 사용자 2명을 만들어 확인하고, 마지막에 일부러 오류를 내서 모든 변경을 되돌린다. (자료가 남지 않는다)
-- 결과는 오류 메시지의 "RESULT:" 뒤에 나온다. 전부 ok이면 정상이다.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  i integer;
  n integer;
  res text := '';
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'reg-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'reg-b@example.invalid');

  -- 보관함 설정
  select count(*) into n from storage.buckets
    where id = 'uploads' and public = false and file_size_limit = 20971520 and allowed_mime_types = array['application/pdf'];
  res := res || case when n = 1 then 'ok 보관함설정(비공개·20MB·PDF만);' else 'FAIL 보관함설정;' end;

  select count(*) into n from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname in ('uploads_owner_select', 'uploads_owner_insert', 'uploads_owner_delete');
  res := res || case when n = 3 then 'ok 보관함접근규칙3개;' else 'FAIL 보관함접근규칙(' || n || ');' end;

  -- A로 로그인해서 20번 기록
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  for i in 1..20 loop
    insert into public.usage_log default values;
  end loop;
  res := res || 'ok 20번기록;';

  begin insert into public.usage_log default values; res := res || 'FAIL 21번째기록;';
  exception when check_violation then res := res || 'ok 21번째기록거부;'; end;

  -- B는 A의 한도와 무관해야 한다
  reset role;
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.usage_log default values;
  res := res || 'ok B는별도한도;';

  -- 어제 기록은 오늘 한도에 세지 않는다 (한국시간 0시 기준)
  reset role;
  update public.usage_log set created_at = created_at - interval '2 days' where user_id = a;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.usage_log default values;
  res := res || 'ok 어제기록은오늘한도에안셈;';

  reset role;
  raise exception 'RESULT: %', res;  -- 일부러 오류를 내서 위의 모든 변경을 되돌린다
end $$;
