# TR-08 v1.0: System Specification

**Status:** ✅ v1.0 Released | **Version:** 1.0 | **Last Updated:** 2025-12-01 (PR #5 Complete)

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
│   └── beatUtils.ts                # ✅ COMPLETED: Serializers & transformers
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
│   ├── Knob.tsx                    # ✅ COMPLETED: Volume knob component
│   ├── LoginModal.tsx              # ✅ COMPLETED (PR #4): Auth gateway (deprecated)
│   ├── LoginModalButton.tsx        # ✅ COMPLETED (PR #4): Modal with sign-in/out
│   ├── SaveButton.tsx              # ✅ COMPLETED (PR #4): Save with loading state
│   ├── LoadButton.tsx              # ✅ COMPLETED (PR #4): Load with loading state
│   ├── SkeletonGrid.tsx            # ✅ COMPLETED (PR #4): Loading placeholder (10x16)
│   ├── PortraitBlocker.tsx         # ✅ COMPLETED (PR #4): Mobile portrait overlay
│   └── ErrorBoundary.tsx           # ✅ COMPLETED (PR #5): Crash protection & error UI
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

#### File: `src/lib/audioEngine.ts` (new)

```typescript
import * as Tone from "tone";
import { BeatManifest, TrackID } from "../types/beat";
import { getSampleUrl, TRACK_REGISTRY } from "../config/trackConfig";

/**
 * AUDIO CONTEXT RESUME (Forced on first user gesture)
 *
 * CONTRACT:
 * - Call this BEFORE starting the Transport.
 * - Browser autoplay policy requires user interaction.
 * - Timeout: 50ms max; don't block UI if context fails.
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
 * LOAD SAMPLES (Initialize Tone.Player instances)
 *
 * CONTRACT:
 * - Idempotent: safe to call multiple times.
 * - Does NOT start Transport; only prepares players.
 * - Returns: Map<TrackID, Tone.Player>
 * - Errors: Log but don't block; allow partial playback.
 * - Timeout: 5 seconds per sample; skip on timeout.
 */
export async function loadAudioSamples(
  manifest: BeatManifest,
  onLoadProgress?: (loaded: number, total: number) => void,
): Promise<Map<TrackID, Tone.Player>> {
  const players = new Map<TrackID, Tone.Player>();
  let loadedCount = 0;
  const totalTracks = TRACK_REGISTRY.length;

  const loadPromises = TRACK_REGISTRY.map(async (config) => {
    const trackId = config.trackId as TrackID;
    const trackData = manifest.tracks[trackId];

    if (!trackData) {
      loadedCount++;
      onLoadProgress?.(loadedCount, totalTracks);
      return;
    }

    try {
      const sampleUrl = getSampleUrl(trackData.sampleId);
      const player = new Tone.Player(sampleUrl);
      await player.load();

      player.toDestination(); // Connect to output
      players.set(trackId, player);

      loadedCount++;
      onLoadProgress?.(loadedCount, totalTracks);
    } catch (err) {
      console.error(`[Sample Load Failed] ${trackId}:`, err);
      loadedCount++;
      onLoadProgress?.(loadedCount, totalTracks);
      // Continue without this sample
    }
  });

  await Promise.race([
    Promise.all(loadPromises),
    new Promise((resolve) => setTimeout(resolve, 5000)), // 5s timeout
  ]);

  return players;
}

/**
 * PLAY TRACK (Trigger a single sample)
 *
 * CONTRACT:
 * - Called once per 16th note step if the grid[trackIndex][step] is true.
 * - Checks effective volume using the Mute > Solo > Knob hierarchy.
 * - Idempotent per step (safe to call multiple times for same step).
 */
export function playTrack(
  player: Tone.Player | undefined,
  effectiveVolume: number,
  now: number, // Tone.now()
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

### 6.1 Audio Context Suspension — PR #5 UPDATED

**Implementation:** `src/lib/audioEngine.ts` (L107-113)

| Scenario                                        | Handling                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| AudioContext blocked by browser autoplay policy | Prompt user: "Click PLAY to start audio"                                     |
| AudioContext resume fails (timeout)             | Log error, disable playback, show alert                                      |
| Sample load timeout (>10s)                      | Log warning, resolve Promise, allow partial playback (app usable but silent) |
| Failed samples                                  | Skip individual samples, continue with loaded ones                           |

**Timeout Implementation (PR #5):**

```typescript
// In loadAudioSamples:
const timeoutPromise = new Promise<void>((resolve) => {
  setTimeout(() => {
    console.warn(
      "[Audio Engine] Audio load timed out after 10 seconds. App remains usable but audio may be silent.",
    );
    resolve(); // Resolve, don't reject - app stays functional
  }, 10000);
});

await Promise.race([Promise.all(loadPromises), timeoutPromise]);
return players; // Return whatever loaded before timeout
```

**Key Guarantee:** The app never crashes due to audio load delays. Worst case: silent playback.

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

## Summary Table

| PR  | Title        | Files       | Hours | Tests       | Blocker Dependencies | Status      |
| --- | ------------ | ----------- | ----- | ----------- | -------------------- | ----------- |
| #1  | Foundation   | 4 new       | 2-3   | Unit        | None                 | ✅ COMPLETE |
| #2  | Audio Engine | 3 touch     | 3-4   | Unit        | PR #1                | ✅ COMPLETE |
| #3  | Pipes        | 7 new/touch | 4-5   | Integration | PR #1                | ✅ COMPLETE |
| #4  | Integration  | 6 new/touch | 3-4   | Component   | PR #3                | ✅ COMPLETE |
| #5  | Hardening    | 4 new/touch | 3-4   | E2E         | PR #4                | ✅ COMPLETE |

**Total Effort:** ~16-20 hours (actual) | **Status:** ALL PRS COMPLETE - v1.0 RELEASED

---

## 8. Execution Checklist

### Pre-Implementation

- [ ] Supabase project created + dev environment configured.
- [ ] Environment variables (.env.local) populated.
- [ ] `npm install zod` executed.
- [ ] Git branch created: `feat/tr-08-v1`.

### Per PR

- [ ] Branch from main (or previous PR branch).
- [ ] Implement files per PR scope.
- [ ] Run: `npm run lint`, `npm run build` (no errors).
- [ ] Run tests: `npm run test` (all passing).
- [ ] Create PR with description linking to this SPEC.md.
- [ ] Code review: Verify Definition of Done checklist.
- [ ] Merge to main.

### Post-Implementation

- [ ] Deploy to staging environment.
- [ ] E2E test: Guest load → Create beat → Save beat → Load as new session.
- [ ] Performance audit: TTI, Save latency, Load latency.
- [ ] Mobile audit: Portrait blocker, landscape playback.
- [ ] Deploy to production.

---

## Appendix: Error Codes & Messages

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

**End of SPEC.md** | **Last Updated:** 2025-11-18
