# TR-08 v1.0 Implementation Checklist

**Status:** ✅ **v1.2 RELEASED + Testing Infrastructure Complete (PR #22-23)** | **Last Updated:** 2026-01-31

---

## Release Summary

**15 PRs completed. Production-ready drum machine with v1.2 features + Master Drive/Swing + Chiclet Grid:**

- Persistent beat storage (Supabase)
- Real-time sequencer with Tone.js master effects chain (DriveGain → SoftClipper → Compressor → Limiter)
- Global Swing control (0-100% Transport.swing with 16n subdivision)
- Master Drive control (soft-clip saturation, 1.0-4.0 gain + auto-gain compensation)
- Auth integration (Google, GitHub OAuth)
- Error boundaries and crash protection
- Mobile-optimized UX
- Browser lifecycle management
- Bulletproof audio loading with individual track timeouts (PR #6)
- Per-track pitch control (-12 to +12 semitones) (PR #8)
- Ghost note accents (-7 dB per step) with 3-state pad UI (PR #9)
- Per-track mute/solo buttons with audio engine integration (PR #11)
- Beat library side panel with beat list browsing and instant loading (PR #12)
- Photorealistic knobs with PNG assets and variant-based rendering (PR #13)
- Photorealistic chiclet grid with 4-step color banding and image-based rendering (PR #21)

---

## Phase-by-Phase Implementation Status

### Phase 1: Foundation (PR #1)

**Objective:** Establish the database, semantic types, and validation safety net.

**1.1 Database Infrastructure (Supabase)**

- [x] Create `beats` table (JSONB 'data' column)
- [x] Create `profiles` table
- [x] Execute SQL for `on_auth_user_created` Trigger (Link Auth -> Profile)
- [x] Enable RLS Policies (Public Read, Auth Write)
- [x] Add optimized RLS policies using `(select auth.uid())` pattern
- [x] Add DELETE policy for user's own beats
- [x] Add auto-update trigger for `updated_at` timestamp

**1.2 Semantic Type Definitions**

- [x] Install Zod: `bun install zod`
- [x] Create `src/types/beat.ts`:
  - Define `TrackID` union type (`kick_01` | `kick_02` | `bass_01` | `bass_02` | `snare_01` | `snare_02` | `synth_01` | `clap` | `hh_01` | `hh_02`)
  - Define `BeatManifest` interface (The JSON structure)
  - Implement Zod Schema `BeatManifestSchema` for runtime validation

**1.3 The "Rosetta Stone" (Track Registry)**

- [x] Create `src/config/trackConfig.ts`
- [x] Export a `TRACK_REGISTRY` object that maps `TrackID` -> `Sample File` + `UI Row Index`
- [x] **Why:** This allows us to convert the DB's "Semantic JSON" into the UI's "Array Grid"

**1.4 Data Transformers**

- [x] Create `src/lib/beatUtils.ts`
- [x] Implement `normalizeBeatData(json: any)`:
  - Uses `safeParse`
  - Returns a guaranteed valid `BeatManifest`
- [x] Implement `toGridArray(manifest)` and `toManifest(gridArray)` converters using the Registry
- [x] Implement `calculateEffectiveVolume(manifest, trackId)` for mute/solo/volume hierarchy
- [x] Implement `migrateSchema(data)` for version compatibility

**1.5 Audio Engine**

- [x] Create `src/lib/audioEngine.ts`
- [x] Implement `resumeAudioContext()` for browser autoplay policy compliance
- [x] Implement `loadAudioSamples(manifest, onLoadProgress)` with timeout and error handling
- [x] Implement `playTrack(player, effectiveVolume, now)` for sample playback

**1.6 Development Tooling**

- [x] Install Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `postgres`)
- [x] Create `drizzle.config.ts` for schema management
- [x] Create `src/db/schema.ts` and `src/db/index.ts` (for Node.js scripts only)
- [x] Add database scripts to package.json (`db:introspect`, `db:generate`, `db:migrate`, etc.)
- [x] Exclude `src/db/` from browser TypeScript config (`tsconfig.app.json`)

**Definition of Done:** ✅ ALL COMPLETE

- Zod schemas compile without errors
- TrackID enum covers all 10 tracks
- toManifest/toGridArray are symmetric
- SQL migrations apply cleanly
- RLS policies enforce row-level security

---

### Phase 2: Audio Engine (PR #2)

**Objective:** Replace hardcoded audio with registry-based engine and signal hierarchy.

- [x] Create `src/lib/audioEngine.ts` with resumeAudioContext, loadAudioSamples, playTrack
- [x] Implement TRACK_REGISTRY lookup for track ordering
- [x] Implement calculateEffectiveVolume (Mute > Solo > Volume hierarchy)
- [x] Refactor `src/sequencer.ts` to use audio engine and manifest
- [x] Update `src/App.tsx` to call resumeAudioContext on Play button
- [x] Add progress callbacks for sample loading UI feedback
- [x] Initialize master effects chain (Compressor + Limiter) on master bus
  - [x] Compressor: 8:1 ratio, -12dB threshold, 5ms attack, 70ms release
  - [x] Limiter: -4dB threshold (brick-wall ceiling at -2dB)
  - [x] Auto-initialize via `getMasterChannel()` on first use
  - [x] All players connect to master channel (→ effects chain)
- [x] Fix AudioMotionAnalyzer to not create duplicate audio path
  - [x] Set `connectSpeakers: false` in constructor options
  - [x] Tap analyzer input from native audio node (listen-only)
  - [x] Resolve phasing issues from duplicate stereo paths

**Definition of Done:** ✅ ALL COMPLETE

- [x] resumeAudioContext called BEFORE sequencer.start()
- [x] loadAudioSamples initializes all 10 Tone.Player instances
- [x] calculateEffectiveVolume respects Mute > Solo > Volume hierarchy
- [x] Playback works with loaded players and manifest data
- [x] Progress bar shows sample loading status
- [x] Master bus compression/limiting applied without phasing issues
- [x] Analyzer visualizes audio without creating duplicate output path
- [x] All players connected to `getMasterChannel()` (effects chain)
- [x] Master effects chain auto-initializes on first use
- [x] Compressor and Limiter are stereo (Web Audio API DynamicsCompressorNode)
- [x] No wet/dry controls on dynamics processors (always 100% wet)

---

### Phase 3: Pipes (PR #3)

**Objective:** User authentication and beat persistence.

- [x] Create `src/hooks/useAuth.ts` with Supabase OAuth integration
- [x] Create `src/hooks/useSaveBeat.ts` with debounced save and validation
- [x] Create `src/hooks/useLoadBeat.ts` with fetch and data normalization
- [x] Update `src/App.tsx` to integrate auth hooks
- [x] Add session state management
- [x] Implement beat save/load with error handling
- [x] Add profanity filter for beat names

**Definition of Done:** ✅ ALL COMPLETE

- signInWithGoogle, signInWithGithub, signOut work correctly
- Save failures retry with exponential backoff (max 3x)
- Load fetches latest beat and normalizes old schema versions
- Session persists across page reloads
- Beat name validation prevents profanity

---

### Phase 4: Integration (PR #4)

**Objective:** UI components, loading states, and mobile support.

- [x] Create `src/components/SkeletonGrid.tsx` (10x16 loading placeholder)
- [x] Create `src/components/PortraitBlocker.tsx` (mobile orientation guard)
- [x] Create `src/components/LoginModalButton.tsx` (auth modal with OAuth buttons)
- [x] Create `src/components/SaveButton.tsx` with loading state
- [x] Create `src/components/LoadButton.tsx` with loading state
- [x] Create `src/components/Knob.tsx` (volume control per track)
- [x] Update `src/App.tsx` to show/hide components based on auth state
- [x] Auto-load latest beat on mount (Graffiti Wall pattern)
- [x] Add loading state to header during auth check

**Definition of Done:** ✅ ALL COMPLETE

- Skeleton displays while initial data loads
- Login modal shows for guests, save/load buttons for authenticated users
- Portrait blocker prevents landscape-only UI on mobile
- All components have loading/disabled states
- TTI < 1.5s on desktop

---

### Phase 5: Hardening & Optimization (PR #5)

**Objective:** Crash protection, performance, and browser lifecycle management.

- [x] Fix Auth Flash: Header shows "Loading..." while checking auth state
- [x] Implement visibilitychange listener in `src/App.tsx`
- [x] Create `isPageHiddenRef` to track page visibility
- [x] Pass `isPageHiddenRef` to sequencer to suspend UI updates when backgrounded
- [x] Sync playhead to `Tone.Transport.position` when tab becomes visible
- [x] Create `src/components/ErrorBoundary.tsx` (class component with error UI)
- [x] Wrap sequencer grid in ErrorBoundary
- [x] Add Promise.race timeout (10s) to `loadAudioSamples` in `src/lib/audioEngine.ts`
- [x] Log "Audio load timed out" warning on timeout
- [x] Resolve Promise instead of throwing to keep app usable

**Definition of Done:** ✅ ALL COMPLETE

- Auth loading state visible, no "Sign In" button flicker on reload
- React updates suspended when `document.hidden === true`
- Playhead syncs when tab becomes visible (no stale UI)
- Error Boundary catches React errors and shows "Reload Page" button
- Audio load timeout resolves successfully (app usable but possibly silent)
- Logging follows structured format: `[Module] Message`

---

### Phase 6: Bulletproof Audio Loading (PR #6)

**Objective:** Eliminate audio loading edge cases with individual track timeouts and comprehensive failure tracking.

**Status:** ✅ COMPLETE

#### Implementation Details

**1. Dual Timeout Architecture**

- [x] **Individual Track Timeout:** 2 seconds per track (prevents slow network from blocking others)
- [x] **Global Timeout:** 20 seconds for entire operation (catches systemic issues)
- [x] **withTimeout Helper:** Wraps promises with timeout rejection mechanism
- [x] **Promise.allSettled:** Ensures all track loads complete (success or failure)

**2. Enhanced Return Type**

```typescript
export interface LoadAudioResult {
  players: Map<TrackID, Tone.Player>;
  failedTrackIds: TrackID[]; // PR #6: Track which samples failed
}
```

**3. Failure Tracking**

- [x] Track failed samples by TrackID (not silent failure)
- [x] Identify URL resolution failures (`getSampleUrl` returns null)
- [x] Mark timeouts and errors explicitly in console
- [x] Return complete list of failed tracks for UI feedback

**4. Guaranteed Returns**

- [x] Function NEVER throws (wrapped in try-catch)
- [x] ALWAYS returns valid `LoadAudioResult` (never undefined)
- [x] Partial success acceptable (e.g., 8/10 samples loaded)
- [x] App remains usable even with failed samples

**5. Master Channel Integration**

- [x] All players connect to `getMasterChannel()` instead of `toDestination()`
- [x] Ensures all samples route through master effects chain
- [x] Single point of compression/limiting for all tracks

#### Code Changes in `src/lib/audioEngine.ts`

**Before (PR #5):**

```typescript
export async function loadAudioSamples(...): Promise<Map<TrackID, Tone.Player>>
```

**After (PR #6):**

```typescript
export async function loadAudioSamples(...): Promise<LoadAudioResult>
```

**Key Improvements:**

1. Individual 2-second timeout per track (prevents cascade failure)
2. Global 20-second failsafe (prevents indefinite hangs)
3. Explicit `failedTrackIds` array for UI integration
4. `Promise.allSettled` instead of `Promise.all` (some failures don't block others)
5. Guaranteed no-throw behavior (wrapped in try-catch)

**Definition of Done:** ✅ ALL COMPLETE

- [x] Individual timeouts (2s) prevent network slowdowns from blocking all tracks
- [x] Global timeout (20s) ensures operation completes eventually
- [x] Failed track IDs returned for UI feedback
- [x] All players connect to master channel effects chain
- [x] Function never throws (app always gets valid result)
- [x] Partial success is valid state (8/10 samples acceptable)
- [x] Console logging distinguishes between different failure types
- [x] Promise.allSettled ensures all attempts complete before returning

---

### Phase 7: v1.1 Features (Pitch & Accent) — ✅ COMPLETE

**Objective:** Implement per-track tuning and ghost note accents to increase musical expressiveness.

**7.1 Data Schema & Types (PR #7)** — ✅ COMPLETE

- [x] Update `TrackData` interface to include `pitch: number` (-12 to +12 semitones)
- [x] Update `TrackData` interface to include `accents: boolean[]` (16-step array)
- [x] Update Zod schema to validate pitch range (-12 to 12)
- [x] Update `normalizeBeatData` to inject default pitch (0) and empty accent track for v1.0 beats
- [x] Auto-migrate v1.0 beats with backward-compatible defaults

**7.2 Audio Engine Physics (PR #8)** — ✅ COMPLETE

- [x] Implement Pitch Logic: Calculate `playbackRate = 2 ^ (semitones / 12)` in `playTrack`
- [x] Apply pitch via `player.playbackRate = rate` before playback
- [x] Implement Accent Logic in `sequencer.ts`:
  - [x] Check `trackData.accents[stepIndex]` on every sequencer tick
  - [x] If accented, apply -7 dB volume reduction
  - [x] Formula: `effectiveVolume = trackVolume + masterVolume + (isAccented ? -7 : 0)`
- [x] Add unit tests for pitch calculation (2^(n/12) formula)
- [x] Add unit tests for accent volume hierarchy

**7.3 UI Integration (PR #9)** — ✅ COMPLETE

- [x] Implement 3-state pad interaction (OFF → ON Normal → ON Ghost → OFF)
  - [x] OFF: opacity-20 (visually dim)
  - [x] ON Normal: opacity-100 (full brightness)
  - [x] ON Ghost: opacity-50 (accent feedback)
- [x] Add dual knob columns:
  - [x] **Column 1 (Amber):** Pitch knobs (-12 to +12 semitones)
  - [x] **Column 2 (Cyan):** Volume knobs (-45 to +5 dB)
- [x] Refactor `Knob.tsx` to be generic (min/max/color props)
- [x] Add `color` prop support for visual distinction
- [x] Add `disabled` prop for failed track visual feedback (grayscale)
- [x] Update `App.tsx` to manage pitch state alongside volume
- [x] Store pitch and accent state in `manifest.tracks[trackId]`

---

### Phase 8: v1.2 Features (Mute/Solo, Beat Library Panel, Knob Asset Raster Impl.) — ✅ COMPLETE (PR #11, #12, #13)

#### PR #11: Mute & Solo Architecture — ✅ COMPLETE

**Goal:** Enable per-track signal processing control.

- [x] Add mute/solo button handlers in `App.tsx` (handleMuteToggle, handleSoloToggle)
- [x] Store mute/solo states in `trackMutes` and `trackSolos` React state arrays
- [x] Pass states to TrackControls component as props
- [x] Create mute/solo buttons styled to match design (25px height, Figma colors)
- [x] Persist mute/solo states in `BeatManifest.tracks[trackId]` during save
- [x] Load mute/solo states from manifest during beat load
- [x] Update sequencer to respect mute/solo during playback (calculateEffectiveVolume)
- [x] Fix manifestRef sync to include mute/solo states on load

#### PR #12: Beat Library (Side Panel) — ✅ COMPLETE

**Goal:** Allow users to browse and load their saved beats.

- [x] Install Shadcn UI dependencies: clsx, tailwind-merge, class-variance-authority, lucide-react, @radix-ui packages, date-fns
- [x] Create `src/lib/utils.ts` with `cn()` helper for class merging
- [x] Add `.beat-library-theme` scoped CSS variables to `src/index.css` (Vega/Orange color palette)
- [x] Create `src/components/ui/sheet.tsx` (Radix Dialog wrapper with scoped theming)
- [x] Create `src/components/ui/button.tsx` (CVA-based button component)
- [x] Add `loadBeatList()` function to `useLoadBeat` hook (fetch beat summaries)
- [x] Create `src/components/BeatLibrary.tsx` (sidebar panel with beat list)
- [x] Pre-fetch beat list in `loadInitialData()` on app mount
- [x] Refresh beat list after successful save
- [x] Integrate BeatLibrary component into App.tsx header (authenticated section)
- [x] **Bug Fix:** Fix `toGridArray()` to return raw `volumeDb` instead of `calculateEffectiveVolume()` (was returning -Infinity for muted tracks)

#### PR #13: Photorealistic Knob (The "Spike") — ✅ COMPLETE

**Goal:** Replace CSS-drawn knobs with photorealistic PNG assets.

- [x] Import VOLUME_KNOB.png (orange) and TONE_KNOB.png (cream) assets
- [x] Refactor Knob component: replace `color: string` prop with `variant?: "level" | "tone"`
- [x] Render knobs as rotated `<img>` tags instead of CSS circles
- [x] Select asset based on variant: `variant === "tone" ? pitchKnob : volumeKnob`
- [x] Apply rotation via CSS: `style={{ transform: rotate(${renderKnob}deg) }}`
- [x] Update TrackControls to pass `variant` prop (pitch knobs: "tone", volume knobs: "level")
- [x] Preserve all existing drag interaction and rotation calculations
- [x] Size: 28px × 28px, fits seamlessly in 25px track controls

---

### PR #14: Global Swing + Drive (Soft-Clip Saturation) — ✅ COMPLETE

**Status:** Implemented with soft-clip saturation (Sigmoid/Tanh) instead of hard distortion.

1. **Audio Engine (`audioEngine.ts`):** ✅ COMPLETE
   - [x] Implemented `Tone.WaveShaper` with sigmoid curve (`Math.tanh`) for warm saturation
   - [x] **Master Chain:** `Channel → DriveGain → SoftClipper → OutputComp → Compressor → Limiter → Destination`
   - [x] **DriveGain:** Maps knob 0-100% → gain 1.0-4.0 (+0 to +12dB boost into clipper)
   - [x] **SoftClipper:** Smooth analog-style clipping (no harsh digital artifacts)
   - [x] **OutputComp:** Auto-gain compensation (inverse of drive gain) maintains consistent volume
   - [x] **Control:** `setMasterDrive(percent: 0-100)` sets driveGain and outputComp simultaneously

2. **UI (`App.tsx`):** ✅ COMPLETE
   - [x] Added **"DRIVE" Knob** (labeled "SHUFFLE" and "DRIVE" in master section)
   - [x] Uses `GLOBAL_SWING.png` asset (same knob as swing control)
   - [x] Both knobs positioned left of Analyzer spectrum
   - [x] Drive knob triggers `handleDriveChange()` on drag
   - [x] Knob state persists in `drive` (0-100%) state variable

---

### PR #16: Track Label Correction

**Goal:** Fix the mislabeled instruments in the UI without breaking the underlying data.

- [x] **Why first?** It's a simple config change that clarifies the UI.
- [x] **Change:** `src/config/trackConfig.ts`.
  - [x] Change `label` for `snare_01` -> "CLAP".
  - [x] Change `label` for `clap` -> "SYNTH 02".
  - [x] (Keep the TrackIDs `snare_01` / `clap` the same so we don't break the database).

### PR #17: UI Style Polish (Button & Labels)

**Goal:** Fix the invisible button and add the column headers.

- [x] **Change 1:** `src/components/BeatLibrary.tsx`. Fix the `variant` or `className` of the Trigger button so it has contrast (e.g., `variant="outline"` or explicit colors).
- [x] **Change 2:** `src/App.tsx`. Add "TONE" and "LEVEL" text headers above the knob columns.

### PR #18: Drive Tuning

**Goal:** Make the Drive effect audible.

- [x] **Diagnosis:** The "Auto-Gain" logic is likely too aggressive (lowering volume _before_ the saturation is audible).
- [x] **Change:** `src/lib/audioEngine.ts`.
  - [x] Tweak the ratio. If we boost Input by +6dB, maybe only cut Output by -3dB.
  - [x] Or increase the max Drive Gain (from 4.0 to 6.0). We need to push the WaveShaper harder to hear the crunch.

### PR #19: Global Settings Persistence

1. **Schema Update (`src/types/beat.ts`):**
   - [x] Add `swing: number` (0-100) to `BeatManifest.global`.
   - [x] Add `drive: number` (0-100) to `BeatManifest.global`.
   - [x] Update Zod schema.
   - [x] Update `normalizeBeatData` to inject defaults (0) for old beats.

2. **App Logic (`src/App.tsx`):**
   - [x] Update `handleLoadBeat` to read these values and set state (`setSwing`, `setDrive`).
   - [x] **Crucial:** Call the audio engine setters (`setMasterDrive`, `setMasterSwing`) immediately on load.

3. **Utils (`src/lib/beatUtils.ts`):**
   - [x] Update `toManifest` to grab the current Swing/Drive values from arguments/state.

### PR #21: Grid Integration & Color Logic — ✅ COMPLETE

**Objective:** Replace the existing circular pads in the main Sequencer Grid with photorealistic Chiclet components and apply 4-step color grouping pattern.

**Status:** Completed

#### Implementation Summary

1. **Created Chiclet Component** (`src/components/Chiclet.tsx`) — ✅ COMPLETE
   - [x] Accepts props: `variant`, `isActive`, `isAccented`, `isCurrentStep`, `is16thNote`, `onClick`, `disabled`
   - [x] Imports 8 prerendered PNG images (on/off for each color band)
   - [x] Maps `variant` to chiclet images via lookup object
   - [x] Computes internal state: `off` | `on` | `accent` (deriving from `isActive` + `isAccented`)
   - [x] Maps state to opacity classes: `opacity-25` (off), `opacity-100` (on), `opacity-60` (accent)
   - [x] Applies brightness modifiers for playhead glow (`brightness-175`) and 16th notes (`brightness-135`)
   - [x] Renders as `<button>` with `backgroundImage` style (images at 70px height)

2. **Integrated into App.tsx Grid Rendering** — ✅ COMPLETE
   - [x] Import `Chiclet` component
   - [x] Created `getChicletVariant(stepIndex)` helper (maps step 0-15 to color band)
   - [x] Replaced `<Pad>` with `<Chiclet>` in grid rendering loop
   - [x] Removed `color` prop (now driven by `variant` + images)
   - [x] Pass `isActive`, `isAccented` directly (no state calculation in App.tsx)

3. **Color Banding Logic** — ✅ COMPLETE
   - [x] Steps 0-3: Red
   - [x] Steps 4-7: Orange
   - [x] Steps 8-11: Yellow
   - [x] Steps 12-15: Cream

4. **3-State Visual Feedback** — ✅ COMPLETE
   - [x] OFF (not active): 25% opacity, dark image
   - [x] ON (active, normal): 100% opacity, bright image
   - [x] ACCENT (active, accented): 60% opacity, bright image

**Deliverable:** The 10×16 grid now renders as a photo-realistic TR-08 panel with correct color banding and fully functional 3-state interaction. Playhead and 16th notes receive brightness boost for visual hierarchy.

---

### Testing Phase

**6-PR Testing Roadmap** (Walk, Jog, Run strategy): test infrastructure (Components), then logic (Integration), then browser (E2E).

---

### Part 1: Component Tests (The "Walk")

**Goal:** Verify UI renders correctly without needing a real browser or backend.

#### PR #22: Test Environment & Static Components ✅ COMPLETE

- **Focus:** Infrastructure setup and testing "dumb" components.
- **Completed:**
  - [x] Configure `vitest.config.ts` to use `environment: 'happy-dom'`.
  - [x] Create `src/test/setup.ts` to extend matchers (like `.toBeInTheDocument()`).
  - [x] **Test:** `SkeletonGrid` (Verify it renders the correct number of cells).
  - [x] **Test:** `PortraitBlocker` (Verify it renders text and ARIA role/label; includes `window.matchMedia` mock for browser API testing).
  - [x] Document test patterns in `TESTING_TUTORIAL.md` and `FOR_ETHAN.md`.

#### PR #23: ErrorBoundary Testing & React Lifecycle ✅ COMPLETE

- **Focus:** Testing React class components, lifecycle methods, and error catching.
- **Completed:**
  - [x] **Test:** `ErrorBoundary` catches render-time errors.
    - [x] `BombComponent` throws during render → ErrorBoundary fallback UI appears.
    - [x] Custom error messages are displayed on the page.
  - [x] **Test:** `ErrorBoundary` does NOT catch useEffect errors (lifecycle limitation).
    - [x] `TestChildComponent` throws in useEffect (post-render phase).
    - [x] Component renders successfully before error occurs.
    - [x] ErrorBoundary fallback UI does NOT appear.
    - [x] Error is logged to console instead (componentDidCatch side effect).
  - [x] **Test:** Reload button functionality.
    - [x] Verify button is present and clickable.
    - [x] Verify `window.location.reload()` is called when clicked.
  - [x] **Documentation:** Section 14 of `FOR_ETHAN.md` documents the key distinction between `getDerivedStateFromError` (render control) and `componentDidCatch` (logging/side effects).

---

### Part 2: Integration Tests (The "Jog")

**Goal:** Test hooks and state logic. This requires **Mocking** (faking Supabase and Timers).

#### PR #24: Supabase Mocking & Auth Hooks ✅ COMPLETE

**Completed:** 2026-02-04  
**Test File:** `src/hooks/__tests__/useAuth.test.tsx` (12 tests passing)

- **Focus:** Testing the `useAuth` hook with backend mocking.
- **Scope:** Establish the pattern for mocking Supabase throughout the test suite.
- **Tasks:**
  - [x] Create a reusable Mock for the Supabase Client
    - [x] Intercept `auth.getSession()` calls
    - [x] Mock `onAuthStateChange()` listener pattern
  - [x] **Test:** `useAuth` hook initialization
    - [x] Verify it calls `getSession()` on mount
    - [x] Verify it sets up `onAuthStateChange` listener
  - [x] **Test:** State updates via session changes
    - [x] Mock session change event
    - [x] Verify `setSession()` is called with new session data
  - [x] **Test:** Sign-in methods (Google, GitHub)
    - [x] Verify `signInWithOAuth` is called with correct provider
    - [x] Verify errors are thrown when OAuth fails
  - [x] **Test:** Sign-out functionality
    - [x] Verify `signOut()` is called on Supabase client
    - [x] Verify errors are thrown when sign-out fails
  - [x] **Test:** Cleanup on unmount
    - [x] Verify `unsubscribe()` is called when component unmounts
- **Why:** This establishes the mocking foundation for all future integration tests. Every hook that depends on Supabase will follow this pattern.

#### PR #25: Logic & Timers (Save/Load) — 🚧 PLANNED

- **Focus:** Testing business logic with fake timers and data transformation.
- **Scope:** Validate debouncing, retries, and data normalization.
- **Tasks:**
  - [ ] **Test:** `useSaveBeat` hook (debounce behavior)
    - [ ] Use `vi.useFakeTimers()` to control time
    - [ ] Trigger a save -> Fast forward 1s -> Verify save **didn't** happen (debounce window)
    - [ ] Fast forward 2s more (total 3s) -> Verify save **did** happen (debounce triggered)
    - [ ] Test retry logic: Mock DB failure -> Verify exponential backoff (max 3x)
  - [ ] **Test:** `useLoadBeat` hook (data normalization)
    - [ ] Mock Supabase response with v1.0 beat (missing new fields)
    - [ ] Verify `normalizeBeatData()` injects defaults for missing fields
    - [ ] Verify React state is correctly hydrated from manifest
  - [ ] **Test:** Error handling in both hooks
    - [ ] Verify failed saves don't crash the app
    - [ ] Verify load errors show appropriate UI feedback
- **Why:** This validates critical features: debounce prevents data loss, normalization handles schema evolution, error handling is graceful.

---

### Part 3: E2E Tests (The "Run")

**Goal:** Simulate a real user clicking buttons in a real Chrome browser.

**Dependencies:** `@playwright/test`

#### PR #26: Playwright Setup & Smoke Test — 🚧 PLANNED

- **Focus:** Getting Playwright infrastructure running and verifying basic sanity.
- **Scope:** Install, configure, and validate Playwright can access the app.
- **Tasks:**
  - [ ] Run `bun init playwright` (installs Playwright and browser binaries)
  - [ ] Configure `playwright.config.ts`
    - [ ] Set `baseURL` to `http://localhost:5173` (Vite dev server)
    - [ ] Configure browsers: Chromium, Firefox, WebKit
    - [ ] Set `timeout: 30000` (30s per test)
  - [ ] **Test:** "The Smoke Test" (most basic sanity check)
    - [ ] Navigate to `/` (home page)
    - [ ] Verify page title is "TR-08"
    - [ ] Verify "Sign In" button is visible (guest mode)
    - [ ] Verify "Start" button is visible (playback control)
- **Why:** Playwright installation is tricky (browser binary downloads). This PR isolates the setup so you know the test runner itself works before writing complex tests.

#### PR #27: Critical User Flows (The Guest Experience) — 🚧 PLANNED

- **Focus:** Test the "Graffiti Wall" remix loop: load → modify → play.
- **Scope:** Verify the core user experience end-to-end.
- **Tasks:**
  - [ ] **Test:** "Guest Loads & Plays Latest Beat"
    - [ ] Navigate to `/`
    - [ ] Wait for Skeleton to disappear (data loads)
    - [ ] Verify grid is populated with pads (beat loaded)
    - [ ] Click "Start" button
    - [ ] Wait for button text to change to "Stop"
    - [ ] Verify playhead is advancing (check `currentStep` indicator)
    - [ ] Click "Stop" button
    - [ ] Verify playhead resets to 0
  - [ ] **Test:** "Guest Modifies & Saves"
    - [ ] Navigate to `/`
    - [ ] Wait for beat to load
    - [ ] Click 5 random pads to toggle them
    - [ ] Wait for "Save" button to be enabled
    - [ ] Click "Save" button
    - [ ] Verify save succeeds (toast/loading state)
  - [ ] **Challenge:** Testing audio playback itself is not practical in E2E
    - [ ] Instead: Verify visual side effects (playhead movement, button state changes)
    - [ ] Audio testing belongs in integration tests (mock Tone.js) or manual testing
- **Why:** This replaces the manual checklist: "Guest loads app → presses play → hears sound → saves beat → reloads → sees saved beat." Now automated and repeatable.

---

### Summary Checklist

1. **PR #22:** React Testing Library Setup + Static Components
2. **PR #23:** ErrorBoundary Tests
3. **PR #24:** Supabase Mocks + `useAuth` Integration
4. **PR #25:** `useSaveBeat` (Debounce) + `useLoadBeat` Integration
5. **PR #26:** Playwright Installation + Smoke Test
6. **PR #27:** Playwright Guest Flow Test

---

## Bug Fixes & Critical Patches

---

### Volume Persistence Fix (PR #12)

**Issue:** `toGridArray()` was calling `calculateEffectiveVolume()` to populate the `trackVolumes` return value. This caused muted tracks to be loaded with volume = -Infinity, corrupting the knob UI state and preventing users from un-muting their tracks after reload.

**Root Cause:** Confusion between "Raw Volume" (stored value) and "Effective Volume" (calculated at playback). The function was returning calculated playback volume instead of the stored knob position.

**Fix:** Changed `toGridArray()` to return raw `trackData.volumeDb` directly, without any mute/solo/master calculations. The effective volume is now calculated only during playback in the sequencer, not during load/save cycles.

**Prevention:** Added SPEC.md Section 4.2 documentation distinguishing raw vs effective volume to prevent future regressions.

**Files Modified:**

- `src/lib/beatUtils.ts`: Line ~761 in `toGridArray()` — changed to return `trackData.volumeDb` instead of `calculateEffectiveVolume()`

### Fix BPM Desync State (Unplanned PR)

**BPM Desync Bug Fixed.**

**Root Cause:**
Both `loadInitialData` (mount) and `handleLoadBeatById` (library load) were calling `setBpm()` for React state only. The Tone.js Transport was never updated, so the audio engine kept running at whatever BPM it had before.

**Fix Applied:**
Added explicit Tone.Transport sync after each beat load:

```typescript
Tone.Transport.bpm.value = loadedBeat.bpm;
if (createSequencerRef.current) {
  createSequencerRef.current.updateBpm(loadedBeat.bpm);
}
```

**What Now Happens:**

1. User loads beat with BPM 120 from library
2. `setBpm(120)` updates UI display
3. `Tone.Transport.bpm.value = 120` forces audio engine to match immediately
4. `updateBpm(120)` ensures sequencer callback sees the new tempo
5. No more desync between display and playback

---

## Cross-Cutting Concerns

### State Management

- [x] React state for UI (grid, bpm, currentStep, beatName, session)
- [x] useRef for audio objects (playersRef, sequencerRef, gridRef, isPageHiddenRef)
- [x] useEffect hooks for side effects (auth, auto-load, lifecycle)
- [x] useCallback for event handlers (memoization not needed for this scale)

### Error Handling

- [x] Zod safeParse for schema validation
- [x] Try/catch in hooks (useAuth, useSaveBeat, useLoadBeat)
- [x] Promise rejection handling in async functions
- [x] Error Boundary for React component errors
- [x] Timeout fallbacks (audio load, auth context)

### Mobile Optimization

- [x] Portrait blocker prevents landscape-only UI
- [x] Responsive grid (grid-cols-16 with gap-1)
- [x] Touch-friendly pad size (Tailwind padding)
- [x] Keyboard shortcuts (Enter to save name, Escape to cancel)

### Performance

- [x] Debounced save (3s delay before DB insert)
- [x] Audio engine doesn't block UI (uses Tone.js scheduling)
- [x] Sequencer reads gridRef.current (not state) on every step
- [x] useRef prevents unnecessary re-renders for audio objects
- [x] SkeletonGrid shown during initial data load

### Security

- [x] RLS policies on beats table (users see only their own)
- [x] Profanity filter on beat names
- [x] Zod schema validation before DB insert
- [x] OAuth flows handled by Supabase (no credentials stored locally)

---

## Testing Status

### Unit Tests

✅ **PR #8: beatUtils.test.ts (736 lines)** - Comprehensive audio physics testing

- [x] BeatManifest serialization (normalizeBeatData)
- [x] Audio signal hierarchy (calculateEffectiveVolume) - Mute/Solo/Volume precedence
- [x] Grid ↔ Manifest round-trip symmetry
- [x] Pitch calculation (2^(semitones/12) formula)
- [x] Accent volume reduction (-7 dB per accented step)
- [x] Backward compatibility - v1.0 beat auto-migration
- [x] Manual testing harness - `window.tr08` console API

### Integration Tests

❌ **Not Implemented** - No test infrastructure

- [ ] Auth hook state management
- [ ] Save beat with debounce
- [ ] Load beat with normalization

### Component Tests

❌ **Not Implemented** - No React Testing Library configured

- [ ] ErrorBoundary catches and displays errors
- [ ] SkeletonGrid renders 10 rows of skeleton pads
- [ ] PortraitBlocker shows overlay on portrait

### E2E Tests (Manual) — ✅ VERIFIED

- ✅ Guest load → Create beat → Play
- ✅ Authenticated flow → Save beat → Reload → Load beat
- ✅ Background tab → Audio continues → Tab returns → UI syncs
- ✅ Throw error in component → ErrorBoundary catches → Reload works
- ✅ Audio load timeout → Warning logged → App usable (silent)

### Testing Note

The project ships without automated tests. All requirements have been **manually verified** and the implementation has been validated through manual testing and code review. Automated testing (Jest/Vitest + React Testing Library) is recommended for future maintenance.

---

## Deployment Checklist

### Pre-Deployment

- [x] Code lint: `bun run lint` passes
- [x] Build: `bun run build` succeeds
- [x] Tests: All pass
- [x] Git: All PRs merged to main
- [x] Environment: .env.local with Supabase keys

### Deployment

- [x] Deploy to production environment
- [x] DNS points to production
- [x] Supabase project configured in production
- [x] RLS policies active
- [x] Backups configured

### Post-Deployment

- [x] Smoke test: Can load, play, save, load beats
- [x] Performance: TTI < 1.5s, Save < 30ms, Load < 100ms
- [x] Error tracking: Sentry/LogRocket configured (if using)
- [x] Monitor: Check logs for errors/warnings

---

## Known Limitations & Future Work

### Current Limitations

- **No collaborative editing:** Each user sees their own latest beat
- **No beat sharing:** Can't share specific beat by URL
- **No audio export:** No WAV/MP3 download
- **No undo/redo:** No action history
- **Single drum kit:** Only 10 tracks, no custom samples

### Future Features (Post-v1.2)

- [ ] Multi-user collaboration with WebSocket sync
- [ ] Shareable beat URLs with public/private visibility
- [ ] Audio export (WAV, MP3)
- [ ] Undo/redo history
- [ ] Custom sample upload
- [ ] Preset templates
- [ ] Social feed ("Graffiti Wall" view)
- [ ] Dark/Light mode theme
- [ ] MIDI controller support

---

## Monitoring & Observability

### Logging Strategy

All errors logged with structured format:

```text
[Module] Message
```

Examples:

- `[Auth] Google sign-in failed: popup blocked`
- `[AudioEngine] Sample load failed: network timeout`
- `[Sequencer] Grid is null`
- `[ErrorBoundary] Caught error: TypeError...`

### Performance Metrics (SLOs)

| Metric               | Target  | Status                                                   |
| -------------------- | ------- | -------------------------------------------------------- |
| TTI                  | < 1.5s  | ✅ Met                                                   |
| Save latency         | < 30ms  | ✅ Met                                                   |
| Load latency         | < 100ms | ✅ Met                                                   |
| Audio context resume | < 50ms  | ✅ Met                                                   |
| Audio load timeout   | 20s     | ✅ Implemented (PR #6: Individual 2s/track + 20s global) |

---

**Release Date:** December 1, 2025 (v1.2) | Updated: January 14, 2026 (PR #14)  
**Version:** 1.2
**Status:** Production Ready ✅
