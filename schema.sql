-- Supabase SQL Editor에 전체 붙여넣고 Run 하세요

-- rooms 테이블
create table rooms (
  code text primary key,
  title text not null,
  hint text default '',
  max_sentences integer default 20,
  teacher_password text not null,
  status text default 'waiting',
  player_order text[] default '{}',
  player_names jsonb default '{}',
  created_at timestamptz default now()
);

-- players 테이블
create table players (
  id text primary key,
  room_code text references rooms(code) on delete cascade,
  name text not null,
  joined_at timestamptz default now()
);

-- sentences 테이블
create table sentences (
  id uuid primary key default gen_random_uuid(),
  room_code text references rooms(code) on delete cascade,
  text text not null,
  player_name text not null,
  order_index integer not null,
  created_at timestamptz default now()
);

-- 인증 없이 anon 키로 접근할 수 있도록 RLS 정책 설정
alter table rooms enable row level security;
alter table players enable row level security;
alter table sentences enable row level security;

create policy "allow_all" on rooms for all to anon using (true) with check (true);
create policy "allow_all" on players for all to anon using (true) with check (true);
create policy "allow_all" on sentences for all to anon using (true) with check (true);

-- 실시간 기능 활성화
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table sentences;
