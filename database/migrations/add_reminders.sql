-- Add reminder fields to notes table
-- This enables both one-time event reminders and recurring reminders

-- Add reminder-related columns to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_reminder BOOLEAN DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS reminder_type TEXT; -- 'one-time' | 'recurring'
ALTER TABLE notes ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ; -- for one-time events
ALTER TABLE notes ADD COLUMN IF NOT EXISTS event_location TEXT; -- location of the event
ALTER TABLE notes ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 1; -- days before event to remind
ALTER TABLE notes ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT; -- 'daily' | 'weekly' | 'monthly' | 'yearly'
ALTER TABLE notes ADD COLUMN IF NOT EXISTS recurrence_day INTEGER; -- 0-6 for weekly (0=Sunday), 1-31 for monthly
ALTER TABLE notes ADD COLUMN IF NOT EXISTS recurrence_time TIME DEFAULT '09:00'; -- time of day for reminder
ALTER TABLE notes ADD COLUMN IF NOT EXISTS notification_ids TEXT[]; -- store scheduled notification IDs
ALTER TABLE notes ADD COLUMN IF NOT EXISTS reminder_active BOOLEAN DEFAULT TRUE; -- can pause/resume reminders
ALTER TABLE notes ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ; -- when was the last reminder shown
ALTER TABLE notes ADD COLUMN IF NOT EXISTS reminder_completed_at TIMESTAMPTZ; -- when marked as done (for one-time)

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_notes_is_reminder ON notes(is_reminder) WHERE is_reminder = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_event_date ON notes(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_reminder_active ON notes(reminder_active) WHERE reminder_active = TRUE;

-- Create a separate table for tracking reminder completions (for recurring reminders)
-- This tracks when a recurring reminder was marked "done" for a specific date
CREATE TABLE IF NOT EXISTS reminder_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_date DATE NOT NULL, -- the date this reminder was completed for
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_id, completed_date)
);

-- Enable RLS on reminder_completions
ALTER TABLE reminder_completions ENABLE ROW LEVEL SECURITY;

-- RLS policies for reminder_completions
CREATE POLICY "Users can view own reminder completions"
  ON reminder_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminder completions"
  ON reminder_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminder completions"
  ON reminder_completions FOR DELETE
  USING (auth.uid() = user_id);
