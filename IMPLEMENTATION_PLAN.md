# Implementation Plan: TR-08 v1.0

**Status:** Active
**Spec:** [PRD v2.1](./PRD.md)

---

## Phase 1: Data Layer & Architecture (The Backbone) ✅ COMPLETED

**Goal:** Establish the database, semantic types, and validation safety net.

- [x] **1.1 Database Infrastructure (Supabase)**
  - [x] Create `beats` table (JSONB 'data' column).
  - [x] Create `profiles` table.
  - [x] Execute SQL for `on_auth_user_created` Trigger (Link Auth -> Profile).
  - [x] Enable RLS Policies (Public Read, Auth Write).
  - [x] Add optimized RLS policies using `(select auth.uid())` pattern.
  - [x] Add DELETE policy for user's own beats.
  - [x] Add auto-update trigger for `updated_at` timestamp.

- [x] **1.2 Semantic Type Definitions**
  - [x] Install Zod: `npm install zod`
  - [x] Create `src/types/beat.ts`:
    - Define `TrackID` union type (`kick_01` | `kick_02` | `bass_01` | `bass_02` | `snare_01` | `snare_02` | `synth_01` | `clap` | `hh_01` | `hh_02`).
    - Define `BeatManifest` interface (The JSON structure).
    - Implement Zod Schema `BeatManifestSchema` for runtime validation.

- [x] **1.3 The "Rosetta Stone" (Track Registry)**
  - [x] Create `src/config/trackConfig.ts`.
  - [x] Export a `TRACK_REGISTRY` object that maps `TrackID` -> `Sample File` + `UI Row Index`.
  - [x] **Why:** This allows us to convert the DB's "Semantic JSON" into the UI's "Array Grid".

- [x] **1.4 Data Transformers**
  - [x] Create `src/lib/beatUtils.ts` (moved from `src/utils/` to `src/lib/`).
  - [x] Implement `normalizeBeatData(json: any)`:
    - Uses `safeParse`.
    - Returns a guaranteed valid `BeatManifest`.
  - [x] Implement `toGridArray(manifest)` and `toManifest(gridArray)` converters using the Registry.
  - [x] Implement `calculateEffectiveVolume(manifest, trackId)` for mute/solo/volume hierarchy.
  - [x] Implement `migrateSchema(data)` for version compatibility.

- [x] **1.5 Audio Engine**
  - [x] Create `src/lib/audioEngine.ts`.
  - [x] Implement `resumeAudioContext()` for browser autoplay policy compliance.
  - [x] Implement `loadAudioSamples(manifest, onLoadProgress)` with timeout and error handling.
  - [x] Implement `playTrack(player, effectiveVolume, now)` for sample playback.

- [x] **1.6 Development Tooling**
  - [x] Install Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `postgres`).
  - [x] Create `drizzle.config.ts` for schema management.
  - [x] Create `src/db/schema.ts` and `src/db/index.ts` (for scripts only).
  - [x] Add database scripts to package.json (`db:introspect`, `db:generate`, `db:migrate`, etc.).

---

## Phase 2: Authentication & User Context

**Goal:** Users can identify themselves safely.

- [ ] **2.1 Supabase Client**
  - [ ] Initialize `src/lib/supabase.ts`.
  - [ ] Set up Environment Variables.

- [ ] **2.2 Auth UI**
  - [ ] Create `LoginModal` component.
  - [ ] Implement `useAuth` hook to track Session state.
  - [ ] **Check:** Ensure `profiles` row exists after first login.

---

## Phase 3: Persistence (The "Graffiti Wall")

**Goal:** Connect the UI to the Database using the new Semantic Data Structure.

- [ ] **3.1 The "Save" Hook**
  - [ ] Logic:
    1. Get current Grid/Knobs from State.
    2. Convert to Semantic `BeatManifest` (using Registry).
    3. Validate via Zod.
    4. Insert into Supabase.
  - [ ] UX: Debounce the Save button.

- [ ] **3.2 The "Load" Hook**
  - [ ] Logic: Fetch `ORDER BY created_at DESC LIMIT 1`.
  - [ ] Logic: Run `normalizeBeatData` (The Safety Check).
  - [ ] Logic: Hydrate React State (Grid + BPM + Knobs).

- [ ] **3.3 Loading States**
  - [ ] Create `SkeletonGrid` component (Visual placeholder).
  - [ ] Block interaction until `isLoaded` is true.

---

## Phase 4: Production Hardening

**Goal:** Optimization and Error Handling.

- [ ] **4.1 Audio Architecture Check**
  - [ ] Verify `Tone.Players` are in `useRef`.
  - [ ] Verify `useEffect` updates volumes based on DB data.
  - [ ] Add `Tone.context.resume()` handler on "Play" click.

- [ ] **4.2 Asset Optimization**
  - [ ] Convert WAVs to MP3/OGG.
  - [ ] Implement Pre-loader utility.
