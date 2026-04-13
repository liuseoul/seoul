-- 018_reminders_assigned_to.sql
-- Add assigned_to_name field to reminders for member assignment

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
