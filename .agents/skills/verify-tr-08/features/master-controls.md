# Master Controls

Global audio effects that apply to all tracks: master output volume, drive (saturation), and swing (shuffle).

## Sub-features

1. **Master Volume:** Output volume knob (-60 to +6 dB, default: 0 dB)
2. **Drive:** Saturation/distortion effect (0-100%, default: 0%)
3. **Swing:** Shuffle/groove amount (0-100%, default: 0%)
4. **Real-time Updates:** All master controls take effect immediately during playback
5. **Persistence:** Master settings are saved with each beat

## How to get to it (user POV)

Located in the top-right control panel of the TR-08 chassis:

- **Master Volume Knob:** Labeled "MASTER" or similar
- **Drive Knob:** Labeled "DRIVE" or "SATURATE"
- **Swing Knob:** Labeled "SWING" or "SHUFFLE"

These are rotary knobs styled to look like physical hardware controls.

## Driving it with control-tr-08

**NOT YET AUTOMATED.** Like track controls, master knobs require drag gestures which are not yet implemented in the control script.

**Workaround for manual verification:**

1. Launch the app:

   ```bash
   cd .agents/skills/verify-tr-08/scripts
   export VERIFY_PORT=5174 VERIFY_RUN_ID=master-test

   ./control-tr-08.mjs launch
   ./control-tr-08.mjs doctor
   ./control-tr-08.mjs wait-settle
   ```

2. Open `http://localhost:5174` in a browser

3. Manually rotate knobs:
   - **Master Volume:** Rotate to +6 dB (loudest), then -60 dB (silent)
   - **Drive:** Rotate to 100% (heavy distortion), then 0% (clean)
   - **Swing:** Rotate to 100% (maximum shuffle), then 0% (straight 16ths)

4. Play a pattern to hear the effects:
   - Tap some pads to create a pattern
   - Click play
   - Adjust knobs in real-time to hear changes

5. Capture evidence:

   ```bash
   ./control-tr-08.mjs screenshot master-volume-max
   ./control-tr-08.mjs screenshot drive-100
   ./control-tr-08.mjs screenshot swing-50
   ```

6. Cleanup:

   ```bash
   ./control-tr-08.mjs cleanup
   ```

**Future automation:**

To add master controls to the control script, we need:

- Stable selectors for each knob (e.g., `[data-control="master-volume"]`)
- Drag gesture helper function (same as track controls)

Example pseudocode:

```javascript
async function setMasterVolume(dbValue) {
  const knob = await page.locator('[data-control="master-volume"]');
  await rotateKnob(knob, dbValue, -60, 6);
}

async function setDrive(percent) {
  const knob = await page.locator('[data-control="drive"]');
  await rotateKnob(knob, percent, 0, 100);
}

async function setSwing(percent) {
  const knob = await page.locator('[data-control="swing"]');
  await rotateKnob(knob, percent, 0, 100);
}
```

## Gotchas

1. **Audio effects require playback:** To verify drive and swing work, you need to play audio. Screenshots show knob positions, but not the audible result.

2. **Drive is CPU-intensive:** High drive values (80-100%) apply heavy distortion, which can cause audio glitches on low-powered devices.

3. **Swing implementation:** Swing delays alternate 16th notes (steps 1, 3, 5, 7, etc.) to create a shuffle feel. At 0%, all steps are perfectly on-grid. At 100%, alternates are delayed to the maximum supported by Tone.js.

4. **Master volume is post-drive:** The signal chain is: Track Volumes → Master Drive → Master Volume. So drive affects the volume knob's behavior (more drive = more gain, may clip).

5. **Knob ranges:**
   - Master Volume: -60 to +6 dB (66 dB range)
   - Drive: 0 to 100% (percentage, mapped to Tone.js Distortion amount)
   - Swing: 0 to 100% (percentage, mapped to Tone.js swing time offset)

6. **Persistence:** Master settings are saved per beat. Loading a different beat restores that beat's master settings.

7. **No visual waveform:** The app has an audio analyzer (audiomotion-analyzer), but it's not currently wired to the master output. Future PR may add this.
