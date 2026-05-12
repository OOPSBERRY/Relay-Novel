-- Supabase SQL Editor에서 실행하세요 (schema_v2 이후 추가)

-- rooms의 FK 전부 제거 (순서 중요)
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_class_code_fkey;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_class_id_fkey;

-- class_id 컬럼 일단 제거 (재추가할 것)
ALTER TABLE rooms DROP COLUMN IF EXISTS class_id;

-- classes 기존 PK 제거 후 uuid PK로 교체
ALTER TABLE classes ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_pkey;
ALTER TABLE classes ADD PRIMARY KEY (id);

-- (class_code + teacher_password) 조합 unique 설정
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_code_pw_unique;
ALTER TABLE classes ADD CONSTRAINT classes_code_pw_unique UNIQUE (class_code, teacher_password);

-- rooms에 class_id 컬럼 재추가
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id);

-- 기존 데이터 마이그레이션
UPDATE rooms r
SET class_id = (SELECT c.id FROM classes c WHERE c.class_code = r.class_code LIMIT 1)
WHERE r.class_code IS NOT NULL;
