-- 013_record_deleted_by_name.sql
-- Store deleter's display name on work_records and time_logs
-- (avoids a second ambiguous FK join to profiles)

ALTER TABLE work_records ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;
ALTER TABLE time_logs    ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;
