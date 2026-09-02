---
name: verify-tr-08
description: 'Verify TR-08 drum machine web app: launch, drive, capture evidence, cleanup. Use for smoke tests, feature verification, or regression checks on the TR-08 sequencer UI.'
---

# verify-tr-08

Verification skill for TR-08, a web-based drum machine / beat sequencer built with React 19, Vite, Tone.js, and Supabase.

**When to use:** Smoke test the app after changes, verify a specific feature works, or capture evidence that a user-facing path behaves correctly.

**What it is NOT:** This is not for unit tests, type checks, or lint (those belong in the gate section). This is for driving the live UI like a user would.

## Launch

Start the dev server on an isolated port:

```bash
cd .agents/skills/verify-tr-08/scripts
VERIFY_PORT=5174 VERIFY_RUN_ID=test-run ./control-tr-08.mjs launch
```

**What it does:**

- Spawns `bun run dev -- --port 5174 --host` (fallback to npm if bun unavailable)
- Refuses to double-launch (checks for running PID and busy port)
- Waits for HTTP 200/304 response at `http://localhost:5174`
- Records PID, port, start time, and log path in `$VERIFY_STATE_DIR/state.json`
- Logs Vite output to `$VERIFY_STATE_DIR/vite.log`

**Default state directory:** `/tmp/tr-08-verify-<VERIFY_RUN_ID>` (override with `VERIFY_STATE_DIR`)

**How to tell it's ready:** `launch` blocks until the server responds. If it exits 0, the app is live.

## Doctor

Read-only health check. Run after launch to confirm the app is up and serving TR-08 content:

```bash
./control-tr-08.mjs doctor
```

**Checks:**

1. Process exists (PID from state is alive)
2. Port responds (HTTP GET to `http://localhost:5174/` returns 200 or 304)
3. Content assertion (response body contains `"TR-08"` — a string only this app serves)

**Exit status:** 0 if all checks pass, 1 otherwise.

## Gate

Mechanical quality gates. Run these BEFORE opening a PR or committing:

### Pre-commit Hook (if installed)

The repo has a Husky pre-commit hook at `.husky/pre-commit`:

```bash
npx lint-staged           # Format and lint staged files
bun run lint              # oxlint on full codebase
bun run test -- --run     # vitest (58 tests)
fallow audit --base HEAD --quiet --gate-marker pre-commit  # optional, skipped if not installed
```

**To install the hook:**

```bash
bun run prepare  # Installs husky hooks
```

### Manual Gate Commands (copy-pasteable)

Run from workspace root:

```bash
# Type check (part of build)
bun run build  # Runs tsc -b && vite build

# Lint (oxlint is the active linter)
bun run lint   # oxlint . (exits 0 with warnings, 1 on errors)

# Tests
bun run test -- --run  # vitest with 58 tests

# Format check (oxfmt, not in CI)
npx oxfmt --check .  # Returns exit code 0 if formatted, 1 if needs formatting
```

**Notes:**

- `eslint.config.js` exists but **oxlint** is the active gate (see `package.json` lint script)
- `.prettierrc.json` exists but **oxfmt** is used for formatting (via oxc toolchain)
- Type-aware linting: `oxlint-tsgolint` package is installed, so oxlint includes type-aware rules
- `fallow` is optional (skipped if not installed)

**Base ref for changed-code analyzers:** `HEAD` (the last commit)

## Drive

Use the control CLI to interact with the UI. All commands are in `/workspace/.agents/skills/verify-tr-08/scripts/control-tr-08.mjs`.

**Harnesses:**

- Local Playwright (auto-installed if missing via `npm install --no-save playwright`)
- In Cursor IDE, can also use `cursor-ide-browser` (if available)
- In Claude Desktop, can also use `mcp__chrome-devtools__*` (if available)

**Real selectors from the codebase:**

| Action       | Selector                              | Command                           |
| ------------ | ------------------------------------- | --------------------------------- |
| Play/Stop    | `button[aria-label="Start / Stop"]`   | `./control-tr-08.mjs play`        |
| Increase BPM | `button[aria-label="Increase tempo"]` | `./control-tr-08.mjs bpm-up`      |
| Decrease BPM | `button[aria-label="Decrease tempo"]` | `./control-tr-08.mjs bpm-down`    |
| Save Beat    | `button[aria-label="Save beat"]`      | _(requires auth)_                 |
| Load Beat    | `button[aria-label="Load beat"]`      | _(requires auth)_                 |
| Tap Pad      | `button:nth-of-type(N)`               | `./control-tr-08.mjs tap-pad 0 0` |

**Example verification flow:**

```bash
# From /workspace/.agents/skills/verify-tr-08/scripts
export VERIFY_PORT=5174
export VERIFY_RUN_ID=smoke-test

./control-tr-08.mjs launch
./control-tr-08.mjs doctor
./control-tr-08.mjs wait-settle
./control-tr-08.mjs screenshot before
./control-tr-08.mjs tap-pad 0 0   # Tap first pad (track 0, step 0)
./control-tr-08.mjs tap-pad 0 4   # Tap fifth pad (track 0, step 4)
./control-tr-08.mjs screenshot after-taps
./control-tr-08.mjs play
./control-tr-08.mjs snapshot playing
./control-tr-08.mjs stop
./control-tr-08.mjs cleanup
```

**Grid coordinates:**

- Tracks: 0-9 (rows, from top to bottom)
- Steps: 0-15 (columns, from left to right)
- Example: `tap-pad 2 8` = track 2 (third row), step 8 (ninth column)

## Evidence

**What to capture:**

1. **Screenshots:** Visual state before/after actions
2. **ARIA snapshots:** Page structure with roles and labels
3. **Action logs:** What commands were run

**Where it goes:**

- Screenshots: `$VERIFY_STATE_DIR/screenshots/` (e.g., `/tmp/tr-08-verify-<run-id>/screenshots/`)
- ARIA snapshots: `$VERIFY_STATE_DIR/artifacts/` (e.g., `/tmp/tr-08-verify-<run-id>/artifacts/`)
- Vite logs: `$VERIFY_STATE_DIR/vite.log`
- State: `$VERIFY_STATE_DIR/state.json`

**Proof standards:**

- **Real user path:** Every command must map to a user action (click, type, wait)
- **Action + resulting state:** Show what changed (screenshot before/after, ARIA diff)
- **Side effects:** Capture console logs, network activity if relevant
- **Mocks only at production boundary:** If Supabase auth is mocked, document it clearly

**Example evidence bundle:**

```
/tmp/tr-08-verify-smoke-test/
├── state.json
├── vite.log
├── screenshots/
│   ├── before-2026-09-02T16-45-00-000Z.png
│   ├── after-taps-2026-09-02T16-45-10-000Z.png
│   └── playing-2026-09-02T16-45-15-000Z.png
└── artifacts/
    ├── snapshot-initial-2026-09-02T16-45-05-000Z.txt
    └── snapshot-playing-2026-09-02T16-45-16-000Z.txt
```

## Cleanup

Stop the server and clear runtime state. **Evidence survives at the artifacts path.**

```bash
./control-tr-08.mjs cleanup
```

**What it does:**

- Finds PID from `$VERIFY_STATE_DIR/state.json`
- Sends SIGTERM (waits 2s), then SIGKILL if still alive
- Clears PID and port from state.json
- **Preserves:** screenshots, snapshots, logs at `$VERIFY_STATE_DIR`

**What it does NOT do:**

- Does not delete `$VERIFY_STATE_DIR` or its subdirectories
- Does not kill by process name (never `pkill vite` or `killall node`)

## Helpers

**From the `.agents/` path** (works through symlinks):

```bash
cd .agents/skills/verify-tr-08/scripts
./control-tr-08.mjs launch
./control-tr-08.mjs doctor
./control-tr-08.mjs cleanup
```

**From a symlinked path** (if `.cursor/skills/verify-tr-08` exists):

```bash
cd /workspace/.cursor/skills/verify-tr-08/scripts
./control-tr-08.mjs launch
./control-tr-08.mjs doctor
./control-tr-08.mjs cleanup
```

The control script walks up from its own location to find the workspace root (four `..` from `scripts/`), so it works from either path.

## Isolation

**Can two instances run side by side?**

Yes, with different ports and state directories:

```bash
# Instance 1
VERIFY_PORT=5174 VERIFY_RUN_ID=run-1 ./control-tr-08.mjs launch

# Instance 2
VERIFY_PORT=5175 VERIFY_RUN_ID=run-2 ./control-tr-08.mjs launch
```

Each instance:

- Uses its own port
- Maintains separate state in `/tmp/tr-08-verify-<run-id>/`
- Records its own PID, log, and artifacts

**Limitations:**

- Supabase backend is shared (if using real Supabase, not mocked)
- Audio context may conflict if both instances play simultaneously

## Feature Map

See [`features/README.md`](features/README.md) for a structured breakdown of user-facing features and how to drive each one.

## Troubleshooting

**Port already in use:**

```bash
# Find what's using the port
lsof -i :5174

# Or use a different port
VERIFY_PORT=5175 ./control-tr-08.mjs launch
```

**PID is stale:**

```bash
# Manually clear state
rm /tmp/tr-08-verify-<run-id>/state.json
```

**Playwright not installed:**

The control script auto-installs Playwright if missing:

```bash
npm install --no-save playwright @playwright/test
```

**Supabase auth required:**

Some features (Save, Load, Beat Library) require authentication. If running without Supabase env vars, those features will fail. Document this in your evidence.

**Environment variables for Supabase:**

If you need to test auth features, set these before `launch`:

```bash
export VITE_SUPABASE_URL=<your-supabase-url>
export VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

(Or use a `.env.local` file in the workspace root)

## Production Boundary

**Where mocks are acceptable:**

- Supabase auth (if testing UI only, not persistence)
- Tone.js audio playback (if testing grid state only, not sound)

**Where mocks are NOT acceptable:**

- Vite dev server (must be real)
- React rendering (must be real)
- Browser interactions (must be real Playwright clicks)

When documenting evidence, state clearly if Supabase is mocked or real.

**Note:** This skill was proven with mock Supabase credentials (`.env.local` with fake values for UI-only testing). Auth features (Save, Load, Beat Library) require real Supabase and are documented as such in the feature map.
