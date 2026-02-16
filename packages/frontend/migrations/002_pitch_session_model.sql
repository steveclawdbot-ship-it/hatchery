-- Add optional selected model per pitch session so sessions can pin concrete provider models.

ALTER TABLE IF EXISTS pitch_sessions
  ADD COLUMN IF NOT EXISTS model TEXT;
