-- 017_work_timelog_soft_delete_columns.sql
-- Ensure all soft-delete columns exist on work_records and time_logs

ALTER TABLE work_records
  ADD COLUMN IF NOT EXISTS deleted          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by       UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_name  TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

ALTER TABLE time_logs
  ADD COLUMN IF NOT EXISTS deleted          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by       UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_name  TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
