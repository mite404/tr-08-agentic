# PR #30: Layout Finesse (Figma → React)

## Goal

Rearrange existing components in `App.tsx` to match the Figma layout reference, and replace CSS-styled transport controls with image-based assets. **No functionality changes** — purely visual/layout.

## Figma Reference Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Beat Name]                              ┌─────────────────┐        │
│                                          │  ANALYZER LCD    │        │
│  OUTPUT                                  └─────────────────┘        │
│  ┌──────┐   ○  ●  [RED ×4][ORG ×4][YEL ×4][CRM ×4]                │
│  │KNOB 1│   ○  ●  [RED ×4][ORG ×4][YEL ×4][CRM ×4]                │
│  └──────┘   ○  ●  [RED ×4][ORG ×4][YEL ×4][CRM ×4]                │
│  DRIVE      ○  ●  [chiclet rows continue...]                        │
│  ┌──────┐   ○  ●  ...                                               │
│  │KNOB 2│   ○  ●  ...                                               │
│  └──────┘   ○  ●  ...                                               │
│  SWING      ○  ●  ...                                               │
│  ┌──────┐   ○  ●  ...                                               │
│  │KNOB 3│   ○  ●  ...                                               │
│  └──────┘   ○  ●  ...                                               │
│                                                                       │
│  TEMPO                                                                │
│  ┌─────────┐┌──┐ ┌──┐                                               │
│  │ LED BPM ││↑↓│ │SV│ SAVE                                          │
│  └─────────┘└──┘ └──┘                                                │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ TRANSPORT_OUTLINE.png                                           │ │
│  │ ┌──────────────┐ ┌──┐                                          │ │
│  │ │  START/STOP  │ │LD│ LOAD          1  2  3  4 ·  5 ... 15 16 │ │
│  │ └──────────────┘ └──┘                                          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                 ↑ STEP_NOTE_COUNT_STRIP.png extends across here ↑    │
└──────────────────────────────────────────────────────────────────────┘
  ○ = cream TONE knob (small, ~86px)
  ● = orange LEVEL knob (~98px)
```

### Bottom Strip Detail

The bottom of the chassis features a **continuous visual strip** that spans the full width:

- **Left portion** (`TRANSPORT_OUTLINE.png`): Gray rounded container wrapping START/STOP button + LOAD button, with text labels "START / STOP" and "LOAD" baked into the image
- **Right portion** (`STEP_NOTE_COUNT_STRIP.png`): Gray background strip with step numbers 1–16, grouped in sets of 4 (1-4, 5-8, 9-12) with a visual gap before the final group (13-16)
- These two images sit **side-by-side** on the same horizontal row, forming one continuous bottom bar

---

## Image Assets Inventory

| Asset                 | File                                                   | Used By                         | Status                        |
| --------------------- | ------------------------------------------------------ | ------------------------------- | ----------------------------- |
| Chassis background    | `CHASSIS 07_TEST_1.png`                                | App.tsx                         | ✅ Already in use             |
| Page background       | `BACKGROUND_01.jpeg`                                   | App.tsx                         | ✅ Already in use             |
| Chiclets (×8)         | `{COLOR}_{ON/OFF}_180x250.png`                         | Chiclet.tsx                     | ✅ Already in use             |
| Knobs (×3)            | `TONE_KNOB.png`, `VOLUME_KNOB.png`, `GLOBAL_SWING.png` | Knob.tsx                        | ✅ Already in use             |
| Tempo LED screen      | `TEMPO_LED_SCREEN.png`                                 | TempoDisplay.tsx                | ❌ Not yet imported           |
| Tempo buttons         | `TEMPO_BTNS.png`                                       | TempoDisplay.tsx                | ❌ Not yet imported           |
| Metal square button   | `METAL_SQUARE_BTN.png`                                 | SaveButton.tsx, BeatLibrary.tsx | ❌ Not yet imported           |
| Start/Stop button     | `START_STOP_BTN.png`                                   | PlayStopBtn.tsx                 | ❌ Not yet imported           |
| **Transport outline** | **`TRANSPORT_OUTLINE.png`**                            | **App.tsx**                     | **❌ NEW — Not yet imported** |
| **Step number strip** | **`STEP_NOTE_COUNT_STRIP.png`**                        | **App.tsx**                     | **❌ NEW — Not yet imported** |

---

## Changes Summary

| File                               | Change                                                      | Complexity |
| ---------------------------------- | ----------------------------------------------------------- | ---------- |
| `src/App.tsx`                      | Restructure JSX layout (lines 1015–1277) + bottom strip     | **High**   |
| `src/components/TrackControls.tsx` | Add `showLabel`/`showButtons` props to hide label + M/S/CLR | Low        |
| `src/components/TempoDisplay.tsx`  | Replace CSS with `TEMPO_LED_SCREEN.png` + `TEMPO_BTNS.png`  | Medium     |
| `src/components/PlayStopBtn.tsx`   | Replace CSS with `START_STOP_BTN.png`                       | Low        |
| `src/components/SaveButton.tsx`    | Replace CSS with `METAL_SQUARE_BTN.png`                     | Low        |
| `src/components/BeatLibrary.tsx`   | Replace trigger button with `METAL_SQUARE_BTN.png`          | Low        |

---

## Step-by-Step Implementation

### Step 1: TrackControls — Add visibility props

**File:** `src/components/TrackControls.tsx`

Add two optional props to the existing component:

- `showLabel?: boolean` (default `true` for backwards compatibility)
- `showButtons?: boolean` (default `true`)

When `showLabel={false}`, hide the track label `<div>`.
When `showButtons={false}`, hide the M/S/CLR buttons.

This lets App.tsx control visibility without removing functionality. The M/S/CLR buttons still exist in code and can be re-enabled later (e.g. via a context menu or settings panel).

**Keep:** All existing props, event handlers, and knob rendering unchanged.

### Step 2: TempoDisplay — Image-based replacement

**File:** `src/components/TempoDisplay.tsx`

**Current:** CSS-styled `bg-red-950` div + gray arrow buttons.

**New approach:**

- Import `TEMPO_LED_SCREEN.png` and `TEMPO_BTNS.png` as ES modules
- Use `TEMPO_LED_SCREEN.png` as the background image for the BPM display area
- Use `TEMPO_BTNS.png` as the background for the up/down button container
- Overlay the BPM text value on top of the LED screen image
- Keep click handlers on the arrow buttons (invisible hit areas over the image)
- Maintain the `bpmValue` overlay text (positioned absolutely over the LED image)

**Pattern to follow:** Same as `Chiclet.tsx` — `backgroundImage` inline style with `backgroundSize: cover`.

### Step 3: PlayStopBtn — Image-based replacement

**File:** `src/components/PlayStopBtn.tsx`

**Current:** Yellow-200 wrapper with orange-500 CSS button showing "START/STOP" text.

**New approach:**

- Import `START_STOP_BTN.png` as ES module
- Render as `<button>` with the PNG as `backgroundImage`
- Remove the text labels (the image already has the visual design)
- Keep `onClick` and `disabled` props working
- Maintain hover state: `opacity` or `brightness` filter on hover
- Disabled state: reduced opacity

### Step 4: SaveButton — Image-based replacement

**File:** `src/components/SaveButton.tsx`

**Current:** Green CSS button with spinner.

**New approach:**

- Import `METAL_SQUARE_BTN.png` as ES module
- Use as `backgroundImage` on the button
- Keep the saving spinner overlay (absolutely positioned over the image)
- Keep `onClick`, `isSaving`, `disabled` props

### Step 5: BeatLibrary — Trigger button image replacement

**File:** `src/components/BeatLibrary.tsx`

**Current:** Shadcn `Button` with Library icon + "Load" text.

**New approach:**

- Import `METAL_SQUARE_BTN.png` as ES module
- Replace `<Button>` trigger with a styled `<button>` using the PNG as background
- Keep `SheetTrigger asChild` wrapping
- Keep all Sheet/modal functionality unchanged

### Step 6: App.tsx — Layout Restructure (THE BIG ONE)

**File:** `src/App.tsx` (lines 1015–1277)

#### Current structure

```
HEADER: [BeatName] .................. [LoginBtn]
TOP:    ............................. [Analyzer]
MIDDLE: [3 GlobalKnobs] | [TrackControls ×10] | [ChicletGrid 10×16]
BOTTOM: [Tempo][Play][Save][Load] (vertical stack, width:200px)
```

#### New structure

```
HEADER:  [BeatName] .......................... [LoginBtn]
         ...................................... [Analyzer LCD]  (top-right, keep as-is)

MAIN AREA (flex-row):
  LEFT COLUMN:
    [OUTPUT knob]
    [DRIVE knob]
    [SWING knob]

  RIGHT AREA (flex-col):
    GRID ROWS (×10):
      [TONE_i] [LEVEL_i] [Chiclet×16 row i]

BOTTOM BAR (full width, flex-row):
  LEFT SIDE: TRANSPORT
    Row 1: [TempoLED+Btns] [SaveBtn]
    Row 2: [TRANSPORT_OUTLINE.png as background] → [StartStopBtn] [LoadBtn] overlaid
  RIGHT SIDE: [STEP_NOTE_COUNT_STRIP.png]
```

#### Detailed layout changes

**A. Keep HEADER as-is** (lines 1049–1074) — beat name left, login right.

**B. Keep Analyzer position** (lines 1076–1078) — `flex justify-end`, top-right.

**C. Restructure MAIN CONTENT** (lines 1082–1233):

Replace the current 3-column flex with:

```jsx
<div className="flex flex-row gap-4">
  {/* LEFT: Global Knobs Column */}
  <div className="flex flex-none flex-col items-center gap-4">
    <Knob variant="swing" ... /> {/* OUTPUT */}
    <Knob variant="swing" ... /> {/* DRIVE */}
    <Knob variant="swing" ... /> {/* SWING */}
  </div>

  {/* RIGHT: Grid Area with per-row knobs */}
  <div className="flex flex-1 flex-col">
    {/* TONE / LEVEL column headers */}
    <div className="flex items-center">
      <div style={{width: KNOB_COL_WIDTH}}>TONE</div>
      <div style={{width: KNOB_COL_WIDTH}}>LEVEL</div>
      <div className="flex-1" />
    </div>

    {/* 10 rows: each row = [TONE knob] [LEVEL knob] [16 chiclets] */}
    {tracks.map((_, rowIndex) => (
      <div key={rowIndex} className="flex items-center gap-1">
        <TrackControls
          showLabel={false}
          showButtons={false}
          ... {/* existing props */}
        />
        <div className="grid flex-1 grid-cols-16 gap-1">
          {grid[rowIndex].map((_, colIndex) => (
            <Chiclet key={...} ... />
          ))}
        </div>
      </div>
    ))}
  </div>
</div>
```

**D. Restructure BOTTOM BAR** (replaces old transport section):

The bottom bar is a **full-width row** combining transport controls and the step number strip.

```jsx
{/* BOTTOM BAR: Transport + Step Number Strip */}
<div className="flex w-full items-end gap-0">

  {/* LEFT: Transport section */}
  <div className="flex flex-none flex-col gap-2">
    {/* Row 1: Tempo + Save */}
    <div className="flex items-center gap-2">
      <TempoDisplay bpmValue={bpm} ... />
      <SaveButton onClick={handleSaveBeat} isSaving={isSaving} />
    </div>

    {/* Row 2: Start/Stop + Load — wrapped in TRANSPORT_OUTLINE image */}
    <div
      className="relative flex items-center"
      style={{
        backgroundImage: `url(${transportOutline})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      <PlayStopBtn onClick={...} disabled={isLoading} />
      <BeatLibrary beats={beats} onLoadBeat={handleLoadBeatById} />
    </div>
  </div>

  {/* RIGHT: Step Number Strip — fills remaining width */}
  <div className="flex-1">
    <img
      src={stepNoteCountStrip}
      alt="Step numbers 1-16"
      className="h-full w-full object-contain"
    />
  </div>
</div>
```

**Key detail:** The `TRANSPORT_OUTLINE.png` already contains the "START / STOP" and "LOAD" text labels baked into the image. The actual `<PlayStopBtn>` and `<BeatLibrary>` buttons are overlaid on top as invisible/transparent hit areas, or the transport outline is used purely as a decorative background behind the buttons.

The `STEP_NOTE_COUNT_STRIP.png` replaces the previous plan to generate step numbers with CSS text — it's a pre-rendered image strip with the numbers 1–16 already styled and grouped (1-4, 5-8, 9-12, then gap, 13-16). This image sits flush alongside the transport outline to form one continuous bottom bar.

**E. Remove the `TONE`/`LEVEL` header row** from the old middle column — the labels will be positioned above the knob columns in the new layout.

**F. Remove track labels column** — handled by `showLabel={false}` on TrackControls.

**G. Remove M/S/CLR buttons** from visible layout — handled by `showButtons={false}` on TrackControls.

---

## Key Decisions

1. **M/S/CLR buttons hidden, not deleted** — We add optional props so they can return later (e.g. right-click context menu, settings panel). Zero functionality removed.

2. **TrackControls still renders knobs** — We just hide label + buttons. The TONE/LEVEL knobs render inline with each chiclet row.

3. **Image assets already exist** — All 10 image assets are in `src/assets/images/` but 6 are not yet imported.

4. **No changes to**: `Chiclet.tsx`, `Knob.tsx`, `Pad.tsx`, `Analyzer.tsx`, `sequencer.ts`, audio engine, auth, or state management.

5. **Step number strip is image-based** — Uses `STEP_NOTE_COUNT_STRIP.png` instead of CSS-generated text. The numbers and grouping are pre-rendered.

6. **Transport outline is image-based** — Uses `TRANSPORT_OUTLINE.png` as a decorative background/container for the START/STOP + LOAD buttons. The text labels ("START / STOP", "LOAD") are baked into the image.

7. **Bottom bar is one continuous row** — Transport outline on the left + step number strip on the right, sitting flush to form a single visual band across the bottom of the chassis.

---

## Files to Modify

| File                               | Why                                           |
| ---------------------------------- | --------------------------------------------- |
| `src/App.tsx:1015-1277`            | Main layout JSX to restructure + bottom strip |
| `src/components/TrackControls.tsx` | Add visibility props                          |
| `src/components/TempoDisplay.tsx`  | Image replacement                             |
| `src/components/PlayStopBtn.tsx`   | Image replacement                             |
| `src/components/SaveButton.tsx`    | Image replacement                             |
| `src/components/BeatLibrary.tsx`   | Trigger button replacement                    |

---

## Verification Checklist

1. **`bun run dev`** — App renders without errors
2. **Visual check** — Layout matches Figma reference:
   - Global knobs (OUTPUT/DRIVE/SWING) left column
   - TONE + LEVEL knobs per-row, left of chiclets
   - Chiclet grid fills right side
   - Transport bottom-left: Tempo+Save on row 1, StartStop+Load on row 2
   - Transport outline wraps START/STOP + LOAD with image background
   - Step number strip (1–16) extends from transport to right edge
   - Bottom bar forms one continuous visual band
   - Analyzer top-right
   - No track labels or M/S/CLR buttons visible
3. **Functional check**:
   - Click chiclets → grid toggles
   - Drag knobs → pitch/volume changes
   - Play/Stop → sequencer runs
   - Save/Load → beats persist
   - Tempo +/- → BPM changes
   - Auth → login/logout works
4. **`bun run build`** — Production build succeeds
5. **`bun run lint`** — No lint errors
6. **Responsive check** — Chassis scales at different viewport sizes, bottom strip scales proportionally
