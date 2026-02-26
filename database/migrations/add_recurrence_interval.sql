-- Migration: Add recurrence_interval column to notes table
-- Required for "every N days" interval-based recurring reminders
-- This column was referenced in the app but never added to the schema,
-- causing PGRST204 (Column Not Found) errors on note insertion.

ALTER TABLE notes ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER;

COMMENT ON COLUMN notes.recurrence_interval IS 'Interval in days for "every N days" recurring reminders (used when recurrence_pattern = ''interval'')';

-- Index for efficient interval-reminder queries
CREATE INDEX IF NOT EXISTS idx_notes_recurrence_interval
  ON notes(recurrence_interval)
  WHERE recurrence_interval IS NOT NULL;
