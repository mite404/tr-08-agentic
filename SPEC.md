# TR-08 v1.0: System Specification
**Status:** Active | **Version:** 1.0 | **Date:** 2025-11-18

---

## 1. Executive Summary & SLOs

### Context: "The Graffiti Wall"
TR-08 is a persistent, social drum machine. Users load the last published beat, remix it, and save a new version. **No friction. No silent audio.**

### Success Metrics (SLOs)
| Metric | Target | Notes |
|--------|--------|-------|
| **Time to Interactive (TTI)** | < 1.5s | UI ready; audio samples can load async |
| **Save Latency** | < 30ms | Insert `BeatManifest` into DB |
| **Load Latency** | < 100ms | Fetch `ORDER BY created_at DESC LIMIT 1` |
| **Beat Payload** | < 5KB | JSONB `data` column |
| **Audio Context Resume** | < 50ms | Force `Tone.context.resume()` on first user gesture |

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
├── lib/
│   ├── supabase.ts                 # Supabase client init (new)
│   └── beatUtils.ts                # Serializers & transformers (new)
│
├── types/
│   └── beat.ts                     # BeatManifest, TrackID, Zod Schemas (new)
│
├── config/
│   └── trackConfig.ts              # TRACK_REGISTRY (new)
│
├── hooks/
│   ├── useAuth.ts                  # Session state (new)
│   ├── useSaveHook.ts              # Debounced save (new)
│   └── useLoadHook.ts              # Fetch + hydrate (new)
│
├── components/
│   ├── Pad.tsx                     # Existing: grid pad
│   ├── Button.tsx                  # Existing: generic button
│   ├── PlayStopBtn.tsx             # Existing: play/stop toggle
│   ├── TempoDisplay.tsx            # Existing: BPM +/-
│   ├── LoginModal.tsx              # NEW: Auth gateway
│   └── SkeletonGrid.tsx            # NEW: Loading placeholder
│
├── assets/
│   ├── samples/                    # 10x WAV files (unchanged)
│   └── images/
│       └── MPC_mark.png

└── utils/
    ├── profanityFilter.ts          # String validation (new)
    └── errors.ts                   # Error codes & messages (new)
```

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
  | "bd_1" | "bd_2"    // Bass Drums (Kick)
  | "sd_1" | "sd_2"    // Snares/Claps
  | "lt_1" | "mt_1"    // Low Tom / Mid Tom
  | "ch_1" | "oh_1"    // Closed Hat / Open Hat
  | "cy_1" | "cb_1";   // Cymbal / Cowbell

/**
 * TRACK DATA (per drum sound)
 * Minimal, immutable representation.
 */
export interface TrackData {
  sampleId: string;           // "KICK_01" - enables future sample swapping
  volumeDb: number;           // -Infinity to 0; stored at 0.1dB precision
  mute: boolean;              // Explicit mute flag
  solo: boolean;              // Explicit solo flag
  steps: boolean[];           // 16 elements (length must be 16)
}

/**
 * BEAT MANIFEST (Root document)
 * The "Rosetta Stone" - converts between DB and UI.
 */
export interface BeatManifest {
  meta: {
    version: string;          // "1.0.0" - enables schema migration
    engine: "TR-08";          // Hard constraint; rejects mismatched saves
  };
  global: {
    bpm: number;              // 40-300 inclusive
    swing: number;            // 0.0-1.0; currently unused (future)
    masterVolumeDb: number;   // -Infinity to 0
  };
  tracks: Record<TrackID, TrackData>;  // Dictionary pattern
}

/**
 * BEAT RECORD (Supabase row)
 * Database schema projection.
 */
export interface BeatRecord {
  id: string;                 // UUID
  user_id: string;            // UUID (FK -> profiles.id)
  name: string;               // Max 50 chars, sanitized
  bpm: number;                // Denormalized (also in data.global.bpm)
  data: BeatManifest;         // JSONB column
  created_at: string;         // ISO 8601 timestamp
  updated_at?: string;        // ISO 8601 timestamp
}

/**
 * AUDIO CONTEXT STATE
 * Tracks AudioContext lifecycle.
 */
export interface AudioContextState {
  isRunning: boolean;         // Tone.context.state === "running"
  canPlay: boolean;           // isRunning && allPlayersReady
  failureReason?: string;     // e.g., "AUTOPLAY_BLOCKED", "SAMPLE_LOAD_TIMEOUT"
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
  "bd_1", "bd_2", "sd_1", "sd_2", "lt_1", "mt_1", "ch_1", "oh_1", "cy_1", "cb_1"
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
    bd_1: { sampleId: "KICK_01", volumeDb: -3, mute: false, solo: false, steps: Array(16).fill(false) },
    bd_2: { sampleId: "KICK_02", volumeDb: -5, mute: false, solo: false, steps: Array(16).fill(false) },
    sd_1: { sampleId: "SNARE_01", volumeDb: -2, mute: false, solo: false, steps: Array(16).fill(false) },
    sd_2: { sampleId: "SNARE_02", volumeDb: -4, mute: false, solo: false, steps: Array(16).fill(false) },
    lt_1: { sampleId: "TOM_LO", volumeDb: -6, mute: false, solo: false, steps: Array(16).fill(false) },
    mt_1: { sampleId: "TOM_MID", volumeDb: -6, mute: false, solo: false, steps: Array(16).fill(false) },
    ch_1: { sampleId: "HAT_CLS", volumeDb: -8, mute: false, solo: false, steps: Array(16).fill(false) },
    oh_1: { sampleId: "HAT_OPN", volumeDb: -10, mute: false, solo: false, steps: Array(16).fill(false) },
    cy_1: { sampleId: "CYMBAL", volumeDb: -12, mute: false, solo: false, steps: Array(16).fill(false) },
    cb_1: { sampleId: "COWBELL", volumeDb: -10, mute: false, solo: false, steps: Array(16).fill(false) },
  };

  return {
    meta: { version: "1.0.0", engine: "TR-08" },
    global: { bpm: 140, swing: 0, masterVolumeDb: 0 },
    tracks: defaultTracks,
  };
}
```

### 3.3 Database Schema (SQL)

#### File: `supabase/migrations/01_init_schema.sql`

```sql
-- ============================================================================
-- PROFILES TABLE (User Identity)
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT profiles_id_fk FOREIGN KEY (id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
);

-- Auto-create profile on signup (via trigger, see below)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
  ON profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================================
-- BEATS TABLE (Persistent Beat Data)
-- ============================================================================
CREATE TABLE beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bpm INTEGER NOT NULL CHECK (bpm >= 40 AND bpm <= 300),
  data JSONB NOT NULL,  -- The BeatManifest
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT beats_name_length CHECK (char_length(name) <= 50),
  CONSTRAINT beats_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX idx_beats_user_id ON beats(user_id);
CREATE INDEX idx_beats_created_at ON beats(created_at DESC);

ALTER TABLE beats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beats are publicly readable"
  ON beats
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own beats"
  ON beats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own beats"
  ON beats
  FOR UPDATE
  USING (auth.uid() = user_id);

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
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
  rowIndex: number;           // 0-9 (UI grid row)
  label: string;              // Display name
  sampleId: string;           // e.g., "KICK_01"
  color: string;              // Tailwind class (e.g., "bg-blue-600")
}

interface SampleLibrary {
  [key: string]: string;      // sampleId -> URL
}

export const SAMPLE_LIBRARY: SampleLibrary = {
  "KICK_01": KICK01,
  "KICK_02": KICK02,
  "BASS_TONE": Bass_Tone_C_013,
  "BASS_01": BASS01,
  "CLAP": Bh_Hit_Clap_0007,
  "SNARE_02": JA_SNARE_2,
  "STAB_DM": Stabs_Chords_016_Dm,
  "STAB_C": Stabs_Chords_028_C,
  "HAT_CLS": Bh_Hit_Hihat_0008,
  "HAT_OPN": Bh_Hit_Hihat_0009,
};

export const TRACK_REGISTRY: TrackConfig[] = [
  { trackId: "bd_1", rowIndex: 0, label: "Kick 1", sampleId: "KICK_01", color: "bg-red-600" },
  { trackId: "bd_2", rowIndex: 1, label: "Kick 2", sampleId: "KICK_02", color: "bg-red-700" },
  { trackId: "sd_1", rowIndex: 2, label: "Snare 1", sampleId: "SNARE_02", color: "bg-blue-600" },
  { trackId: "sd_2", rowIndex: 3, label: "Snare 2", sampleId: "CLAP", color: "bg-blue-700" },
  { trackId: "lt_1", rowIndex: 4, label: "Tom Low", sampleId: "BASS_TONE", color: "bg-yellow-600" },
  { trackId: "mt_1", rowIndex: 5, label: "Tom Mid", sampleId: "BASS_01", color: "bg-yellow-700" },
  { trackId: "ch_1", rowIndex: 6, label: "Hat Closed", sampleId: "HAT_CLS", color: "bg-green-600" },
  { trackId: "oh_1", rowIndex: 7, label: "Hat Open", sampleId: "HAT_OPN", color: "bg-green-700" },
  { trackId: "cy_1", rowIndex: 8, label: "Cymbal", sampleId: "STAB_DM", color: "bg-purple-600" },
  { trackId: "cb_1", rowIndex: 9, label: "Cowbell", sampleId: "STAB_C", color: "bg-purple-700" },
];

/**
 * LOOKUP FUNCTIONS
 */
export function getTrackConfig(trackId: TrackID): TrackConfig {
  const config = TRACK_REGISTRY.find(t => t.trackId === trackId);
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
  currentStep: number
): number {
  const trackData = manifest.tracks[trackId];

  if (!trackData) {
    return -Infinity;  // Track not found
  }

  // RULE 1: Mute defeats everything
  if (trackData.mute) {
    return -Infinity;
  }

  // RULE 2: Check if ANY track has Solo enabled
  const anySoloActive = Object.values(manifest.tracks).some(t => t.solo);

  if (anySoloActive) {
    // In Solo mode: play only if this track is soloed
    if (!trackData.solo) {
      return -Infinity;  // Track is not soloed; mute it
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
  trackVolumes: Record<TrackID, number>
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
    beatName: "Loaded Beat",  // Placeholder; fetch from beats.name
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
  onLoadProgress?: (loaded: number, total: number) => void
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

      player.toDestination();  // Connect to output
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
    new Promise(resolve => setTimeout(resolve, 5000))  // 5s timeout
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
  now: number  // Tone.now()
): void {
  if (!player) return;
  if (effectiveVolume === -Infinity) return;  // Muted

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
  "badword1", "badword2", "badword3"  // Placeholder
  // In production: fetch from CDN or use npm package
];

export function isSanitized(beatName: string): { clean: boolean; reason?: string } {
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
  console.warn("[Schema Migration] Validation failed, using defaults", result.error);
  return getDefaultBeatManifest();
}
```

---

## 6. Failure Modes & Degradation

### 6.1 Audio Context Suspension

| Scenario | Handling |
|----------|----------|
| AudioContext blocked by browser autoplay policy | Prompt user: "Click PLAY to start audio" |
| AudioContext resume fails (timeout) | Log error, disable playback, show alert |
| Sample load timeout (>5s) | Skip failed samples, allow partial playback |
| All samples fail | Fall back to Blank Beat, show error toast |

### 6.2 Network & Database Failures

| Scenario | Handling |
|----------|----------|
| Save fails (DB down) | Debounce → Retry (exponential backoff, max 3x) |
| Load fails (fetch timeout) | Show Skeleton, then Blank Beat + error toast |
| Auth fails (Supabase down) | Show login modal indefinitely; allow guest playback |

### 6.3 Mobile Responsiveness

**Portrait Mode (<768px):**
```typescript
// src/components/PortraitBlocker.tsx
export function PortraitBlocker(): JSX.Element | null {
  const [isPortrait, setIsPortrait] = useState(
    window.matchMedia("(orientation: portrait) and (max-width: 768px)").matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: portrait) and (max-width: 768px)");
    const listener = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-4">Rotate Your Device</h1>
        <p>The 16-step grid requires landscape orientation.</p>
      </div>
    </div>
  );
}
```

### 6.4 Visibility Change (Background Throttling)

```typescript
// In App.tsx useEffect:
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Background: suspend React updates
      setIsBackgrounded(true);
    } else {
      // Re-enter: resync playhead
      setIsBackgrounded(false);
      if (sequencerRef.current?.isPlaying()) {
        const position = Tone.Transport.position;
        setCurrentStep(Math.floor((position as number) * 4) % 16);
      }
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
}, []);
```

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
      tracks: { bd_1: { mute: true, solo: true, ... } }
    };
    const vol = calculateEffectiveVolume(manifest, "bd_1", 0);
    expect(vol).toBe(-Infinity);
  });

  test("Solo isolation works correctly", () => {
    const manifest = {
      tracks: {
        bd_1: { mute: false, solo: true, volumeDb: -3 },
        bd_2: { mute: false, solo: false, volumeDb: -3 }
      }
    };
    expect(calculateEffectiveVolume(manifest, "bd_1", 0)).toBe(-3);
    expect(calculateEffectiveVolume(manifest, "bd_2", 0)).toBe(-Infinity);
  });
});
```

---

### PR #3: The Pipes (Supabase Auth & Save/Load Hooks)
**Scope:** Authentication + data persistence (Save/Load).
**Effort:** 4-5 hours | **Complexity:** Medium-High

#### Files to Touch
```
src/lib/supabase.ts               (new)
src/hooks/useAuth.ts              (new)
src/hooks/useSaveHook.ts          (new)
src/hooks/useLoadHook.ts          (new)
src/App.tsx                        (integrate hooks, add Save button)
src/components/LoginModal.tsx      (new)
.env.local                         (add: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
```

#### Definition of Done
- [ ] `useAuth()` tracks Session state from Supabase Auth.
- [ ] `useSaveHook()` debounces grid updates (500ms), validates with Zod, inserts to `beats` table.
- [ ] `useLoadHook()` fetches latest beat, normalizes via `normalizeBeatData()`, hydrates React state.
- [ ] Save button is disabled if beatName fails sanitization check.
- [ ] Load hook shows Skeleton state while fetching.
- [ ] LoginModal is shown if user is not authenticated (auth-gated Save).
- [ ] RLS policies are verified (authenticated save, public read).
- [ ] Error handling: network failures retry with exponential backoff.

#### Testing
```typescript
// hooks/__tests__/useSaveHook.test.ts
describe("useSaveHook", () => {
  test("Debounces grid updates", async () => {
    const { result } = renderHook(() => useSaveHook(...));
    act(() => result.current.triggerSave());
    act(() => result.current.triggerSave());
    // Expect only 1 DB insert after debounce window
  });

  test("Rejects unsanitized beatName", () => {
    const { result } = renderHook(() => useSaveHook(...));
    const canSave = result.current.canSave("badword1");
    expect(canSave).toBe(false);
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

### PR #5: Hardening (Performance & Mobile Constraints)
**Scope:** Optimizations, error handling, mobile UX.
**Effort:** 3-4 hours | **Complexity:** Medium

#### Files to Touch
```
src/utils/errors.ts               (new - centralized error codes)
src/App.tsx                        (add: visibilitychange listener, error boundaries)
src/components/ErrorBoundary.tsx   (new)
src/lib/audioEngine.ts            (refactor: timeout handling, retry logic)
.env.example                       (document all env vars)
```

#### Definition of Done
- [ ] Background throttling: React updates suspended when `document.hidden === true`.
- [ ] Visibility resync: Playhead updates when tab becomes visible.
- [ ] Error boundary catches React errors in UI (doesn't break sequencer).
- [ ] Retry logic: Save failures retry up to 3x with exponential backoff.
- [ ] Logging: All errors logged with structured format: `[Module] Message`.
- [ ] TTI < 1.5s verified (Lighthouse audit).
- [ ] Mobile tested on iPhone SE (portrait/landscape, network throttle).

#### Testing
```typescript
// App integration test
describe("App Lifecycle", () => {
  test("Suspends React updates when backgrounded", () => {
    render(<App />);
    act(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Verify no re-renders during hidden state
  });
});
```

---

## Summary Table

| PR | Title | Files | Hours | Tests | Blocker Dependencies |
|----|-------|-------|-------|-------|----------------------|
| #1 | Foundation | 4 new | 2-3 | Unit | None |
| #2 | Audio Engine | 3 touch | 3-4 | Unit | PR #1 |
| #3 | Pipes | 7 new/touch | 4-5 | Integration | PR #1 |
| #4 | Integration | 6 new/touch | 3-4 | Component | PR #3 |
| #5 | Hardening | 5 new/touch | 3-4 | E2E | PR #4 |

**Total Effort:** ~16-20 hours | **Dependencies:** Strictly sequential (each PR requires prior PRs).

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
| Code | Message | Recovery |
|------|---------|----------|
| `AUDIO_CONTEXT_BLOCKED` | "Click PLAY to enable audio" | Retry on user gesture |
| `SAMPLE_LOAD_TIMEOUT` | "Some samples failed to load. Playback may be incomplete." | Skip failed samples, continue |
| `SEQUENCER_INIT_FAILED` | "Sequencer initialization failed. Reload the page." | Hard refresh |

### Database
| Code | Message | Recovery |
|------|---------|----------|
| `SAVE_TIMEOUT` | "Save failed. Retrying..." | Exponential backoff |
| `LOAD_NOT_FOUND` | "No beats found. Starting fresh." | Show blank beat |
| `AUTH_REQUIRED` | "Sign in to save beats." | Show LoginModal |

### Validation
| Code | Message | Recovery |
|------|---------|----------|
| `BEAT_NAME_INVALID` | "Name too long or contains inappropriate content." | User edits name |
| `SCHEMA_MISMATCH` | "Beat is from an incompatible version. Using defaults." | Log + proceed |

---

**End of SPEC.md** | **Last Updated:** 2025-11-18
