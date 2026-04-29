-- 기존 schema.sql 실행 후 이걸 추가로 실행하세요

-- 반 서재 테이블
create table if not exists classes (
  class_code text primary key,
  name text not null,
  teacher_password text not null,
  created_at timestamptz default now()
);

-- rooms에 반 코드 연결 컬럼 추가
alter table rooms add column if not exists class_code text references classes(class_code);

-- RLS 설정
alter table classes enable row level security;
create policy "allow_all" on classes for all to anon using (true) with check (true);

-- 실시간 활성화
alter publication supabase_realtime add table classes;
