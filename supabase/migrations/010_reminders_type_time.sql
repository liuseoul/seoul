-- 010_reminders_type_time.sql
-- Add type, start_time, end_time columns to reminders

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS type       TEXT NOT NULL DEFAULT 'others',
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME;
