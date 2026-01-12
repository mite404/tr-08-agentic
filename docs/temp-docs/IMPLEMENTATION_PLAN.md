# Implementation Plan: TR-08 v1.0

**Status:** ✅ COMPLETE (PR #5: Hardening & Optimization Complete)
**Last Updated:** 2025-12-01
**Spec:** [PRD v2.2](./PRD.md)

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
  - [x] Create `src/db/schema.ts` and `src/db/index.ts` (for Node.js scripts only).
  - [x] Add database scripts to package.json (`db:introspect`, `db:generate`, `db:migrate`, etc.).
  - [x] Exclude `src/db/` from browser TypeScript config (`tsconfig.app.json`).

---

## Phase 2: Authentication & User Context ✅ COMPLETED (PR #3)

**Goal:** Users can identify themselves safely.

- [x] **2.1 Supabase Client**
  - [x] Initialize `src/lib/supabase.ts`.
  - [x] Set up Environment Variables (`.env.local`).

- [x] **2.2 Auth UI**
  - [x] Create `LoginModal` component.
  - [x] Implement `useAuth` hook to track Session state.
  - [x] Add Google and GitHub OAuth providers.
  - [x] **Check:** Ensure `profiles` row exists after first login (via SQL trigger).

---

## Phase 3: Persistence (The "Graffiti Wall") ✅ COMPLETED (PR #3)

**Goal:** Connect the UI to the Database using the new Semantic Data Structure.

- [x] **3.1 Supabase Client & Types**
  - [x] Create `src/lib/supabase.ts` with client initialization.
  - [x] Create `src/types/database.ts` with TypeScript types for `beats` and `profiles` tables.
  - [x] Load environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

- [x] **3.2 Authentication Hook**
  - [x] Create `src/hooks/useAuth.ts`.
  - [x] Implement session state tracking.
  - [x] Implement Google OAuth sign-in.
  - [x] Implement GitHub OAuth sign-in.
  - [x] Implement sign-out functionality.
  - [x] Create `src/components/LoginModal.tsx` for OAuth UI.

- [x] **3.3 The "Save" Hook**
  - [x] Create `src/hooks/useSaveBeat.ts`.
  - [x] Logic:
    1. Get current Grid/BPM/BeatName from State.
    2. Convert to Semantic `BeatManifest` (using `toManifest()`).
    3. Validate via Zod (`BeatManifestSchema`).
    4. Insert into Supabase `beats` table.
  - [x] UX: Implement debounced save (500ms via `saveBeatDebounced()`).
  - [x] Validation: Beat name 1-25 chars, non-empty.

- [x] **3.4 The "Load" Hook**
  - [x] Create `src/hooks/useLoadBeat.ts`.
  - [x] Logic: Fetch `ORDER BY created_at DESC LIMIT 1` (latest beat).
  - [x] Logic: Run `normalizeBeatData()` (The Safety Check).
  - [x] Logic: Hydrate React State (Grid + BPM + Beat Name) via `toGridArray()`.
  - [x] Add `loadBeatById()` and `loadUserBeats()` for future use.

- [x] **3.5 UI Integration**
  - [x] Add `LoginModal` to `App.tsx`.
  - [x] Initialize `useAuth`, `useSaveBeat`, `useLoadBeat` hooks in `App.tsx`.
  - [x] Add Save/Load buttons to `App.tsx`.
  - [x] Add loading states (`isSaving`, `loadingBeat`).
  - [x] Add error handling and user feedback.
  - [x] Create `SkeletonGrid` component (completed in PR #4).
  - [x] Block interaction until `isLoaded` is true (completed in PR #4).

---

## Phase 4: The Integration (UI Polish) ✅ COMPLETED (PR #4)

**Goal:** Polish UI, implement loading skeletons, and enforce auth-only visibility.

- [x] **4.1 Loading Skeleton Grid**
  - [x] Create `src/components/SkeletonGrid.tsx`.
  - [x] Layout: 10 rows × 16 columns = 160 cells.
  - [x] Styling: Matches exact grid layout (`grid grid-cols-16 gap-1`).
  - [x] Animation: `animate-pulse` for smooth loading feedback.
  - [x] Purpose: Prevents Cumulative Layout Shift (CLS) during data load.

- [x] **4.2 Mobile Responsiveness**
  - [x] Create `src/components/PortraitBlocker.tsx`.
  - [x] Logic: Detect `(orientation: portrait) and (max-width: 768px)`.
  - [x] UI: Fixed full-screen overlay (`z-50`, `bg-black`).
  - [x] Message: "Please Rotate Your Device to Play".
  - [x] Implementation: `MediaQueryList` listener for orientation changes.

- [x] **4.3 Component Polish**
  - [x] Create `src/components/SaveButton.tsx` with loading spinner.
  - [x] Create `src/components/LoadButton.tsx` with loading spinner.
  - [x] Create `src/components/LoginModalButton.tsx` with modal and close button.
  - [x] Dark-theme modal styling (`bg-gray-900`).
  - [x] Proper error handling and user feedback.

- [x] **4.4 App.tsx Integration**
  - [x] Add auto-load "Graffiti Wall" on mount via `useEffect`.
  - [x] Show `SkeletonGrid` while `isInitialDataLoaded` is false.
  - [x] Auth-based UI logic:
    - Guest users: Show only "Sign In" button.
    - Authenticated users: Show "Save", "Load", and "Sign Out" buttons.
  - [x] Mount `PortraitBlocker` at top level.
  - [x] Remove unused imports and test code (instruments table references).

---

## Phase 5: Production Hardening ✅ COMPLETED (PR #5)

**Goal:** Optimization and Error Handling.

- [x] **5.1 UX Polish: Auth Flash Fix**
  - [x] Added loading state to header during auth check.
  - [x] Shows "Loading..." text instead of flashing "Sign In" button on reload.

- [x] **5.2 Browser Lifecycle Management**
  - [x] Implemented `visibilitychange` listener in `App.tsx`.
  - [x] Created `isPageHiddenRef` to track page visibility state.
  - [x] Modified sequencer to skip UI updates when `document.hidden === true`.
  - [x] Audio continues playing in background; UI syncs on tab return.

- [x] **5.3 Error Boundaries (Crash Protection)**
  - [x] Created `src/components/ErrorBoundary.tsx` (class component).
  - [x] Wraps sequencer grid to catch React errors.
  - [x] Displays user-friendly error UI with "Reload Page" button.

- [x] **5.4 Audio Load Timeout**
  - [x] Updated `loadAudioSamples()` with Promise.race and 10-second timeout.
  - [x] Logs warning on timeout but resolves successfully (app usable but possibly silent).
  - [x] Never crashes due to slow audio loading.

### Asset Optimization (Post-v1.0)

- [ ] Convert WAVs to MP3/OGG for smaller bundle size.
- [ ] Implement lazy audio loading (load UI first, audio async).
