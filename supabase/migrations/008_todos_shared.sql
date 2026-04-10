-- ============================================================
-- Migration 008: Todos become team-shared; add assignee_abbrev
-- ============================================================

-- Add assignee abbreviation column
ALTER TABLE todos ADD COLUMN IF NOT EXISTS assignee_abbrev TEXT NOT NULL DEFAULT '';

-- All members may now see all todos (was: own only)
DROP POLICY IF EXISTS "用户只可查看自己的待办" ON todos;
CREATE POLICY "已登录用户可查看所有待办" ON todos
  FOR SELECT USING (auth.role() = 'authenticated');

-- All authenticated users may update any todo row
-- (frontend enforces who can actually click the completion button)
DROP POLICY IF EXISTS "用户只可更新自己的待办" ON todos;
CREATE POLICY "已登录用户可更新待办" ON todos
  FOR UPDATE USING (auth.role() = 'authenticated');
