CREATE TABLE public.profiles (
  profile_id uuid NOT NULL PRIMARY KEY default gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_profiles JSONB,
  created_at timestamp DEFAULT now()
);
