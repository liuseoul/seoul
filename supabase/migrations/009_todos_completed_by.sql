-- 009_todos_completed_by.sql
-- Add completed_by_name to todos so any member's completion is recorded

ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_by_name TEXT;
