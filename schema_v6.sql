-- Supabase SQL Editor에서 실행하세요 (schema_v5 이후 추가)

-- 모둠 기능: 상위 방에서 하위 방 목록 저장, 하위 방에서 상위 방 참조
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS group_room_codes text[];
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS parent_room_code text;
