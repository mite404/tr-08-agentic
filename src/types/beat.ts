import { z } from "zod";

/**
 * TR-08 Type Definitions & Validation Schemas
 *
 * This file defines the core data contracts for the beat sequencer,
 * including Zod schemas for runtime validation and TypeScript types
 * for compile-time safety.
 */

// ============================================================================
// 3.1 Type Definitions (TypeScript)
// ============================================================================

/**
 * Track identifiers corresponding to the 10 drum sounds in the TR-08.
 * Each track has a unique ID that maps to a specific drum sound.
 * Order matches existing App.tsx track array (rows 0-9).
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
 * Per-track configuration including sample assignment, volume, mute/solo state,
 * and the 16-step sequence pattern.
 */
export interface TrackData {
  sampleId: string; // Reference to SAMPLE_LIBRARY key
  volumeDb: number; // Track volume in decibels (-60 to +6)
  mute: boolean; // Mute state (overrides solo)
  solo: boolean; // Solo state (silences non-solo tracks)
  steps: boolean[]; // 16-step sequence (true = trigger, false = silent)
}

/**
 * Complete beat manifest containing all sequencer state.
 * This is the canonical format for storing beats in the database.
 */
export interface BeatManifest {
  meta: {
    version: string; // Schema version (e.g., "1.0.0")
    engine: string; // Engine identifier (e.g., "tone.js@15.1.22")
  };
  global: {
    bpm: number; // Tempo in beats per minute (40-300)
    swing: number; // Swing amount (0.0-1.0, 0 = no swing)
    masterVolumeDb: number; // Master volume in decibels (-60 to +6)
  };
  tracks: Record<TrackID, TrackData>; // Per-track configuration
}

/**
 * Database record structure for saved beats.
 * Maps to the `beats` table in Supabase.
 */
export interface BeatRecord {
  id: string; // UUID primary key
  user_id: string; // Foreign key to auth.users
  beat_name: string; // User-defined beat name (sanitized, max 25 chars)
  data: BeatManifest; // JSONB column containing the beat manifest
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Audio context state tracking for the Tone.js engine.
 */
export interface AudioContextState {
  isResumed: boolean; // Has audio context been resumed?
  isLoading: boolean; // Are samples currently loading?
  loadedCount: number; // Number of successfully loaded samples
}

// ============================================================================
// 3.2 Validation Schemas (Zod)
// ============================================================================

/**
 * Zod schema for TrackID literal union type.
 */
export const TrackIDSchema = z.enum([
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

/**
 * Zod schema for TrackData with runtime validation.
 */
export const TrackDataSchema = z.object({
  sampleId: z.string().min(1),
  volumeDb: z.number().min(-60).max(6),
  mute: z.boolean(),
  solo: z.boolean(),
  steps: z.array(z.boolean()).length(16),
});

/**
 * Zod schema for BeatManifest with nested validation.
 */
export const BeatManifestSchema = z.object({
  meta: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    engine: z.string().min(1),
  }),
  global: z.object({
    bpm: z.number().int().min(40).max(300),
    swing: z.number().min(0).max(1),
    masterVolumeDb: z.number().min(-60).max(6),
  }),
  tracks: z.record(TrackIDSchema, TrackDataSchema),
});

/**
 * Normalizes and validates untrusted beat data from the database or user input.
 * Returns a Result-style object with either valid data or an error.
 *
 * @param data - Untrusted data to validate
 * @returns { valid: true, data: BeatManifest } | { valid: false, error: string }
 */
export function normalizeBeatData(
  data: unknown,
): { valid: true; data: BeatManifest } | { valid: false; error: string } {
  const result = BeatManifestSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, error: result.error.message };
  }
  return { valid: true, data: result.data };
}

/**
 * Returns a default BeatManifest with all tracks initialized to empty patterns.
 * This is used when creating a new beat or when database data is corrupted.
 *
 * @returns Default BeatManifest with sensible initial values
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
