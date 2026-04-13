-- 014_reminders_date_range.sql
-- Replace single due_date with start_date + end_date range
-- Backfill existing rows so nothing is lost

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE;

-- Backfill from due_date for any existing records
UPDATE reminders
   SET start_date = due_date,
       end_date   = due_date
 WHERE start_date IS NULL;
