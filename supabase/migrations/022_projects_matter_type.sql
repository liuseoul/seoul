-- Add matter type to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS matter_type TEXT;
