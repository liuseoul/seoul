-- Add optional deadline date to todos
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date DATE;
