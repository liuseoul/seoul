-- 012_reminders_soft_delete.sql
-- Switch reminders from hard-delete to soft-delete so history is preserved.
-- Past items and manually-deleted items remain visible with styling.

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS deleted          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by_name  TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

-- Allow any authenticated member to soft-delete (UPDATE) a reminder
CREATE POLICY "已登录用户可更新提醒" ON reminders
  FOR UPDATE USING (auth.role() = 'authenticated');
