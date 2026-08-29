# PR #29: The Faceplate Alignment (Grid & Layout Tuning)

## Objective

Align React components (Knobs, Chiclets, Controls) to fit perfectly into the visual "slots" of the photorealistic metal chassis background image.

## Background Image Layout (Confirmed)

Based on the actual background image:

**Left Column (Transport & Global Controls)**:

- Top: 3 large knobs (OUTPUT, DRIVE, SWING) - 60px diameter
- Below: TEMPO display (LCD-style)
- Below: SAVE button
- Below: START/STOP button (orange)
- Below: LOAD button

**Main Grid Area**:

- 10 rows × 16 columns of chiclet button slots
- Each row has: TONE knob (cream) + LEVEL knob (orange) + 16 chiclet slots
- Color banding: Red (cols 1-4), Orange (5-8), Yellow (9-12), Cream (13-16)
- Step numbers 1-16 printed at bottom
- "TONE" and "LEVEL" labels printed at top

**Top Right**:

- LCD screen bezel (dark display area)

## Current State vs. Target Layout

### What Needs to Move

1. **Transport Controls** (currently bottom-center) → Move to left column
   - PlayStopBtn → Below TEMPO display
   - SaveButton → Above PlayStopBtn
   - LoadButton → Below PlayStopBtn

2. **Global Knobs** (currently top-left of grid) → Move to left column above transport
   - OUTPUT knob (currently labeled as one of the knobs)
   - DRIVE knob
   - SWING knob (currently exists)

3. **Grid Layout** (currently matches) → Keep structure, adjust spacing
   - Chiclets: Keep h-[70px] (matches background slots)
   - Tone/Level knobs: Currently exist, need spacing adjustment
   - Remove TONE/LEVEL text labels (printed on background)

4. **LCD Screen** (currently TempoDisplay) → Position in top-right bezel
   - May need to create separate LCD component
   - Or reposition existing TempoDisplay

## Critical Layout Changes Required

### File: `src/App.tsx`

#### Change 1: Apply Background Image

```tsx
import chassisBackground from "./assets/images/CHASSIS 07_TEST_1.png";

// Apply to device container (line ~1010)
<div 
  className="rounded-xl p-4 pt-12 pr-8 pb-8 pl-8"
  style={{
    backgroundImage: `url(${chassisBackground})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat"
  }}
>
```

#### Change 2: Restructure Main Layout

**Current structure** (simplified):

```
<div> {/* device container */}
  <div> {/* header */}
  <div> {/* master section - swing/drive/analyzer */}
  <div> {/* TONE/LEVEL labels */}
  <div> {/* main flex row */}
    <div> {/* TrackControls column */}
    <div> {/* Grid */}
  <div> {/* bottom controls - play/save/tempo */}
```

**Target structure**:

```
<div> {/* device container with background */}
  <div> {/* header - keep as is */}

  <div> {/* NEW: main content flex row */}
    <div> {/* LEFT COLUMN */}
      <div> {/* Global knobs: OUTPUT, DRIVE, SWING */}
      <div> {/* Transport controls: TEMPO, SAVE, PLAY, LOAD */}
    </div>

    <div> {/* RIGHT SECTION: Grid area */}
      <div> {/* 10 rows of: TONE knob + LEVEL knob + 16 chiclets */}
    </div>
  </div>

  <div> {/* LCD Screen - absolute positioned top-right */}
```

#### Change 3: Remove Duplicate Labels (lines 1089-1101)

**DELETE** this entire block:

```tsx
<div>
  {/* Column headers for knobs */}
  <div className="flex h-[25px] items-center gap-1">
    <div className="w-14"></div>
    <div className="flex h-6 w-12 items-center justify-center text-xs font-bold text-white">
      TONE
    </div>
    <div className="flex h-6 w-12 items-center justify-center text-xs font-bold text-white">
      LEVEL
    </div>
    {/* ... */}
  </div>
</div>
```

Reason: "TONE" and "LEVEL" are printed on the background image.

#### Change 4: Create Left Column (Global Controls + Transport)

**NEW section** (add before grid):

```tsx
{/* LEFT COLUMN: Global Knobs + Transport Controls */}
<div className="flex flex-col gap-6">
  {/* Global Knobs Section */}
  <div className="flex flex-col items-center gap-4">
    {/* OUTPUT Knob */}
    <div className="flex flex-col items-center gap-1">
      <Knob
        variant="swing"  // Use large 60px knob
        min={-60}
        max={6}
        value={masterVolume}
        onChange={handleMasterVolumeChange}
      />
    </div>

    {/* DRIVE Knob */}
    <div className="flex flex-col items-center gap-1">
      <Knob
        variant="swing"
        min={0}
        max={100}
        value={drive}
        onChange={handleDriveChange}
      />
    </div>

    {/* SWING Knob */}
    <div className="flex flex-col items-center gap-1">
      <Knob
        variant="swing"
        min={0}
        max={100}
        value={swing}
        onChange={handleSwingChange}
      />
    </div>
  </div>

  {/* Transport Controls Section */}
  <div className="flex flex-col gap-2">
    {/* TEMPO Display */}
    <TempoDisplay
      bpmValue={bpm}
      onIncrementClick={handleIncrementBpm}
      onDecrementClick={handleDecrementBpm}
    />

    {/* SAVE Button */}
    <SaveButton onClick={handleSaveBeat} isSaving={isSaving} />

    {/* START/STOP Button */}
    <PlayStopBtn
      isPlaying={isPlaying}
      onPlayClick={handlePlay}
      onStopClick={handleStop}
    />

    {/* LOAD Button */}
    <BeatLibrary beats={beats} onLoadBeat={handleLoadBeatById} />
  </div>
</div>
```

#### Change 5: Grid Section (Right of Left Column)

Keep the current grid structure but adjust spacing:

```tsx
{/* GRID SECTION */}
<div className="flex flex-col">
  {tracks.map((track, trackIndex) => {
    const trackId = trackIdsByRowRef.current[trackIndex];
    const trackConfig = TRACK_REGISTRY.find((c) => c.trackId === trackId);
    const isDisabled = failedTrackIds.includes(trackId);

    return (
      <div key={`row-${trackIndex}`} className="flex items-center gap-2">
        {/* TrackControls: TONE knob + LEVEL knob + M/S/CLR buttons */}
        <TrackControls
          trackId={trackId}
          label={trackConfig.label}  // Keep or remove based on background
          isMuted={trackMutes[trackIndex]}
          isSoloed={trackSolos[trackIndex]}
          onMuteToggle={handleMuteToggle}
          onSoloToggle={handleSoloToggle}
          onClear={handleClearTrack}
          pitchValue={trackPitches[trackIndex]}
          volumeValue={trackVolumes[trackIndex]}
          onPitchChange={(newValue) => handlePitchChange(trackIndex, newValue)}
          onVolumeChange={(newValue) => handleDbChange(trackIndex, newValue)}
          disabled={isDisabled}
        />

        {/* 16 Chiclets for this row */}
        <div className="flex gap-1">
          {track.map((_, colIndex) => {
            const isAccented = manifestRef.current.tracks[trackId]?.accents?.[colIndex] ?? false;

            return (
              <Chiclet
                key={`${rowIndex}-${colIndex}`}
                variant={getChicletVariant(colIndex)}
                isActive={grid[rowIndex][colIndex]}
                isAccented={isAccented}
                isCurrentStep={colIndex === currentStep}
                is16thNote={colIndex % 4 !== 0}
                onClick={() => handlePadClick(rowIndex, colIndex)}
                disabled={isDisabled}
              />
            );
          })}
        </div>
      </div>
    );
  })}
</div>
```

### File: `src/components/Chiclet.tsx`

**Keep current sizing** (per user request):

```tsx
className={`aspect-2/1 h-[70px] w-full cursor-pointer hover:opacity-80 ${opacityClass} ${brightnessModifiers}`}
```

**Add drop shadow** for depth:

```tsx
style={{
  backgroundImage: `url(${chicletImage})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))",
  transition: "filter 0.15s ease"
}}
```

### File: `src/components/TrackControls.tsx`

**Current layout**: Label + Pitch Knob + Volume Knob + M + S + CLR

**Adjust spacing** between knobs to match background:

```tsx
<div className="flex h-[25px] items-center" style={{ gap: "12px" }}>
  {/* Optionally hide label if background has track names */}
  {/* <div className="w-16 truncate text-left text-xs font-semibold text-white">{label}</div> */}

  {/* TONE Knob (Pitch) */}
  <Knob
    variant="tone"
    min={-12}
    max={12}
    value={pitchValue}
    onChange={onPitchChange}
    disabled={disabled}
  />

  {/* LEVEL Knob (Volume) */}
  <Knob
    variant="level"
    min={-45}
    max={5}
    value={volumeValue}
    onChange={onVolumeChange}
    disabled={disabled}
  />

  {/* Mute/Solo/Clear buttons - KEEP CURRENT CSS IMPLEMENTATION */}
  <button
    className="h-[25px] w-[30px] rounded-md text-xs font-bold text-white transition-colors"
    style={{
      backgroundColor: isMuted ? "#B43131" : "#504F4F",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)"
    }}
    onClick={() => onMuteToggle(trackId)}
  >
    M
  </button>

  <button
    className="h-[25px] w-[30px] rounded-md text-xs font-bold text-white transition-colors"
    style={{
      backgroundColor: isSoloed ? "#B49531" : "#504F4F",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)"
    }}
    onClick={() => onSoloToggle(trackId)}
  >
    S
  </button>

  <button
    className="h-[25px] w-[30px] rounded-md text-xs font-bold text-white transition-colors hover:bg-[#8B0000]"
    style={{
      backgroundColor: "#504F4F",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)"
    }}
    onClick={() => onClear(trackId)}
  >
    CLR
  </button>
</div>
```

**Note**: User confirmed we're keeping CSS buttons (M/S/CLR), not creating new components.

### File: `src/components/Knob.tsx`

**Add drop shadow** to all knobs:

```tsx
<img
  className="h-[28px] w-[28px] cursor-grab select-none active:cursor-grabbing"  // Small knobs
  // OR
  className="h-[60px] w-[60px] cursor-grab select-none active:cursor-grabbing"  // Large knobs
  src={knobImage}
  alt="Knob"
  style={{
    transform: `rotate(${renderKnob}deg)`,
    filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5))",
    transition: "filter 0.15s ease"
  }}
  draggable={false}
  onMouseDown={handleMouseDown}
/>
```

### File: `src/index.css`

**Add missing grid-cols-16**:

```css
@import "tailwindcss";

@layer utilities {
  .grid-cols-16 {
    grid-template-columns: repeat(16, minmax(0, 1fr));
  }
}

/* ... rest of existing CSS ... */
```

## Spacing Adjustments (Fine-Tuning Values)

### Grid Chiclet Spacing

- **Between chiclets**: `gap: "4px"` (current `gap-1`)
- **Row height**: Auto-calculated based on chiclet h-[70px]

### TrackControls Spacing

- **Between knobs**: Increase from `gap-1` (4px) to `gap: "12px"` or `gap: "16px"`
- **Reason**: Background image shows wider spacing between TONE and LEVEL columns

### Left Column Spacing

- **Between global knobs**: `gap-4` (16px)
- **Between transport buttons**: `gap-2` (8px)
- **Between sections**: `gap-6` (24px)

## New State/Handlers Required

### File: `src/App.tsx`

**Add master volume state** (for OUTPUT knob):

```tsx
const [masterVolume, setMasterVolume] = useState<number>(0); // -60 to +6 dB

function handleMasterVolumeChange(newValue: number) {
  setMasterVolume(newValue);
  // Update audio engine master volume
  // setMasterOutputVolume(newValue);  // Need to implement in audioEngine.ts
}
```

**Note**: This may already exist as part of the manifest, but needs to be exposed as UI state if implementing OUTPUT knob.

## LCD Screen Positioning

### File: `src/App.tsx` (or new component)

**Strategy**: Position LCD screen absolutely in top-right corner to match background bezel.

**Option 1** - Absolute positioning of existing TempoDisplay:

```tsx
<div 
  style={{
    position: "absolute",
    top: "60px",    // Adjust to match background
    right: "80px",  // Adjust to match background
    width: "300px",
    height: "120px"
  }}
>
  {/* LCD content - possibly just BPM number, no arrows */}
  <div className="flex h-full w-full items-center justify-center bg-black">
    <span className="text-6xl font-bold text-green-400">{bpm}</span>
  </div>
</div>
```

**Option 2** - Keep TEMPO display in left column (per background image), use LCD screen for different info.

**Decision Point**: Need to clarify what should display in the top-right LCD screen vs. the TEMPO display in the left column.

## Critical Files to Modify

1. **`src/App.tsx`** - Major restructure
   - Apply background image
   - Reorganize layout: left column + grid area
   - Remove duplicate labels
   - Add master volume state
   - Reposition LCD screen

2. **`src/components/TrackControls.tsx`**
   - Adjust knob spacing (gap-1 → gap-3 or gap-4)
   - Add shadows to M/S/CLR buttons
   - Optionally hide track labels

3. **`src/components/Chiclet.tsx`**
   - Add drop-shadow filter (keep h-[70px])

4. **`src/components/Knob.tsx`**
   - Add drop-shadow filter

5. **`src/index.css`**
   - Add grid-cols-16 definition

## Verification Steps

1. **Layout Structure**:
   - [ ] Left column shows: OUTPUT/DRIVE/SWING knobs + TEMPO/SAVE/PLAY/LOAD buttons
   - [ ] Grid area shows: 10 rows × (TONE knob + LEVEL knob + 16 chiclets)
   - [ ] LCD screen positioned in top-right bezel area

2. **Visual Alignment**:
   - [ ] Chiclets align with background button slots (h-[70px] maintained)
   - [ ] TONE/LEVEL knobs align with background knob graphics
   - [ ] Global knobs (OUTPUT/DRIVE/SWING) align with background slots
   - [ ] Transport buttons align with background panel areas
   - [ ] No duplicate text labels (TONE, LEVEL, step numbers)

3. **Spacing**:
   - [ ] Gap between chiclets matches background (4-6px)
   - [ ] Gap between TONE and LEVEL knobs matches background (12-16px)
   - [ ] Rows align vertically with background grid lines

4. **Interaction**:
   - [ ] All chiclets clickable and responsive
   - [ ] All knobs draggable (small 28px and large 60px)
   - [ ] M/S/CLR buttons functional
   - [ ] Transport controls work (SAVE/PLAY/LOAD)

5. **Visual Depth**:
   - [ ] Chiclets have drop shadow
   - [ ] Knobs have drop shadow
   - [ ] Buttons have box shadow
   - [ ] Components appear to "float" above metal chassis

## Expected Outcome

A photorealistic TR-08 drum machine interface where:

- Background image provides the metal chassis, labels, and visual slots
- React components fit perfectly into their designated slots
- Left column contains global controls and transport
- Main area contains 10 rows of controls + chiclet grid
- No visual duplication (labels rendered by React match background)
- Realistic depth with shadows making components appear 3D
- Layout matches the reference image exactly
