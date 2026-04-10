-- ============================================================
-- Migration 003: New project fields + admin hard-delete + admin name
-- ============================================================

-- 1. Add new columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS agreement_party TEXT NOT NULL DEFAULT 'Deheng Beijing'
    CHECK (agreement_party IN ('Deheng Beijing', 'Deheng Seoul')),
  ADD COLUMN IF NOT EXISTS service_fee_currency TEXT NOT NULL DEFAULT 'CNY'
    CHECK (service_fee_currency IN ('CNY', 'KRW', 'USD')),
  ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC(15,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collaboration_parties TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2. Allow admin to permanently delete already-soft-deleted records
DROP POLICY IF EXISTS "禁止物理删除工作记录" ON work_records;

CREATE POLICY "管理员可永久删除已标记删除的记录" ON work_records
  FOR DELETE USING (
    deleted = true AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Update admin display name
UPDATE profiles SET name = 'LIU PENG' WHERE email = 'liupeng1@dehenglaw.com';
