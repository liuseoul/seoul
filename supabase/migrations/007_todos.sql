-- ============================================================
-- Migration 007: Personal To-Do List
-- ============================================================

CREATE TABLE IF NOT EXISTS todos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content      TEXT NOT NULL,
  created_by   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Each user sees only their own todos
CREATE POLICY "用户只可查看自己的待办" ON todos
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "用户只可新增自己的待办" ON todos
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "用户只可更新自己的待办" ON todos
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "用户只可删除自己的待办" ON todos
  FOR DELETE USING (auth.uid() = created_by);
