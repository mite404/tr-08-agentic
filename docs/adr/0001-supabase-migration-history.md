# 0001. Keep `01_init_schema.sql`, remove the three November 2025 migrations

- Status: accepted
- Date: 2026-08-24
- Ticket: [ETH-35](https://linear.app/mite404-workspace/issue/ETH-35/resolve-the-three-uncommitted-supabase-migration-deletions) · `tr-08-agentic#60`

## Context

`supabase/migrations/` tracked four files. Three are timestamped Nov 10-11 2025
and arrived on `main` via a branch merge on Nov 18 (`368a02a`); they create
`beats.beats` in its own schema, `public.profiles` with a `profile_id` primary
key, and two RLS policies on that table. The fourth, `01_init_schema.sql`, was
added Nov 30 in a separate PR (`ae28faa`) alongside the Zod and TypeScript type
definitions; it creates `public.profiles` and `public.beats`, six RLS policies,
and two triggers. The two sets disagree on schema, primary keys, and column
names. The three older files were deleted in the working tree but the deletion
was never staged, so `git ls-files` still returned all four.

This repo has no `supabase/config.toml`, so the Supabase CLI was never wired up
and no file here records which migrations ever ran against a database.

## Decision

Commit the three deletions and treat `supabase/migrations/01_init_schema.sql` as
the sole description of the schema.

## Evidence

- `src/hooks/useLoadBeat.ts:122` selects `id, beat_name, data, created_at,
  updated_at` from `beats`. Those six columns exist in `01_init_schema.sql:28-35`.
  The deleted migration has `beat_id` and `beat_grid` instead of `id` and `data`,
  and no `updated_at` at all.
- `src/hooks/useSaveBeat.ts:108-112` inserts `user_id`, `beat_name`, `data` into
  `beats`. `data` does not exist in the deleted migration.
- `src/types/database.ts:11` keys the `Database` interface by `public` and
  nothing else, so the client cannot address the `beats` schema created at
  `20251110234325_create_beats_table.sql:1`.

## Consequences

(a) A fresh clone provisions by running `supabase/migrations/01_init_schema.sql`
against a new Supabase project. It is the only file in that directory.

(b) The `beats.beats` design, the `profiles.profile_id` key, and the
`social_profiles` column are recoverable only through git history —
`git show 368a02a:supabase/migrations/<name>.sql`.

(c) `supabase/migrations/01_init_schema.sql` owns every RLS policy from here on:
six `CREATE POLICY` statements at lines 19, 22, 49, 56, 63 and 71, covering
`public.profiles` and `public.beats`. No policy should be created in the Supabase
dashboard, because a dashboard policy has no diff, no review, and no rollback.

## What this does not decide

Whether the live database matches `01_init_schema.sql`. No query was run against
the running project to confirm it, and the app never queries `profiles` at all
(`grep -rn 'from("profiles")' src/` returns nothing), so the `profiles` half of
this decision rests entirely on the hand-written `src/types/database.ts`.
