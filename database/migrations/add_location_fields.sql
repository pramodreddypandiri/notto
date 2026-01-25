-- Migration: Add location-based reminder fields to notes table
-- Run this in your Supabase SQL Editor

-- Add location category column (what type of place triggers this note)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS location_category TEXT;

-- Add shopping items array (for grocery lists)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS shopping_items TEXT[];

-- Add location_completed flag (to track if the user has completed this location-based task)
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS location_completed BOOLEAN DEFAULT FALSE;

-- Add index for faster queries on location-based notes
CREATE INDEX IF NOT EXISTS idx_notes_location_category
ON notes(user_id, location_category)
WHERE location_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_location_pending
ON notes(user_id, location_completed)
WHERE location_category IS NOT NULL AND location_completed = FALSE;

-- Comment explaining the location_category values
COMMENT ON COLUMN notes.location_category IS 'Location trigger category: shopping, grocery, pharmacy, health, errand, work, fitness, or null for no location trigger';
COMMENT ON COLUMN notes.shopping_items IS 'Array of items to buy (for grocery/shopping notes)';
COMMENT ON COLUMN notes.location_completed IS 'Whether this location-based task has been completed';
