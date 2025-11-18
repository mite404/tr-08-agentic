CREATE SCHEMA IF NOT EXISTS beats;

CREATE TABLE beats.beats (
  beat_id uuid PRIMARY KEY default gen_random_uuid(),
  user_id uuid NOT NULL,
  beat_name VARCHAR(255),
  beat_grid JSONB,
  created_at timestamp DEFAULT now(),
  beat_pushed_to_wall_date int,
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
