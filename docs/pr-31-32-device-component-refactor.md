# Plan: SequencerChassis Extraction + NavBar

## Context

App.tsx (~1277 lines) currently owns **everything** — state management, audio engine logic, AND the entire device UI layout. The chassis background image contains all the sequencer controls, and keeping UI elements aligned within it requires them to live inside a single coordinated container. Currently, the Sign In button also lives inside the chassis, which doesn't make sense architecturally — auth is a page-level concern, not a drum machine concern.

This refactor splits the work into **2 PRs** to reduce risk and make review easier.

---

## PR 1: NavBar Component (move auth out of chassis)

### What Changes

1. **Create `src/components/NavBar.tsx`** — new top-level nav bar
2. **Modify `src/App.tsx`** — remove LoginModalButton from chassis, add NavBar above it
3. **Copy logo asset** — `Roland_Logo_White.png` into `src/assets/images/`

### NavBar Design (from reference image)

```
┌──────────────────────────────────────────────────────────────┐
│  [Roland Logo]          LOG IN [toggle]  ABOUT  BEATS  COMMUNITY │
└──────────────────────────────────────────────────────────────┘
```

- **Position**: `fixed` top, full width, `z-40` (below PortraitBlocker's z-50)
- **Background**: dark (`bg-neutral-900` or `#1a1a1a`), subtle bottom border
- **Left**: Roland logo image (~40px height)
- **Right**: Nav links (ABOUT, BEATS, COMMUNITY) + LOG IN with toggle — all uppercase, gold/beige text (`text-amber-200`), `tracking-widest`
- **Height**: ~64px (`h-16`)

### NavBar Props Interface

```typescript
// Reuses the existing LoginModalButtonProps shape
interface NavBarProps {
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  authLoading: boolean;
}
```

### App.tsx Changes (PR 1)

- Import `NavBar`
- Remove lines 1058-1075 (the auth controls `<div>` inside the chassis header)
- Add `<NavBar>` as first child in the return, before `<PortraitBlocker>`
- Add `pt-16` to the page container div to offset for fixed nav

### PortraitBlocker — stays at App.tsx level (no change)

It's a full-screen overlay that should block the entire app including the NavBar when portrait. It already sits outside the chassis at the `<>` fragment level. No move needed for either PR.

### Nav Links (ABOUT, BEATS, COMMUNITY)

For now these will be placeholder `<a href="#">` links — they're part of the visual design but the pages don't exist yet. This keeps the NavBar visually complete without creating dead-end routes.

---

## PR 2: SequencerChassis Component (extract chassis UI)

### What Changes

1. **Create `src/components/SequencerChassis.tsx`** — ~350-400 lines
2. **Modify `src/App.tsx`** — replace chassis JSX with `<SequencerChassis {...props} />`

### What Moves Into SequencerChassis

Everything inside the current "device container" div (lines 1036-1277):

- Chassis background image styling
- Beat name display / title editing UI
- Analyzer
- Global knobs column (Output, Drive, Swing)
- TONE/LEVEL headers
- 10 track rows (TrackControls + Chiclet grid)
- ErrorBoundary wrapping the grid
- SkeletonGrid (loading state)
- TempoDisplay + SaveButton row
- Transport outline with PlayStopBtn + BeatLibrary
- Step number count strip

### What Stays in App.tsx

- All `useState` / `useRef` / `useEffect` hooks (state management)
- Audio engine logic (`initPlayers`, sequencer setup, manifest mutations)
- Event handlers (`handlePadClick`, `handleDbChange`, `handleMuteToggle`, etc.)
- `getDisplayTitle()` helper (accesses `setBeatName` and `setIsEditTitleActive`) — **stays in App.tsx, passed as a render prop or its output passed as JSX**
- NavBar
- PortraitBlocker
- Page background container

### The `manifestRef` Problem

**Issue**: The grid render loop (line 1198) reads `manifestRef.current.tracks[trackId]?.accents?.[colIndex]` directly. This is a ref, not state — SequencerChassis can't access it without receiving the ref.

**Solution**: Compute a derived `accentsByRow: boolean[][]` in App.tsx before passing to SequencerChassis. This is cleaner than passing the entire manifest ref:

```typescript
// In App.tsx, compute before passing to chassis
const accentsByRow: boolean[][] = trackIdsByRowRef.current.map((trackId) =>
  Array.from({ length: 16 }, (_, col) =>
    manifestRef.current.tracks[trackId]?.accents?.[col] ?? false
  )
);
```

Then SequencerChassis receives `accentsByRow` as a simple `boolean[][]` prop.

### SequencerChassis Props Interface

```typescript
interface SequencerChassisProps {
  // Title / display
  displayTitle: JSX.Element;          // Pre-rendered by App.tsx's getDisplayTitle()

  // Grid state
  grid: boolean[][];
  currentStep: number;
  accentsByRow: boolean[][];          // Derived from manifestRef in App.tsx
  failedTrackIds: TrackID[];
  isInitialDataLoaded: boolean;
  onPadClick: (rowIndex: number, colIndex: number) => void;

  // Global knobs
  masterVolume: number;
  drive: number;
  swing: number;
  onMasterVolumeChange: (value: number) => void;
  onDriveChange: (value: number) => void;
  onSwingChange: (value: number) => void;

  // Per-track controls
  trackVolumes: number[];
  trackPitches: number[];
  trackMutes: boolean[];
  trackSolos: boolean[];
  onVolumeChange: (trackIndex: number, value: number) => void;
  onPitchChange: (trackIndex: number, value: number) => void;
  onMuteToggle: (trackId: TrackID) => void;
  onSoloToggle: (trackId: TrackID) => void;
  onClearTrack: (trackId: TrackID) => void;

  // Tempo / transport
  bpm: number;
  onIncrementBpm: () => void;
  onDecrementBpm: () => void;
  onStartStop: () => void;
  isLoading: boolean;

  // Save / Load
  onSave: () => void;
  isSaving: boolean;
  beats: BeatSummary[];
  onLoadBeat: (beatId: string) => Promise<void>;
}
```

~28 props. This is expected for a Container/Presenter split — App.tsx is the "director" (state + logic), SequencerChassis is the "stage" (pure layout + visuals).

### Helper Functions That Move to SequencerChassis

- `getChicletVariant(colIndex)` — pure function, no state dependency
- Track ID ordering from `TRACK_REGISTRY` — can be computed locally

### Image Imports That Move to SequencerChassis

```typescript
import chassisBackground from "../assets/images/CHASSIS 07_TEST_1.png";
import transportOutline from "../assets/images/TRANSPORT_OUTLINE.png";
import stepNoteCountStrip from "../assets/images/STEP_NOTE_COUNT_STRIP.png";
```

---

## Files Summary

### PR 1

| File | Action |
|------|--------|
| `src/components/NavBar.tsx` | **Create** (~80-100 lines) |
| `src/App.tsx` | **Modify** — add NavBar, remove LoginModalButton from chassis header, add `pt-16` |
| `src/assets/images/Roland_Logo_White.png` | **Copy** from Downloads |

### PR 2

| File | Action |
|------|--------|
| `src/components/SequencerChassis.tsx` | **Create** (~350-400 lines) |
| `src/App.tsx` | **Modify** — extract chassis JSX, replace with `<SequencerChassis {...props} />`, add `accentsByRow` computation |

---

## Verification

### PR 1

- [ ] NavBar renders at top with Roland logo, nav links, and login button
- [ ] Auth flow (sign in/out) works through NavBar
- [ ] Chassis no longer shows login button in its header
- [ ] PortraitBlocker still covers entire screen including NavBar
- [ ] Chassis has proper spacing below NavBar (no overlap)
- [ ] `bun run build` succeeds
- [ ] `bun run lint` passes

### PR 2

- [ ] Chassis looks visually identical to before extraction
- [ ] All pad clicks register and trigger audio
- [ ] All knobs (global + per-track) work
- [ ] Mute/Solo/Clear buttons work
- [ ] Beat name editing works (click to edit, Enter to save, Escape to cancel)
- [ ] Save beat works
- [ ] Load beat works (BeatLibrary)
- [ ] SkeletonGrid shows during initial load
- [ ] Failed tracks show as disabled/grayed
- [ ] Accent highlights display correctly on chiclets
- [ ] Responsive scaling maintained
- [ ] `bun run build` succeeds
- [ ] `bun run lint` passes
