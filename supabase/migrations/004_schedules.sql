-- ============================================================
-- Migration 004: Schedules / Calendar events
-- ============================================================

CREATE TABLE IF NOT EXISTS schedules (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  content     TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "已登录用户可查看所有日程" ON schedules
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "已登录用户可新增日程" ON schedules
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "本人可删除自己的日程" ON schedules
  FOR DELETE USING (auth.uid() = created_by);
