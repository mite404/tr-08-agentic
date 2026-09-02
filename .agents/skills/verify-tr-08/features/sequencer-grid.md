# Sequencer Grid

The core of TR-08: a 10-track × 16-step grid where users program drum patterns.

## Sub-features

1. **Pad States:** Each pad has 3 states:
   - **OFF** (opacity-20, very dim)
   - **ON Normal** (opacity-100, full brightness)
   - **ON Ghost** (opacity-50, medium brightness, lower volume accent)
2. **Tap Cycling:** Click a pad to cycle: OFF → ON Normal → ON Ghost → OFF
3. **Visual Playhead:** Current step highlights with `brightness-175`
4. **16th Note Distinction:** Steps 1-3, 5-7, 9-11, 13-15 have `brightness-135` (slightly dimmer) to distinguish 16th notes visually
5. **Failed Tracks:** If an audio sample fails to load, that track's pads are grayed out and disabled

## How to get to it (user POV)

The grid is the main UI element in the center of the screen:

- **10 rows** (top to bottom): Different drum sounds (kick, snare, hi-hat, etc.)
- **16 columns** (left to right): Steps in the sequence (one bar)
- Each pad is a rectangular button styled with a Tailwind color (dark-orange, dark-purple, etc.)

When the app loads, track 8 (9th row from top) has all pads ON by default (visual reference pattern).

## Driving it with control-tr-08

**Launch and verify the grid exists:**

```bash
cd .agents/skills/verify-tr-08/scripts
export VERIFY_PORT=5174 VERIFY_RUN_ID=grid-test

./control-tr-08.mjs launch
./control-tr-08.mjs doctor
./control-tr-08.mjs wait-settle
./control-tr-08.mjs screenshot initial-grid
```

**Tap pads to change state:**

Grid coordinates: `tap-pad <track> <step>` where track is 0-9, step is 0-15.

```bash
# Tap track 0 (first row), step 0 (first column)
./control-tr-08.mjs tap-pad 0 0
./control-tr-08.mjs screenshot after-first-tap

# Tap same pad again (should cycle to Ghost state)
./control-tr-08.mjs tap-pad 0 0
./control-tr-08.mjs screenshot after-second-tap

# Tap same pad again (should cycle back to OFF)
./control-tr-08.mjs tap-pad 0 0
./control-tr-08.mjs screenshot after-third-tap

# Tap multiple pads to build a pattern
./control-tr-08.mjs tap-pad 0 0
./control-tr-08.mjs tap-pad 0 4
./control-tr-08.mjs tap-pad 0 8
./control-tr-08.mjs tap-pad 0 12
./control-tr-08.mjs screenshot four-on-the-floor
```

**Verify visual playhead:**

```bash
# Start playback to see the playhead move
./control-tr-08.mjs play
sleep 2
./control-tr-08.mjs screenshot playhead-moving
./control-tr-08.mjs stop
```

**Capture ARIA structure:**

```bash
./control-tr-08.mjs snapshot grid-structure
```

**Cleanup:**

```bash
./control-tr-08.mjs cleanup
```

Evidence is preserved at `/tmp/tr-08-verify-grid-test/screenshots/` and `/tmp/tr-08-verify-grid-test/artifacts/`.

## Gotchas

1. **Pad selectors:** The control script uses `button:nth-of-type(N)` where N = (track × 16) + step + 1. This assumes the buttons are in DOM order (which they are, thanks to grid-cols-16 layout). If the DOM structure changes, this selector breaks.

2. **Failed tracks:** If audio samples fail to load (e.g., missing files, network issues), those tracks are visually grayed out and pads are disabled. The control script does not currently detect this state (future enhancement).

3. **Initial state:** Track 8 (9th row) has all pads ON by default. If you're verifying a "blank grid," tap those pads off first.

4. **Ghost state visual feedback:** Screenshots show opacity differences, but the actual audio difference (lower volume accent) is not captured. To verify audio behavior, you'd need to record the output and analyze waveforms.

5. **3-state cycling:** The order is always OFF → ON → Ghost → OFF. You cannot skip states or reverse the cycle.
