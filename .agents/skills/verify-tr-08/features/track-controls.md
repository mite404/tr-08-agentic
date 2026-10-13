# Track Controls

Per-track controls for muting, soloing, adjusting volume/pitch, and clearing patterns.

## Sub-features

1. **Mute:** Silence a track (visual feedback: button state changes)
2. **Solo:** Play only soloed tracks (mutes all others)
3. **Volume:** Per-track volume knob (-45 to +5 dB, default: -5 dB)
4. **Pitch:** Per-track pitch knob (-12 to +12 semitones, default: 0)
5. **Clear:** Clear all steps and accents for a track (keeps other settings)

## How to get to it (user POV)

Each track row has a control panel on the left side with:

- **Mute button** (M icon)
- **Solo button** (S icon)
- **Volume knob** (rotary control)
- **Pitch knob** (rotary control)
- **Clear button** (trash icon or similar)

These controls are part of the `TrackControls` component, rendered for each of the 10 tracks.

**Note:** The current control script does NOT have commands for these yet, as they require Playwright to interact with knobs (drag/rotate gestures) and buttons without aria-labels or test IDs. This feature file documents the USER POV and notes that automation is incomplete.

## Driving it with control-tr-08

**NOT YET AUTOMATED.** The control script needs enhancement to support:

- Clicking mute/solo/clear buttons (requires stable selectors)
- Rotating knobs (requires drag gestures or simulated mouse events)

**Workaround for manual verification:**

1. Launch the app with `./control-tr-08.mjs launch`
2. Open `http://localhost:5174` in a real browser
3. Manually click buttons and rotate knobs
4. Capture screenshots with `./control-tr-08.mjs screenshot <name>`

**Future automation:**

To add track controls to the control script, we need:

- Test IDs or stable selectors for each track's mute/solo/clear buttons
- A helper function to rotate knobs (Playwright `mouse.move` + `mouse.down` + `mouse.move` + `mouse.up`)

Example pseudocode:

```javascript
async function muteTrack(trackIndex) {
  const button = await page.locator(`[data-track="${trackIndex}"] [aria-label="Mute"]`);
  await button.click();
}

async function setVolume(trackIndex, dbValue) {
  // Find knob center
  const knob = await page.locator(`[data-track="${trackIndex}"] [data-control="volume"]`);
  const box = await knob.boundingBox();
  // Calculate rotation angle from dbValue
  // Simulate drag gesture
}
```

## Gotchas

1. **No stable selectors:** The codebase does not currently have `data-testid` or `aria-label` attributes on mute/solo/clear buttons. Adding these would make automation easier.

2. **Knob gestures:** Knobs require mouse drag gestures (not simple clicks). Playwright supports this, but it's more complex than button clicks.

3. **Solo interaction:** When any track is soloed, all other tracks are effectively muted. Soloing multiple tracks means only those soloed tracks play. This can be confusing to verify without audio capture.

4. **Volume/pitch ranges:** Volume is -45 to +5 dB (50 dB range). Pitch is -12 to +12 semitones (24 semitone range). Knob rotation maps these ranges to a 0-1 normalized value internally.

5. **Clear is destructive:** The clear button removes all steps and accents for that track. There is no undo (except reloading a saved beat).

6. **Per-track state persists:** Mute/solo/volume/pitch settings persist in the beat manifest and are saved with the beat (if saved to Supabase).
