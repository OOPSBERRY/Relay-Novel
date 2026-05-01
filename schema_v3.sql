-- Supabase SQL Editor에서 실행하세요 (schema_v2 이후 추가)

-- 1. rooms의 기존 FK 제거
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_class_code_fkey;

-- 2. classes에 uuid PK 추가
ALTER TABLE classes ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_pkey;
ALTER TABLE classes ADD PRIMARY KEY (id);

-- 3. (class_code + teacher_password) 조합을 unique으로
ALTER TABLE classes ADD CONSTRAINT classes_code_pw_unique UNIQUE (class_code, teacher_password);

-- 4. rooms에 class_id 컬럼 추가
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id);

-- 5. 기존 데이터 마이그레이션 (있는 경우)
UPDATE rooms r
SET class_id = (SELECT c.id FROM classes c WHERE c.class_code = r.class_code LIMIT 1)
WHERE r.class_code IS NOT NULL;
