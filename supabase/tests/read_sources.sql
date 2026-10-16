do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); inst uuid; r text[]; n int; res text := '';
begin
  insert into auth.users (id, email, instance_id, aud, role) values (a, 'eduscope-test-rs-a@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'), (b, 'eduscope-test-rs-b@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.institutions (user_id, name, source_type, source_ref) values (a, 'RS기관', 'url', 'https://example.com/') returning id into inst;
  insert into public.institution_texts (institution_id, content, page_count, char_count) values (inst, E'[s.1] https://example.com/\n본문 하나\n\n[s.2] https://example.com/plan.pdf, 1쪽\n쪽1\n\n[s.3] https://example.com/plan.pdf, 2쪽\n쪽2\n\n[s.4] https://example.com/edu\n교육', 4, 20);
  select array_agg(x order by ord) into r from public.read_sources(inst) with ordinality as t(x, ord);
  res := res || case when r = array['https://example.com/','https://example.com/plan.pdf','https://example.com/edu'] then 'ok 순서·중복제거;' else 'FAIL '||coalesce(r::text,'null')||';' end;
  reset role;
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.read_sources(inst);
  res := res || case when n=0 then 'ok 남의기관빈목록;' else 'FAIL 남의;' end;
  reset role;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.institution_texts set content = E'[web]\n그냥 한 페이지' where institution_id = inst;
  select count(*) into n from public.read_sources(inst);
  res := res || case when n=0 then 'ok 한페이지는빈목록;' else 'FAIL 한페이지;' end;
  reset role;
  begin set local role anon; perform public.read_sources(inst); res := res || 'FAIL anon;'; exception when insufficient_privilege then res := res || 'ok anon거부;'; end;
  raise exception 'RESULT: %', res;
end $$;
