-- 게스트 계정 한도(하루 300개)와 24시간 지난 게스트 정리 시험. (마지막에 일부러 오류를 내서 모두 되돌린다)
do $$
declare
  i int; uid uuid; made int := 0; err text := ''; res text := '';
  old1 uuid; old2 uuid; fresh uuid; normal uuid; n int; left_inst int; fresh_alive int; normal_alive int;
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  before_guests int;
begin
  select count(*) into before_guests from auth.users where raw_user_meta_data ->> 'guest' = 'true' and created_at >= day_start;
  -- 한도 시험: 오늘 게스트가 300개가 될 때까지 만들고, 그 다음 것은 막히는지 본다.
  begin
    for i in 1..400 loop
      -- 실제 가입(GoTrue)은 created_at을 지금 시각으로 채우므로 시험도 같게 넣는다.
      insert into auth.users (id, email, instance_id, aud, role, raw_user_meta_data, created_at)
        values (gen_random_uuid(), 'eduscope-test-guest-' || i || '@guest.example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{"guest": true}'::jsonb, now());
      made := made + 1;
    end loop;
    res := res || 'FAIL 한도 없음;';
  exception when check_violation then err := sqlerrm; end;
  res := res || case when before_guests + made = 300 then 'ok 하루 300개에서 막힘;' else 'FAIL 만든 수 ' || (before_guests + made) || ';' end;
  res := res || case when err like 'GUEST_LIMIT%' then 'ok 한도 문구;' else 'FAIL 문구 ' || err || ';' end;

  -- 일반 가입(게스트 표시 없음)은 한도와 상관없이 된다.
  normal := gen_random_uuid();
  insert into auth.users (id, email, instance_id, aud, role) values (normal, 'eduscope-test-normal-guestlimit@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  res := res || 'ok 일반가입은한도무관;';

  -- 정리 시험을 위해 한도 밖의 상태를 만든다: 오늘 만든 게스트 3개를 지우고 새로 3개(오래된 2 + 새 1)
  delete from auth.users where email like 'eduscope-test-guest-%' and email in (select email from auth.users where email like 'eduscope-test-guest-%' order by email limit 5);
  old1 := gen_random_uuid(); old2 := gen_random_uuid(); fresh := gen_random_uuid();
  insert into auth.users (id, email, instance_id, aud, role, raw_user_meta_data, created_at) values
    (old1, 'eduscope-test-old1@guest.example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{"guest": true}', now() - interval '30 hours'),
    (old2, 'eduscope-test-old2@guest.example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{"guest": true}', now() - interval '25 hours'),
    (fresh, 'eduscope-test-fresh@guest.example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{"guest": true}', now() - interval '2 hours');
  -- 오래된 게스트 한 명은 기관 자료도 갖고 있다
  insert into public.institutions (user_id, name, source_type, source_ref) values (old1, '게스트 자료', 'url', 'https://example.com/');
  -- 일반 계정도 31시간 전에 만들었지만(게스트 아님) 정리 대상이 아니다
  update auth.users set created_at = now() - interval '31 hours' where id = normal;

  n := public.cleanup_expired_guests();
  select count(*) into left_inst from public.institutions where user_id = old1;
  select count(*) into fresh_alive from auth.users where id = fresh;
  select count(*) into normal_alive from auth.users where id = normal;
  res := res || case when n >= 2 and not exists (select 1 from auth.users where id in (old1, old2)) then 'ok 24시간 지난 게스트 정리;' else 'FAIL 정리 ' || n || ';' end;
  res := res || case when left_inst = 0 then 'ok 게스트 자료도 함께 삭제;' else 'FAIL 자료 남음;' end;
  res := res || case when fresh_alive = 1 then 'ok 새 게스트는 유지;' else 'FAIL 새 게스트 삭제됨;' end;
  res := res || case when normal_alive = 1 then 'ok 일반 계정은 유지;' else 'FAIL 일반 계정 삭제됨;' end;
  raise exception 'RESULT: %', res;
end $$;
