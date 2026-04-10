-- ============================================================
-- Migration 006: Reminders + schedule/reminder delete policies
-- ============================================================

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  due_date   DATE NOT NULL,
  content    TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "已登录用户可查看所有提醒" ON reminders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "已登录用户可新增提醒" ON reminders
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "本人或管理员可删除提醒" ON reminders
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Update schedules: allow admin to delete any schedule (old policy only allowed own)
DROP POLICY IF EXISTS "本人可删除自己的日程" ON schedules;

CREATE POLICY "本人或管理员可删除日程" ON schedules
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
