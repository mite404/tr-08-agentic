# PR #32: SequencerChassis Component Extraction — Tutorial

> **Goal:** Extract the entire drum machine UI from App.tsx into a self-contained `SequencerChassis.tsx` component. App.tsx becomes the "director" (state + logic); SequencerChassis becomes the "stage" (pure layout + visuals).
>
> **Estimated Time:** ~2.5 hours
>
> **Learning Style:** Concept-first, guided surgical extraction. You'll learn how to execute a large refactor safely by moving code in small, verifiable steps.
>
> **Prerequisites:**
> - Completed PR #31 (NavBar extraction)
> - Understanding of React props and component composition
> - Familiarity with the current App.tsx layout structure

---

## Table of Contents

- [Background Concepts](#background-concepts)
  - [What Is a "Component Extraction" Refactor?](#what-is-a-component-extraction-refactor)
  - [The Container/Presenter Pattern](#the-containerpresenter-pattern)
  - [The Safety Net: Using Existing Tests](#the-safety-net-using-existing-tests)
  - [The manifestRef Problem](#the-manifestref-problem)
- [Phase 1: Define the Props Interface](#phase-1-define-the-props-interface-25-min)
- [Phase 2: Create the Skeleton Component](#phase-2-create-the-skeleton-component-20-min)
- [Phase 3: Move the Chassis JSX](#phase-3-move-the-chassis-jsx-30-min)
- [Phase 4: Wire Up Props in App.tsx](#phase-4-wire-up-props-in-apptsx-25-min)
- [Phase 5: Solve the manifestRef Problem](#phase-5-solve-the-manifestref-problem-15-min)
- [Phase 6: Clean Up App.tsx](#phase-6-clean-up-apptsx-15-min)
- [Phase 7: Verification & Cleanup](#phase-7-verification--cleanup-20-min)
- [Reference](#reference)

---

## Background Concepts

### What Is a "Component Extraction" Refactor?

A component extraction takes a section of JSX (and its supporting code) out of a large component and moves it into its own file. The critical rule:

> **Nothing should change for the user.** The app should look and behave identically before and after the refactor.

**Film analogy:** You're not rewriting the script — you're reorganizing the production. The scenes play in the same order, the actors say the same lines, but the shooting schedule is now organized by location instead of crammed onto one call sheet.

**Why do this at all?** App.tsx is currently ~1200 lines. It manages state, handles audio, orchestrates the UI, AND contains the entire chassis layout. That's too many jobs for one file. After this refactor:

- **App.tsx** (~800 lines): State management, audio engine, event handlers
- **SequencerChassis.tsx** (~350 lines): Pure visual layout of the drum machine

Each file has one clear responsibility.

### The Container/Presenter Pattern

This refactor introduces a classic pattern:

| Role | File | Analogy | Manages State? | Renders UI? |
|------|------|---------|---------------|-------------|
| **Container** | App.tsx | The Director | Yes — all state, refs, effects | Minimal — just the outer shell |
| **Presenter** | SequencerChassis.tsx | The Stage Set | No — receives everything via props | Yes — all the visual layout |

**The data flows one way:**

```
App.tsx (state changes)
    ↓ props
SequencerChassis (renders UI)
    ↓ callback props
App.tsx (handles events, updates state)
    ↓ new props
SequencerChassis (re-renders)
```

Think of it like a soundboard: the engineer (App.tsx) adjusts levels and routes, and the speakers (SequencerChassis) produce the output. The speakers don't make decisions — they just faithfully reproduce what the engineer sends.

### The Safety Net: Using Existing Tests

You already have integration tests for several components that live inside the chassis:

```
src/components/__tests__/
├── SkeletonGrid.test.tsx      # Tests the 10×16 loading grid
├── ErrorBoundary.test.tsx     # Tests crash protection around the grid
└── PortraitBlocker.test.tsx   # Tests portrait orientation blocking
```

**Strategy:** Run these tests at key checkpoints throughout the refactor. They test the child components in isolation, so they should continue to pass as long as you don't accidentally break the component interfaces.

```bash
# Your safety net — run this often
bun run test
```

**When to run tests:**
- After Phase 2 (skeleton compiles)
- After Phase 3 (JSX moved)
- After Phase 4 (props wired)
- After Phase 6 (cleanup done)

If tests fail at any point, you know you broke something in the most recent phase. Revert that phase and try again. This is why we work in small phases — small blast radius.

### The manifestRef Problem

There's one tricky spot in the current App.tsx. Inside the grid rendering loop, accents are read directly from a ref:

```tsx
// Line ~1197 in App.tsx
const isAccented =
  manifestRef.current.tracks[trackId]
    ?.accents?.[colIndex] ?? false;
```

**The problem:** `manifestRef` is a React ref (`useRef`). Refs are mutable objects that exist outside React's render cycle. If we pass this ref to SequencerChassis, we'd be leaking an implementation detail — the chassis would need to know about the manifest data structure.

**The solution:** Compute the accent data *before* passing it as a prop. In App.tsx, we'll derive a clean `boolean[][]` from the manifest and pass that instead.

**Film analogy:** Instead of giving the actors (SequencerChassis) access to the raw footage vault (manifestRef), we hand them the edited dailies (a simple boolean array). They get exactly what they need, nothing more.

---

## Phase 1: Define the Props Interface (25 min)

### Concept: Designing a Props Contract

Before writing any JSX, we need to design the **contract** between App.tsx and SequencerChassis. This is the props interface — it defines exactly what data flows in and what callbacks flow out.

**Why define this first?** Same reason architects draw blueprints before pouring concrete. If you start moving JSX without a clear interface, you'll discover missing props mid-refactor and have to backtrack. The interface is your map.

**How to find every prop you need:** Look at every variable, state value, and function referenced inside the chassis JSX. Each one either:
1. Becomes a prop (if it comes from App.tsx state/handlers)
2. Stays local (if it can be computed inside SequencerChassis)

### Step 1.1: Audit the Chassis JSX

Open `src/App.tsx` and find the "device container" div (starts around line 1036). Read through all the JSX inside it and list every variable that comes from App.tsx state or handlers.

Here's the audit — every external dependency the chassis JSX touches:

**State values used in the chassis:**
- `masterVolume`, `drive`, `swing` (global knob values)
- `grid` (10×16 boolean array)
- `currentStep` (playhead position 0-15)
- `trackMutes`, `trackSolos`, `trackVolumes`, `trackPitches` (per-track arrays)
- `bpm` (tempo)
- `isLoading`, `isSaving` (loading states)
- `isInitialDataLoaded` (initial load flag)
- `failedTrackIds` (tracks that couldn't load samples)
- `beats` (saved beat list for BeatLibrary)
- `manifestRef.current.tracks[trackId]?.accents` (accent data — the tricky one)

**Functions called from the chassis:**
- `getDisplayTitle()` (returns JSX — title editing UI)
- `handlePadClick(rowIndex, colIndex)`
- `handleMasterVolumeChange`, `handleDriveChange`, `handleSwingChange`
- `handleDbChange(trackIndex, value)`, `handlePitchChange(trackIndex, value)`
- `handleMuteToggle(trackId)`, `handleSoloToggle(trackId)`, `handleClearTrack(trackId)`
- `handleIncrementBpm()`, `handleDecrementBpm()`
- `handleStartStopClick()`
- `handleSaveBeat()`
- `handleLoadBeatById(beatId)`

**Things that can stay local to SequencerChassis:**
- `getChicletVariant(stepIndex)` — pure function, no dependencies on App state
- `TRACK_REGISTRY` — imported directly, no need to pass as prop
- `trackIdsByRow` — can be derived from TRACK_REGISTRY locally
- Image imports (chassisBackground, transportOutline, stepNoteCountStrip)

### Step 1.2: Create the File with the Props Interface

Create `src/components/SequencerChassis.tsx` and start with just the interface:

```tsx
// =============================================================================
// SequencerChassis.tsx — The drum machine hardware UI
// =============================================================================
//
// This is a "presenter" component — it owns no state. Everything flows in
// via props from App.tsx (the "container"). Think of it as the physical
// stage set: it displays what the director tells it to, and reports back
// when the audience (user) interacts with something.
//
// Props are grouped by function:
//   - Display:   What to show (grid, knob values, tempo, etc.)
//   - Callbacks: What to do when user interacts (pad clicks, knob turns, etc.)
// =============================================================================

import type { JSX } from "react";
import type { TrackID } from "../types/beat";
import type { BeatSummary } from "../hooks/useLoadBeat";

// =============================================================================
// TYPES
// =============================================================================

export interface SequencerChassisProps {
  // ── Display: Title ──────────────────────────────────────
  displayTitle: JSX.Element;

  // ── Display: Grid State ─────────────────────────────────
  grid: boolean[][];
  currentStep: number;
  accentsByRow: boolean[][];
  failedTrackIds: TrackID[];
  isInitialDataLoaded: boolean;

  // ── Display: Global Knobs ───────────────────────────────
  masterVolume: number;
  drive: number;
  swing: number;

  // ── Display: Per-Track State ────────────────────────────
  trackVolumes: number[];
  trackPitches: number[];
  trackMutes: boolean[];
  trackSolos: boolean[];

  // ── Display: Tempo & Transport ──────────────────────────
  bpm: number;
  isLoading: boolean;

  // ── Display: Save & Load ────────────────────────────────
  isSaving: boolean;
  beats: BeatSummary[];

  // ── Callbacks: Grid ─────────────────────────────────────
  onPadClick: (rowIndex: number, colIndex: number) => void;

  // ── Callbacks: Global Knobs ─────────────────────────────
  onMasterVolumeChange: (value: number) => void;
  onDriveChange: (value: number) => void;
  onSwingChange: (value: number) => void;

  // ── Callbacks: Per-Track Controls ───────────────────────
  onVolumeChange: (trackIndex: number, value: number) => void;
  onPitchChange: (trackIndex: number, value: number) => void;
  onMuteToggle: (trackId: TrackID) => void;
  onSoloToggle: (trackId: TrackID) => void;
  onClearTrack: (trackId: TrackID) => void;

  // ── Callbacks: Tempo & Transport ────────────────────────
  onIncrementBpm: () => void;
  onDecrementBpm: () => void;
  onStartStop: () => void;

  // ── Callbacks: Save & Load ──────────────────────────────
  onSave: () => void;
  onLoadBeat: (beatId: string) => Promise<void>;
}
```

**Why 28 props?** It looks like a lot, but each one is an explicit, named connection between the director and the stage. Compare this to the alternative — passing `manifestRef` or a giant `appState` object. With explicit props:
- TypeScript catches missing props at compile time
- You can see exactly what the chassis depends on
- You can test the chassis in isolation with mock props

**Pattern to remember:** Group props by *function* (display vs. callbacks), not by *type* (strings, numbers, functions). This makes the interface scannable.

### Step 1.3: Verify the Interface Compiles

Add a placeholder component below the interface so TypeScript doesn't complain about unused types:

```tsx
// =============================================================================
// COMPONENT (placeholder — we'll build this in Phase 2)
// =============================================================================

export function SequencerChassis(_props: SequencerChassisProps) {
  return <div>SequencerChassis placeholder</div>;
}
```

Run the build:

```bash
bun run build
```

**Expected:** Build succeeds. If TypeScript complains about the `TrackID` or `BeatSummary` imports, double-check the import paths.

**Run the tests:**

```bash
bun run test
```

**Expected:** All existing tests still pass. We haven't changed anything yet — just added a new file.

### ✅ Phase 1 Complete

You've learned:
- How to audit existing JSX for external dependencies
- How to categorize dependencies into "props" vs. "local" concerns
- How to design a props interface before writing any layout code
- The grouping pattern for large prop interfaces (display vs. callbacks)

**Next:** Phase 2 — We'll fill in the component skeleton with imports and helper functions.

---

## Phase 2: Create the Skeleton Component (20 min)

### Concept: Setting Up Before the Move

Before you move 200+ lines of JSX, prepare the receiving file. This means:
1. All imports that the JSX will need
2. Helper functions that can live locally
3. The component function with destructured props

This is like prepping a new set before moving a scene — lights, cameras, and marks all need to be in place before the actors walk on.

### Step 2.1: Add All Imports

At the top of `SequencerChassis.tsx`, add the imports the chassis JSX will need. These are the child components and image assets that currently live in App.tsx:

```tsx
import type { JSX } from "react";
import type { TrackID } from "../types/beat";
import type { BeatSummary } from "../hooks/useLoadBeat";

// ── Child components ──────────────────────────────────────
import { Analyzer } from "./Analyzer";
import { BeatLibrary } from "./BeatLibrary";
import { Chiclet } from "./Chiclet";
import { ErrorBoundary } from "./ErrorBoundary";
import { Knob } from "./Knob";
import { PlayStopBtn } from "./PlayStopBtn";
import { SaveButton } from "./SaveButton";
import { SkeletonGrid } from "./SkeletonGrid";
import { TempoDisplay } from "./TempoDisplay";
import { TrackControls } from "./TrackControls";

// ── Data ──────────────────────────────────────────────────
import { TRACK_REGISTRY } from "../config/trackConfig";

// ── Image assets ──────────────────────────────────────────
import chassisBackground from "../assets/images/CHASSIS 07_TEST_1.png";
import transportOutline from "../assets/images/TRANSPORT_OUTLINE.png";
import stepNoteCountStrip from "../assets/images/STEP_NOTE_COUNT_STRIP.png";
```

**Why move these imports?** They belong to the chassis, not to App.tsx. After the refactor, App.tsx won't render `<Chiclet>` or `<TrackControls>` directly — SequencerChassis will. The imports follow the JSX.

### Step 2.2: Add Local Helper Functions

Two functions currently live in App.tsx but have **zero dependency on App state**. They're pure functions — same input, same output, no side effects. These should move to SequencerChassis:

```tsx
// =============================================================================
// LOCAL HELPERS (pure functions — no App.tsx state dependency)
// =============================================================================

/**
 * Maps a step index (0-15) to a chiclet color variant.
 * Steps 0-3: red, 4-7: orange, 8-11: yellow, 12-15: cream
 */
function getChicletVariant(stepIndex: number) {
  if (stepIndex < 4) return "red";
  if (stepIndex < 8) return "orange";
  if (stepIndex < 12) return "yellow";
  return "cream";
}

/**
 * Sorted array of track IDs in row order (0-9).
 * Computed once from TRACK_REGISTRY — no need to receive as a prop.
 */
const trackIdsByRow: TrackID[] = [...TRACK_REGISTRY]
  .sort((a, b) => a.rowIndex - b.rowIndex)
  .map((c) => c.trackId);
```

**Think:** Why compute `trackIdsByRow` locally instead of receiving it as a prop?

Because it's **derived from static data** (`TRACK_REGISTRY` never changes at runtime). There's no reason for App.tsx to compute this and pass it down — SequencerChassis can compute it once, outside the component function, so it doesn't re-compute on every render.

### Step 2.3: Set Up the Component Function

Replace the placeholder component with the real function signature:

```tsx
// =============================================================================
// COMPONENT
// =============================================================================

export function SequencerChassis({
  displayTitle,
  grid,
  currentStep,
  accentsByRow,
  failedTrackIds,
  isInitialDataLoaded,
  masterVolume,
  drive,
  swing,
  trackVolumes,
  trackPitches,
  trackMutes,
  trackSolos,
  bpm,
  isLoading,
  isSaving,
  beats,
  onPadClick,
  onMasterVolumeChange,
  onDriveChange,
  onSwingChange,
  onVolumeChange,
  onPitchChange,
  onMuteToggle,
  onSoloToggle,
  onClearTrack,
  onIncrementBpm,
  onDecrementBpm,
  onStartStop,
  onSave,
  onLoadBeat,
}: SequencerChassisProps) {
  return (
    // TODO: Phase 3 — Move chassis JSX here
    <div>SequencerChassis skeleton ready</div>
  );
}
```

### Step 2.4: Verify

```bash
bun run build
bun run test
```

**Expected:** Both pass. The component compiles but isn't used anywhere yet. The destructured props might trigger an "unused variable" lint warning — that's fine for now, we'll use them all in Phase 3.

### ✅ Phase 2 Complete

You've learned:
- How to prepare a "receiving" file before moving code
- Why pure helper functions should live in the component that uses them
- The difference between static data (compute locally) and runtime state (receive as props)
- How module-level `const` values avoid re-computation on every render

**Next:** Phase 3 — The big move. We'll transplant the entire chassis JSX.

---

## Phase 3: Move the Chassis JSX (30 min)

### Concept: The Surgical Transplant

This is the most delicate phase. We're cutting ~200 lines of JSX from App.tsx and pasting them into SequencerChassis. The key rules:

1. **Copy first, don't cut.** Paste the JSX into SequencerChassis while leaving the original in App.tsx. This lets you compare side-by-side.
2. **Replace all direct state references with `props.`** or destructured prop names.
3. **Only cut from App.tsx after the new component compiles.**

**Film analogy:** You're transferring a scene from Film A to Film B. You duplicate the footage first, edit the copy to fit the new context, verify it plays correctly, *then* remove it from the original.

### Step 3.1: Identify the Exact Boundaries

In App.tsx, the chassis JSX starts and ends at these comments:

```tsx
{/* device container */}
{/* Background image is 3050x2550 (aspect ratio ~1.196:1) */}
<div
  className="flex flex-col rounded-xl"
  style={{
    backgroundImage: `url(${chassisBackground})`,
    ...
  }}
>
  ... everything inside ...
</div>
```

**Copy everything from that opening `<div>` through its closing `</div>`** — including the div itself. This is the entire chassis. Paste it into the `return (...)` of SequencerChassis, replacing the placeholder.

### Step 3.2: Replace State References with Props

Now go through the pasted JSX in SequencerChassis and replace every reference to App.tsx state/handlers. Here's the mapping:

**Direct replacements (variable names that match prop names):**

These already match because we named our props after the state variables:
- `masterVolume` → already matches prop name
- `drive` → already matches
- `swing` → already matches
- `grid` → already matches
- `currentStep` → already matches
- `bpm` → already matches
- `isLoading` → already matches
- `isSaving` → already matches
- `isInitialDataLoaded` → already matches
- `failedTrackIds` → already matches
- `trackMutes`, `trackSolos`, `trackVolumes`, `trackPitches` → already match
- `beats` → already matches

**Handler replacements (rename to match prop names):**

| In App.tsx (old) | In SequencerChassis (new prop) |
|---|---|
| `handlePadClick(row, col)` | `onPadClick(row, col)` |
| `handleMasterVolumeChange` | `onMasterVolumeChange` |
| `handleDriveChange` | `onDriveChange` |
| `handleSwingChange` | `onSwingChange` |
| `handleDbChange(idx, val)` | `onVolumeChange(idx, val)` |
| `handlePitchChange(idx, val)` | `onPitchChange(idx, val)` |
| `handleMuteToggle` | `onMuteToggle` |
| `handleSoloToggle` | `onSoloToggle` |
| `handleClearTrack` | `onClearTrack` |
| `handleIncrementBpm` | `onIncrementBpm` |
| `handleDecrementBpm` | `onDecrementBpm` |
| `() => void handleStartStopClick()` | `onStartStop` |
| `handleSaveBeat` | `onSave` |
| `handleLoadBeatById` | `onLoadBeat` |

**Special replacements:**

| In App.tsx (old) | In SequencerChassis (new) |
|---|---|
| `{getDisplayTitle()}` | `{displayTitle}` |
| `tracks.map((_track, rowIndex) => {` | `grid.map((_row, rowIndex) => {` |
| `trackIdsByRowRef.current[rowIndex]` | `trackIdsByRow[rowIndex]` |
| `manifestRef.current.tracks[trackId]?.accents?.[colIndex] ?? false` | `accentsByRow[rowIndex][colIndex]` |

**That last one is critical.** The accent data currently reads from a ref. We're replacing it with a simple array lookup. Phase 5 covers how App.tsx computes this array.

### Step 3.3: Handle the `tracks.map()` Loop

In App.tsx, the grid loop iterates over a `tracks` variable:

```tsx
{tracks.map((_track, rowIndex) => {
```

The `tracks` variable is derived from `TRACK_REGISTRY` and exists in App.tsx. But SequencerChassis doesn't need it — we only use `rowIndex` from the loop. Since `grid` is a `boolean[][]` with 10 rows, we can iterate over `grid` directly:

```tsx
{grid.map((_row, rowIndex) => {
```

This gives us the same `rowIndex` (0-9) without needing the `tracks` array.

### Step 3.4: Do a Find-and-Replace Pass

After pasting, use your editor's find-and-replace within `SequencerChassis.tsx` only:

1. `handlePadClick` → `onPadClick`
2. `handleMasterVolumeChange` → `onMasterVolumeChange`
3. `handleDriveChange` → `onDriveChange`
4. `handleSwingChange` → `onSwingChange`
5. `handleDbChange` → `onVolumeChange`
6. `handlePitchChange` → `onPitchChange`
7. `handleMuteToggle` → `onMuteToggle`
8. `handleSoloToggle` → `onSoloToggle`
9. `handleClearTrack` → `onClearTrack`
10. `handleIncrementBpm` → `onIncrementBpm`
11. `handleDecrementBpm` → `onDecrementBpm`
12. `handleSaveBeat` → `onSave`
13. `handleLoadBeatById` → `onLoadBeat`

Then manually fix:
- `{getDisplayTitle()}` → `{displayTitle}`
- The `tracks.map` line → `grid.map`
- `trackIdsByRowRef.current` → `trackIdsByRow`
- The accent line (detailed in Step 3.2)
- `() => void handleStartStopClick()` → `onStartStop`

### Step 3.5: Verify the Component Compiles

```bash
bun run build
```

**Expected errors at this point:** You'll likely see TypeScript errors in App.tsx because the chassis JSX is now duplicated — once in App.tsx (still there) and once in SequencerChassis. That's fine. We're about to replace the App.tsx version in Phase 4.

**If you see errors in SequencerChassis.tsx:** You probably missed a rename. Check the error messages — TypeScript will tell you exactly which variable doesn't exist. Match it against the replacement table in Step 3.2.

### Step 3.6: Run the Tests

```bash
bun run test
```

**Expected:** All tests pass. SkeletonGrid, ErrorBoundary, and PortraitBlocker tests don't depend on App.tsx structure — they test their components in isolation.

### ✅ Phase 3 Complete

You've learned:
- The "copy first, cut later" strategy for safe code moves
- How to systematically rename state references to prop names
- That you can iterate `grid.map()` instead of `tracks.map()` when you only need the index
- How TypeScript errors guide you to missed renames

**Next:** Phase 4 — Wire up SequencerChassis in App.tsx and remove the old chassis JSX.

---

## Phase 4: Wire Up Props in App.tsx (25 min)

### Concept: The Swap

Now comes the satisfying part. We'll:
1. Import SequencerChassis in App.tsx
2. Build the props object
3. Replace the entire chassis JSX with one line: `<SequencerChassis {...chassisProps} />`

**Why build a named `chassisProps` object?** You could spread 28 props inline, but that would make the JSX unreadable. A named object lets you:
- See all the prop mappings in one place
- Add comments explaining non-obvious mappings
- Change a mapping without hunting through JSX

### Step 4.1: Import SequencerChassis

At the top of `src/App.tsx`, add:

```tsx
import { SequencerChassis } from "./components/SequencerChassis";
```

Put it with the other component imports (near `NavBar`, `PortraitBlocker`, etc.).

### Step 4.2: Build the Props Object

Just before the `return` statement in App.tsx (after all the handler functions, around line ~1015), add the props object. This is where we map App.tsx's internal names to SequencerChassis's prop names:

```tsx
// =========================================================================
// PR #32: Build props for SequencerChassis
// =========================================================================
const chassisProps = {
  // Display: Title
  displayTitle: getDisplayTitle(),

  // Display: Grid State
  grid,
  currentStep,
  accentsByRow: [], // TODO: Phase 5 — compute from manifestRef
  failedTrackIds,
  isInitialDataLoaded,

  // Display: Global Knobs
  masterVolume,
  drive,
  swing,

  // Display: Per-Track State
  trackVolumes,
  trackPitches,
  trackMutes,
  trackSolos,

  // Display: Tempo & Transport
  bpm,
  isLoading,

  // Display: Save & Load
  isSaving,
  beats,

  // Callbacks: Grid
  onPadClick: handlePadClick,

  // Callbacks: Global Knobs
  onMasterVolumeChange: handleMasterVolumeChange,
  onDriveChange: handleDriveChange,
  onSwingChange: handleSwingChange,

  // Callbacks: Per-Track Controls
  onVolumeChange: handleDbChange,
  onPitchChange: handlePitchChange,
  onMuteToggle: handleMuteToggle,
  onSoloToggle: handleSoloToggle,
  onClearTrack: handleClearTrack,

  // Callbacks: Tempo & Transport
  onIncrementBpm: handleIncrementBpm,
  onDecrementBpm: handleDecrementBpm,
  onStartStop: () => void handleStartStopClick(),

  // Callbacks: Save & Load
  onSave: handleSaveBeat,
  onLoadBeat: handleLoadBeatById,
};
```

**Notice the naming translations:** `handleDbChange` becomes `onVolumeChange`, `handleSaveBeat` becomes `onSave`, etc. The `handle*` prefix is an App.tsx convention (it handles the event). The `on*` prefix is a React convention for callback props (what to do on this event). Same function, different name depending on which side you're on.

**Notice `accentsByRow: []`** — that's a temporary placeholder. We'll compute the real value in Phase 5.

### Step 4.3: Replace the Chassis JSX

Now the actual swap. In App.tsx, find the entire "device container" div and replace it with:

```tsx
<SequencerChassis {...chassisProps} />
```

**Before:**
```tsx
{/* whole page container */}
<div
  className="flex min-h-screen items-center justify-center pt-20"
  style={{ ... }}
>
  {/* device container */}
  <div
    className="flex flex-col rounded-xl"
    style={{ backgroundImage: `url(${chassisBackground})`, ... }}
  >
    ... 200+ lines of chassis JSX ...
  </div>
</div>
```

**After:**
```tsx
{/* whole page container */}
<div
  className="flex min-h-screen items-center justify-center pt-20"
  style={{ ... }}
>
  <SequencerChassis {...chassisProps} />
</div>
```

**Important:** The page container div (with the background image) stays in App.tsx. Only the device container div moves.

### Step 4.4: Build Check

```bash
bun run build
```

**Possible errors:**
- **Missing prop:** TypeScript will tell you if `chassisProps` is missing a required prop. Add it.
- **Type mismatch:** A prop might have the wrong type. Check the mapping in Step 4.2.
- **Unused imports in App.tsx:** Components like `Chiclet`, `TrackControls`, etc. are no longer used in App.tsx. We'll clean those up in Phase 6.

**Don't clean up imports yet.** Get the build passing first, then clean up. One thing at a time.

### Step 4.5: Run Tests

```bash
bun run test
```

**Expected:** All tests pass. The component tests are isolated — they don't care whether `SkeletonGrid` is rendered by App.tsx or SequencerChassis.

### Step 4.6: Visual Verification

```bash
bun run dev
```

Open the browser and verify:
- [ ] The chassis renders (you should see the drum machine)
- [ ] The background image appears correctly
- [ ] Pad clicks work (you should hear sounds)
- [ ] Knobs turn
- [ ] Play/Stop works
- [ ] Beat name is visible

**Note:** Accents won't display correctly yet — `accentsByRow` is still an empty array. That's Phase 5.

### ✅ Phase 4 Complete

You've learned:
- How to build a props object that maps internal names to prop names
- The `handle*` vs `on*` naming convention (handler vs callback)
- Why spreading `{...chassisProps}` keeps JSX clean
- The "swap and verify" approach — get it working first, clean up second

**Next:** Phase 5 — Solve the manifestRef problem by computing accentsByRow.

---

## Phase 5: Solve the manifestRef Problem (15 min)

### Concept: Derived State

The manifest ref contains accent data buried in a nested structure:

```
manifestRef.current.tracks["kick_01"].accents[0]  → true/false
manifestRef.current.tracks["kick_01"].accents[1]  → true/false
...
manifestRef.current.tracks["hh_02"].accents[15]   → true/false
```

SequencerChassis doesn't need to know about manifests, tracks, or any of that structure. It just needs: "Is step X of row Y accented? true or false."

**The pattern:** Compute a derived `boolean[][]` in App.tsx and pass it as a flat prop.

### Step 5.1: Compute accentsByRow

In App.tsx, find the `chassisProps` object you created in Phase 4. Replace the placeholder:

**Before:**
```tsx
accentsByRow: [], // TODO: Phase 5 — compute from manifestRef
```

**After:**
```tsx
accentsByRow: trackIdsByRowRef.current.map((trackId) =>
  Array.from({ length: 16 }, (_, colIndex) =>
    manifestRef.current.tracks[trackId]?.accents?.[colIndex] ?? false
  )
),
```

**How this works:**

1. `trackIdsByRowRef.current` is `["kick_01", "kick_02", ..., "hh_02"]` (10 track IDs in row order)
2. `.map((trackId) => ...)` iterates each track
3. `Array.from({ length: 16 }, ...)` creates a 16-element array for each track
4. For each step, it reads the accent from the manifest, defaulting to `false`

**Result:** A `boolean[10][16]` array — same shape as `grid`, where `accentsByRow[row][col]` tells you if that step is accented.

### Step 5.2: Verify Accents Work

```bash
bun run dev
```

Open the browser:
- [ ] If you have a beat loaded with accents, they should display correctly on the chiclets
- [ ] If you don't have accents set, this is invisible — but it shouldn't break anything

### Step 5.3: Build and Test

```bash
bun run build
bun run test
```

**Expected:** Both pass clean.

### ✅ Phase 5 Complete

You've learned:
- How to convert a ref-based data structure into a flat array prop
- The "derived state" pattern: compute it at the boundary, pass it simply
- Why components shouldn't need to know about parent implementation details

**Next:** Phase 6 — Clean up the orphaned imports in App.tsx.

---

## Phase 6: Clean Up App.tsx (15 min)

### Concept: Removing Orphaned Code

After extracting the chassis, App.tsx still has imports and possibly functions that are no longer used. TypeScript's `noUnusedLocals` rule will flag these as errors. Let's clean them up.

**Rule:** Only remove things that are truly unused. If in doubt, search for the variable name in the file before deleting.

### Step 6.1: Remove Orphaned Imports

These component imports are no longer used in App.tsx (they've moved to SequencerChassis):

```tsx
// REMOVE these — now imported by SequencerChassis.tsx
import { Analyzer } from "./components/Analyzer";
import { PlayStopBtn } from "./components/PlayStopBtn";
import { TempoDisplay } from "./components/TempoDisplay";
import { TrackControls } from "./components/TrackControls";
import { Knob } from "./components/Knob";
import { BeatLibrary } from "./components/BeatLibrary";
import { SaveButton } from "./components/SaveButton";
import { SkeletonGrid } from "./components/SkeletonGrid";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Chiclet } from "./components/Chiclet";
```

These image imports are also no longer used in App.tsx:

```tsx
// REMOVE these — now imported by SequencerChassis.tsx
import chassisBackground from "./assets/images/CHASSIS 07_TEST_1.png";
import transportOutline from "./assets/images/TRANSPORT_OUTLINE.png";
import stepNoteCountStrip from "./assets/images/STEP_NOTE_COUNT_STRIP.png";
```

**Keep these** — they're still used in App.tsx:

```tsx
// KEEP — still used in App.tsx
import pageBackground from "./assets/images/BACKGROUND_01.jpeg";
import { TRACK_REGISTRY } from "./config/trackConfig";
import { NavBar } from "./components/NavBar";
import { PortraitBlocker } from "./components/PortraitBlocker";
import { SequencerChassis } from "./components/SequencerChassis";
```

### Step 6.2: Remove the getChicletVariant Function

Find `getChicletVariant` in App.tsx and delete it — it now lives in SequencerChassis.tsx.

```tsx
// DELETE this from App.tsx — moved to SequencerChassis.tsx
function getChicletVariant(stepIndex: number) {
  if (stepIndex < 4) return "red";
  if (stepIndex < 8) return "orange";
  if (stepIndex < 12) return "yellow";
  return "cream";
}
```

### Step 6.3: Check for Other Orphans

Run the build — TypeScript will tell you if anything else is unused:

```bash
rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo
bun run build
```

**Why clear the build cache?** Remember the issue from earlier — stale `.tsbuildinfo` can hide unused-import errors locally. Clear it to get the same strict checking Vercel uses.

Fix any remaining `TS6133` (unused local) errors the build reports.

### Step 6.4: Run the Full Test Suite

```bash
bun run test
```

**Expected:** All tests pass. This is the definitive check — if tests pass and the build succeeds, the refactor is structurally sound.

### Step 6.5: Lint Check

```bash
bun run lint
```

**Expected:** Clean. No unused imports, no type errors.

### ✅ Phase 6 Complete

You've learned:
- How to identify orphaned imports after a component extraction
- Why clearing the TypeScript build cache matters for catching real errors
- The principle: "TypeScript tells you what's orphaned — trust the compiler"

**Next:** Phase 7 — Final visual verification and documentation.

---

## Phase 7: Verification & Cleanup (20 min)

### Step 7.1: Full Visual Walkthrough

```bash
bun run dev
```

Walk through every feature to verify nothing broke:

**Grid:**
- [ ] All 10 rows × 16 columns render
- [ ] Clicking a pad toggles it on/off
- [ ] Active pads have full opacity, inactive pads are dimmed
- [ ] 16th note steps (not divisible by 4) have slightly different brightness

**Playback:**
- [ ] Press Play — playhead moves across the grid
- [ ] Active pads trigger their sounds at the correct steps
- [ ] Press Stop — playback stops, playhead resets

**Knobs:**
- [ ] Global knobs (Output, Drive, Swing) turn and affect audio
- [ ] Per-track TONE and LEVEL knobs turn

**Track Controls:**
- [ ] Mute button silences a track
- [ ] Solo button isolates a track
- [ ] Clear button removes all steps from a track

**Tempo:**
- [ ] BPM display shows current tempo
- [ ] Increment/decrement arrows change BPM

**Save/Load:**
- [ ] Save button saves the current beat (when signed in)
- [ ] Beat Library opens and lists saved beats
- [ ] Loading a beat populates the grid

**Other:**
- [ ] Beat name is editable (click to edit, Enter to save, Escape to cancel)
- [ ] SkeletonGrid shows during initial data load
- [ ] Failed tracks appear disabled/grayed out (if any)
- [ ] Accent highlights appear on chiclets (if any accents are set)
- [ ] Responsive scaling — chassis fits the viewport correctly
- [ ] NavBar still works (auth, links)
- [ ] PortraitBlocker still works (rotate to portrait on mobile/devtools)

### Step 7.2: Review the Final Architecture

Take a moment to appreciate the new structure:

**Before (1 file does everything):**
```
App.tsx (1200+ lines)
├── State management (hooks, refs)
├── Audio engine (init, play, stop)
├── Event handlers (30+ functions)
├── ALL chassis JSX (200+ lines)
├── ALL child component imports
└── Navigation + page layout
```

**After (clear separation of concerns):**
```
App.tsx (~800 lines)
├── State management (hooks, refs)
├── Audio engine (init, play, stop)
├── Event handlers (30+ functions)
├── Props computation (chassisProps)
└── Page shell: NavBar + PortraitBlocker + SequencerChassis

SequencerChassis.tsx (~350 lines)
├── Props interface (typed contract)
├── Local helpers (getChicletVariant, trackIdsByRow)
├── Image assets
└── ALL chassis layout JSX
```

### Step 7.3: Final Build Pipeline

```bash
rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo
bun run lint
bun run build
bun run test
```

All three should pass clean.

### Step 7.4: Count the Damage

Check how many lines App.tsx shrank by:

```bash
wc -l src/App.tsx src/components/SequencerChassis.tsx
```

You should see App.tsx drop by roughly 200-300 lines, with SequencerChassis picking up ~350 lines.

### ✅ Phase 7 Complete — PR #32 Finished!

You've completed the SequencerChassis extraction. Here's what you accomplished:

1. **Designed a 28-prop interface** that explicitly defines the container/presenter boundary
2. **Moved ~200 lines of JSX** without breaking any existing functionality
3. **Solved the manifestRef problem** by computing derived state at the boundary
4. **Cleaned up orphaned imports** and let TypeScript guide you
5. **Verified with existing tests** at every checkpoint

The drum machine now has a clean architecture: App.tsx directs, SequencerChassis performs.

---

## Reference

### SequencerChassis Props Interface

```typescript
export interface SequencerChassisProps {
  displayTitle: JSX.Element;
  grid: boolean[][];
  currentStep: number;
  accentsByRow: boolean[][];
  failedTrackIds: TrackID[];
  isInitialDataLoaded: boolean;
  masterVolume: number;
  drive: number;
  swing: number;
  trackVolumes: number[];
  trackPitches: number[];
  trackMutes: boolean[];
  trackSolos: boolean[];
  bpm: number;
  isLoading: boolean;
  isSaving: boolean;
  beats: BeatSummary[];
  onPadClick: (rowIndex: number, colIndex: number) => void;
  onMasterVolumeChange: (value: number) => void;
  onDriveChange: (value: number) => void;
  onSwingChange: (value: number) => void;
  onVolumeChange: (trackIndex: number, value: number) => void;
  onPitchChange: (trackIndex: number, value: number) => void;
  onMuteToggle: (trackId: TrackID) => void;
  onSoloToggle: (trackId: TrackID) => void;
  onClearTrack: (trackId: TrackID) => void;
  onIncrementBpm: () => void;
  onDecrementBpm: () => void;
  onStartStop: () => void;
  onSave: () => void;
  onLoadBeat: (beatId: string) => Promise<void>;
}
```

### Handler Name Mapping (App.tsx → SequencerChassis)

| App.tsx Handler | SequencerChassis Prop |
|---|---|
| `handlePadClick` | `onPadClick` |
| `handleMasterVolumeChange` | `onMasterVolumeChange` |
| `handleDriveChange` | `onDriveChange` |
| `handleSwingChange` | `onSwingChange` |
| `handleDbChange` | `onVolumeChange` |
| `handlePitchChange` | `onPitchChange` |
| `handleMuteToggle` | `onMuteToggle` |
| `handleSoloToggle` | `onSoloToggle` |
| `handleClearTrack` | `onClearTrack` |
| `handleIncrementBpm` | `onIncrementBpm` |
| `handleDecrementBpm` | `onDecrementBpm` |
| `handleStartStopClick` | `onStartStop` |
| `handleSaveBeat` | `onSave` |
| `handleLoadBeatById` | `onLoadBeat` |

### Files Changed in PR #32

| File | Action | Lines |
|------|--------|-------|
| `src/components/SequencerChassis.tsx` | Created | ~350-400 |
| `src/App.tsx` | Modified | ~-200 (net reduction) |

### Imports That Move to SequencerChassis

```typescript
// These leave App.tsx and go to SequencerChassis.tsx
import { Analyzer } from "./components/Analyzer";
import { BeatLibrary } from "./components/BeatLibrary";
import { Chiclet } from "./components/Chiclet";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Knob } from "./components/Knob";
import { PlayStopBtn } from "./components/PlayStopBtn";
import { SaveButton } from "./components/SaveButton";
import { SkeletonGrid } from "./components/SkeletonGrid";
import { TempoDisplay } from "./components/TempoDisplay";
import { TrackControls } from "./components/TrackControls";

import chassisBackground from "../assets/images/CHASSIS 07_TEST_1.png";
import transportOutline from "../assets/images/TRANSPORT_OUTLINE.png";
import stepNoteCountStrip from "../assets/images/STEP_NOTE_COUNT_STRIP.png";
```

### Test Checkpoint Schedule

| After Phase | Command | What You're Checking |
|---|---|---|
| Phase 1 | `bun run build && bun run test` | Interface compiles, no regressions |
| Phase 2 | `bun run build && bun run test` | Skeleton compiles, no regressions |
| Phase 3 | `bun run build` | JSX compiles in new location |
| Phase 4 | `bun run build && bun run test && bun run dev` | Props wired, visual check |
| Phase 5 | `bun run dev` | Accents render correctly |
| Phase 6 | `bun run lint && bun run build && bun run test` | Clean build, no orphans |
| Phase 7 | All three + visual walkthrough | Everything works end-to-end |

### Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `TS6133: declared but never read` | Orphaned import in App.tsx | Remove the unused import |
| `TS2339: Property does not exist` | Missed a rename in SequencerChassis | Check the handler mapping table above |
| Chassis doesn't render | Props not passed or component not imported | Check `<SequencerChassis {...chassisProps} />` in App.tsx |
| Pads don't click | `onPadClick` not mapped to `handlePadClick` | Check `chassisProps` object |
| Accents missing | `accentsByRow` still `[]` | Complete Phase 5 |
| Build passes locally but fails on Vercel | Stale TypeScript cache | Run `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo` then rebuild |
| Knobs don't turn | Handler props not mapped | Check `onVolumeChange: handleDbChange` etc. in chassisProps |
| Grid shows skeleton forever | `isInitialDataLoaded` not passed | Verify it's in chassisProps |

### Key Takeaways

1. **Design the interface before moving code.** The props interface is your blueprint.
2. **Copy first, cut later.** Don't delete from the source until the destination compiles.
3. **Let TypeScript guide cleanup.** Unused imports and missing props are caught automatically.
4. **Run tests at every checkpoint.** Small phases = small blast radius when something breaks.
5. **Pure functions move with the JSX.** If a function only serves the chassis, it belongs in SequencerChassis.
6. **Compute derived state at the boundary.** Don't pass refs — pass simple data.
7. **Name props by convention.** `handle*` in the container, `on*` in the presenter.
