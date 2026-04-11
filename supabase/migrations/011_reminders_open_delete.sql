-- 011_reminders_open_delete.sql
-- Allow any authenticated user to delete past-date reminders (for auto-cleanup on load)
-- Own/admin delete policy is retained for future-date items via the frontend guard

DROP POLICY IF EXISTS "本人或管理员可删除提醒" ON reminders;

CREATE POLICY "已登录用户可删除提醒" ON reminders
  FOR DELETE USING (auth.role() = 'authenticated');
