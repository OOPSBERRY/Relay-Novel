-- Supabase SQL Editor에서 실행하세요 (schema_v3 이후 추가)

-- rooms에 턴 시간 제한 및 턴 시작 시각 추가
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS turn_time_limit integer; -- 초 단위, null = 제한 없음
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS turn_started_at timestamptz;

-- sentences에 패스 여부 추가
ALTER TABLE sentences ADD COLUMN IF NOT EXISTS skipped boolean DEFAULT false;
