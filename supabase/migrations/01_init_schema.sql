-- ============================================================================
-- TR-08 Database Schema Initialization
-- Migration: 01_init_schema.sql
-- Description: Creates profiles and beats tables with optimized RLS
-- ============================================================================

-- 1. Create PROFILES table (Needed for the Trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profile Policies (Optimized)
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);

-- ============================================================================

-- 2. Create BEATS table
CREATE TABLE IF NOT EXISTS public.beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beat_name TEXT NOT NULL CHECK (char_length(beat_name) <= 25 AND char_length(beat_name) >= 1),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beats_user_id ON public.beats(user_id);
CREATE INDEX IF NOT EXISTS idx_beats_updated_at ON public.beats(updated_at DESC);

-- Enable RLS on beats
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies (Optimized & PRD Compliant)
-- ============================================================================

-- Policy: Everyone can SEE beats (The Graffiti Wall)
CREATE POLICY "Beats are public to view"
  ON public.beats
  FOR SELECT
  USING (true);

-- Policy: Users can INSERT their own beats
-- Fix: Used (select auth.uid()) for performance
CREATE POLICY "Users can create their own beats"
  ON public.beats
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Policy: Users can UPDATE their own beats
-- Fix: Used (select auth.uid()) for performance
CREATE POLICY "Users can update their own beats"
  ON public.beats
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Policy: Users can DELETE their own beats
-- Fix: Used (select auth.uid()) for performance
CREATE POLICY "Users can delete their own beats"
  ON public.beats
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TRIGGER: Auto-create Profile on Auth Signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplicates on re-runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_beats_updated_at ON public.beats;

CREATE TRIGGER update_beats_updated_at
  BEFORE UPDATE ON public.beats
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
