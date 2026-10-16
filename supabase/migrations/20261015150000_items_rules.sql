-- Design Ref: §4 — 항목 규칙을 화면 코드에만 맡기지 않고 DB가 직접 지킨다.
-- Plan SC: 작업 9 — 항목 추가·수정·삭제 (기본 6개는 설명만 수정·삭제 불가, 추가 항목은 최대 4개)
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.

-- 1. 접근 규칙을 동작별로 나눈다. (기존에는 `for all` 하나라서 기본 항목을 지우거나 새로 만들 수 있었다)
drop policy if exists items_owner_all on public.items;

drop policy if exists items_owner_select on public.items;
create policy items_owner_select on public.items
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 사용자가 직접 만드는 항목은 항상 "추가 항목"이다. 기본 항목은 가입할 때 DB 함수만 만든다.
drop policy if exists items_owner_insert on public.items;
create policy items_owner_insert on public.items
  for insert to authenticated
  with check (user_id = (select auth.uid()) and is_default = false);

drop policy if exists items_owner_update on public.items;
create policy items_owner_update on public.items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 기본 항목은 실제로 지울 수 없다.
drop policy if exists items_owner_delete on public.items;
create policy items_owner_delete on public.items
  for delete to authenticated
  using (user_id = (select auth.uid()) and is_default = false);

-- 2. 항목 규칙 검사: 기본 항목 보호, 추가 항목 최대 4개
create or replace function public.guard_items_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  added integer;
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then
      raise exception 'ITEM_OWNER_LOCKED: 항목의 주인은 바꿀 수 없습니다.' using errcode = 'check_violation';
    end if;

    -- 기본 항목은 설명만 바꿀 수 있다. (이름·유형·삭제·기본 여부 변경 불가)
    if old.is_default then
      if new.is_default is distinct from true
         or new.name is distinct from old.name
         or new.value_type is distinct from old.value_type
         or new.deleted_at is not null then
        raise exception 'DEFAULT_ITEM_LOCKED: 기본 항목은 설명만 수정할 수 있습니다.' using errcode = 'check_violation';
      end if;
      return new;
    end if;

    -- 추가 항목을 기본 항목으로 바꿀 수 없다.
    if new.is_default then
      raise exception 'DEFAULT_ITEM_LOCKED: 추가 항목을 기본 항목으로 바꿀 수 없습니다.' using errcode = 'check_violation';
    end if;
  end if;

  -- 가입할 때 DB 함수가 만드는 기본 항목은 개수 제한을 받지 않는다. (사용자가 직접 만들 수는 접근 규칙이 막는다)
  if new.is_default then
    return new;
  end if;

  -- 새로 만들거나, 지웠던 항목을 되살릴 때: 지워지지 않은 추가 항목이 4개를 넘으면 안 된다.
  if new.deleted_at is null and (tg_op = 'INSERT' or old.deleted_at is not null) then
    -- 동시에 여러 개를 추가해도 4개를 넘지 못하게 계정별로 순서를 세운다.
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    select count(*) into added
      from public.items
      where user_id = new.user_id and not is_default and deleted_at is null;
    if added >= 4 then
      raise exception 'ITEM_LIMIT: 추가 항목은 최대 4개까지 만들 수 있습니다.' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists items_guard on public.items;
create trigger items_guard
  before insert or update on public.items
  for each row execute function public.guard_items_rules();
