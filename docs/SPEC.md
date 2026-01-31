# TR-08 v1.0: System Specification

**Status:** ✅ v1.2 IN PROGRESS (Global Swing + Drive Saturation) | **Version:** 1.2 | **Last Updated:** 2026-01-14 (PR #14: Soft-Clip Saturation & Master Drive Control)

---

## 1. Executive Summary & SLOs

### Context: "The Graffiti Wall"

TR-08 is a persistent, social drum machine. Users load the last published beat, remix it, and save a new version. **No friction. No silent audio.**

### Success Metrics (SLOs)

| Metric                        | Target  | Notes                                               |
| ----------------------------- | ------- | --------------------------------------------------- |
| **Time to Interactive (TTI)** | < 1.5s  | UI ready; audio samples can load async              |
| **Save Latency**              | < 30ms  | Insert `BeatManifest` into DB                       |
| **Load Latency**              | < 100ms | Fetch `ORDER BY created_at DESC LIMIT 1`            |
| **Beat Payload**              | < 5KB   | JSONB `data` column                                 |
| **Audio Context Resume**      | < 50ms  | Force `Tone.context.resume()` on first user gesture |

### Critical Guarantees

- **No Data Loss:** All grid/BPM changes serialize to `BeatManifest` before DB insert.
- **No Silent Playback:** Audio samples preload before Transport starts (with timeout fallback).
- **No Orphaned Users:** `on_auth_user_created` trigger ensures Profile row exists.
- **Schema Resilience:** Zod `safeParse` + schema versioning handle old data gracefully.

---

## 2. Architecture & Orchestration

### 2.1 The "Two Clocks" Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                         │
│              (Click, Drag, Input Events)                    │
└──────────┬──────────────────────────┬──────────────────────┘
           │                          │
           v                          v
   ┌───────────────┐          ┌──────────────────┐
   │  REACT CLOCK  │          │  AUDIO CLOCK     │
   │  (UI State)   │          │  (Tone.js)       │
   ├───────────────┤          ├──────────────────┤
   │ useState:     │          │ useRef:          │
   │ - grid[][]    │          │ - Players[]      │
   │ - bpm         │          │ - Transport      │
   │ - currentStep │          │ - Synth Voices   │
   │ - beatName    │          │                  │
   │               │          │ Precision: SR    │
   │ Precision:    │          │ (Sample Rate)    │
   │ ~16ms         │          │                  │
   └───────┬───────┘          └────────┬─────────┘
           │                           │
           └──────────┬────────────────┘
                      │
                      v
          ┌───────────────────────┐
          │  SUPABASE (persistent)│
          │  - beats (JSONB)      │
          │  - profiles           │
          └───────────────────────┘
```

**Data Flow:**

1. **User Input** → React State (immediate, debounced Save).
2. **React State** → Serialize to `BeatManifest` (on Save button).
3. **BeatManifest** → Validate (Zod) → Insert to `beats` table.
4. **Tone.js** → Reads `gridRef.current` on every 16th note step (tight loop, no re-renders).
5. **Load** → Fetch `beats` → `normalizeBeatData()` → Hydrate React State + Audio Context.

### 2.2 Directory Structure

```
src/
├── App.tsx                         # Main app, state orchestration
├── sequencer.ts                    # Tone.js Transport wrapper
├── main.tsx                        # React entry
├── index.css                       # Global Tailwind
├── App.css                         # App-specific styles
│
├── lib/                            # MOVED FROM utils/
│   ├── audioEngine.ts              # ✅ COMPLETED: Audio context, sample loading, playback
│   ├── beatUtils.ts                # ✅ COMPLETED: Serializers & transformers
│   └── utils.ts                    # ✅ COMPLETED (PR #12): cn() class merger for Shadcn
│
├── types/
│   ├── beat.ts                     # ✅ COMPLETED: BeatManifest, TrackID, Zod Schemas
│   └── database.ts                 # ✅ COMPLETED (PR #3): Supabase type definitions
│
├── config/
│   └── trackConfig.ts              # ✅ COMPLETED: TRACK_REGISTRY, SAMPLE_LIBRARY
│
├── db/                             # NEW: Drizzle ORM (schema management only)
│   ├── schema.ts                   # Generated schema from introspection
│   └── index.ts                    # Database client (scripts only)
│
├── hooks/                          # ✅ COMPLETED (PR #3)
│   ├── useAuth.ts                  # ✅ Session state, OAuth sign-in/out
│   ├── useSaveBeat.ts              # ✅ Debounced save with validation
│   └── useLoadBeat.ts              # ✅ Fetch + hydrate with normalization
│
├── components/
│   ├── Pad.tsx                     # Existing: grid pad
│   ├── Button.tsx                  # Existing: generic button
│   ├── PlayStopBtn.tsx             # Existing: play/stop toggle
│   ├── TempoDisplay.tsx            # Existing: BPM +/-
│   ├── Knob.tsx                    # ✅ COMPLETED (PR #13): Photorealistic knobs with variant prop (level/tone)
│   ├── TrackControls.tsx           # ✅ COMPLETED (PR #11): Channel strip with mute/solo/pitch/volume controls
│   ├── LoginModal.tsx              # ✅ COMPLETED (PR #4): Auth gateway (deprecated)
│   ├── LoginModalButton.tsx        # ✅ COMPLETED (PR #4): Modal with sign-in/out
│   ├── SaveButton.tsx              # ✅ COMPLETED (PR #4): Save with loading state
│   ├── LoadButton.tsx              # ✅ COMPLETED (PR #4): Load with loading state
│   ├── SkeletonGrid.tsx            # ✅ COMPLETED (PR #4): Loading placeholder (10x16)
│   ├── PortraitBlocker.tsx         # ✅ COMPLETED (PR #4): Mobile portrait overlay
│   ├── ErrorBoundary.tsx           # ✅ COMPLETED (PR #5): Crash protection & error UI
│   ├── BeatLibrary.tsx             # ✅ COMPLETED (PR #12): Beat library side panel with Shadcn UI
│   └── ui/                         # ✅ COMPLETED (PR #12): Shadcn UI component library
│       ├── sheet.tsx               # Dialog/Sheet component (Radix UI wrapper)
│       └── button.tsx              # CVA-based button component
│
│
└── assets/
    ├── samples/                    # 10x WAV files (unchanged)
    └── images/
        └── MPC_mark.png
```

**Note:** `src/utils/` has been removed. All utilities moved to `src/lib/`.

### 2.3 State Management Strategy

#### React State (`useState`)

**Purpose:** Visual representation, user input buffer.

```typescript
const [grid, setGrid] = useState<boolean[][]>([...]);
const [bpm, setBpm] = useState<number>(140);
const [currentStep, setCurrentStep] = useState<number>(0);
const [beatName, setBeatName] = useState<string>("TR-08");
const [isLoading, setIsLoading] = useState<boolean>(true);
const [session, setSession] = useState<Session | null>(null);
```

#### Audio Refs (`useRef`)

**Purpose:** Persistent audio objects, unaffected by React re-renders.

```typescript
const playersRef = useRef<Map<TrackID, Tone.Player>>(new Map());
const sequencerRef = useRef<ReturnType<typeof createSequencer> | null>(null);
const gridRef = useRef<boolean[][]>([...]);  // Snapshot for sequencer callback
const contextResumeRef = useRef<boolean>(false);  // One-time Audio Context resume
```

#### Key Principle

- **Audio never waits for React render cycles.** The sequencer reads `gridRef.current`, not `grid` state.
- **Grid state updates don't interrupt playback.** Sequencer callback is decoupled from state management.

---

## 3. State & Data Contracts

### 3.1 Type Definitions (TypeScript)

#### File: `src/types/beat.ts`

```typescript
/**
 * SEMANTIC TRACK IDENTIFIERS
 * These are the "DNA" of the drum machine.
 * Order-independent, version-resilient.
 */
export type TrackID =
  | "kick_01" // Row 0: KICK 01
  | "kick_02" // Row 1: KICK 02
  | "bass_01" // Row 2: BASS 01
  | "bass_02" // Row 3: BASS 02
  | "snare_01" // Row 4: SNARE 01
  | "snare_02" // Row 5: SNARE 02
  | "synth_01" // Row 6: SYNTH 01
  | "clap" // Row 7: CLAP
  | "hh_01" // Row 8: HH 01
  | "hh_02"; // Row 9: HH 02

/**
 * TRACK DATA (per drum sound)
 * Minimal, immutable representation.
 */
export interface TrackData {
  sampleId: string; // "KICK_01" - enables future sample swapping
  volumeDb: number; // -Infinity to 0; stored at 0.1dB precision
  mute: boolean; // Explicit mute flag
  solo: boolean; // Explicit solo flag
  steps: boolean[]; // 16 elements (length must be 16)
}

/**
 * BEAT MANIFEST (Root document)
 * The "Rosetta Stone" - converts between DB and UI.
 */
export interface BeatManifest {
  meta: {
    version: string; // "1.0.0" - enables schema migration
    engine: string; // "tone.js@15.1.22" (not hard constraint)
  };
  global: {
    bpm: number; // 40-300 inclusive
    swing: number; // 0.0-1.0; currently unused (future)
    masterVolumeDb: number; // -60 to +6 dB
  };
  tracks: Record<TrackID, TrackData>; // Dictionary pattern
}

/**
 * BEAT RECORD (Supabase row)
 * Database schema projection.
 */
export interface BeatRecord {
  id: string; // UUID
  user_id: string; // UUID (FK -> auth.users.id)
  beat_name: string; // Max 25 chars, sanitized
  data: BeatManifest; // JSONB column
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp (auto-updated via trigger)
}

/**
 * AUDIO CONTEXT STATE
 * Tracks AudioContext lifecycle.
 */
export interface AudioContextState {
  isResumed: boolean; // Has audio context been resumed?
  isLoading: boolean; // Are samples currently loading?
  loadedCount: number; // Number of successfully loaded samples
  failureReason?: string; // e.g., "AUTOPLAY_BLOCKED", "SAMPLE_LOAD_TIMEOUT"
}
```

### 3.2 Validation Schemas (Zod)

#### File: `src/types/beat.ts` (continued)

```typescript
import { z } from "zod";

/**
 * ZODINATOR (Schema-on-Read validation)
 * All external data must pass safeParse().
 */

// TrackID literal union
const TrackIDSchema = z.enum([
  "kick_01",
  "kick_02",
  "bass_01",
  "bass_02",
  "snare_01",
  "snare_02",
  "synth_01",
  "clap",
  "hh_01",
  "hh_02",
]);

// Individual track validation
const TrackDataSchema = z.object({
  sampleId: z.string().min(1).max(50),
  volumeDb: z.number().min(-Infinity).max(0),
  mute: z.boolean(),
  solo: z.boolean(),
  steps: z.array(z.boolean()).length(16),
});

// BeatManifest validation
export const BeatManifestSchema = z.object({
  meta: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    engine: z.literal("TR-08"),
  }),
  global: z.object({
    bpm: z.number().int().min(40).max(300),
    swing: z.number().min(0).max(1),
    masterVolumeDb: z.number().min(-Infinity).max(0),
  }),
  tracks: z.record(TrackIDSchema, TrackDataSchema),
});

/**
 * SAFETY CHECK (Runtime normalization)
 * Converts any BeatRecord.data to guaranteed valid BeatManifest.
 */
export function normalizeBeatData(data: unknown): BeatManifest {
  const result = BeatManifestSchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  // Fallback: Return default blank beat + log error
  console.error("[Zod Validation Failure]", result.error);
  return getDefaultBeatManifest();
}

/**
 * DEFAULT MANIFEST
 * Fallback for new sessions or validation failures.
 */
export function getDefaultBeatManifest(): BeatManifest {
  const defaultTracks: Record<TrackID, TrackData> = {
    kick_01: {
      sampleId: "KICK_01",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    kick_02: {
      sampleId: "KICK_02",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    bass_01: {
      sampleId: "BASS_TONE",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    bass_02: {
      sampleId: "BASS_01",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    snare_01: {
      sampleId: "CLAP_01",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    snare_02: {
      sampleId: "SNARE_02",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    synth_01: {
      sampleId: "STAB_DM",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    clap: {
      sampleId: "STAB_C",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    hh_01: {
      sampleId: "HAT_CLS",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
    hh_02: {
      sampleId: "HAT_OPN",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false),
    },
  };

  return {
    meta: { version: "1.0.0", engine: "tone.js@15.1.22" },
    global: { bpm: 140, swing: 0, masterVolumeDb: 0 },
    tracks: defaultTracks,
  };
}
```

### 3.3 Database Schema (SQL)

#### File: `supabase/migrations/01_init_schema.sql`

```sql
-- ============================================================================
-- TR-08 Database Schema Initialization
-- Migration: 01_init_schema.sql
-- Description: Creates profiles and beats tables with optimized RLS
-- ============================================================================

-- 1. Create PROFILES table (Needed for the Trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profile Policies (Optimized)
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);

-- ============================================================================

-- 2. Create BEATS table
CREATE TABLE IF NOT EXISTS public.beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beat_name TEXT NOT NULL CHECK (char_length(beat_name) <= 25 AND char_length(beat_name) >= 1),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beats_user_id ON public.beats(user_id);
CREATE INDEX IF NOT EXISTS idx_beats_updated_at ON public.beats(updated_at DESC);

-- Enable RLS on beats
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies (Optimized & PRD Compliant)
-- ============================================================================

-- Policy: Everyone can SEE beats (The Graffiti Wall)
CREATE POLICY "Beats are public to view"
  ON public.beats
  FOR SELECT
  USING (true);

-- Policy: Users can INSERT their own beats
-- Fix: Used (select auth.uid()) for performance
CREATE POLICY "Users can create their own beats"
  ON public.beats
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Policy: Users can UPDATE their own beats
-- Fix: Used (select auth.uid()) for performance
CREATE POLICY "Users can update their own beats"
  ON public.beats
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Policy: Users can DELETE their own beats
-- Fix: Used (select auth.uid()) for performance
CREATE POLICY "Users can delete their own beats"
  ON public.beats
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- TRIGGER: Auto-create Profile on Auth Signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplicates on re-runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_beats_updated_at ON public.beats;

CREATE TRIGGER update_beats_updated_at
  BEFORE UPDATE ON public.beats
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
```

---

## 4. Tool Contracts: Audio Engine

### 4.1 Track Registry

#### File: `src/config/trackConfig.ts`

```typescript
import { TrackID } from "../types/beat";
import KICK01 from "../assets/samples/KICK01.wav";
import KICK02 from "../assets/samples/KICK02.wav";
import Bass_Tone_C_013 from "../assets/samples/Bass_Tone_C_013.wav";
import BASS01 from "../assets/samples/BASS01.wav";
import Bh_Hit_Clap_0007 from "../assets/samples/Bh_Hit_Clap_0007.wav";
import JA_SNARE_2 from "../assets/samples/JA_SNARE_2.wav";
import Stabs_Chords_016_Dm from "../assets/samples/Stabs_&_Chords_016_Dm.wav";
import Stabs_Chords_028_C from "../assets/samples/Stabs_&_Chords_028_C.wav";
import Bh_Hit_Hihat_0008 from "../assets/samples/Bh_Hit_Hihat_0008.wav";
import Bh_Hit_Hihat_0009 from "../assets/samples/Bh_Hit_Hihat_0009.wav";

/**
 * TRACK REGISTRY
 * Maps Semantic TrackID -> Sample URL + UI Row Index.
 *
 * CONTRACT:
 * - Every TrackID MUST have an entry.
 * - rowIndex must match the UI grid row order (0-9).
 * - sampleId must exist in SAMPLE_LIBRARY.
 */
interface TrackConfig {
  trackId: TrackID;
  rowIndex: number; // 0-9 (UI grid row)
  label: string; // Display name
  sampleId: string; // e.g., "KICK_01"
  color: string; // Tailwind class (e.g., "bg-blue-600")
}

interface SampleLibrary {
  [key: string]: string; // sampleId -> URL
}

export const SAMPLE_LIBRARY: SampleLibrary = {
  KICK_01: KICK01,
  KICK_02: KICK02,
  BASS_TONE: Bass_Tone_C_013,
  BASS_01: BASS01,
  CLAP: Bh_Hit_Clap_0007,
  SNARE_02: JA_SNARE_2,
  STAB_DM: Stabs_Chords_016_Dm,
  STAB_C: Stabs_Chords_028_C,
  HAT_CLS: Bh_Hit_Hihat_0008,
  HAT_OPN: Bh_Hit_Hihat_0009,
};

export const TRACK_REGISTRY: TrackConfig[] = [
  {
    trackId: "kick_01",
    rowIndex: 0,
    label: "KICK 01",
    sampleId: "KICK_01",
    color: "bg-red-900",
  },
  {
    trackId: "kick_02",
    rowIndex: 1,
    label: "KICK 02",
    sampleId: "KICK_02",
    color: "bg-red-900",
  },
  {
    trackId: "bass_01",
    rowIndex: 2,
    label: "BASS 01",
    sampleId: "BASS_TONE",
    color: "bg-orange-800",
  },
  {
    trackId: "bass_02",
    rowIndex: 3,
    label: "BASS 02",
    sampleId: "BASS_01",
    color: "bg-orange-800",
  },
  {
    trackId: "snare_01",
    rowIndex: 4,
    label: "SNARE 01",
    sampleId: "CLAP",
    color: "bg-yellow-800",
  },
  {
    trackId: "snare_02",
    rowIndex: 5,
    label: "SNARE 02",
    sampleId: "SNARE_02",
    color: "bg-yellow-800",
  },
  {
    trackId: "synth_01",
    rowIndex: 6,
    label: "SYNTH 01",
    sampleId: "STAB_DM",
    color: "bg-yellow-900",
  },
  {
    trackId: "clap",
    rowIndex: 7,
    label: "CLAP",
    sampleId: "STAB_C",
    color: "bg-yellow-900",
  },
  {
    trackId: "hh_01",
    rowIndex: 8,
    label: "HH 01",
    sampleId: "HAT_CLS",
    color: "bg-orange-950",
  },
  {
    trackId: "hh_02",
    rowIndex: 9,
    label: "HH 02",
    sampleId: "HAT_OPN",
    color: "bg-orange-950",
  },
];

/**
 * LOOKUP FUNCTIONS
 */
export function getTrackConfig(trackId: TrackID): TrackConfig {
  const config = TRACK_REGISTRY.find((t) => t.trackId === trackId);
  if (!config) throw new Error(`Unknown TrackID: ${trackId}`);
  return config;
}

export function getSampleUrl(sampleId: string): string {
  const url = SAMPLE_LIBRARY[sampleId];
  if (!url) throw new Error(`Unknown SampleID: ${sampleId}`);
  return url;
}
```

### 4.2 Signal Logic (Audio Volume Calculation)

**CRITICAL:** Distinguish between **Raw Volume** (stored in manifest) and **Effective Volume** (calculated at playback).

- **Raw Volume (`volumeDb`):** The knob position stored in `BeatManifest.tracks[trackId].volumeDb`. Always -∞ to +6 dB.
- **Effective Volume:** Calculated at playback time via `calculateEffectiveVolume()`. Accounts for mute/solo/master volume and returns -∞ if muted.
- **Why This Matters:** When loading beats, `toGridArray()` must return **raw volume** (not effective), else muted tracks will display as -Infinity and corrupt the UI state.
- **Prevention:** Always use `trackData.volumeDb` directly; never call `calculateEffectiveVolume()` during load/save.

#### File: `src/lib/beatUtils.ts` (Audio Calculation)

```typescript
import { BeatManifest, TrackID } from "../types/beat";

/**
 * AUDIO SIGNAL HIERARCHY (Precedence Rules)
 *
 * CONTRACT: This function MUST be called once per 16th note step
 * to calculate the effective volume for every track.
 *
 * Precedence (highest to lowest):
 * 1. Mute: If ON → Volume = -Infinity (SILENT)
 * 2. Solo: If ANY track has Solo ON
 *         └─ If current track Solo ON  → Use knob volume
 *         └─ If current track Solo OFF → Volume = -Infinity (SILENT)
 * 3. Normal: All tracks play at knob volume
 */

export function calculateEffectiveVolume(
  manifest: BeatManifest,
  trackId: TrackID,
  currentStep: number,
): number {
  const trackData = manifest.tracks[trackId];

  if (!trackData) {
    return -Infinity; // Track not found
  }

  // RULE 1: Mute defeats everything
  if (trackData.mute) {
    return -Infinity;
  }

  // RULE 2: Check if ANY track has Solo enabled
  const anySoloActive = Object.values(manifest.tracks).some((t) => t.solo);

  if (anySoloActive) {
    // In Solo mode: play only if this track is soloed
    if (!trackData.solo) {
      return -Infinity; // Track is not soloed; mute it
    }
  }

  // RULE 3: Normal mode (no solo) or this track is soloed
  // Apply knob volume + master volume
  const trackVolume = trackData.volumeDb;
  const masterVolume = manifest.global.masterVolumeDb;

  // Sum dB values (multiplication in linear scale)
  return trackVolume + masterVolume;
}

/**
 * GRID-TO-MANIFEST CONVERTER
 * Transforms the React Grid (10x16 array) → Semantic BeatManifest.
 *
 * CONTRACT:
 * - grid[trackIndex][stepIndex] corresponds to TRACK_REGISTRY[trackIndex]
 * - stepIndex is 0-15 (16 steps)
 */
export function toManifest(
  grid: boolean[][],
  bpm: number,
  beatName: string,
  trackVolumes: Record<TrackID, number>,
): BeatManifest {
  const { TRACK_REGISTRY } = require("../config/trackConfig");

  const tracks: Record<TrackID, any> = {};

  TRACK_REGISTRY.forEach((config: any, index: number) => {
    const trackId = config.trackId as TrackID;
    tracks[trackId] = {
      sampleId: config.sampleId,
      volumeDb: trackVolumes[trackId] || -6,
      mute: false,
      solo: false,
      steps: grid[index] || Array(16).fill(false),
    };
  });

  return {
    meta: { version: "1.0.0", engine: "TR-08" },
    global: { bpm, swing: 0, masterVolumeDb: 0 },
    tracks,
  };
}

/**
 * MANIFEST-TO-GRID CONVERTER
 * Transforms Semantic BeatManifest → React Grid + ancillary state.
 *
 * CONTRACT:
 * - Output grid[trackIndex][stepIndex] where trackIndex matches TRACK_REGISTRY order
 * - Returns { grid, bpm, beatName, trackVolumes }
 */
export function toGridArray(manifest: BeatManifest): {
  grid: boolean[][];
  bpm: number;
  beatName: string;
  trackVolumes: Record<TrackID, number>;
} {
  const { TRACK_REGISTRY } = require("../config/trackConfig");

  const grid: boolean[][] = [];
  const trackVolumes: Record<TrackID, number> = {};

  TRACK_REGISTRY.forEach((config: any, index: number) => {
    const trackId = config.trackId as TrackID;
    const trackData = manifest.tracks[trackId];

    if (trackData) {
      grid[index] = trackData.steps;
      trackVolumes[trackId] = trackData.volumeDb;
    } else {
      grid[index] = Array(16).fill(false);
      trackVolumes[trackId] = -6;
    }
  });

  return {
    grid,
    bpm: manifest.global.bpm,
    beatName: "Loaded Beat", // Placeholder; fetch from beats.name
    trackVolumes,
  };
}
```

### 4.3 Audio Context & Player Initialization

#### File: `src/lib/audioEngine.ts`

**Master Effects Chain Initialization** (PR #2, Enhanced in PR #14):

````typescript
let masterChannel: Tone.Channel | null = null;
let driveGain: Tone.Gain | null = null;
let softClipper: Tone.WaveShaper | null = null;
let outputComp: Tone.Gain | null = null;
let masterCompressor: Tone.Compressor | null = null;
let masterLimiter: Tone.Limiter | null = null;

const BYPASS_MASTER_EFFECTS = false; // DEBUG flag

/**
 * Initializes the master effects chain: Channel -> DriveGain -> SoftClipper -> OutputComp -> Compressor -> Limiter -> Destination
 * PR #14: Added soft-clip saturation for warm, analog-style master drive control
 * Chain order: Drive signal into soft clipper, then compress for dynamics control, finally limit for safety
 */
function initializeMasterEffects(): void {
  // Soft clipper: WaveShaper with sigmoid curve (tanh) for smooth saturation
  softClipper = new Tone.WaveShaper((x) => Math.tanh(x), 4096);

  // Input gain: controls how much signal drives into the soft clipper (unity default)
  driveGain = new Tone.Gain(1);

  // Output compensation: maintains consistent volume across drive range
  outputComp = new Tone.Gain(1);

  // Compressor: 8:1 ratio, -12dB threshold, 5ms attack, 70ms release
  masterCompressor = new Tone.Compressor({
    threshold: -12,
    ratio: 8,
    attack: 0.005,
    release: 0.07,
  });

  // Limiter: -4dB ceiling safety net
  masterLimiter = new Tone.Limiter(-4);

  // Wire: Channel -> DriveGain -> SoftClipper -> OutputComp -> Compressor -> Limiter -> Destination
  driveGain.connect(softClipper);
  softClipper.connect(outputComp);
  outputComp.connect(masterCompressor);
  masterCompressor.connect(masterLimiter);
  masterLimiter.toDestination();
  masterChannel.connect(driveGain);
}

**PR #14: Master Drive Control:**

```typescript
/**
 * Maps 0-100% knob to 1.0-4.0 gain (+0 to +12dB into soft clipper)
 * Auto-compensates output to maintain consistent volume
 */
export function setMasterDrive(percent: number): void {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const driveGainValue = 1 + (clampedPercent / 100) * 3; // 1.0-4.0 range
  driveGain.gain.value = driveGainValue;
  outputComp.gain.value = 1 / driveGainValue; // Inverse compensation
}
````

**Audio Context Resume & Sample Loading** (PR #2, Enhanced in PR #6):

```typescript
/**
 * Resumes the Tone.js audio context.
 * Must be called in response to a user gesture (e.g., Play button click).
 *
 * CONTRACT:
 * - Call this BEFORE starting the Transport
 * - Browser autoplay policy requires user interaction
 * - Returns true if audio context is running, false otherwise
 */
export async function resumeAudioContext(): Promise<boolean> {
  try {
    if (Tone.context.state !== "running") {
      await Tone.context.resume();
    }
    return Tone.context.state === "running";
  } catch (err) {
    console.error("[AudioContext Resume Failed]", err);
    return false;
  }
}

/**
 * Result object for audio sample loading (PR #6 Enhancement)
 */
export interface LoadAudioResult {
  players: Map<TrackID, Tone.Player>;
  failedTrackIds: TrackID[];
}

/**
 * BULLETPROOF Audio Loading (PR #6 Complete)
 *
 * CONTRACT:
 * - ALWAYS returns valid LoadAudioResult - NEVER throws, NEVER hangs
 * - Individual Timeout: Each track has 2-second timeout
 * - Global Timeout: 20-second failsafe for entire operation
 * - Partial Success: Returns loaded tracks even if some fail
 * - Idempotent: Safe to call multiple times
 * - Does NOT start Transport; only prepares players
 * - All players connect to master channel effects chain
 *
 * PR #5: Added 10-second timeout with Promise.race
 * PR #6: Upgraded to bulletproof pattern with individual timeouts, failedTrackIds tracking
 *
 * @param manifest - Beat manifest containing track data
 * @param onLoadProgress - Optional callback for tracking load progress (loaded, total)
 * @returns Promise<LoadAudioResult> - Loaded players and failed track IDs
 */
export async function loadAudioSamples(
  manifest: BeatManifest,
  onLoadProgress?: (loaded: number, total: number) => void,
): Promise<LoadAudioResult> {
  const players = new Map<TrackID, Tone.Player>();
  const loadedTracks = new Set<TrackID>();
  const failedTracks = new Set<TrackID>();
  let loadedCount = 0;
  const totalTracks = TRACK_REGISTRY.length;

  const INDIVIDUAL_TIMEOUT_MS = 2000; // 2 seconds per track
  const GLOBAL_TIMEOUT_MS = 20000; // 20 seconds total

  // Guaranteed no-throw loading logic
  const loadAllTracks = async (): Promise<void> => {
    const loadPromises = TRACK_REGISTRY.map(async (config) => {
      const trackId = config.trackId;
      const trackData = manifest.tracks[trackId];

      if (!trackData) {
        loadedCount++;
        onLoadProgress?.(loadedCount, totalTracks);
        return;
      }

      try {
        const sampleUrl = getSampleUrl(trackData.sampleId);
        if (!sampleUrl) {
          console.error(
            `[Sample URL Not Found] ${trackId}: ${trackData.sampleId}`,
          );
          failedTracks.add(trackId);
          loadedCount++;
          onLoadProgress?.(loadedCount, totalTracks);
          return;
        }

        // Connect player to master channel effects chain
        const player = new Tone.Player(sampleUrl).connect(getMasterChannel());

        // Individual 2-second timeout per track
        await withTimeout(
          player.load(sampleUrl),
          INDIVIDUAL_TIMEOUT_MS,
          `Track ${trackId} load timeout (${INDIVIDUAL_TIMEOUT_MS}ms)`,
        );

        players.set(trackId, player);
        loadedTracks.add(trackId);
        loadedCount++;
        onLoadProgress?.(loadedCount, totalTracks);
      } catch (err) {
        console.error(`[Sample Load Failed] ${trackId}:`, err);
        failedTracks.add(trackId);
        loadedCount++;
        onLoadProgress?.(loadedCount, totalTracks);
      }
    });

    await Promise.allSettled(loadPromises);
  };

  // Global timeout failsafe
  const globalTimeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn(
        `[Audio Engine] Global timeout reached (${GLOBAL_TIMEOUT_MS}ms). Proceeding with partial load.`,
      );
      resolve();
    }, GLOBAL_TIMEOUT_MS);
  });

  try {
    await Promise.race([loadAllTracks(), globalTimeoutPromise]);
  } catch (err) {
    console.error("[Audio Engine] Unexpected error during load:", err);
  }

  // Mark any manifest track not explicitly loaded as failed
  const failedTrackIds: TrackID[] = [];
  for (const config of TRACK_REGISTRY) {
    const trackId = config.trackId;
    const trackData = manifest.tracks[trackId];
    if (trackData && !loadedTracks.has(trackId)) {
      failedTrackIds.push(trackId);
    }
  }

  console.log(
    `[Audio Engine] Load complete: ${loadedTracks.size} loaded, ${failedTrackIds.length} failed`,
  );

  return { players, failedTrackIds };
}

/**
 * PLAY TRACK (Trigger a single sample)
 *
 * CONTRACT:
 * - Called once per 16th note step if the grid[trackIndex][step] is true
 * - Checks effective volume using the Mute > Solo > Knob hierarchy
 * - Idempotent per step (safe to call multiple times for same step)
 */
export function playTrack(
  player: Tone.Player | undefined,
  effectiveVolume: number,
  now: number,
): void {
  if (!player) return;
  if (effectiveVolume === -Infinity) return; // Muted

  try {
    player.volume.value = effectiveVolume;
    player.start(now);
  } catch (err) {
    console.error("[Playback Error]", err);
  }
}
```

### 4.4 Spectrum Analyzer Integration

#### File: `src/components/Analyzer.tsx`

**Purpose:** Real-time audio spectrum visualization using AudioMotionAnalyzer library.

**Critical Implementation Detail (PR #2 Fix):**

The AudioMotionAnalyzer must be configured with `connectSpeakers: false` to prevent creating a duplicate audio path to the speakers. Without this setting, the analyzer would create two independent output paths:

1. `Channel → Limiter → Destination` (correct)
2. `Channel → Analyzer → Destination` (duplicate - causes phasing)

When both stereo signals reach the speakers independently, they can cause phase cancellation and audio artifacts.

```typescript
const analyzer = new AudioMotionAnalyzer(containerRef.current, {
  audioCtx: Tone.context.rawContext._nativeContext,
  connectSpeakers: false, // CRITICAL: Prevent duplicate audio path
  mode: 2, // 1/12th octave bands
  barSpace: 0.6, // Space between bars
  ledBars: true, // LED-style visual bars
});

const masterChannel = getMasterChannel();

// Connect analyzer input to the native audio node of master channel
const gainWrapper = (masterChannel as any).output.output.output.input;
const nativeNode = gainWrapper._nativeAudioNode as AudioNode;
analyzer.connectInput(nativeNode);
```

**Signal Flow:**

```
All Tone.Player Instances
          ↓
    getMasterChannel()
          ↓
    [Master Effects Chain]
    Compressor (8:1) → Limiter (-4dB)
          ↓
    Split Point:
    ├─ To Destination (speakers) [PRIMARY]
    └─ To Analyzer Input (spectrum visualization) [ANALYSIS ONLY]
```

**Why This Matters:**

- **No Duplicate Audio Path:** The analyzer taps into the audio chain as a listener, not as a router
- **Correct Master Level:** All volume calculations and effects apply uniformly
- **No Phasing Issues:** Stereo signals reach speakers through a single path
- **PR #2 Discovery:** This fix resolved phasing/reverb effects that appeared when both compressor and limiter were active

### 4.5 Pitch Control & Accent Notes (v1.1 Features)

#### Pitch Shifting Implementation

**File:** `src/lib/audioEngine.ts:playTrack()` and `src/sequencer.ts`

Pitch shifting is implemented using playback rate modulation. The formula converts musical semitones to linear playback rate:

```
playbackRate = 2^(semitones / 12)
```

**Examples:**

- Pitch +12 semitones = playbackRate 2.0 (one octave higher, double speed)
- Pitch +5 semitones = playbackRate 1.335 (perfect fourth higher)
- Pitch 0 semitones = playbackRate 1.0 (original pitch)
- Pitch -12 semitones = playbackRate 0.5 (one octave lower, half speed)

**Range:** -12 to +12 semitones (2 octaves of pitch bend)

**Integration:** The sequencer reads `manifest.tracks[trackId].pitch` and applies it in `playTrack()` via `player.playbackRate = rate`.

#### Accent/Ghost Notes Implementation

**File:** `src/lib/beatUtils.ts:calculateEffectiveVolume()` and `src/sequencer.ts`

Accents (ghost notes) reduce a track's volume by 7 dB for specific steps. This creates syncopated rhythms without adding new tracks.

**Volume Formula:**

```
effectiveVolume = trackVolume + masterVolume + (isAccented ? -7 : 0)
```

**Step Resolution:** Each track has a 16-element boolean array (`accents[]`) corresponding to 16 steps. When a step is marked as accented, playback volume drops 7 dB (perceptually ~half as loud).

**3-State Pad Interaction (UI):**

- **OFF:** Opacity 20 (not active)
- **ON (Normal):** Opacity 100 (full volume)
- **ON (Ghost/Accent):** Opacity 50 (7 dB reduction)
- Cycling: `OFF → ON → Ghost → OFF`

**Control:** Accent state stored in `manifest.tracks[trackId].accents[stepIndex]`, toggled by clicking pads multiple times.

#### Type Updates (v1.1)

```typescript
interface TrackData {
  sampleId: string; // Unchanged
  volumeDb: number; // Unchanged
  mute: boolean; // Unchanged
  solo: boolean; // Unchanged
  steps: boolean[]; // Unchanged
  pitch: number; // NEW: -12 to +12 semitones
  accents: boolean[]; // NEW: 16-step accent pattern
}
```

**Backward Compatibility:** The `normalizeBeatData()` function auto-migrates v1.0 beats by injecting default values: `pitch: 0`, `accents: Array(16).fill(false)`.

#### Mute/Solo Control (v1.2 Features)

**File:** `src/components/TrackControls.tsx` (UI) and `src/lib/beatUtils.ts:calculateEffectiveVolume()` (Logic)

Per-track mute and solo buttons provide signal control. Mute silences a track unconditionally; Solo isolates tracks (only solo'd tracks play when any track is soloed).

**Signal Hierarchy (Precedence):**

```
1. Mute (highest priority)    → Volume = -∞ (SILENT)
2. Solo (if any active)       → Non-solo tracks = -∞
3. Normal Volume              → Use knob value + Master volume
```

**UI Implementation (TrackControls):**

- **Mute Button:** 25px height, 30px width, red when active (#B43131), dark gray when inactive (#504F4F)
- **Solo Button:** 25px height, 30px width, amber when active (#B49531), dark gray when inactive (#504F4F)
- Both buttons rendered via `onMuteToggle()` and `onSoloToggle()` handlers in `App.tsx`

**Data Persistence:** Mute/Solo states stored in `BeatManifest.tracks[trackId].mute` and `.solo` (boolean), persisted during save/load cycles.

**Playback Integration:** The sequencer calls `calculateEffectiveVolume(manifest, trackId, isAccented)` every 16th note step. The function returns -Infinity if the track is muted or should be silenced by solo logic.

### 4.6 Photorealistic Knobs (v1.2 Feature)

**File:** `src/components/Knob.tsx`

Knobs are rendered as rotated PNG assets (VOLUME_KNOB.png and TONE_KNOB.png) instead of CSS-drawn circles. The variant prop determines which asset to display.

**Implementation:**

```typescript
type KnobProps = {
  variant?: "level" | "tone"; // "level" uses orange VOLUME_KNOB.png, "tone" uses cream TONE_KNOB.png
  // ... other props
};
```

**Rendering:**

- Select asset: `const knobImage = variant === "tone" ? pitchKnob : volumeKnob`
- Render: `<img src={knobImage} style={{ transform: rotate(${renderKnob}deg) }} />`
- Size: 28px × 28px (fits snugly in 25px track controls)
- Rotation: Calculated via existing angle logic (MIN_ROTATION_ANGLE=10, MAX_ROTATION_ANGLE=256)

**Drag Interaction:** Unchanged from v1.1. Dragging up/down updates value; angle recomputes in real-time.

---

## 5. Data & Security Annex

### 5.1 Row-Level Security (RLS) Policies

**Already defined in Section 3.3.** Summary:

- **Profiles:** Public read, authenticated users can write own profile.
- **Beats:** Public read, authenticated users can write own beats.

### 5.2 Sanitization & Content Moderation

#### File: `src/utils/profanityFilter.ts`

```typescript
/**
 * CLIENT-SIDE PROFANITY FILTER
 *
 * CONTRACT:
 * - Runs BEFORE Save button is enabled.
 * - Soft block: UI prompts user to choose cleaner name.
 * - Flagged words: Maintained in external JSON (allows hot updates).
 */

const PROFANITY_LIST = [
  "badword1",
  "badword2",
  "badword3", // Placeholder
  // In production: fetch from CDN or use npm package
];

export function isSanitized(beatName: string): {
  clean: boolean;
  reason?: string;
} {
  const trimmed = beatName.trim().toLowerCase();

  // Check length
  if (trimmed.length === 0) {
    return { clean: false, reason: "Name cannot be empty" };
  }
  if (trimmed.length > 50) {
    return { clean: false, reason: "Name too long (max 50 chars)" };
  }

  // Check profanity
  for (const word of PROFANITY_LIST) {
    if (trimmed.includes(word.toLowerCase())) {
      return { clean: false, reason: "Name contains inappropriate content" };
    }
  }

  return { clean: true };
}
```

### 5.3 Schema-on-Read & Version Migration

#### File: `src/lib/beatUtils.ts` (continued)

```typescript
/**
 * SCHEMA MIGRATION (Future-proofing)
 *
 * CONTRACT:
 * - All BeatManifest.meta.version must be "1.0.0" for TR-08 v1.
 * - If version mismatch: Log warning, apply defaults for missing fields.
 * - No data loss: Old fields are preserved in "unknown" namespace (not used).
 */
export function migrateSchema(data: any): BeatManifest {
  const result = BeatManifestSchema.safeParse(data);

  if (result.success) {
    // Exact version match; no migration needed
    return result.data;
  }

  // Fallback: Return blank beat + log the validation error
  console.warn(
    "[Schema Migration] Validation failed, using defaults",
    result.error,
  );
  return getDefaultBeatManifest();
}
```

---

## 6. Failure Modes & Degradation

### 6.1 Audio Context Suspension — PR #6 ENHANCED

**Implementation:** `src/lib/audioEngine.ts` (Master effects + bulletproof loading)

| Scenario                                        | Handling                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| AudioContext blocked by browser autoplay policy | Prompt user: "Click PLAY to start audio"                                      |
| AudioContext resume fails (timeout)             | Log error, disable playback, show alert                                       |
| Individual sample load timeout (>2s)            | Mark track as failed, continue loading other tracks (PR #6)                   |
| Global audio load timeout (>20s)                | Resolve Promise with partial load, allow playback of loaded samples (PR #6)   |
| Failed samples                                  | Return `failedTrackIds` array, app shows which tracks are unavailable (PR #6) |
| Network slowdown                                | Individual 2s timeout per track prevents cascade failure (PR #6)              |

**Bulletproof Loading Architecture (PR #6):**

```typescript
// Individual 2-second timeout per track
const INDIVIDUAL_TIMEOUT_MS = 2000; // Prevents single slow track from blocking others

// Global 20-second failsafe
const GLOBAL_TIMEOUT_MS = 20000; // Ensures operation completes eventually

// Returns both players AND failed track IDs
export interface LoadAudioResult {
  players: Map<TrackID, Tone.Player>;
  failedTrackIds: TrackID[]; // Explicit failure tracking
}
```

**Key Guarantees (PR #6):**

- The app **NEVER hangs** on audio load (20s global timeout)
- The app **NEVER throws** from audio load (wrapped in try-catch)
- Individual track failures **DO NOT block** other tracks (2s individual timeouts)
- Partial success is **VALID state** (8/10 samples acceptable)
- Failed samples are **TRACKED and reported** for UI feedback
- Worst case: partial playback with known failures (not silent crash)

### 6.2 Network & Database Failures

| Scenario                   | Handling                                            |
| -------------------------- | --------------------------------------------------- |
| Save fails (DB down)       | Debounce → Retry (exponential backoff, max 3x)      |
| Load fails (fetch timeout) | Show Skeleton, then Blank Beat + error toast        |
| Auth fails (Supabase down) | Show login modal indefinitely; allow guest playback |

### 6.3 Mobile Responsiveness

**Portrait Mode (<768px):**

✅ **COMPLETED (PR #4):** See `src/components/PortraitBlocker.tsx`

The PortraitBlocker component:

- Uses `window.matchMedia("(orientation: portrait) and (max-width: 768px)")`
- Returns `null` in landscape mode (does not render)
- Shows fixed full-screen overlay (`z-50`) with black background (`bg-black`)
- Displays "Please Rotate Your Device to Play" message centered on screen
- Implements `MediaQueryList` listener for orientation changes
- Prevents interaction with grid until device is rotated to landscape

### 6.4 Visibility Change (Background Throttling) — PR #5 COMPLETE

**Implementation:** `src/App.tsx` (L321-340), `src/sequencer.ts` (L124-128)

```typescript
// In App.tsx useEffect:
const isPageHiddenRef = useRef(false);

useEffect(() => {
  const handleVisibilityChange = () => {
    isPageHiddenRef.current = document.hidden;
    console.log(`[App] Page visibility changed: hidden=${document.hidden}`);

    // When page becomes visible again, sync the playhead to current transport position
    if (!document.hidden && createSequencerRef.current) {
      const position = Tone.Transport.position;
      console.log(`[App] Page visible, syncing playhead to ${position}`);
      // The sequencer's onStep callback will update the UI on the next step
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}, []);
```

**Sequencer Integration:**

```typescript
// In sequencer.ts onStep callback:
Tone.Draw.schedule(() => {
  if (!isPageHiddenRef?.current) {
    onStep(stepToPlay);
  }
}, time);
```

**Behavior:**

- When `document.hidden === true`: Audio continues playing, but React UI updates (setCurrentStep) are suspended
- When `document.hidden === false`: UI resync happens on next sequencer step, no jank
- Audio playback is unaffected; only visual feedback is throttled

---

## 7. PR Delivery Roadmap

### Philosophy

Each PR is **atomic, reviewable, and deployable**. No partial implementations. Each PR must have clear "Definition of Done" and should include tests (unit or integration as appropriate).

---

### PR #22: Test Environment & Static Components ✅ COMPLETE

**Scope:** Test infrastructure setup and testing two static UI components.
**Delivered:** 2026-01-30 | **Effort:** 2-3 hours | **Complexity:** Low

#### Deliverables

- **vite.config.ts:** Integrated Vitest config with `environment: 'happy-dom'`, globals enabled, setupFiles pointing to src/test/setup.ts.
- **src/test/setup.ts:** Imports `@testing-library/jest-dom` to extend matchers (`.toBeInTheDocument()`, `.toHaveClass()`, etc.).
- **src/components/**tests**/SkeletonGrid.test.tsx:** Tests that the component renders 160 skeleton pads with `animate-pulse` class.
- **src/components/**tests**/PortraitBlocker.test.tsx:** Tests that the component renders text and overlay with ARIA role/label. Includes `window.matchMedia` mock (critical for happy-dom).
- **Documentation:** `TESTING_TUTORIAL.md` and `FOR_ETHAN.md` updated with test patterns, regex flags, and query preferences.

**Test Results:** ✅ 3 test files, 39 tests passing.

#### Key Patterns Established

1. **Query Preference:** `getByRole > getByText > getByTestId` (accessibility-first testing)
2. **Browser API Mocking:** `window.matchMedia` mock pattern for conditional rendering tests
3. **Regex Flags:** Case-insensitive matching with `/pattern/i` for resilient text queries
4. **Component Test Structure:** AAA pattern (Arrange, Act, Assert) with `beforeEach` setup

---

### PR #1: The Foundation (Types, Validation, DB Setup)

**Scope:** Zero UI changes. Types, schemas, and DB infrastructure only.
**Effort:** 2-3 hours | **Complexity:** Low

#### Files to Touch

```
src/types/beat.ts                 (new)
src/config/trackConfig.ts         (new)
src/lib/beatUtils.ts              (new - transformers only)
src/utils/profanityFilter.ts      (new)
supabase/migrations/01_init_schema.sql (new)
package.json                       (add: zod)
```

#### Definition of Done

- [ ] Zod schemas compile without errors.
- [ ] All TrackID types pass validation.
- [ ] `normalizeBeatData()` handles invalid input gracefully (returns default).
- [ ] `toManifest()` and `toGridArray()` are symmetric (round-trip test).
- [ ] SQL migrations run against local Supabase dev environment.
- [ ] RLS policies are enforced (verified via psql).
- [ ] No breaking changes to existing App.tsx.

#### Testing

```typescript
// types/__tests__/beat.test.ts
describe("BeatManifest", () => {
  test("normalizeBeatData handles invalid input", () => {
    const result = normalizeBeatData({ invalid: "data" });
    expect(result).toEqual(getDefaultBeatManifest());
  });

  test("toManifest and toGridArray are symmetric", () => {
    const grid = [[true, false, ...], ...];
    const manifest = toManifest(grid, 140, "Test", {});
    const { grid: roundTrip } = toGridArray(manifest);
    expect(roundTrip).toEqual(grid);
  });
});
```

---

### PR #2: Audio Engine Refactor (Registry & Signal Logic)

**Scope:** Replace hardcoded audio logic with Registry + Signal Hierarchy.
**Effort:** 3-4 hours | **Complexity:** Medium

#### Files to Touch

```
src/lib/audioEngine.ts            (new)
src/sequencer.ts                  (refactor: use calculateEffectiveVolume)
src/App.tsx                        (update: call resumeAudioContext on Play)
```

#### Definition of Done

- [ ] `resumeAudioContext()` is called BEFORE `sequencer.start()`.
- [ ] `loadAudioSamples()` initializes all 10 Tone.Player instances.
- [ ] `calculateEffectiveVolume()` respects Mute > Solo > Volume hierarchy.
- [ ] Sequencer callback uses `playTrack()` with effective volume.
- [ ] All existing playback tests pass (audio output unchanged).
- [ ] Error handling: failed samples don't block sequencer.

#### Testing

```typescript
// lib/__tests__/audioEngine.test.ts
describe("calculateEffectiveVolume", () => {
  test("Mute defeats Solo", () => {
    const manifest = {
      tracks: { kick_01: { mute: true, solo: true, ... } }
    };
    const vol = calculateEffectiveVolume(manifest, "kick_01", 0);
    expect(vol).toBe(-Infinity);
  });

  test("Solo isolation works correctly", () => {
    const manifest = {
      tracks: {
        kick_01: { mute: false, solo: true, volumeDb: -3 },
        kick_02: { mute: false, solo: false, volumeDb: -3 }
      }
    };
    expect(calculateEffectiveVolume(manifest, "kick_01", 0)).toBe(-3);
    expect(calculateEffectiveVolume(manifest, "kick_02", 0)).toBe(-Infinity);
  });
});
```

---

### PR #3: The Pipes (Supabase Auth & Save/Load Hooks)

**Scope:** Authentication + data persistence (Save/Load).
**Effort:** 4-5 hours | **Complexity:** Medium-High

#### Files to Touch

```
src/lib/supabase.ts               (✅ new)
src/hooks/useAuth.ts              (✅ new)
src/hooks/useSaveBeat.ts          (✅ new - renamed from useSaveHook)
src/hooks/useLoadBeat.ts          (✅ new - renamed from useLoadHook)
src/types/database.ts             (✅ new)
src/App.tsx                        (✅ integrated hooks, added Save/Load buttons)
src/components/LoginModal.tsx      (✅ new)
tsconfig.app.json                  (✅ exclude src/db/)
.env.local                         (✅ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
```

#### Definition of Done

- [x] `useAuth()` tracks Session state from Supabase Auth (Google/GitHub OAuth).
- [x] `useSaveBeat()` validates with Zod, inserts to `beats` table (debounced version available).
- [x] `useLoadBeat()` fetches beats, normalizes via `normalizeBeatData()`, hydrates React state.
- [x] Save button validates beat name (1-25 chars, non-empty).
- [x] Load hook includes loading state tracking.
- [x] LoginModal shown with OAuth sign-in buttons (Google/GitHub).
- [x] RLS policies verified (authenticated save, public read).
- [x] Error handling with user-friendly alerts.

#### Testing

```typescript
// hooks/__tests__/useSaveBeat.test.ts
describe("useSaveBeat", () => {
  test("Debounces grid updates", async () => {
    const { result } = renderHook(() => useSaveBeat(mockSession));
    act(() => result.current.saveBeatDebounced({ grid, bpm, beatName }));
    act(() => result.current.saveBeatDebounced({ grid, bpm, beatName }));
    // Expect only 1 DB insert after 500ms debounce window
  });

  test("Rejects invalid beatName", async () => {
    const { result } = renderHook(() => useSaveBeat(mockSession));
    await expect(
      result.current.saveBeat({ grid, bpm, beatName: "" }),
    ).rejects.toThrow("INVALID_BEAT_NAME");
  });
});
```

---

### PR #4: The Integration (UI Components & Loading States)

**Scope:** UI polish, loading skeletons, modals.
**Effort:** 3-4 hours | **Complexity:** Low-Medium

#### Files to Touch

```
src/components/SkeletonGrid.tsx    (new)
src/components/LoginModal.tsx      (new - OAuth buttons)
src/components/PortraitBlocker.tsx (new - mobile constraint)
src/components/SaveButton.tsx      (new - debounced save)
src/App.tsx                        (conditional rendering: Skeleton, LoginModal, etc.)
src/App.css                        (animation: skeleton pulse)
```

#### Definition of Done

- [ ] Skeleton grid appears while loading beat data.
- [ ] LoginModal prevents Save unless authenticated.
- [ ] PortraitBlocker blocks interaction on portrait <768px.
- [ ] SaveButton is disabled if beatName is unsanitized.
- [ ] Error toast appears on Save/Load failures.
- [ ] All components render without console errors.
- [ ] Tailwind classes are properly scoped (no style leaks).

#### Testing

```typescript
// components/__tests__/SkeletonGrid.test.tsx
describe("SkeletonGrid", () => {
  test("Renders 10 rows of skeleton pads", () => {
    render(<SkeletonGrid />);
    const pads = screen.getAllByTestId("skeleton-pad");
    expect(pads).toHaveLength(160);  // 10 rows × 16 cols
  });
});
```

---

### PR #5: Hardening (Performance & Mobile Constraints) — ✅ COMPLETE

**Scope:** Optimizations, error handling, mobile UX.
**Effort:** 3-4 hours | **Complexity:** Medium

#### Files Completed

```
✅ src/App.tsx                        (add: visibilitychange listener, error boundaries)
✅ src/components/ErrorBoundary.tsx   (new - class component with error UI)
✅ src/lib/audioEngine.ts            (refactor: 10s timeout with Promise.race)
✅ src/sequencer.ts                  (update: respect isPageHiddenRef)
```

#### Definition of Done — ALL CHECKED ✅

- [x] **Auth Flash Fixed:** Header shows "Loading..." while checking auth, no button flicker on reload
- [x] **Background throttling:** React updates suspended when `document.hidden === true` (sequencer skips onStep calls)
- [x] **Visibility resync:** Playhead syncs to `Tone.Transport.position` when tab becomes visible
- [x] **Error boundary:** `<ErrorBoundary>` wraps sequencer grid, catches React errors, displays "Reload Page" button
- [x] **Audio timeout:** 10-second Promise.race timeout; resolves successfully (not throws) to keep app usable
- [x] **Logging:** All errors logged with structured format `[Module] Message`
- [x] **Mobile:** Portrait blocker active (PR #4), landscape playback works

#### Implementation Details

**1. Auth Flash Fix (UX Polish)**

- Location: `src/App.tsx:575-577`
- Checks `authLoading` before rendering auth controls
- Shows "Loading..." text while auth state is being determined

**2. Browser Lifecycle Management**

- Location: `src/App.tsx:321-340` and `src/sequencer.ts:124-128`
- Uses `isPageHiddenRef` to track visibility state
- Prevents React state updates when backgrounded
- Syncs playhead on visibility change

**3. Error Boundaries**

- Location: `src/components/ErrorBoundary.tsx` (new class component)
- Wraps sequencer grid in App.tsx
- Catches errors, logs them, displays user-friendly UI with "Reload Page" button

**4. Audio Optimizations**

- Location: `src/lib/audioEngine.ts:107-113`
- Uses `Promise.race` with 10-second timeout
- Logs warning but resolves successfully on timeout
- App remains usable (possibly silent) instead of crashing

---

## v1.1 Feature Implementation

## PR #7: Data Schema & Type Expansion

**Goal:** Update the "Contracts" to support the new data fields without breaking existing saves.

1.  **Update `TrackID`:** Add `ac_01` (Accent) to the enum.
2.  **Update `TrackData`:** Add `pitch: number` property.
3.  **Update `BeatManifestSchema` (Zod):**
    - Add validation for `pitch` (min -12, max 12).
    - Add `ac_01` to the allowed keys.
4.  **Update `normalizeBeatData`:**
    - **Crucial:** When loading old v1.0 beats (which lack `pitch`), inject default `pitch: 0`.
    - When loading old beats (which lack `ac_01`), inject an empty accent track.
5.  **Update `TRACK_REGISTRY`:** Add the entry for `ac_01`.
    - _Note:_ It won't have a sample URL. We need to handle `sampleId: null` or a specific "virtual" flag.

## PR #8: Audio Engine Physics

**Goal:** Teach the audio engine how to "bend time" (Pitch) and "boost gain" (Accent).

1.  **Pitch:** Calculate playback rate: `rate = 2 ^ (pitch / 12)`.

2.  **Accent (Ghost Note):**
    - Look up `trackData.accents[stepIndex]`.
    - If `true` -> Subtract 7dB from the volume (Ghost note).
    - If `false` -> Play at Knob volume.
3.  **Signal Flow Update:**
    - `playTrack` logic: `Final Volume = Track Volume + (IsAccented ? AccentStrength : 0)`.

**Goal:** Teach the engine to interpret `pitch` and the new `accents` array.

**Updated Logic for `playTrack`:**

## PR #9: UI Integration

**Goal:** Expose the new controls.

1.  **Knob Mode Toggle:**
    - Add a toggle switch in `App.tsx`.
    - Pass `knobMode` ("vol" | "pitch") to the `ControlPanel`.
    - Update `Knob` to render differently based on mode (e.g., center zero for pitch).
2.  **Grid Rendering:**
    - The `SequencerGrid` will automatically render the 11th row because it iterates `TRACK_REGISTRY`.
    - Ensure the Accent row looks distinct (maybe a different color LED).

---

## Phase 8: v1.2 Feature Implementation (Mute/Solo, Beat Library Panel, Knob Asset Raster Impl.) — ✅ COMPLETE (PR #11, #12, #13)

#### PR #11: Mute & Solo Architecture — ✅ COMPLETE

Per-track mute/solo buttons with full audio engine integration. Mute silences a track (returns -Infinity to playback logic). Solo isolates tracks: if ANY track has solo enabled, only solo'd tracks play.

**Key Changes:**

- Add `handleMuteToggle()` and `handleSoloToggle()` to App.tsx
- Store states in `trackMutes[]` and `trackSolos[]` arrays
- Buttons styled 25px height matching Figma colors (#B43131 mute, #B49531 solo)
- Persist states in `BeatManifest.tracks[trackId].mute/solo` during save/load

#### PR #12: Beat Library Panel — ✅ COMPLETE

Shadcn UI side panel for browsing and loading saved beats. Pre-fetches beat list on app mount for instant access when opening the panel.

**Key Changes:**

- New Shadcn UI components: `ui/sheet.tsx`, `ui/button.tsx` with Vega/Orange scoped theme
- `loadBeatList()` hook returns beat summaries (id, name, updated_at)
- Pre-fetch in `loadInitialData()`, refresh after save
- **Bug Fix:** `toGridArray()` now returns raw `volumeDb` (not `calculateEffectiveVolume()` which returns -Infinity for muted tracks)
- Add `vitest` dev dependency and test script to package.json

#### PR #13: Knob Asset Raster Implementation — ✅ COMPLETE

Replace CSS-drawn knobs with photorealistic PNG assets (VOLUME_KNOB.png and TONE_KNOB.png).

**Key Changes:**

- Import PNG assets (VOLUME_KNOB.png for level, TONE_KNOB.png for pitch)
- Refactor Knob props: replace `color` string prop with `variant` union type ("level" | "tone")
- Render knobs as rotated `<img>` tags instead of CSS circles
- Update TrackControls to pass `variant` prop based on knob type
- Preserve all existing drag interaction and rotation calculations
- Size: 28px × 28px, integrates seamlessly with 25px track control height

---

#### Did a lot of small incremental UI debugging b/t PR 13-19

- like 'React state wasn't updating accent notes eventhough they were written to/read from DB
- setBPM() was called for React state only and wasn't being read from DB even though it was being saved
- fine tuning of Drive knob distortion behavior

---

#### feat: PR #19 - Global Settings Persistence (Shuffle & Drive) ✅ COMPLETE

Persist Shuffle (Swing) and Drive knob values with saved beats.

**Key Changes:**

- Update BeatManifest.global to include swing and drive (0-100 range)
- Add backward compatibility in normalizeBeatData for v1.1 beats
- Sync global settings to both React state and audio engine on load
- Save swing/drive values when persisting beats to database
- Fixes UI/engine desync when loading beats with custom effect setting

#### feat: PR #21 - Chiclet Grid Integration & Color Logic ✅ COMPLETE

Replace circular pads with photorealistic chiclet buttons using prerendered PNG assets and 4-step color banding.

**Key Changes:**

- **New Component:** `src/components/Chiclet.tsx` (70px photorealistic button)
- **Image Assets:** 8 PNG files (on/off for red, orange, yellow, cream)
- **Color Logic:** `getChicletVariant(stepIndex)` maps step 0-15 to color band (4 steps per color)
- **3-State Rendering:** Opacity-based visual feedback (25% off, 100% on, 60% accent)
- **Brightness:** Playhead glow (brightness-175) + 16th note highlight (brightness-135)
- **Props:** `variant`, `isActive`, `isAccented`, `isCurrentStep`, `is16thNote`, `onClick`, `disabled`
- **Integration:** Minimal refactor of App.tsx grid rendering loop (swapped Pad → Chiclet)

## Summary Table

| PR  | Title           | Files       | Hours | Tests  | Blocker Dependencies | Status      |
| --- | --------------- | ----------- | ----- | ------ | -------------------- | ----------- |
| #1  | Foundation      | 4 new       | 2-3   | Unit   | None                 | ✅ COMPLETE |
| #2  | Audio Engine    | 3 touch     | 3-4   | Unit   | PR #1                | ✅ COMPLETE |
| #3  | Pipes           | 7 new/touch | 4-5   | Integ  | PR #1                | ✅ COMPLETE |
| #4  | Integration     | 6 new/touch | 3-4   | Comp   | PR #3                | ✅ COMPLETE |
| #5  | Hardening       | 4 touch     | 3-4   | Manual | PR #4                | ✅ COMPLETE |
| #6  | Audio Load      | 1 refactor  | 2-3   | Manual | PR #2                | ✅ COMPLETE |
| #7  | Data Schema     | 2 touch     | 2-3   | Unit   | PR #1                | ✅ COMPLETE |
| #8  | Audio Physics   | 2 touch     | 2-3   | Unit   | PR #2, #7            | ✅ COMPLETE |
| #9  | UI Pitch/Accent | 3 touch     | 2-3   | Comp   | PR #8                | ✅ COMPLETE |
| #11 | Mute/Solo UI    | 1 touch     | 1-2   | Manual | PR #9                | ✅ COMPLETE |
| #12 | Beat Library    | 6 new/touch | 2-3   | Manual | PR #3                | ✅ COMPLETE |
| #21 | Chiclet Grid    | 2 new/touch | 1-2   | Manual | PR #19               | ✅ COMPLETE |

**Total Effort:** ~21-27 hours (actual) | **Status:** 12 PRs COMPLETE - v1.2 READY FOR RELEASE

---

## 8. Execution Checklist

### Post-Release (v1.0/v1.1 Verification — Completed ✅)

- [x] Deploy to staging environment.
- [x] E2E test: Guest load → Create beat → Play → Save → Load beat.
- [x] Performance audit: TTI, Save latency, Load latency meet SLOs.
- [x] Mobile audit: Portrait blocker, landscape playback functional.
- [x] Deploy to production.

---

## Appendix A: Library Integration Patterns

### Integration Challenge: Tone.js + AudioMotionAnalyzer

**Problem:** Integrating a vanilla JavaScript spectrum analyzer (AudioMotionAnalyzer) with a high-level audio abstraction library (Tone.js) requires understanding multiple layers of wrapper abstractions.

**Root Cause:** Libraries wrap the Web Audio API differently for developer convenience, but third-party libraries expect native Web Audio objects.

### The Wrapper Stack

When you use Tone.js, audio signals pass through multiple abstraction layers:

```
Your Code (TypeScript)
    ↓
Tone.js wrappers (ToneAudioNode, Channel, Player, etc.)
    ├─ _Channel, _PanVol, _Volume, _Gain (Tone abstractions)
    ├─ Added features: scheduling, transport, BPM, parameter automation
    └─ Convenience methods: .toDestination(), .chain(), etc.
    ↓
standardized-audio-context wrappers (cross-browser compatibility)
    ├─ Normalize Safari vs Chrome vs Firefox differences
    ├─ Polyfill missing features in older browsers
    └─ Ensure consistent behavior across platforms
    ↓
Native Web Audio API (Browser implementation)
    ├─ GainNode, DynamicsCompressorNode, AudioContext
    ├─ Direct hardware audio access
    └─ What third-party libraries expect to receive
```

### Why You Can't Just Use `source:` Constructor Option

**Simple case** (works with `source:` parameter):

```tsx
// If you had a plain <audio> element
const audioEl = document.getElementById("audio");
const audioMotion = new AudioMotionAnalyzer(container, {
  source: audioEl, // ← Audiomotion handles context creation & connection
});
```

**Your complex case** (requires manual `audioCtx:` + `connectInput()`):

```tsx
// You have:
// - 10 individual Tone.Player nodes
// - Master channel with effects chain
// - Scheduled playback via Transport
// - Complex audio graph

// If you used `source:`, audiomotion would:
// 1. Create a SECOND, separate AudioContext
// 2. Try to connect nodes from FIRST context to SECOND context
// 3. Browser throws: "cannot connect to an AudioNode belonging to a different audio context"
```

### The Solution Pattern

```tsx
// Step 1: Tell AudioMotionAnalyzer to use Tone's existing context
const analyzer = new AudioMotionAnalyzer(containerRef.current, {
  audioCtx: Tone.context.rawContext._nativeContext, // ← Use existing context
  connectSpeakers: false, // ← Don't create duplicate output path
  mode: 2,
  barSpace: 0.6,
  ledBars: true,
});

// Step 2: Manually connect analyzer to the right point in your audio graph
const masterChannel = getMasterChannel();

// Step 3: Unwrap Tone.js layers to reach the native GainNode
const gainWrapper = (masterChannel as any).output.output.output.input;
const nativeNode = gainWrapper._nativeAudioNode as AudioNode;

// Step 4: Connect analyzer's input to this native node
analyzer.connectInput(nativeNode);
```

### Understanding the Unwrapping Chain

```
Tone.Channel                                    ← What you create
  .output → Tone._PanVol (pan + volume)
    .output → Tone._Volume (volume control)
      .output → Tone._Gain (internal gain)
        .input → standardized-audio-context wrapper
          ._nativeAudioNode → GainNode (NATIVE - what AudioMotionAnalyzer needs) ✓
```

Each layer adds functionality:

- **Tone.\_Channel:** High-level mixer with .chain(), .toDestination()
- **Tone.\_PanVol:** Stereo panning + volume combined
- **Tone.\_Volume:** Volume automation interface
- **Tone.\_Gain:** Internal scheduler integration
- **standardized-audio-context:** Browser compatibility layer
- **Native GainNode:** Raw Web Audio API

### Key Principles for Future Library Integration

1. **Shared AudioContext:** All nodes must belong to the same AudioContext. You cannot mix nodes from different contexts.

2. **Wrapper Asymmetry:** Library A might wrap Web Audio one way, Library B another way. There's no standard.

3. **Debugging Strategy:**
   - Log the object types: `console.log(channel.output.constructor.name)`
   - Check for `.rawContext` or `._nativeAudioNode` properties
   - Verify the context reference matches: `channel.context === analyzer.audioCtx`

4. **Access Pattern:**
   - Simple libraries: Use public APIs (`player.toDestination()`)
   - Complex integrations: You may need to access private/internal properties (hence `any` type assertion)

5. **Connection Methods:**
   - Tone.js: Use `.connect()`, `.toDestination()`, `.chain()`
   - Web Audio API: Use `node.connect(destination)`
   - Third-party: Check documentation for `connectInput()`, `setSource()`, etc.

### Visual Comparison: Simple vs Complex Audio Graphs

**Simple (works with `source:` option):**

```
<audio> element
    ↓ (AudioMotionAnalyzer creates this automatically)
MediaElementSourceNode
    ↓
AudioMotionAnalyzer
    ↓
Destination (speakers)
```

**Complex (requires manual `audioCtx:` + `connectInput()`):**

```
              Tone.Transport (scheduler)
                      ↓
Player₁  Player₂  Player₃ ... Player₁₀
   ↓       ↓        ↓          ↓
   └───────┴────────┴──────────┘
              ↓
      Master Channel (with effects)
       ┌──────────────┐
       ├─ Compressor  │
       ├─ Limiter     │
       └──────────────┘
         ↙        ↘
    Analyzer    Destination
  (visualization) (speakers)
```

---

## Appendix B: Error Codes & Messages

### Audio Engine

| Code                    | Message                                                    | Recovery                      |
| ----------------------- | ---------------------------------------------------------- | ----------------------------- |
| `AUDIO_CONTEXT_BLOCKED` | "Click PLAY to enable audio"                               | Retry on user gesture         |
| `SAMPLE_LOAD_TIMEOUT`   | "Some samples failed to load. Playback may be incomplete." | Skip failed samples, continue |
| `SEQUENCER_INIT_FAILED` | "Sequencer initialization failed. Reload the page."        | Hard refresh                  |

### Database

| Code             | Message                           | Recovery            |
| ---------------- | --------------------------------- | ------------------- |
| `SAVE_TIMEOUT`   | "Save failed. Retrying..."        | Exponential backoff |
| `LOAD_NOT_FOUND` | "No beats found. Starting fresh." | Show blank beat     |
| `AUTH_REQUIRED`  | "Sign in to save beats."          | Show LoginModal     |

### Validation

| Code                | Message                                                 | Recovery        |
| ------------------- | ------------------------------------------------------- | --------------- |
| `BEAT_NAME_INVALID` | "Name too long or contains inappropriate content."      | User edits name |
| `SCHEMA_MISMATCH`   | "Beat is from an incompatible version. Using defaults." | Log + proceed   |

---

**End of SPEC.md** | **Last Updated:** 2026-01-12 (Appendix A: Library Integration Patterns Added)

<!-- Deployment Trigger -->
