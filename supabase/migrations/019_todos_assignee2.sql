-- 019_todos_assignee2.sql
-- Second assignee slot for collaboration cases
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS assignee_abbrev_2 TEXT;
