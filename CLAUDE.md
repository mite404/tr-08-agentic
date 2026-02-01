# CLAUDE.md

**Last Updated:** 2025-11-30

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TR-08** is a drum machine / beat sequencer web application built with React, TypeScript, Vite, and Tone.js. It provides a visual 16-step sequencer grid where users can program drum patterns across 10 instrument tracks, control BPM (tempo), play back sequences, and save beats with custom names. The UI mimics physical hardware (Roland TR-08 style).

## Build & Development Commands

```bash
bun run dev          # Start development server with Vite HMR
bun run build        # Compile TypeScript and build for production
bun run lint         # Run ESLint on all TS/TSX files
bun run preview      # Preview production build locally
```

## Architecture & Key Concepts

### State Management Flow

The application uses **React hooks** with a functional component architecture. Key state management happens in `App.tsx`:

1. **Grid State** (`grid`): A 10×16 2D array of booleans representing which tracks should play at which steps
2. **BPM State** (`bpm`): Current tempo in beats per minute (default: 140)
3. **Current Step** (`currentStep`): Which of the 16 steps is currently being played (0-15)
4. **Beat Name** (`beatName`): User-defined name for the sequence (default: "TR-08", max 25 chars)
5. **Loading State** (`loadedCount`, `allPlayersReady`, `isLoading`): Tracks audio sample loading

**Grid Structure:**

```text
grid[trackIndex][stepIndex] = boolean
```

- 10 tracks (rows): Different drum sounds (kicks, bass, snare, synth, hi-hat)
- 16 steps (columns): One bar divided into 16 positions (4 beats of 4 16th notes each)
- `true` = sound plays at this step, `false` = silent

**Audio Players:**

- Each track has a `player` property (Tone.Player instance) added dynamically
- Players are initialized on first play (lazy loading) via `initPlayers()` function
- Loading state prevents playback until all samples are loaded (or allows continuation if some fail)
- Error handling: samples that fail to load don't block sequencer startup

### Sequencer Engine (`src/sequencer.ts`)

The `createSequencer()` function is the core timing engine:

- Uses **Tone.js Transport** for precise timing (not simple setInterval)
- Schedules playback at "16n" (16th note) interval
- Manages playback state: `start()`, `stop()`, `updateBpm()`
- Calls the `onStep` callback function each 16th note, passing the current step number (0-15)
- Returns an object with methods for controlling playback

**Important Detail:** The sequencer operates at 16th note resolution, so a full bar is 16 steps rather than 8.

### Audio Assets (`src/assets/samples/`)

Audio samples are **imported as ES modules** (Commit #21) for production deployment:

```typescript
import KICK01 from "./assets/samples/KICK01.wav";
import KICK02 from "./assets/samples/KICK02.wav";
import Bass_Tone_C_013 from "./assets/samples/Bass_Tone_C_013.wav";
import BASS01 from "./assets/samples/BASS01.wav";
import Bh_Hit_Clap_0007 from "./assets/samples/Bh_Hit_Clap_0007.wav";
import JA_SNARE_2 from "./assets/samples/JA_SNARE_2.wav";
import Stabs_Chords_016_Dm from "./assets/samples/Stabs_&_Chords_016_Dm.wav";
import Stabs_Chords_028_C from "./assets/samples/Stabs_&_Chords_028_C.wav";
import Bh_Hit_Hihat_0008 from "./assets/samples/Bh_Hit_Hihat_0008.wav";
import Bh_Hit_Hihat_0009 from "./assets/samples/Bh_Hit_Hihat_0009.wav";
```

**Benefits:**

- Vite bundles samples into production build
- No network requests needed in production
- Reliable for deployed applications
- Proper asset handling during build process

### Component Architecture

All UI components are functional components with TypeScript prop types:

- **`Pad.tsx`**: Individual grid button (one pad = one track × one step)
  - Props: `color`, `isActive`, `isCurrentStep`, `is16thNote`, `onClick`
  - Styling: Opacity indicates active/inactive; brightness indicates playhead position and 16th note distinction
  - 16th notes (every step not divisible by 4) have slightly reduced brightness for visual distinction (Commit #22)

- **`Button.tsx`**: Reusable control button for PLAY, STOP, SET TEMPO
  - Props: `text`, `customStyles`, `onClick`

- **`PlayStopBtn.tsx`**: Enhanced play/stop toggle with divided visual design
  - Shows START and STOP as separate visual sections
  - Indicates current playback state

- **`TempoDisplay.tsx`**: BPM display with increment/decrement arrows
  - Props: `bpmValue`, `onIncrementClick`, `onDecrementClick`
  - Allows real-time BPM adjustment during playback

### Data Flow

1. User clicks a pad → `handlePadClick()` in App.tsx
2. `togglePad()` in App.tsx creates a new grid with toggled state
3. Grid state updates → re-renders all Pad components
4. Separately, sequencer callback fires on each 16th note → updates `currentStep` state
5. Current step affects visual styling (brightness-175) of pads
6. 16th notes (steps 1-3, 5-7, 9-11, 13-15) have brightness-135 for visual distinction
7. When user clicks Play, `initPlayers()` loads all audio samples asynchronously
8. Once samples are ready (or after timeout), sequencer starts and `onStep` callback updates UI

### Beat Name / Display Name Feature

Users can customize the beat name (Commit #18):

- Click the title to enter edit mode
- Type a new name (max 25 characters)
- Press Enter to save, Escape to cancel
- Default name: "TR-08"
- Name persists in component state during session

**Implementation:**

```typescript
const [beatName, setBeatName] = useState("TR-08");
const [isEditTitleActive, setIsEditTitleActive] = useState(false);

function getDisplayTitle(): JSX.Element {
  // Returns either input field or h1 heading based on isEditTitleActive
}
```

### Styling

- **Tailwind CSS v4** for all styling (via `@tailwindcss/vite` plugin)
- **Color mapping system**: Each track has a distinct Tailwind dark color
- **Device mockup**: Outer gray container simulates physical hardware aesthetic
- **Grid layout**: CSS Grid with 16 columns (`grid-cols-16`)
- **Custom font**: Stack Sans Notch (imported from Google Fonts)
- **Pad brightness states:**
  - Current playhead position: `brightness-175` (very bright)
  - 16th notes: `brightness-135` (slightly dimmed)
  - Active pads: `opacity-100`
  - Inactive pads: `opacity-50`
  - Hover: `opacity-80`

### Sequencer Timing & Playback

- BPM updates are applied in real-time during playback
- Transport is used to schedule note triggering at precise intervals
- Playback cycles through 16 steps, then repeats
- `gridRef.current` pattern ensures sequencer callback has access to latest grid state

## TypeScript Configuration

Strict mode is enabled (`"strict": true`). Key compiler options:

- Target: ES2022
- Module: ESNext
- JSX: react-jsx
- Linting rules enforce no unused locals/parameters
- No unchecked side effect imports
- `lib: ["ES2020", "DOM", "DOM.Iterable"]`

## Dependencies

- **`react@^19.1.1` & `react-dom@^19.1.1`**: UI framework
- **`tone@^15.1.22`**: For audio playback and timing
- **`tailwindcss@^4.1.16` & `@tailwindcss/vite@^4.1.16`**: Utility-first styling
- **`vite@^7.1.7`**: Build tool with React plugin
- **`typescript~5.9.3`**: Type safety
- **`eslint@^9.36.0` & `typescript-eslint`**: Code quality

## ESLint Configuration

Uses recommended configs for:

- ESLint base rules
- TypeScript ESLint (`typescript-eslint`)
- React Hooks (`eslint-plugin-react-hooks`)
- React Refresh (`eslint-plugin-react-refresh`)

## Development Notes

- **Module Imports for Audio**: Audio samples are imported as ES modules at the top of App.tsx, not fetched dynamically
- **Lazy Loading**: Players are initialized only on first play via `initPlayers()` to avoid blocking initial load
- **16-Step Sequencer**: The grid is 16 steps (not 8). Use `colIndex % 4 !== 0` to determine 16th note positions
- **Grid Updates**: Use `structuredClone()` to create immutable grid updates in `togglePad()`
- **Playhead Ref Pattern**: Use `gridRef.current` to pass fresh grid state to the sequencer callback
- **Color System**: Track colors are defined in the `tracks` array; add new colors by extending Tailwind color palette
- **BPM Bounds**: BPM is clamped between 40 and 300 to avoid timing issues
- **Error Handling**: Failed audio samples are logged but don't prevent sequencer startup

## File Structure

```text
src/
├── App.tsx                      # Main application, state management
├── sequencer.ts                 # Core timing engine (Tone.js Transport)
├── main.tsx                     # React entry point
├── App.css                      # App-specific styles
├── index.css                    # Global styles with Tailwind
├── components/
│   ├── Pad.tsx                  # Individual grid pad (16 columns × 10 rows)
│   ├── PlayStopBtn.tsx          # Play/Stop toggle button
│   ├── Button.tsx               # Reusable button component
│   └── TempoDisplay.tsx         # BPM display with +/- controls
├── assets/
│   ├── images/
│   │   └── MPC_mark.png         # TR-08 branding image
│   └── samples/                 # 10 audio WAV files (imported as modules)
│       ├── KICK01.wav, KICK02.wav
│       ├── Bass_Tone_C_013.wav, BASS01.wav
│       ├── Bh_Hit_Clap_0007.wav, JA_SNARE_2.wav
│       ├── Stabs_&_Chords_016_Dm.wav, Stabs_&_Chords_028_C.wav
│       └── Bh_Hit_Hihat_0008.wav, Bh_Hit_Hihat_0009.wav
```

## 🧠 Educational Persona: The Senior Mentor

Treat every interaction as a tutoring session for a visual learner with a
background in Film/TV production and Graphic Design. You are an expert who
double checks thing, you are skeptical and you do research. I'm not always right.
Neither are you, but we both strive for accuracy.

- **Concept First, Code Second:** Never provide a code snippet without first
  explaining the _pattern_ or _strategy_ behind it.
- **The "Why" and "How":** Explicitly explain _why_ a specific approach was chosen
  over alternatives and _how_ it fits into the larger architecture.
- **Analogy Framework:** Use analogies related to film sets, post-production
  pipelines, or design layers. (e.g., "The Database is the footage vault, the API
  is the editor, the Frontend is the theater screen").

## 🗣️ Explanation Style

- **Avoid Jargon:** If technical terms are necessary, define them immediately using plain language.
- **Visual Descriptions:** Describe code flow visually (e.g., "Imagine the data flowing like a signal chain on a soundboard").
- **Scaffolding:** When introducing complex logic, break it down into "scenes" or "beats" rather than a wall of text.

## 📚 The "FOR_ETHAN.md" Learning Log

Maintain a living document at `docs/FOR_ETHAN.md`.
Update this file significantly after every major feature implementation or refactor.

- **Structure:**
  1. **The Story So Far:** High-level narrative of the project.
  2. **Cast & Crew (Architecture):** How components talk to each other (using film analogies).
  3. **Behind the Scenes (Decisions):** Why we chose Stack X over Stack Y.
  4. **Bloopers (Bugs & Fixes):** Detailed breakdown of bugs, why they happened, and the logic used to solve them.
  5. **Director's Commentary:** Best practices and "Senior Engineer" mindset tips derived from the current work.
- **Tone:** Engaging, magazine-style, memorable. Not a textbook.
