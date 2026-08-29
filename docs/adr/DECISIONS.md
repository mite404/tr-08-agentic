# Architectural Decisions (concise log)

One sentence per decision. Dates match merge commit dates on `main`. Full context for migration history lives in [0001-supabase-migration-history.md](./0001-supabase-migration-history.md).

| Date | Decision |
| ---- | -------- |
| 2025-11-30 | Beat data is stored as semantic JSON (`BeatManifest`) validated by Zod and mapped to the UI grid through a single `TRACK_REGISTRY`. |
| 2025-11-30 | Audio samples load through a registry-based engine with mute/solo/volume hierarchy calculated at playback, not at save time. |
| 2025-12-01 | React state updates pause when the tab is hidden; the playhead resyncs from `Tone.Transport` when the tab returns. |
| 2025-12-02 | Failed sample loads return `failedTrackIds` instead of throwing so partial playback remains usable. |
| 2026-01-14 | Global swing and drive run through a master effects chain (`DriveGain → SoftClipper → Compressor → Limiter`) rather than per-track distortion. |
| 2026-01-15 | Track display labels were corrected in `trackConfig.ts` without renaming `TrackID` values so existing Supabase rows stay valid. |
| 2026-01-15 | Beat load must set `Tone.Transport.bpm` and call `updateBpm()`; updating React BPM state alone is insufficient. |
| 2026-01-15 | Swing and drive persist on `BeatManifest.global` with `normalizeBeatData()` injecting `0` defaults for older beats. |
| 2026-01-16 | CI runs lint-and-build and Vercel deploy through GitHub Actions workflows checked into the repo. |
| 2026-01-30 | Component tests use Vitest with `happy-dom` rather than a full browser for static UI checks. |
| 2026-02-04 | Supabase client mocks use a module getter so each test can swap the client without stale singleton state. |
| 2026-02-04 | The photorealistic chassis image is the layout coordinate system; knobs and chiclets align to its printed slots. |
| 2026-02-06 | Auth controls live in a page-level `NavBar`, not inside the sequencer chassis. |
| 2026-02-06 | `SequencerChassis` is a presenter component; `App.tsx` keeps state, audio wiring, and handlers. |
| 2026-06-19 | `oxlint` and `oxfmt` replace ESLint as the primary lint/format toolchain for faster feedback. |
| 2026-06-19 | The chassis background switched from PNG to JPG and chiclets scale responsively within the faceplate grid. |
| 2026-08-24 | `supabase/migrations/01_init_schema.sql` is the sole migration file; three November 2025 migrations were removed as superseded. |
