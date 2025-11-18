-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read profiles (public display)
CREATE POLICY "Profiles are readable by anyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Allow users to update only their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
