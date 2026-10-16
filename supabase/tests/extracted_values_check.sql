-- Design Ref: §3.1 ④ — 정리 결과 표의 강화된 규칙이 동작하는지 확인하는 검사. (마지막에 일부러 오류를 내서 모두 되돌린다)
do $$
declare
  a uuid := gen_random_uuid();
  inst uuid;
  it uuid;
  res text := '';
  s text;
begin
  insert into auth.users (id, aud, role, email) values (a, 'authenticated', 'authenticated', 'strict-a@example.invalid');
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into it from public.items where name = '교육과정 수';
  insert into public.institutions (name, source_type, source_ref) values ('엄격 기관', 'url', 'https://example.org') returning id into inst;

  begin insert into public.extracted_values (institution_id, item_id, status, value_number, source_ref, source_quote) values (inst, it, 'confirmed', 42, '', '원문');
    res := res || 'FAIL 빈출처;'; exception when check_violation then res := res || 'ok 빈문자열출처거부;'; end;
  begin insert into public.extracted_values (institution_id, item_id, status, value_number, source_ref, source_quote) values (inst, it, 'confirmed', 42, 'https://example.org', '   ');
    res := res || 'FAIL 공백발췌;'; exception when check_violation then res := res || 'ok 공백만있는발췌거부;'; end;
  begin insert into public.extracted_values (institution_id, item_id, status, value_text, source_ref, source_quote) values (inst, it, 'confirmed', ' ', 'https://example.org', '원문 발췌');
    res := res || 'FAIL 공백값;'; exception when check_violation then res := res || 'ok 공백만있는값거부;'; end;
  begin insert into public.extracted_values (institution_id, item_id, status, value_number, source_ref, source_quote) values (inst, it, 'confirmed', 42, 'https://example.org', repeat('가', 601));
    res := res || 'FAIL 긴발췌;'; exception when check_violation then res := res || 'ok 너무긴발췌거부;'; end;
  begin insert into public.extracted_values (institution_id, item_id, status, value_text, source_ref, source_quote) values (inst, it, 'confirmed', repeat('가', 501), 'https://example.org', '원문 발췌');
    res := res || 'FAIL 긴값;'; exception when check_violation then res := res || 'ok 너무긴값거부;'; end;
  insert into public.extracted_values (institution_id, item_id, status, value_number, unit, source_ref, source_quote) values (inst, it, 'confirmed', 42, '개', 'plan.pdf, 1쪽', '올해 운영한 교육과정은 총 42개이다.');
  res := res || 'ok 정상값저장;';
  reset role;
  raise exception 'RESULT: %', res;
end $$;
