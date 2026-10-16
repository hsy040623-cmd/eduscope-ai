-- Design Ref: §3.3 — 이메일별 로그인 시도 제한 함수가 동작하는지 확인하는 검사.
-- 마지막에 일부러 오류를 내서 모든 변경을 되돌린다. (자료가 남지 않는다)
-- 결과는 오류 메시지의 "RESULT:" 뒤에 나온다. 전부 ok이면 정상이다.
do $$
declare
  h1 text := repeat('a', 64);
  h2 text := repeat('b', 64);
  n integer;
  blocked boolean;
  res text := '';
begin
  set local role anon;  -- 로그인하지 않은 상태에서 쓰는 함수들이다

  select public.login_is_blocked(h1) into blocked;
  res := res || case when not blocked then 'ok 처음엔안막힘;' else 'FAIL 처음부터막힘;' end;

  for i in 1..9 loop perform public.login_record_failure(h1); end loop;
  select public.login_is_blocked(h1) into blocked;
  res := res || case when not blocked then 'ok 9번실패는안막힘;' else 'FAIL 9번에막힘;' end;

  perform public.login_record_failure(h1);
  select public.login_is_blocked(h1) into blocked;
  res := res || case when blocked then 'ok 10번실패는막힘;' else 'FAIL 10번에안막힘;' end;

  select public.login_is_blocked(h2) into blocked;
  res := res || case when not blocked then 'ok 다른이메일은영향없음;' else 'FAIL 다른이메일막힘;' end;

  -- 기록은 한 이메일에 최대 20줄
  for i in 1..30 loop perform public.login_record_failure(h1); end loop;
  reset role;
  select count(*) into n from public.login_failures where email_hash = h1;
  res := res || case when n = 20 then 'ok 한이메일최대20줄;' else 'FAIL 줄수 ' || n || ';' end;

  -- 10분이 지나면 풀린다
  update public.login_failures set created_at = now() - interval '11 minutes' where email_hash = h1;
  set local role anon;
  select public.login_is_blocked(h1) into blocked;
  res := res || case when not blocked then 'ok 10분뒤풀림;' else 'FAIL 안풀림;' end;

  -- 잘못된 모양의 값은 무시한다
  perform public.login_record_failure('짧은값');
  perform public.login_record_failure(null);
  select public.login_is_blocked('짧은값') into blocked;
  res := res || case when not blocked then 'ok 잘못된값무시;' else 'FAIL 잘못된값;' end;

  -- 표를 직접 읽거나 쓸 수 없다
  begin perform 1 from public.login_failures; res := res || 'FAIL anon표읽기;';
  exception when insufficient_privilege then res := res || 'ok anon표읽기거부;'; end;
  begin insert into public.login_failures (email_hash) values (h2); res := res || 'FAIL anon표쓰기;';
  exception when insufficient_privilege then res := res || 'ok anon표쓰기거부;'; end;
  reset role;

  -- 로그인한 사용자도 표를 직접 못 본다
  set local role authenticated;
  begin perform 1 from public.login_failures; res := res || 'FAIL 로그인사용자표읽기;';
  exception when insufficient_privilege then res := res || 'ok 로그인사용자표읽기거부;'; end;
  reset role;

  raise exception 'RESULT: %', res;  -- 일부러 오류를 내서 위의 모든 변경을 되돌린다
end $$;
