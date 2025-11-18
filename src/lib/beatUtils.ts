import type { BeatManifest, TrackID } from "../types/beat";
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
 *
 * Volume hierarchy (highest to lowest priority):
 * 1. Mute (if muted, return -Infinity regardless of solo)
 * 2. Solo (if any track is solo'd, non-solo tracks → -Infinity unless muted)
 * 3. Track volume + Master volume (additive in dB space)
 *
 * @param manifest - The beat manifest containing all track data
 * @param trackId - The track to calculate volume for
 * @returns Effective volume in decibels (-Infinity to +6)
 */
export function calculateEffectiveVolume(
  manifest: BeatManifest,
  trackId: TrackID,
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

  // Rule 3: Normal volume calculation (track + master)
  const trackVolume = trackData.volumeDb;
  const masterVolume = manifest.global.masterVolumeDb;

  return trackVolume + masterVolume;
}

// ============================================================================
// Data Transformers (BeatManifest ↔ Grid Array)
// ============================================================================

/**
 * Converts legacy grid array format to BeatManifest.
 * This is used when migrating from the old App.tsx state format.
 *
 * @param grid - 10×16 boolean array (grid[rowIndex][stepIndex])
 * @param bpm - Tempo in beats per minute
 * @returns BeatManifest with tracks populated from grid
 *
 * Note: beatName is stored separately in BeatRecord, not in BeatManifest
 */
export function toManifest(grid: boolean[][], bpm: number): BeatManifest {
  // Use TRACK_REGISTRY as source of truth for track order
  const TRACK_REGISTRY_SORTED = [...TRACK_REGISTRY].sort(
    (a, b) => a.rowIndex - b.rowIndex,
  );

  const tracks: Record<TrackID, any> = {} as Record<TrackID, any>;

  TRACK_REGISTRY_SORTED.forEach((config) => {
    const trackId = config.trackId;
    const rowIndex = config.rowIndex;

    tracks[trackId] = {
      sampleId: config.sampleId, // Default sample from registry
      volumeDb: 0, // Default volume
      mute: false,
      solo: false,
      steps: grid[rowIndex] || Array(16).fill(false), // Use grid data or empty
    };
  });

  return {
    meta: { version: "1.0.0", engine: "tone.js@15.1.22" },
    global: { bpm, swing: 0, masterVolumeDb: 0 },
    tracks,
  };
}

/**
 * Converts BeatManifest back to legacy grid array format.
 * This is used when loading beats from the database into the UI.
 *
 * @param manifest - The beat manifest to convert
 * @returns Object containing grid (10×16), bpm, and extracted beatName
 */
export function toGridArray(manifest: BeatManifest): {
  grid: boolean[][];
  bpm: number;
  beatName: string; // Note: beatName comes from DB record, not manifest
  trackVolumes: Record<TrackID, number>; // Calculated effective volumes
} {
  // Use TRACK_REGISTRY to ensure correct row ordering
  const TRACK_REGISTRY_SORTED = [...TRACK_REGISTRY].sort(
    (a, b) => a.rowIndex - b.rowIndex,
  );

  const grid: boolean[][] = [];
  const trackVolumes: Record<TrackID, number> = {} as Record<TrackID, number>;

  TRACK_REGISTRY_SORTED.forEach((config) => {
    const trackId = config.trackId;
    const trackData = manifest.tracks[trackId];

    // Populate grid with steps
    grid[config.rowIndex] = trackData?.steps || Array(16).fill(false);

    // Calculate effective volume for this track
    trackVolumes[trackId] = calculateEffectiveVolume(manifest, trackId);
  });

  return {
    grid,
    bpm: manifest.global.bpm,
    beatName: "TR-08", // Default name (actual name comes from BeatRecord)
    trackVolumes,
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
export function migrateSchema(data: any): BeatManifest {
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
