-- ============================================================
-- Migration 005: Soft-delete for time_logs
-- ============================================================

-- Add soft-delete columns
ALTER TABLE time_logs
  ADD COLUMN IF NOT EXISTS deleted     BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID      REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

-- Drop old UPDATE policy (only allowed own; now admin can also soft-delete)
DROP POLICY IF EXISTS "用户可更新自己的工时" ON time_logs;

-- New UPDATE: own member OR admin
CREATE POLICY "成员或管理员可更新工时记录" ON time_logs
  FOR UPDATE USING (
    auth.uid() = member_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin can permanently delete already-soft-deleted time logs
CREATE POLICY "管理员可永久删除已标记的工时记录" ON time_logs
  FOR DELETE USING (
    deleted = TRUE
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
