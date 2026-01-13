# PR #8: Audio Engine Testing Guide

This document provides instructions for testing the Pitch and Accent (Ghost Note) audio engine implementation.

## Unit Tests (Automated)

### Running Tests

```bash
bun test src/lib/beatUtils.test.ts
```

### Test Coverage

✅ **Volume Calculation Tests** (`calculateEffectiveVolume`)
- Standard volume (0dB, no accent) → 0dB
- Accent active (0dB, accent) → -7dB
- Accent + Knob (-10dB, accent) → -17dB
- Mute override (mute defeats accent) → -Infinity
- Solo isolation (non-solo track silenced) → -Infinity
- Master volume integration → correct additive math
- Combined (track + accent + master) → -19dB

**Result:** All 7 tests passing ✅

---

## Manual Testing (Browser Console)

### Setup

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open browser at `http://localhost:5173`

3. Open Chrome DevTools Console (F12)

4. Wait for the console message:
   ```
   🎹 TR-08 Console Harness Ready!
   ```

### Available Console Commands

#### Basic Usage

```javascript
// Play kick at normal pitch and volume
window.tr08.play('kick_01', 0, false)
```

#### Test Pitch Shifting

```javascript
// Play kick +1 octave (12 semitones up)
window.tr08.play('kick_01', 12, false)

// Play kick -1 octave (12 semitones down)
window.tr08.play('kick_01', -12, false)

// Play kick +7 semitones (perfect fifth up)
window.tr08.play('kick_01', 7, false)

// Play snare -5 semitones (lower)
window.tr08.play('snare_01', -5, false)
```

**Expected:** Higher pitch values should sound faster/higher, lower pitch values should sound slower/deeper.

#### Test Ghost Note (Accent)

```javascript
// Play kick at normal volume (0dB)
window.tr08.play('kick_01', 0, false)

// Play kick with ghost note (-7dB softer)
window.tr08.play('kick_01', 0, true)
```

**Expected:** Second command should be noticeably softer (approximately 45% volume).

#### Test Combined (Pitch + Accent)

```javascript
// Ghost note at higher pitch
window.tr08.play('kick_01', 12, true)

// Ghost note at lower pitch
window.tr08.play('kick_01', -12, true)
```

#### Test All Tracks

```javascript
// List available track IDs
window.tr08.tracks()

// Test each track
window.tr08.play('kick_01', 0, false)
window.tr08.play('kick_02', 0, false)
window.tr08.play('bass_01', 0, false)
window.tr08.play('bass_02', 0, false)
window.tr08.play('snare_01', 0, false)
window.tr08.play('snare_02', 0, false)
window.tr08.play('synth_01', 0, false)
window.tr08.play('clap', 0, false)
window.tr08.play('hh_01', 0, false)
window.tr08.play('hh_02', 0, false)
```

#### Inspect Current State

```javascript
// View current manifest (including pitch and accent values)
window.tr08.manifest()
```

---

## Test Scenarios

### Scenario 1: Pitch Range Test

Test the full pitch range to ensure no audio glitches:

```javascript
// Extreme low (-12 semitones)
window.tr08.play('kick_01', -12, false)

// Mid-range low (-6 semitones)
window.tr08.play('kick_01', -6, false)

// Normal (0 semitones)
window.tr08.play('kick_01', 0, false)

// Mid-range high (+6 semitones)
window.tr08.play('kick_01', 6, false)

// Extreme high (+12 semitones)
window.tr08.play('kick_01', 12, false)
```

**Expected:** Smooth pitch progression, no clicks or distortion.

### Scenario 2: Volume Knob Independence Test

1. Adjust the volume knob for kick_01 to -10dB (in the UI)
2. Test accent behavior:

```javascript
// Should play at -10dB (knob setting)
window.tr08.play('kick_01', 0, false)

// Should play at -17dB (knob -10dB + accent -7dB)
window.tr08.play('kick_01', 0, true)
```

**Expected:** Ghost note should be softer RELATIVE to the knob setting.

### Scenario 3: Rapid Fire Test

Test that playback rate resets correctly between triggers:

```javascript
// Rapidly trigger different pitches
window.tr08.play('kick_01', 12, false)
window.tr08.play('kick_01', 0, false)   // Should be normal speed
window.tr08.play('kick_01', -12, false)
window.tr08.play('kick_01', 0, false)   // Should be normal speed again
```

**Expected:** Each trigger should use the specified pitch, no "pitch bleed" between triggers.

---

## Verification Checklist

- [ ] Unit tests pass (7/7)
- [ ] Console harness loads successfully
- [ ] Pitch shifting works (+12, 0, -12 semitones)
- [ ] Ghost notes are audibly softer (-7dB)
- [ ] Volume knob still controls overall track level
- [ ] Ghost notes work independently of pitch
- [ ] All 10 tracks can be triggered via console
- [ ] No audio glitches or clicks
- [ ] Playback rate resets correctly (pitch = 0 → rate = 1)

---

## Known Issues & Limitations

- **Browser Autoplay Policy**: First call to `window.tr08.play()` may require user interaction (click Play button first)
- **Tone.js Context**: Audio context must be running (automatically handled by harness)
- **Sample Loading**: Console harness only works after samples have loaded

---

## API Reference

### `window.tr08.play(trackId, pitch, accent)`

**Parameters:**
- `trackId`: `TrackID` - One of: `kick_01`, `kick_02`, `bass_01`, `bass_02`, `snare_01`, `snare_02`, `synth_01`, `clap`, `hh_01`, `hh_02`
- `pitch`: `number` - Semitones (-12 to +12, default: 0)
- `accent`: `boolean` - Ghost note flag (default: false)

**Returns:** `Promise<void>`

### `window.tr08.tracks()`

Lists all available track IDs in the console.

### `window.tr08.manifest()`

Displays the current beat manifest (useful for inspecting pitch and accent state).

---

## Next Steps

After manual testing confirms:
1. ✅ Pitch shifting works correctly
2. ✅ Ghost notes work correctly
3. ✅ Volume hierarchy is maintained

Proceed to **PR #9: UI Implementation** to add:
- Pitch knob UI component
- Accent toggle UI (second click on grid cells)
- Visual feedback for accented cells
