-- =========================================================
-- schema_v7_security: 보안 강화
-- Supabase 대시보드 → SQL Editor에 전체 붙여넣고 Run 하세요.
-- (새 앱 코드가 배포된 직후, 수업이 없는 시간에 실행하세요)
--
-- 바뀌는 점
-- 1) 교사 비밀번호를 암호화(bcrypt)해서 앱에서 읽을 수 없는 별도 테이블로 옮깁니다.
-- 2) 앱(anon 키)은 표를 "읽기"만 할 수 있습니다.
--    쓰기는 아래 함수로만 가능하고, 교사용 동작은 비밀번호를 확인합니다.
-- 여러 번 실행해도 안전합니다.
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------
-- 1. 비밀번호 분리 + 암호화
-- ---------------------------------------------------------
create table if not exists public.room_secrets (
  room_code text primary key references public.rooms(code) on delete cascade,
  password_hash text not null
);

create table if not exists public.class_secrets (
  class_id uuid primary key references public.classes(id) on delete cascade,
  password_hash text not null
);

alter table public.room_secrets enable row level security;
alter table public.class_secrets enable row level security;
revoke all on public.room_secrets, public.class_secrets from anon, authenticated;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'rooms' and column_name = 'teacher_password') then
    insert into public.room_secrets (room_code, password_hash)
    select code, extensions.crypt(teacher_password, extensions.gen_salt('bf'))
    from public.rooms
    where teacher_password is not null
    on conflict (room_code) do nothing;
    alter table public.rooms drop column teacher_password;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'classes' and column_name = 'teacher_password') then
    insert into public.class_secrets (class_id, password_hash)
    select id, extensions.crypt(teacher_password, extensions.gen_salt('bf'))
    from public.classes
    where teacher_password is not null
    on conflict (class_id) do nothing;
    alter table public.classes drop constraint if exists classes_code_pw_unique;
    alter table public.classes drop column teacher_password;
  end if;
end $$;

-- ---------------------------------------------------------
-- 2. 표는 읽기만 허용
-- ---------------------------------------------------------
drop policy if exists "allow_all" on public.rooms;
drop policy if exists "allow_all" on public.players;
drop policy if exists "allow_all" on public.sentences;
drop policy if exists "allow_all" on public.classes;

drop policy if exists "read_only" on public.rooms;
drop policy if exists "read_only" on public.players;
drop policy if exists "read_only" on public.sentences;
drop policy if exists "read_only" on public.classes;

create policy "read_only" on public.rooms     for select to anon, authenticated using (true);
create policy "read_only" on public.players   for select to anon, authenticated using (true);
create policy "read_only" on public.sentences for select to anon, authenticated using (true);
create policy "read_only" on public.classes   for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.rooms, public.players, public.sentences, public.classes
  from anon, authenticated;

-- ---------------------------------------------------------
-- 3. 함수
-- ---------------------------------------------------------

-- 내부용: 방 비밀번호 확인 (앱에서 직접 부르지 못함)
create or replace function public._room_pw_ok(p_code text, p_pw text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from room_secrets
    where room_code = p_code
      and password_hash = crypt(coalesce(p_pw, ''), password_hash)
  );
$$;
revoke execute on function public._room_pw_ok(text, text) from public, anon, authenticated;

-- 내부용: 비어 있는 방 코드 찾기
create or replace function public._free_room_code(p_taken text[] default '{}')
returns text
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_code text;
begin
  for i in 1..300 loop
    v_code := (1000 + floor(random() * 9000))::int::text;
    if not exists (select 1 from rooms where code = v_code) and not (v_code = any(p_taken)) then
      return v_code;
    end if;
  end loop;
  raise exception 'NO_FREE_CODE';
end $$;
revoke execute on function public._free_room_code(text[]) from public, anon, authenticated;

-- 서버 시각 (기기 시계 보정용)
create or replace function public.server_now()
returns timestamptz
language sql stable
as $$ select now(); $$;

-- 교사: 비밀번호 확인 (새로고침 복구)
create or replace function public.verify_teacher(p_code text, p_password text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$ select public._room_pw_ok(p_code, p_password); $$;

-- 교사: 방 만들기 (반 서재 연결 포함)
create or replace function public.create_room(
  p_title text,
  p_hint text,
  p_max_sentences int,
  p_time_limit int,
  p_password text,
  p_class_code text default null,
  p_class_name text default null
)
returns text
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_class_id uuid;
  v_class_code text := nullif(trim(coalesce(p_class_code, '')), '');
begin
  if trim(coalesce(p_title, '')) = '' or char_length(trim(p_title)) > 50 then
    raise exception 'TITLE_REQUIRED';
  end if;
  if char_length(coalesce(p_password, '')) < 4 or char_length(p_password) > 40 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;
  if p_max_sentences is null or p_max_sentences not between 2 and 100
     or (p_time_limit is not null and p_time_limit not between 10 and 3600)
     or char_length(coalesce(p_hint, '')) > 200 then
    raise exception 'BAD_SETTINGS';
  end if;

  if v_class_code is not null then
    if v_class_code !~ '^\d{4}$' then raise exception 'BAD_CLASS_CODE'; end if;
    select c.id into v_class_id
    from classes c join class_secrets s on s.class_id = c.id
    where c.class_code = v_class_code
      and s.password_hash = crypt(p_password, s.password_hash)
    limit 1;

    if v_class_id is null then
      if trim(coalesce(p_class_name, '')) = '' then raise exception 'CLASS_NAME_REQUIRED'; end if;
      insert into classes (class_code, name)
      values (v_class_code, left(trim(p_class_name), 20))
      returning id into v_class_id;
      insert into class_secrets (class_id, password_hash)
      values (v_class_id, crypt(p_password, gen_salt('bf')));
    end if;
  end if;

  v_code := _free_room_code();

  insert into rooms (code, title, hint, max_sentences, status, player_order, player_names,
                     turn_time_limit, class_code, class_id)
  values (v_code, trim(p_title), trim(coalesce(p_hint, '')), p_max_sentences, 'waiting', '{}', '{}',
          p_time_limit, v_class_code, v_class_id);

  insert into room_secrets (room_code, password_hash)
  values (v_code, crypt(p_password, gen_salt('bf')));

  return v_code;
end $$;

-- 학생: 대기실 입장 (같은 이름이면 거절)
create or replace function public.join_room(p_code text, p_name text)
returns text
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_status text;
  v_name text := trim(coalesce(p_name, ''));
  v_id text;
begin
  if v_name = '' or char_length(v_name) > 20 then raise exception 'BAD_NAME'; end if;

  -- 같은 방에 동시에 들어올 때 한 명씩 처리
  perform pg_advisory_xact_lock(hashtext('join:' || p_code));

  select status into v_status from rooms where code = p_code;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_status <> 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;

  if exists (
    select 1 from players
    where room_code = p_code
      and regexp_replace(name, '\s', '', 'g') = regexp_replace(v_name, '\s', '', 'g')
  ) then
    raise exception 'DUPLICATE_NAME';
  end if;

  v_id := gen_random_uuid()::text;
  insert into players (id, room_code, name) values (v_id, p_code, v_name);
  return v_id;
end $$;

-- 교사: 대기실에서 학생 내보내기
create or replace function public.remove_player(p_code text, p_password text, p_player_id text)
returns void
language plpgsql volatile security definer
set search_path = public, extensions
as $$
begin
  if not _room_pw_ok(p_code, p_password) then raise exception 'FORBIDDEN'; end if;
  delete from players
  where id = p_player_id and room_code = p_code
    and exists (select 1 from rooms where code = p_code and status = 'waiting');
end $$;

-- 교사: 전체 한 팀으로 시작
create or replace function public.start_single(p_code text, p_password text)
returns void
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_room rooms;
  v_order text[];
  v_names jsonb;
  v_has_hint boolean;
begin
  if not _room_pw_ok(p_code, p_password) then raise exception 'FORBIDDEN'; end if;

  select * into v_room from rooms where code = p_code for update;
  if v_room.status is distinct from 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;

  select array_agg(id order by r), jsonb_object_agg(id, name)
  into v_order, v_names
  from (select id, name, random() as r from players where room_code = p_code) t;

  if coalesce(array_length(v_order, 1), 0) < 2 then raise exception 'NOT_ENOUGH_PLAYERS'; end if;

  v_has_hint := trim(coalesce(v_room.hint, '')) <> '';
  if v_has_hint then
    insert into sentences (room_code, text, player_name, order_index, skipped)
    values (p_code, trim(v_room.hint), '선생님', 0, false);
  end if;

  update rooms
  set status = 'playing',
      player_order = v_order,
      player_names = v_names,
      turn_started_at = date_trunc('milliseconds', now()),
      max_sentences = max_sentences + (case when v_has_hint then 1 else 0 end)
  where code = p_code;
end $$;

-- 교사: 모둠으로 나눠 시작
create or replace function public.start_groups(p_code text, p_password text, p_group_count int)
returns text[]
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_room rooms;
  v_hash text;
  v_all text[];
  v_ids text[];
  v_names jsonb;
  v_codes text[] := '{}';
  v_code text;
  v_has_hint boolean;
begin
  if not _room_pw_ok(p_code, p_password) then raise exception 'FORBIDDEN'; end if;

  select * into v_room from rooms where code = p_code for update;
  if v_room.status is distinct from 'waiting' then raise exception 'ROOM_NOT_WAITING'; end if;

  select array_agg(id order by random()) into v_all from players where room_code = p_code;
  if p_group_count is null or p_group_count not between 2 and 6
     or coalesce(array_length(v_all, 1), 0) < p_group_count * 2 then
    raise exception 'NOT_ENOUGH_PLAYERS';
  end if;

  select password_hash into v_hash from room_secrets where room_code = p_code;
  v_has_hint := trim(coalesce(v_room.hint, '')) <> '';

  for g in 0..p_group_count - 1 loop
    v_ids := '{}';
    v_names := '{}'::jsonb;
    for i in 1..array_length(v_all, 1) loop
      if (i - 1) % p_group_count = g then
        v_ids := v_ids || v_all[i];
        v_names := v_names || jsonb_build_object(v_all[i], (select name from players where id = v_all[i]));
      end if;
    end loop;

    v_code := _free_room_code(v_codes);

    insert into rooms (code, title, hint, max_sentences, status, player_order, player_names,
                       turn_time_limit, turn_started_at, class_code, class_id)
    values (v_code, v_room.title, v_room.hint,
            v_room.max_sentences + (case when v_has_hint then 1 else 0 end),
            'playing', v_ids, v_names, v_room.turn_time_limit, date_trunc('milliseconds', now()),
            v_room.class_code, v_room.class_id);

    insert into room_secrets (room_code, password_hash) values (v_code, v_hash);

    if v_has_hint then
      insert into sentences (room_code, text, player_name, order_index, skipped)
      values (v_code, trim(v_room.hint), '선생님', 0, false);
    end if;

    update players set room_code = v_code where id = any(v_ids);
    v_codes := v_codes || v_code;
  end loop;

  update rooms set status = 'group_monitoring', player_order = v_codes where code = p_code;
  return v_codes;
end $$;

-- 교사: 이야기 끝내기
create or replace function public.end_room(p_code text, p_password text)
returns void
language plpgsql volatile security definer
set search_path = public, extensions
as $$
begin
  if not _room_pw_ok(p_code, p_password) then raise exception 'FORBIDDEN'; end if;
  update rooms set status = 'finished' where code = p_code and status <> 'finished';
end $$;

-- 차례 넘기기: 문장 제출 / 시간 초과 패스 / 교사 강제 패스
-- (turn_started_at은 밀리초까지만 저장 → 앱이 JavaScript 날짜로 다뤄도 비교가 정확히 맞음)
-- 결과: 'ok' | 'turn-changed' | 'not-expired' | 'not-playing' | 'forbidden' | 'bad-text'
create or replace function public.advance_turn(
  p_code text,
  p_expected_started_at timestamptz,
  p_type text,
  p_player_id text default null,
  p_text text default null,
  p_force boolean default false,
  p_password text default null
)
returns text
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_room rooms;
  v_total int;
  v_real int;
  v_hint int;
  v_count int;
  v_current text;
  v_current_name text;
  v_skip boolean := (p_type = 'skip');
  v_text text;
begin
  -- 같은 방에 대한 요청은 한 번에 하나씩 (먼저 온 요청만 성공)
  select * into v_room from rooms where code = p_code for update;
  if not found or v_room.status <> 'playing' then return 'not-playing'; end if;
  if v_room.turn_started_at is distinct from p_expected_started_at then return 'turn-changed'; end if;

  select count(*), count(*) filter (where not coalesce(skipped, false))
  into v_total, v_real
  from sentences where room_code = p_code;

  v_hint := case when trim(coalesce(v_room.hint, '')) <> '' then 1 else 0 end;
  v_count := coalesce(array_length(v_room.player_order, 1), 0);
  if v_count = 0 then return 'not-playing'; end if;

  -- 패스도 한 차례로 센다
  v_current := v_room.player_order[(greatest(v_total - v_hint, 0) % v_count) + 1];
  v_current_name := coalesce(v_room.player_names ->> v_current, '');

  if v_skip then
    if p_force then
      if not _room_pw_ok(p_code, p_password) then return 'forbidden'; end if;
    elsif v_room.turn_time_limit is null
       or now() < v_room.turn_started_at + make_interval(secs => v_room.turn_time_limit) then
      return 'not-expired';
    end if;
  else
    if p_player_id is distinct from v_current then return 'turn-changed'; end if;
    v_text := trim(coalesce(p_text, ''));
    if v_text = '' or char_length(v_text) > 200 then return 'bad-text'; end if;
  end if;

  insert into sentences (room_code, text, player_name, order_index, skipped)
  values (p_code, case when v_skip then '(패스)' else v_text end, v_current_name, v_total, v_skip);

  -- 실제 문장 수가 목표에 닿으면 끝 (패스는 세지 않음)
  update rooms
  set turn_started_at = date_trunc('milliseconds', now()),
      status = case when not v_skip and v_real + 1 >= v_room.max_sentences then 'finished' else status end
  where code = p_code;

  return 'ok';
end $$;

-- 반 서재: 열기 (반 코드 + 교사 비밀번호)
create or replace function public.open_class(p_class_code text, p_password text)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select json_build_object('id', c.id, 'name', c.name)
  from classes c join class_secrets s on s.class_id = c.id
  where c.class_code = p_class_code
    and s.password_hash = crypt(coalesce(p_password, ''), s.password_hash)
  limit 1;
$$;

-- 반 서재: 교사 관리 모드 확인
create or replace function public.verify_class(p_class_id uuid, p_password text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from class_secrets
    where class_id = p_class_id
      and password_hash = crypt(coalesce(p_password, ''), password_hash)
  );
$$;

-- 반 서재: 이야기 빼기
create or replace function public.remove_from_library(p_class_id uuid, p_password text, p_room_code text)
returns void
language plpgsql volatile security definer
set search_path = public, extensions
as $$
begin
  if not public.verify_class(p_class_id, p_password) then raise exception 'FORBIDDEN'; end if;
  update rooms set class_code = null, class_id = null
  where code = p_room_code and class_id = p_class_id;
end $$;

grant execute on function
  public.server_now(),
  public.verify_teacher(text, text),
  public.create_room(text, text, int, int, text, text, text),
  public.join_room(text, text),
  public.remove_player(text, text, text),
  public.start_single(text, text),
  public.start_groups(text, text, int),
  public.end_room(text, text),
  public.advance_turn(text, timestamptz, text, text, text, boolean, text),
  public.open_class(text, text),
  public.verify_class(uuid, text),
  public.remove_from_library(uuid, text, text)
to anon, authenticated;

-- API가 새 함수를 바로 알아보도록
notify pgrst, 'reload schema';
