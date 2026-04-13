-- 015_todos_soft_delete.sql
-- Add soft-delete fields to todos; allow admin hard-delete

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS deleted         BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by      UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

-- Allow admin to hard-delete todos
CREATE POLICY "管理员可删除待办" ON todos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
