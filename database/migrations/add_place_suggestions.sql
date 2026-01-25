-- Migration: Add place_suggestions table for new suggestions-based plans feature
-- Run this in Supabase SQL Editor

-- Create place_suggestions table
CREATE TABLE IF NOT EXISTS place_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Place information
  name TEXT NOT NULL,
  address TEXT,
  category TEXT NOT NULL, -- 'activity', 'food', 'park', 'shopping', 'entertainment', 'fitness', 'cafe', 'bar', 'other'

  -- AI-generated data
  description TEXT,
  reason TEXT, -- Why this was suggested (personality match, based on notes, etc.)
  price_range TEXT, -- '$', '$$', '$$$', '$$$$'

  -- Metadata
  source TEXT DEFAULT 'ai', -- 'ai', 'popular', 'trending'
  related_note_ids UUID[], -- Notes that influenced this suggestion

  -- User feedback
  status TEXT DEFAULT 'suggested', -- 'suggested', 'liked', 'disliked'
  feedback_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'), -- Suggestions expire after 7 days

  -- Ensure unique suggestion per user/place
  UNIQUE(user_id, name, address)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_place_suggestions_user_status ON place_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_place_suggestions_user_created ON place_suggestions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_place_suggestions_expires ON place_suggestions(expires_at);

-- Enable Row Level Security
ALTER TABLE place_suggestions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own place suggestions"
  ON place_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own place suggestions"
  ON place_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own place suggestions"
  ON place_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own place suggestions"
  ON place_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: Function to clean up expired suggestions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_suggestions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM place_suggestions
  WHERE expires_at < NOW()
    AND status = 'suggested';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
