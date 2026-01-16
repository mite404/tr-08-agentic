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
 *
 * v1.1: Added pitch property for per-track pitch shifting
 * v1.1: Added accents array for per-cell velocity control
 */
export interface TrackData {
  sampleId: string; // Reference to SAMPLE_LIBRARY key
  volumeDb: number; // Track volume in decibels (-60 to +6)
  mute: boolean; // Mute state (overrides solo)
  solo: boolean; // Solo state (silences non-solo tracks)
  steps: boolean[]; // 16-step sequence (true = trigger, false = silent)
  accents: boolean[]; // 16-step accent pattern (true = -7dB softer, false = 0dB full) [v1.1]
  pitch: number; // Pitch shift in semitones (-12 to +12, 0 = no shift) [v1.1]
}

/**
 * Complete beat manifest containing all sequencer state.
 * This is the canonical format for storing beats in the database.
 *
 * PR #19: Added swing and drive to global settings for persistence
 */
export interface BeatManifest {
  meta: {
    version: string; // Schema version (e.g., "1.0.0")
    engine: string; // Engine identifier (e.g., "tone.js@15.1.22")
  };
  global: {
    bpm: number; // Tempo in beats per minute (40-300)
    swing: number; // Swing/Shuffle amount (0-100, 0 = no swing) [PR #19]
    drive: number; // Master drive/saturation amount (0-100, 0 = no drive) [PR #19]
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
 * v1.1: Added pitch field with -12 to +12 semitone range, defaults to 0
 * v1.1: Added accents array for per-cell velocity (defaults to all false)
 */
export const TrackDataSchema = z.object({
  sampleId: z.string().min(1),
  volumeDb: z.number().min(-60).max(6),
  mute: z.boolean(),
  solo: z.boolean(),
  steps: z.array(z.boolean()).length(16),
  accents: z.array(z.boolean()).length(16).default(Array(16).fill(false)), // v1.1: Accent pattern
  pitch: z.number().min(-12).max(12).default(0), // v1.1: Pitch shift in semitones
});

/**
 * Zod schema for BeatManifest with nested validation.
 * PR #19: Added drive field to global settings
 */
export const BeatManifestSchema = z.object({
  meta: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    engine: z.string().min(1),
  }),
  global: z.object({
    bpm: z.number().int().min(40).max(300),
    swing: z.number().min(0).max(100).default(0), // PR #19: 0-100 range
    drive: z.number().min(0).max(100).default(0), // PR #19: 0-100 range
    masterVolumeDb: z.number().min(-60).max(6),
  }),
  tracks: z.record(TrackIDSchema, TrackDataSchema),
});

/**
 * Normalizes and validates untrusted beat data from the database or user input.
 * Returns a Result-style object with either valid data or an error.
 *
 * v1.1 Migration: Automatically adds missing pitch fields (defaults to 0) for v1.0 beats.
 * v1.2 Migration: Automatically adds missing swing/drive fields (defaults to 0) for v1.1 beats.
 *
 * @param data - Untrusted data to validate
 * @returns { valid: true, data: BeatManifest } | { valid: false, error: string }
 */
export function normalizeBeatData(
  data: unknown,
): { valid: true; data: BeatManifest } | { valid: false; error: string } {
  // Pre-process data to inject missing fields for backward compatibility
  if (data && typeof data === "object" && "tracks" in data) {
    const manifest = data as any;

    // v1.1: Inject pitch: 0 and accents: Array(16).fill(false) into any track that doesn't have them
    for (const trackId in manifest.tracks) {
      if (manifest.tracks[trackId]) {
        // Add pitch if missing
        if (typeof manifest.tracks[trackId].pitch === "undefined") {
          manifest.tracks[trackId].pitch = 0;
        }
        // Add accents if missing (v1.0 beats won't have this)
        if (typeof manifest.tracks[trackId].accents === "undefined") {
          manifest.tracks[trackId].accents = Array(16).fill(false);
        }
      }
    }

    // PR #19: Inject swing and drive into global if missing (backward compatibility with v1.1 beats)
    if (manifest.global) {
      if (typeof manifest.global.swing === "undefined") {
        manifest.global.swing = 0;
      }
      if (typeof manifest.global.drive === "undefined") {
        manifest.global.drive = 0;
      }
    }
  }

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
 * v1.1: Added pitch: 0 and accents: [] to all tracks
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
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    kick_02: {
      sampleId: "KICK_02",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    bass_01: {
      sampleId: "BASS_TONE",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    bass_02: {
      sampleId: "BASS_01",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    snare_01: {
      sampleId: "CLAP",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    snare_02: {
      sampleId: "SNARE_02",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    synth_01: {
      sampleId: "STAB_DM",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    clap: {
      sampleId: "STAB_C",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    hh_01: {
      sampleId: "HAT_CLS",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
    hh_02: {
      sampleId: "HAT_OPN",
      volumeDb: 0,
      mute: false,
      solo: false,
      steps: Array(16).fill(false) as boolean[],
      accents: Array(16).fill(false) as boolean[], // v1.1
      pitch: 0, // v1.1
    },
  };

  return {
    meta: { version: "1.2.0", engine: "tone.js@15.1.22" }, // PR #19: Updated to v1.2
    global: { bpm: 140, swing: 0, drive: 0, masterVolumeDb: 0 }, // PR #19: Added drive
    tracks: defaultTracks,
  };
}
