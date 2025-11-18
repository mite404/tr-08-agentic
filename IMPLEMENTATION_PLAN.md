# Implementation Plan: TR-08 v1.0

**Status:** Active
**Spec:** [PRD v2.1](./PRD.md)

---

## Phase 1: Data Layer & Architecture (The Backbone)

**Goal:** Establish the database, semantic types, and validation safety net.

- [ ] **1.1 Database Infrastructure (Supabase)**
  - [x] Create `beats` table (JSONB 'data' column).
  - [x] Create `profiles` table.
  - [ ] **Task:** Execute SQL for `on_auth_user_created` Trigger (Link Auth -> Profile).
  - [x] Enable RLS Policies (Public Read, Auth Write).

- [ ] **1.2 Semantic Type Definitions**
  - [ ] Install Zod: `npm install zod`
  - [ ] Create `src/types/beat.ts`:
    - Define `TrackID` union type (`bd_1` | `sd_1` ...).
    - Define `BeatManifest` interface (The JSON structure).
    - Implement Zod Schema `BeatManifestSchema` for runtime validation.

- [ ] **1.3 The "Rosetta Stone" (Track Registry)**
  - [ ] Create `src/config/trackConfig.ts`.
  - [ ] Export a `TRACK_REGISTRY` object that maps `TrackID` -> `Sample File` + `UI Row Index`.
  - [ ] **Why:** This allows us to convert the DB's "Semantic JSON" into the UI's "Array Grid".

- [ ] **1.4 Data Transformers**
  - [ ] Create `src/utils/beatUtils.ts`.
  - [ ] Implement `normalizeBeatData(json: any)`:
    - Uses `safeParse`.
    - Returns a guaranteed valid `BeatManifest`.
  - [ ] Implement `toGridArray(manifest)` and `toManifest(gridArray)` converters using the Registry.

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
