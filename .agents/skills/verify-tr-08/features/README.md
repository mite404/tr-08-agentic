# TR-08 Feature Map

This directory maps user-facing features to their verification handles. Each feature file follows the same structure:

1. **Sub-features** — What the feature does
2. **How to get to it (user POV)** — Where it lives in the UI
3. **Driving it with control-tr-08** — Exact commands to exercise it
4. **Gotchas** — Known issues, auth requirements, or constraints

## Coverage Set

The following features were identified from source code (`src/App.tsx`, `src/components/SequencerChassis.tsx`, and component files):

| Feature           | File                                         | Auth Required | Notes                                      |
| ----------------- | -------------------------------------------- | ------------- | ------------------------------------------ |
| Sequencer Grid    | [sequencer-grid.md](sequencer-grid.md)       | No            | 10 tracks × 16 steps, 3-state pads         |
| Playback Controls | [playback-controls.md](playback-controls.md) | No            | Play/Stop, BPM adjustment                  |
| Track Controls    | [track-controls.md](track-controls.md)       | No            | Mute, Solo, Volume, Pitch, Clear per track |
| Beat Persistence  | [beat-persistence.md](beat-persistence.md)   | **Yes**       | Save/Load beats to Supabase                |
| Master Controls   | [master-controls.md](master-controls.md)     | No            | Master Volume, Drive, Swing                |

## Unbounded Sets

**Track configurations:** The app has 10 tracks, each with:

- Volume knob (-60 to +6 dB)
- Pitch knob (-12 to +12 semitones)
- Mute button
- Solo button
- Clear button

The feature map samples 1-2 tracks. Testing all 10 tracks is repetitive and not required for coverage.

**Grid states:** With 10 tracks × 16 steps = 160 pads, each with 3 states (OFF, ON, Ghost), the state space is unbounded. The feature map samples representative interactions (tap a few pads, verify state changes).

**Beat library:** User-created beats in Supabase are unbounded. The feature map tests save and load with 1-2 sample beats.

## How to Use This Map

1. Pick a feature file (e.g., `sequencer-grid.md`)
2. Follow the "How to get to it" section to understand where it lives
3. Use the "Driving it with control-tr-08" section to run commands
4. Check "Gotchas" for known constraints

When proving the skill works, verify ONE feature end-to-end (recommended: sequencer-grid or playback-controls, since they don't require auth).
