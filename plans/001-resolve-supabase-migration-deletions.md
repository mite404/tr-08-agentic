# Plan 001: Resolve the three uncommitted Supabase migration deletions

> **Linear**: [ETH-35](https://linear.app/mite404-workspace/issue/ETH-35/resolve-the-three-uncommitted-supabase-migration-deletions) · GitHub `tr-08-agentic#60`
> **Type**: Learning plan — worksheet format, see the legend below.

---

## How to read this file

This plan is a **worksheet**, not a recipe. It is complete as written; the empty
cells are the exercise.

| Notation                                     | Means                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A table with an empty **Your answer** column | Fill it in. Every answer comes from a command in the "Where to look" column — never from memory.              |
| `[FILL: description]` inside a code block    | A field you write. The surrounding template is finished; only the bracketed parts are yours.                  |
| **Quiz**                                     | Answer in writing before moving on. Written, not thought — the act of writing is what catches the wrong ones. |
| `<details>Hints</details>`                   | Collapsed on purpose. Open after fifteen minutes of being stuck, not before.                                  |
| **Verify**                                   | A command with an expected result. Run it. Do not proceed on a mismatch.                                      |

There are no worked solutions in this file, by design. The evidence you gather in
Steps 1 and 2 _is_ the answer to Step 3, and being handed it would remove the
only part of this ticket that is hard.

**Working file**: keep your answers in `/tmp/eth-35-evidence.md` — outside the
repo, so a stray `git add .` cannot commit your notes.

---

## Executor instructions

Run every verification command and confirm the expected result before moving to
the next step. If anything in "STOP conditions" occurs, stop and report — do not
improvise.

**Drift check (run first)**:

```bash
cd /Users/ea/Programming/web/fractal/tr-08-agentic
git status --short -- supabase/
```

Expected, exactly three lines:

```
 D supabase/migrations/20251110234325_create_beats_table.sql
 D supabase/migrations/20251111023141_create_profiles_table.sql
 D supabase/migrations/20251111030511_add_profiles_rls.sql
```

Anything else — a fourth file, a staged deletion, a clean tree — means someone
touched this since the plan was written. Treat it as a STOP condition.

## Status

- **Priority**: P0 (Linear: Urgent)
- **Effort**: S (~1h, almost all of it reading)
- **Risk**: LOW to the running app, HIGH to the repo's memory. Nothing here
  changes runtime behaviour; what you decide is what a future clone believes.
- **Depends on**: none
- **Category**: repo hygiene, security boundary
- **Planned at**: `gitbutler/workspace`, 2026-08-24
- **Learning goals**: migration ordering, `schema.table` identity in Postgres,
  RLS as a versioned artefact, evidence-before-action

## Why this matters

A migration file is not a script you ran once. It is the repo's answer to a
question a stranger will ask: _"I just cloned this. How do I get a database this
code can talk to?"_

Right now the repo has two conflicting answers, and one of them exists only as a
deletion marker in your working tree.

The dangerous file is not either `CREATE TABLE`. It is
`20251111030511_add_profiles_rls.sql`. Row-Level Security is the rule that stops
user A from reading user B's row. If the only copy of that rule lives in the live
Supabase project's dashboard and not in git, the repo does not describe its own
authorization model — and the next person to provision a fresh project gets a
`profiles` table with RLS off and no error to tell them.

The three-line `git status` above is the whole problem, and it is currently the
only place that information exists. One `git checkout -- .` and it is gone.

## Current state

**Committed and present on disk:**

- `supabase/migrations/01_init_schema.sql` — creates `public.profiles` and
  `public.beats`, enables RLS on both, defines four policies, adds two indexes
  and an `updated_at` trigger.

**Deleted in the working tree, still recoverable from `HEAD`:**

- `supabase/migrations/20251110234325_create_beats_table.sql`
- `supabase/migrations/20251111023141_create_profiles_table.sql`
- `supabase/migrations/20251111030511_add_profiles_rls.sql`

**The application's data access** is entirely in two hooks:

- `src/hooks/useSaveBeat.ts:108` — one insert
- `src/hooks/useLoadBeat.ts:122,163,199,242` — four reads/writes

The hand-written Supabase client types are at `src/types/database.ts`.
`README.md:24` names Supabase in the Tech Stack list and says nothing about
provisioning. There is no `supabase/config.toml` and no `docs/adr/` directory.

**You do not yet know which set of migrations describes the database those hooks
talk to.** Finding out is Step 2, and it is the whole plan.

## Commands you will need

| Purpose                                      | Command                                                      | Expected on success               |
| -------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| See the three deletions                      | `git status --short -- supabase/`                            | three `D` lines                   |
| Read a deleted file **without** restoring it | `git show HEAD:supabase/migrations/<name>.sql`               | contents on stdout                |
| List what is committed                       | `git ls-files supabase/migrations/`                          | four paths                        |
| Find every table the app touches             | `grep -rn '\.from(' src/ --include='*.ts' --include='*.tsx'` | five hits, all under `src/hooks/` |
| Typecheck + build                            | `npm run build`                                              | `tsc -b && vite build`, exit 0    |
| Lint                                         | `npm run lint`                                               | exit 0, no new problems           |
| Final gate                                   | `git status --short -- supabase/`                            | **no output**                     |

Nothing in this table mutates anything except the single `git` command in Step 3.
That is deliberate.

## Scope

**In scope**:

- The contents of `supabase/migrations/`
- `docs/adr/0001-supabase-migration-history.md` (new)
- A provisioning section in `README.md`

**Out of scope** (do NOT touch):

- **Any table shape.** Whatever you conclude, the live database is not migrating
  today. This plan makes the repo honest about what already exists.
- **`src/types/database.ts`** — it is evidence, not a target.
- **`src/hooks/*`** — read-only. If you find yourself editing a hook, your Step 2
  conclusion is wrong; go back and re-read the evidence.
- **Adding `supabase/config.toml` or wiring the Supabase CLI.** Worth doing, not
  today; it would bury the decision under tooling.
- **The `beats.data` JSONB shape / `BeatManifest`.** Separate conversation.

## Git workflow

- Branch: `mite404/eth-35-supabase-migrations`
- Two commits, in this order:
  1. `docs: record the supabase migration history decision (ETH-35)`
  2. the migrations resolution itself — message written in Step 3
- Do NOT push or open a PR unless the operator instructed it.

The ADR commit comes first so the reasoning is readable from the commit that acts
on it. A bare deletion with no reason attached forces the next reader to redo all
of Steps 1 and 2.

## Background: the two session tapes

You are in the studio. Two reels on the shelf are labelled for the same song —
one from November 10th, one from November 30th. Both are physically playable.
Nobody wrote on the boxes.

You cannot mix them together. They are different arrangements, different track
counts. Playing both into the same console produces noise, not a fuller mix.

So there are exactly three honest moves: the later reel is the record and you bin
the earlier one; the earlier reel is the record and someone shelved the wrong
one; or they are takes of different songs and you keep both, relabelled so nobody
confuses them again.

What you must not do is leave both on the shelf unlabelled and walk out — which
is the current state of `supabase/migrations/`, except one reel is half out of
its sleeve and one bump from the bin.

Step 2 is finding the sticker that says which reel the band actually played to.

---

## Step 1: Recover the evidence without un-deleting anything

`git checkout -- <path>` restores a file **and** makes a decision. `git show
HEAD:<path>` prints the same bytes and decides nothing. You only want the bytes —
the moment you restore, the `git status` signal that told you there was a problem
is gone.

Run these four commands, then fill in the three worksheets below.

```bash
git show HEAD:supabase/migrations/20251110234325_create_beats_table.sql
git show HEAD:supabase/migrations/20251111023141_create_profiles_table.sql
git show HEAD:supabase/migrations/20251111030511_add_profiles_rls.sql
cat supabase/migrations/01_init_schema.sql
```

### Worksheet 1a — the deleted `beats` migration

File: `20251110234325_create_beats_table.sql`

| #   | Question                                      | Where to look                   | Your answer    |
| --- | --------------------------------------------- | ------------------------------- | -------------- |
| 1   | Which **schema** does it create the table in? | the very first line of the file | beats          |
| 2   | Fully qualified table name (`schema.table`)   | line 3                          | beats.beats    |
| 3   | Primary key column name                       | the `PRIMARY KEY` line          | beat_id        |
| 4   | Column holding the pattern/grid data          | the `JSONB` column              | beat_grid      |
| 5   | Foreign key target                            | the `FOREIGN KEY` line          | auth.users(id) |

### Worksheet 1b — the deleted `profiles` migration and its RLS

Files: `20251111023141_create_profiles_table.sql`, `20251111030511_add_profiles_rls.sql`

| #   | Question                                                    | Where to look                       | Your answer                        |
| --- | ----------------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| 6   | Fully qualified table name                                  | the `CREATE TABLE` line             | public.profiles                    |
| 7   | Primary key column name                                     | the `PRIMARY KEY` line              | profile_id                         |
| 8   | Column linking to `auth.users`                              | the `REFERENCES` line               | user_id                            |
| 9   | Remaining columns                                           | rest of the block                   | social_profiles, created_at        |
| 10  | Names of the policies defined                               | the RLS file, `CREATE POLICY` lines | Users can update their own profile |
| 11  | The `USING` clause on the **UPDATE** policy, copied exactly | the RLS file                        | (auth.uid() = user_id)             |

### Worksheet 1c — the committed `01_init_schema.sql`

| #   | Question                                                             | Where to look                 | Your answer                      |
| --- | -------------------------------------------------------------------- | ----------------------------- | -------------------------------- |
| 12  | Fully qualified tables it creates                                    | the two `CREATE TABLE` blocks | public.profiles and public.beats |
| 13  | `profiles` primary key column                                        | first block                   | id                               |
| 14  | `beats` primary key column                                           | second block                  | id                               |
| 15  | Column holding the pattern/grid data                                 | second block                  | data                             |
| 16  | How many `CREATE POLICY` statements?                                 | `grep -c "CREATE POLICY"`     | 6                                |
| 17  | The `USING` clause on the **profiles UPDATE** policy, copied exactly | first block                   | ((select auth.uid()) = id)       |

### Two things that should stop you

**First**, one of the deleted files opens with a statement that is **not**
`CREATE TABLE`. That single line changes what "the beats table" even means, and
it is the most important character in this plan. If cell 1 and cell 12 do not
disagree, re-read the first line of that file.

**Second**, compare cell 11 against cell 17. They are not identical. One is a
documented Supabase performance idiom, the other is the naive form. Work out
which is which and why the difference exists — Supabase's Row Level Security
docs cover it under "Call functions with `select`".

### Quiz — Step 1

Answer in writing before Step 2.

1. `01_init_schema.sql` and `20251110234325_create_beats_table.sql` are both in
   `supabase/migrations/`. Migrations replay in filename sort order. Which runs
   first, and why? Compare the strings character by character — do not reason
   about the dates.

   0 runs first because its before 2.

2. If both ran in that order, which statement fails, and what is the error?
   well if the 2025 file also creates a db then we would get errors about provisioning dbs w/ the same name.
3. Both files create something called `beats`. Are they the same table? What in
   Postgres makes the answer "no"?
4. RLS is enabled on `profiles` in the deleted file. Is it enabled anywhere else
   in the repo? If yes, is the policy set identical?

<details>
<summary>Hints for Step 1 — open only after the worksheets are filled in</summary>

- Q1: `"0" < "2"` in ASCII. Nothing about November matters.
- Q3: A table is identified by `schema.name`, not `name`. Re-read the first line
  of the deleted beats migration, then look at cell 1 next to cell 12.
- Q4: `grep -c "ENABLE ROW LEVEL SECURITY"` and `grep -c "CREATE POLICY"` across
  both files.
- If cells 7 and 13 hold the same column name, you mis-read one of the two files.
  They differ.

</details>

**Verify**: all seventeen cells are filled from commands you ran, and
`git status --short -- supabase/` still prints the same three lines — you have
restored nothing.

---

## Step 2: Determine which schema the app believes in

`src/types/database.ts` is hand-written, so it cannot _prove_ anything — but it
was written by someone looking at a real Supabase project while making the hooks
compile, and the hooks do compile. That makes it a witness with a strong story.

The hooks are the harder evidence: `supabase.from("beats")` resolves against the
client's default schema unless something explicitly says otherwise.

Every cell below is answerable from `src/`, not from either `.sql` file. That is
the point — "which migration is real" is not answerable from the migrations,
because both are valid SQL. Only the code that has to live with the result can
break the tie.

### Worksheet 2a — what the app actually asks for

| #   | Question                                               | Where to look                              | Your answer                                                  |
| --- | ------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| 18  | `supabase.from("beats")` resolves to which schema?     | Supabase client default                    | auth.users.id                                                |
| 19  | Where would a schema override live, if there were one? | `src/lib/supabase.ts`                      | i dont know how to answer this at my current knowledge level |
| 20  | Columns the app **writes** on insert                   | `src/hooks/useSaveBeat.ts:108`             | user_id, beat_name, data                                     |
| 21  | Columns the app **reads**                              | `src/hooks/useLoadBeat.ts:122,163,199,242` | beats                                                        |
| 22  | Does the app query `profiles` **at all**?              | `grep -rn 'from("profiles")' src/`         | i got no results back                                        |

### Worksheet 2b — cross-reference against the two candidates

| #   | Question                                                           | Where to look           | Your answer |
| --- | ------------------------------------------------------------------ | ----------------------- | ----------- |
| 23  | The `beats` Row columns, per the type file                         | `src/types/database.ts` |             |
| 24  | Does cell 23 match the **deleted** beats migration (cells 2-4)?    | compare                 | yes / no    |
| 25  | Which columns are in one and not the other?                        | compare                 |             |
| 26  | Does cell 23 match `01_init_schema.sql` (cells 14-15)?             | compare                 | yes / no    |
| 27  | The `profiles` Row columns, per the type file                      | `src/types/database.ts` |             |
| 28  | Does cell 27 match the **deleted** profiles migration (cells 7-9)? | compare                 | yes / no    |
| 29  | Does cell 27 match `01_init_schema.sql` (cell 13)?                 | compare                 | yes / no    |

### Worksheet 2c — the conclusion

Write these as sentences, not yes/no. This is the paragraph you will paste into
the ADR in Step 3, so write it properly the first time.

| #   | Prompt                                                                                                    | Your answer |
| --- | --------------------------------------------------------------------------------------------------------- | ----------- |
| 30  | The database this code talks to is described by… (name the file, and cite the cell numbers that prove it) |             |
| 31  | The three deleted files describe…                                                                         |             |
| 32  | The weakest leg of this conclusion is… and it is weak because…                                            |             |

Do the `beats` comparison first — it has the loudest mismatch, and once you see
it the `profiles` one is quick.

### Two traps

- **Do not let the type file settle it alone.** It is hand-written, so a stale
  entry is possible. Check that at least one column name from cell 23 also
  appears in cell 20 or 21. That is the link from "someone typed this" to "the
  running app depends on it".
- **`profiles` is the weaker case**, and cell 22 is why. If the app never queries
  `profiles`, your conclusion about it rests on a coherence argument — the same
  file created `beats`, so presumably it is current — not on direct evidence.
  Cell 32 is where you say so. A decision record that names its weak leg is worth
  more than one that pretends both are solid.

### Quiz — Step 2

1. Suppose your conclusion is wrong and the deleted files describe the live
   database. What would be broken _right now_ in the running app? Name the
   specific hook and the specific error.
2. Your answer to (1) is the falsification test. Can you run it? If not, what is
   the cheapest thing that _would_?
3. `src/types/database.ts` declares `public: { Tables: { ... } }`. What does the
   presence of that `public` key tell you about the deleted beats migration?

<details>
<summary>Hints for Step 2</summary>

- Q1: If the live table were in a `beats` schema with a `beat_grid` column, would
  the table lookup 404 first, or would the insert fail on an undefined column?
  Which error surfaces first tells you what to look for.
- Q2: `npm run dev`, sign in, save a beat. Ninety seconds. If saving works, then
  `public.beats` with a `data` column exists.
- Q3: The `Database` generic only ever describes `public`. A table in a different
  schema could not be reached through it without extra client configuration.

</details>

**Verify**: run the falsification test you named in Q2 and record the result in
your evidence file — including "I could not run it because X", if that is the
truth. Record what you observed, not what you assumed.

---

## Step 3: Write the decision record, then act

The `git status` output you are looking at will not exist in six months. What
will exist is a commit. If that commit says `chore: remove old migrations`, the
next reader has to redo Steps 1 and 2 to find out whether it was safe.

So the deliverable of this step is not the deletion. It is a short document that
makes the deletion re-checkable.

The house format is `claude-agent-dashboard/docs/adr/0001-*.md` — a decision, its
context, its consequences, numbered. This repo has no `docs/adr/` yet; you are
creating the first one.

### 3a. The ADR

Create `docs/adr/0001-supabase-migration-history.md`. The template below is
complete — fill the seven bracketed fields and delete the brackets.

```markdown
# 0001. [FILL: the decision in one line, active voice — "Keep X, remove Y"]

- Status: accepted
- Date: [FILL: today's date, YYYY-MM-DD]

## Context

[FILL: 3-5 sentences. What was in supabase/migrations/, and what was
uncommitted. Someone who DISAGREES with your decision should still agree with
this paragraph — so no conclusions here, only what was on disk.]

## Decision

[FILL: one sentence, imperative. Your cell 30, compressed.]

## Evidence

[FILL: the two or three specific file:line citations from Step 2 that drove the
decision. Actual paths and line numbers — "the code suggested" is not evidence.
Cells 20, 21 and 23 are where yours will come from.]

## Consequences

[FILL: (a) what a fresh clone now runs to provision, by exact path.
(b) what is now unrecoverable except through git history.
(c) which file owns the RLS policies from here on — be explicit, this is the
security boundary and the reason this ticket was P0.]

## What this does not decide

[FILL: your cell 32. If you never verified `profiles` against a running query,
say so here in one sentence.]
```

### 3b. The README section

There is currently nowhere in `README.md` that answers "how do I get a database".
`README.md:24` names Supabase in the Tech Stack list and stops.

Add this section where a new contributor would look for it — after the Tech Stack
block is the natural home.

```markdown
## Database Setup

[FILL: which file provisions the schema, by exact path.]

[FILL: how to run it — Supabase SQL editor, or the CLI. If you say CLI, note
that this repo has no supabase/config.toml yet, so that path needs setup first.]

[FILL: one sentence stating that RLS policies are included in that file, so
nobody assumes they need to be clicked into the dashboard.]

See [ADR 0001](docs/adr/0001-supabase-migration-history.md) for why the earlier
migrations are not here.
```

### 3c. The git action

**Write the ADR before you run any `git` command.** If you cannot fill in
"Evidence" with paths and line numbers, you are not ready to act, and the correct
move is to return to Step 2 — not to type the command and backfill a
justification afterwards.

On the command itself: your cell 30 selects exactly one of two one-liners. One
restores three files. One stages three deletions. You should be able to write
both from memory; the work was deciding, not typing.

Whichever you run, the migration directory afterwards must not contain two files
that create the same `schema.table`. If your action leaves that situation, your
conclusion was "keep both" — which Step 1 Q1 and Q2 exist to rule out. Re-read
them.

### Quiz — Step 3

1. Write the commit message. Does it say what a reader needs, or what you did?
   (`git log --oneline -15` for the house style.)
2. Someone provisions a fresh Supabase project six months from now by running
   every file in `supabase/migrations/` in sort order. After your change, does
   `profiles` have RLS enabled? Trace it, file by file.
3. If your decision is wrong, what is the recovery path and how long does it
   take? Write the exact `git` incantation. If you cannot write it, your decision
   is riskier than you currently think it is.

<details>
<summary>Hints for Step 3</summary>

- Q1: this repo's log uses `feat:`, `fix:`, `style:`, `polish:`, and bracketed
  ticket ids. Match it.
- Q3: deleted-but-committed content is reachable via `git show <sha>:<path>`
  forever — _provided the commit is on a branch someone pushed_. Is your branch
  pushed?
- Stuck on the decision itself? Read cell 30 out loud. If it does not select an
  action unambiguously, it is not finished, and that — not the git command — is
  your actual blocker.

</details>

**Verify**:

```bash
git status --short -- supabase/    # → no output
git ls-files supabase/migrations/  # → matches your ADR's Consequences section
```

If those two disagree, fix the ADR. It is the thing that will be read.

---

## Test plan

There is no unit-test harness for SQL migrations in this repo, and adding one is
disproportionate. Verify by inspection and by the build:

1. `git status --short -- supabase/` prints nothing.
2. `git ls-files supabase/migrations/` matches the ADR's Consequences section
   exactly.
3. `npm run build` passes (`tsc -b && vite build`). It should be unaffected — if
   it is not, you touched `src/`, which was out of scope.
4. `npm run lint` prints no new problems.
5. `grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/*.sql` returns a
   number you can justify out loud. Not zero.
6. **The one that actually matters**: open `README.md` as if you had never seen
   this repo. Can you provision a database from it without asking anyone? If not,
   the section is not done. This is the only check you can fail while all the
   others pass.

## Done criteria

Machine-checkable except where noted. ALL must hold:

- [ ] `git status --short -- supabase/` returns no output
- [ ] `git ls-files supabase/migrations/` matches the ADR's Consequences section
- [ ] `docs/adr/0001-supabase-migration-history.md` exists, with at least two
      `file:line` citations in its Evidence section
- [ ] That ADR's "What this does not decide" section is non-empty
- [ ] `grep -c "\[FILL:" docs/adr/0001-supabase-migration-history.md` returns `0`
- [ ] `grep -c "\[FILL:" README.md` returns `0`
- [ ] `grep -rn "ENABLE ROW LEVEL SECURITY" supabase/migrations/` returns at
      least one match, and you can name the file
- [ ] `README.md` contains a Database Setup section naming the provisioning file
      by exact path and linking the ADR
- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0 with no new problems
- [ ] `git status` shows no modified files under `src/`
- [ ] (Judgement) You ran your Step 2 Q2 falsification test, or recorded in the
      ADR why you could not

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check does not print exactly three `D` lines.
- Your Step 2 evidence points **both ways** — e.g. cell 26 says yes and cell 24
  also says yes, or the type file matches one migration while the hooks match the
  other. That is a real finding: the live database is in a state neither file
  describes. Do not resolve it by picking one.
- You are about to run `git checkout -- .` (with a dot). That restores everything
  in the tree, not just `supabase/`, and this branch has other uncommitted work.
- You conclude the answer is "keep all four migrations". Step 1 Q1/Q2 exist to
  rule this out; if you still believe it after answering them, settle the sort
  order before acting.

## Maintenance notes

- If the Supabase CLI is wired up later (`supabase/config.toml`, `supabase db
push`), the README section from Step 3b is the thing to update — it will be the
  only place claiming how provisioning works.
- The `docs/adr/` directory created here should get an `0002` the next time a
  schema-shaped decision is made. The numbering is per-repo.
- A reviewer should confirm `grep -rn "profiles" src/` returns what it returned
  before this plan. Nothing under `src/` should have moved.

## What you should know afterwards

1. A migration directory is a replayable history, so two files creating the same
   `schema.table` is not redundancy — it is a runtime error waiting for the next
   fresh provision.
2. Postgres identifies tables by `schema.name`. `beats.beats` and `public.beats`
   share four letters and nothing else.
3. Hand-written client types are evidence about a live database but not proof.
   The way to upgrade them is to find a query that would fail if they were wrong.
4. RLS defined only in a hosting dashboard is a security policy with no review,
   no diff, and no rollback.
5. The reversible half of a change (deleting a file) is cheap. The irreversible
   half (the reasoning) is the part worth an hour.
