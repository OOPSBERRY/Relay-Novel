-- Supabase SQL Editor에서 실행하세요 (schema_v4 이후 추가)

-- rooms에 다음 이야기 코드 컬럼 추가 (한 편 더 기능)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS next_room_code text;
