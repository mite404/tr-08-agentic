-- ============================================================================
-- TR-08 Database Schema Initialization
-- Migration: 01_init_schema.sql
-- Description: Creates the `beats` table with RLS policies for user isolation
-- ============================================================================

-- Create the beats table
-- Stores user-created beat patterns with JSONB data column
CREATE TABLE IF NOT EXISTS public.beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beat_name TEXT NOT NULL CHECK (char_length(beat_name) <= 25 AND char_length(beat_name) >= 1),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_beats_user_id ON public.beats(user_id);

-- Create index on updated_at for sorting by recency
CREATE INDEX IF NOT EXISTS idx_beats_updated_at ON public.beats(updated_at DESC);

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on the beats table
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT only their own beats
CREATE POLICY "Users can view their own beats"
  ON public.beats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can INSERT beats with their own user_id
CREATE POLICY "Users can create their own beats"
  ON public.beats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can UPDATE only their own beats
CREATE POLICY "Users can update their own beats"
  ON public.beats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can DELETE only their own beats
CREATE POLICY "Users can delete their own beats"
  ON public.beats
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on UPDATE
CREATE TRIGGER update_beats_updated_at
  BEFORE UPDATE ON public.beats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Notes
-- ============================================================================
--
-- 1. RLS Policies ensure users can only access their own beats
-- 2. The `data` column stores BeatManifest as JSONB for flexibility
-- 3. The `beat_name` constraint enforces 1-25 character limit (validated client-side too)
-- 4. ON DELETE CASCADE ensures beats are deleted when user account is deleted
-- 5. The updated_at trigger automatically timestamps modifications
--
-- ============================================================================
