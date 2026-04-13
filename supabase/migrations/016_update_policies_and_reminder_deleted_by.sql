-- 016_update_policies_and_reminder_deleted_by.sql

-- Allow any authenticated user to update work_records (needed for soft-delete)
DROP POLICY IF EXISTS "已登录用户可更新工作记录" ON work_records;
CREATE POLICY "已登录用户可更新工作记录" ON work_records
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow any authenticated user to update time_logs (needed for soft-delete)
DROP POLICY IF EXISTS "已登录用户可更新工时记录" ON time_logs;
CREATE POLICY "已登录用户可更新工时记录" ON time_logs
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Add deleted_by UUID to reminders (for restore permission checks)
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS deleted_by UUID;
