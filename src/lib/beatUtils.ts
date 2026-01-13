import type { BeatManifest, TrackID, TrackData } from "../types/beat";
import { TRACK_REGISTRY } from "../config/trackConfig";

/**
 * TR-08 Beat Utilities
 *
 * This file provides transformation and calculation functions for converting
 * between different data representations:
 * - BeatManifest (canonical storage format)
 * - Grid Array (legacy UI format: boolean[][])
 * - Volume calculations (signal logic for mute/solo/master)
 */

// ============================================================================
// 4.2 Signal Logic (Audio Volume Calculation)
// ============================================================================

/**
 * Calculates the effective volume for a specific track, considering:
 * - Track-level volume (volumeDb)
 * - Mute state (overrides everything → -Infinity dB)
 * - Solo state (silences non-solo tracks unless muted)
 * - Master volume (global multiplier)
 * - Accent state (Ghost Note: -7dB reduction if accented) [v1.1]
 *
 * Volume hierarchy (highest to lowest priority):
 * 1. Mute (if muted, return -Infinity regardless of solo)
 * 2. Solo (if any track is solo'd, non-solo tracks → -Infinity unless muted)
 * 3. Track volume + Accent offset + Master volume (additive in dB space)
 *
 * @param manifest - The beat manifest containing all track data
 * @param trackId - The track to calculate volume for
 * @param isAccented - Whether this specific cell is accented (Ghost Note) [v1.1]
 * @returns Effective volume in decibels (-Infinity to +6)
 */
export function calculateEffectiveVolume(
  manifest: BeatManifest,
  trackId: TrackID,
  isAccented: boolean = false,
): number {
  const trackData = manifest.tracks[trackId];

  // Rule 1: Mute defeats everything (including solo)
  if (trackData.mute) {
    return -Infinity;
  }

  // Rule 2: Solo isolation
  // Check if ANY track has solo enabled
  const anySoloActive = Object.values(manifest.tracks).some(
    (track) => track.solo && !track.mute,
  );

  // If some track is solo'd and this track is NOT solo'd, silence it
  if (anySoloActive && !trackData.solo) {
    return -Infinity;
  }

  // Rule 3: Normal volume calculation (track + accent + master)
  const trackVolume = trackData.volumeDb;
  const accentOffset = isAccented ? -7 : 0; // v1.1: Ghost Note at -7dB
  const masterVolume = manifest.global.masterVolumeDb;

  return trackVolume + accentOffset + masterVolume;
}

// ============================================================================
// Data Transformers (BeatManifest ↔ Grid Array)
// ============================================================================

/**
 * Converts legacy grid array format to BeatManifest.
 * This is used when migrating from the old App.tsx state format.
 *
 * v1.1: Added pitch and accents parameter support
 *
 * @param grid - 10×16 boolean array (grid[rowIndex][stepIndex])
 * @param bpm - Tempo in beats per minute
 * @param trackPitches - Optional pitch values per track (defaults to 0)
 * @param trackAccents - Optional accent patterns per track (defaults to all false)
 * @returns BeatManifest with tracks populated from grid
 *
 * Note: beatName is stored separately in BeatRecord, not in BeatManifest
 */
export function toManifest(
  grid: boolean[][],
  bpm: number,
  trackPitches?: Record<TrackID, number>,
  trackAccents?: Record<TrackID, boolean[]>,
): BeatManifest {
  // Use TRACK_REGISTRY as source of truth for track order
  const TRACK_REGISTRY_SORTED = [...TRACK_REGISTRY].sort(
    (a, b) => a.rowIndex - b.rowIndex,
  );

  const tracks = {} as Record<TrackID, TrackData>;

  TRACK_REGISTRY_SORTED.forEach((config) => {
    const trackId = config.trackId;
    const rowIndex = config.rowIndex;

    tracks[trackId] = {
      sampleId: config.sampleId, // Default sample from registry
      volumeDb: 0, // Default volume
      mute: false,
      solo: false,
      steps: grid[rowIndex] || Array(16).fill(false), // Use grid data or empty
      accents: trackAccents?.[trackId] ?? Array(16).fill(false), // v1.1: Default accents to all false
      pitch: trackPitches?.[trackId] ?? 0, // v1.1: Default pitch to 0
    };
  });

  return {
    meta: { version: "1.1.0", engine: "tone.js@15.1.22" }, // v1.1
    global: { bpm, swing: 0, masterVolumeDb: 0 },
    tracks,
  };
}

/**
 * Converts BeatManifest back to legacy grid array format.
 * This is used when loading beats from the database into the UI.
 *
 * v1.1: Added trackPitches and trackAccents to return value for pitch knob and accent states
 *
 * @param manifest - The beat manifest to convert
 * @returns Object containing grid (10×16), bpm, volumes, pitches, and accents
 */
export function toGridArray(manifest: BeatManifest): {
  grid: boolean[][];
  bpm: number;
  beatName: string; // Note: beatName comes from DB record, not manifest
  trackVolumes: Record<TrackID, number>; // Calculated effective volumes
  trackPitches: Record<TrackID, number>; // v1.1: Pitch shift values per track
  trackAccents: Record<TrackID, boolean[]>; // v1.1: Accent patterns per track
} {
  // Use TRACK_REGISTRY to ensure correct row ordering
  const TRACK_REGISTRY_SORTED = [...TRACK_REGISTRY].sort(
    (a, b) => a.rowIndex - b.rowIndex,
  );

  const grid: boolean[][] = [];
  const trackVolumes: Record<TrackID, number> = {} as Record<TrackID, number>;
  const trackPitches: Record<TrackID, number> = {} as Record<TrackID, number>; // v1.1
  const trackAccents: Record<TrackID, boolean[]> = {} as Record<
    TrackID,
    boolean[]
  >; // v1.1

  TRACK_REGISTRY_SORTED.forEach((config) => {
    const trackId = config.trackId;
    const trackData = manifest.tracks[trackId];

    // Populate grid with steps
    grid[config.rowIndex] = trackData?.steps || Array(16).fill(false);

    // Calculate effective volume for this track
    trackVolumes[trackId] = calculateEffectiveVolume(manifest, trackId);

    // v1.1: Extract pitch value (default to 0 for backward compatibility)
    trackPitches[trackId] = trackData?.pitch ?? 0;

    // v1.1: Extract accent pattern (default to all false for backward compatibility)
    trackAccents[trackId] = trackData?.accents ?? Array(16).fill(false);
  });

  return {
    grid,
    bpm: manifest.global.bpm,
    beatName: "TR-08", // Default name (actual name comes from BeatRecord)
    trackVolumes,
    trackPitches, // v1.1
    trackAccents, // v1.1
  };
}

// ============================================================================
// Schema Migration (Version Compatibility)
// ============================================================================

/**
 * Migrates beat data from older schema versions to the current version.
 * This ensures backward compatibility when loading beats created with older versions.
 *
 * @param data - Untrusted beat data (potentially old schema version)
 * @returns Migrated BeatManifest in current schema version
 */
export function migrateSchema(data: unknown): BeatManifest {
  // Currently only v1.0.0 exists, but future versions would add migration logic here
  // Example:
  // if (data.meta?.version === "0.9.0") {
  //   // Migrate 0.9.0 → 1.0.0
  //   return migrateFrom_0_9_0(data);
  // }

  // For now, return data as-is (assuming it's already v1.0.0)
  const result = data as BeatManifest;
  return result;
}
