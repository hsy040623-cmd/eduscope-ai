-- 서비스 전체 하루 200곳 한도 시험. (마지막에 일부러 오류를 내서 모두 되돌린다)
do $$
declare
  users uuid[] := '{}';
  uid uuid;
  i int; n int := 0; r int;
  before_total int; after_total int; err text := ''; res text := '';
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  select count(*) into before_total from public.usage_log where created_at >= day_start;
  -- 계정 15개(계정별 20곳 × 15 = 300곳 가능)를 돌아가며 기록해 전체 200곳에서 막히는지 본다.
  for i in 1..15 loop
    uid := gen_random_uuid();
    insert into auth.users (id, email, instance_id, aud, role) values (uid, 'eduscope-test-svc-' || i || '@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
    users := users || uid;
  end loop;
  begin
    for r in 1..20 loop
      foreach uid in array users loop
        insert into public.usage_log (user_id) values (uid);
        n := n + 1;
      end loop;
    end loop;
    res := res || 'FAIL 한도 없음;';
  exception when check_violation then err := sqlerrm; end;
  -- 오류가 나면 그 블록의 기록은 되돌려지므로, 막히기 전까지 성공한 횟수(n)로 합계를 계산한다.
  after_total := before_total + n;
  res := res || case when after_total = 200 then 'ok 전체 정확히 200에서 막힘;' else 'FAIL 합계 ' || after_total || ';' end;
  res := res || case when err like 'SERVICE_LIMIT%' then 'ok 전체 한도 오류 문구;' else 'FAIL 문구 ' || coalesce(err,'없음') || ';' end;
  res := res || '(시험 전 오늘 등록 ' || before_total || '곳, 시험이 넣은 ' || n || '곳)';
  raise exception 'RESULT: %', res;
end $$;
