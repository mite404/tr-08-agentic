# Playback Controls

Start and stop the sequencer, adjust tempo, and control the playback loop.

## Sub-features

1. **Play/Stop Button:** Single button that toggles between START and STOP states
2. **BPM Control:** Increment/decrement tempo between 40 and 300 BPM (default: 140)
3. **Playhead:** Visual indicator showing which step is currently playing (brightness-175)
4. **Transport Sync:** Uses Tone.js Transport for precise timing (16th note resolution)
5. **Real-time BPM Updates:** BPM changes take effect immediately during playback

## How to get to it (user POV)

Located in the center control panel of the TR-08 chassis:

- **Play/Stop Button:** Large divided button with "START" and "STOP" labels, styled like a physical hardware button
  - Selector: `button[aria-label="Start / Stop"]`
- **BPM Display:** Shows current tempo (e.g., "140") with up/down arrow buttons
  - Increment: `button[aria-label="Increase tempo"]`
  - Decrement: `button[aria-label="Decrease tempo"]`

The BPM range is 40-300 (enforced in the code).

## Driving it with control-tr-08

**Launch and verify playback controls:**

```bash
cd /workspace/.agents/skills/verify-tr-08/scripts
export VERIFY_PORT=5174 VERIFY_RUN_ID=playback-test

./control-tr-08.mjs launch
./control-tr-08.mjs doctor
./control-tr-08.mjs wait-settle
./control-tr-08.mjs screenshot initial-stopped
```

**Start playback:**

```bash
./control-tr-08.mjs play
sleep 2
./control-tr-08.mjs screenshot playing
```

The playhead should move across the grid (each step lights up with brightness-175 as it plays).

**Stop playback:**

```bash
./control-tr-08.mjs stop
./control-tr-08.mjs screenshot stopped-after-play
```

**Adjust BPM:**

```bash
# Increase tempo by 5 BPM
./control-tr-08.mjs bpm-up
./control-tr-08.mjs bpm-up
./control-tr-08.mjs bpm-up
./control-tr-08.mjs bpm-up
./control-tr-08.mjs bpm-up
./control-tr-08.mjs screenshot bpm-145

# Decrease tempo by 10 BPM
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs bpm-down
./control-tr-08.mjs screenshot bpm-135
```

**Test BPM during playback:**

```bash
./control-tr-08.mjs play
sleep 1
./control-tr-08.mjs bpm-up
./control-tr-08.mjs bpm-up
sleep 1
./control-tr-08.mjs screenshot faster-playback
./control-tr-08.mjs stop
```

The tempo should change immediately without stopping playback.

**Capture ARIA structure:**

```bash
./control-tr-08.mjs snapshot playback-controls
```

**Cleanup:**

```bash
./control-tr-08.mjs cleanup
```

Evidence is preserved at `/tmp/tr-08-verify-playback-test/`.

## Gotchas

1. **Audio context resume:** On first play, the browser may require a user gesture to resume the audio context (autoplay policy). The control script clicks the play button, which satisfies this requirement.

2. **Sample loading:** On first play, all audio samples are loaded asynchronously. The app shows a loading state while samples load. The control script's `wait-settle` command waits for this, but you may need to add extra delay if samples are slow to load.

3. **BPM bounds:** The UI clamps BPM between 40 and 300. Clicking bpm-up at 300 or bpm-down at 40 does nothing.

4. **Playhead wraps:** After step 15, the playhead wraps back to step 0 and the loop repeats indefinitely until stopped.

5. **Stop vs. Pause:** The stop button halts playback and resets the playhead to step 0 (not a pause). There is no "resume from current position" feature.

6. **Tone.js Transport:** The app uses Tone.js Transport for precise scheduling. If you see timing drift, it's likely a browser/system audio issue, not the app.
