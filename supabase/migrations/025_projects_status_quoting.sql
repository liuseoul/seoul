-- Add 'quoting' (报价阶段) as an allowed project status
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'completed', 'cancelled', 'delayed', 'quoting'));
