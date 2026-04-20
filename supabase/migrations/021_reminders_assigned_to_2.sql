-- Add second assignee to reminders
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS assigned_to_name_2 TEXT;
