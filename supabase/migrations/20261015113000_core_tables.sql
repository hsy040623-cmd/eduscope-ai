-- Design Ref: §4 — 데이터 구조 (items, institutions, extracted_values, usage_log)
-- Plan SC: 작업 4 — 기관, 항목, 값의 출처·상태·연도, 사용자 소유 관계
-- 여러 번 실행해도 같은 결과가 되도록 만들었다.
-- 규칙: 모든 표에 주인(user_id)을 두고, 본인 자료만 읽고 쓰도록 행 수준 보안(RLS)을 켠다.

-- ─────────────────────────────────────────────
-- 1. items: 정리 항목 (기본 6 + 추가 최대 4, 계정 단위)
-- ─────────────────────────────────────────────
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  description text,
  value_type text not null check (value_type in ('number', 'text')), -- 숫자 / 글
  is_default boolean not null default false,                          -- 기본 6개 항목 여부
  sort_order integer not null default 0,
  -- 항목을 지워도 이미 정리된 값은 남겨야 하므로 실제로 지우지 않고 삭제 시각만 기록한다. (DESIGN §4에 없던 칸)
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint items_default_not_deletable check (not (is_default and deleted_at is not null)) -- 기본 항목은 지울 수 없음
);

-- 같은 계정에서 지워지지 않은 항목의 이름은 겹칠 수 없다.
create unique index if not exists items_user_name_active_uniq
  on public.items (user_id, name) where deleted_at is null;

-- ─────────────────────────────────────────────
-- 2. institutions: 기관 (처리 중 · 확인 대기 · 저장됨 · 실패)
-- ─────────────────────────────────────────────
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  -- 같은 기관 판단용: 앞뒤 공백 제거, 중간 공백을 하나로, 대소문자 통일
  normalized_name text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  source_type text not null check (source_type in ('url', 'pdf')),
  source_ref text not null,                                           -- 주소 또는 파일 이름
  base_year integer check (base_year between 1900 and 2100),          -- 기준연도 (확인 전에는 비어 있을 수 있음)
  status text not null default 'processing'
    check (status in ('processing', 'pending_review', 'saved', 'failed')),
  step text check (step in ('reading', 'organizing')),               -- 진행 단계: 자료 읽는 중 / 항목 정리 중
  failure_reason text,                                                -- 실패했을 때 화면에 보여 줄 이유 (DESIGN §4에 없던 칸)
  started_at timestamptz not null default now(),                      -- 등록 시작 시각 (PRD §3 시간 측정)
  saved_at timestamptz,                                               -- 검토 완료(저장) 시각
  is_home boolean not null default false,                             -- (nice) 사용자 소속 기관 여부
  created_at timestamptz not null default now(),
  constraint institutions_saved_needs_year check (status <> 'saved' or (base_year is not null and saved_at is not null)),
  constraint institutions_home_only_saved check (not is_home or status = 'saved')
);

-- 같은 계정 + 같은 이름(정리한) + 같은 기준연도의 저장된 기관은 하나만 있을 수 있다.
create unique index if not exists institutions_same_saved_uniq
  on public.institutions (user_id, normalized_name, base_year) where status = 'saved';
-- 소속 기관은 계정당 하나만 지정할 수 있다.
create unique index if not exists institutions_one_home_uniq
  on public.institutions (user_id) where is_home;
-- 목록·비교 화면에서 상태별로 빠르게 찾기 위한 색인
create index if not exists institutions_user_status_idx
  on public.institutions (user_id, status, created_at desc);

-- ─────────────────────────────────────────────
-- 3. extracted_values: 기관별·항목별 정리 결과
--    "미조사"는 값 행이 아예 없는 상태라서 저장하지 않는다.
-- ─────────────────────────────────────────────
create table if not exists public.extracted_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  status text not null check (status in ('confirmed', 'unverifiable')), -- 확인됨 / 확인 불가
  value_text text,
  value_number numeric,
  unit text,
  value_year integer check (value_year between 1900 and 2100),         -- 값의 연도 (없으면 "연도 미상")
  source_ref text,                                                      -- 출처: URL, 또는 파일 이름 + 쪽수
  source_quote text,                                                    -- 원문 발췌 1문장
  created_at timestamptz not null default now(),
  constraint extracted_values_one_per_item unique (institution_id, item_id),
  -- 출처 없는 값은 저장할 수 없다. (PRD: 출처가 확인되지 않은 값은 "확인 불가")
  constraint extracted_values_confirmed_needs_source check (
    status <> 'confirmed'
    or (source_ref is not null and source_quote is not null and (value_text is not null or value_number is not null))
  ),
  -- "확인 불가"인데 값이 들어 있으면 지어낸 값이므로 막는다.
  constraint extracted_values_unverifiable_has_no_value check (
    status <> 'unverifiable' or (value_text is null and value_number is null)
  )
);

create index if not exists extracted_values_institution_idx on public.extracted_values (institution_id);

-- ─────────────────────────────────────────────
-- 4. usage_log: 하루 등록 한도(20곳) 계산용 기록
--    하루는 한국시간 0시 기준이며, 계산은 조회할 때 한다.
-- ─────────────────────────────────────────────
create table if not exists public.usage_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists usage_log_user_time_idx on public.usage_log (user_id, created_at);

-- ─────────────────────────────────────────────
-- 5. 접근 규칙: 로그인한 본인의 자료만 읽고 쓴다. 로그인하지 않은 사람(anon)은 아무것도 못 한다.
-- ─────────────────────────────────────────────
alter table public.items enable row level security;
alter table public.institutions enable row level security;
alter table public.extracted_values enable row level security;
alter table public.usage_log enable row level security;

revoke all on public.items, public.institutions, public.extracted_values, public.usage_log from anon;

drop policy if exists items_owner_all on public.items;
create policy items_owner_all on public.items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists institutions_owner_all on public.institutions;
create policy institutions_owner_all on public.institutions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 값은 본인의 기관과 본인의 항목에만 연결할 수 있다. (남의 기관·항목 번호를 끼워 넣는 것을 막는다)
drop policy if exists extracted_values_owner_all on public.extracted_values;
create policy extracted_values_owner_all on public.extracted_values
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.institutions i where i.id = institution_id and i.user_id = (select auth.uid()))
    and exists (select 1 from public.items t where t.id = item_id and t.user_id = (select auth.uid()))
  );

-- 사용 기록은 읽기와 추가만 가능하다. (고치거나 지워서 한도를 우회할 수 없게)
revoke update, delete on public.usage_log from authenticated;

drop policy if exists usage_log_owner_select on public.usage_log;
create policy usage_log_owner_select on public.usage_log
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists usage_log_owner_insert on public.usage_log;
create policy usage_log_owner_insert on public.usage_log
  for insert to authenticated with check (user_id = (select auth.uid()));
