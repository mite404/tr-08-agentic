import * as Tone from "tone";
import type { BeatManifest, TrackID } from "../types/beat";
import { getSampleUrl, TRACK_REGISTRY } from "../config/trackConfig";

/**
 * TR-08 Audio Engine
 *
 * This module handles all Tone.js audio operations:
 * - Audio context lifecycle management
 * - Sample loading and player initialization
 * - Track playback with volume calculation
 */

// ============================================================================
// 4.3 Audio Context & Player Initialization
// ============================================================================

/**
 * Resumes the Tone.js audio context.
 * Must be called in response to a user gesture (e.g., Play button click)
 * to satisfy browser autoplay policies.
 *
 * CONTRACT:
 * - Call this BEFORE starting the Transport
 * - Browser autoplay policy requires user interaction
 * - Timeout: 50ms max; don't block UI if context fails
 *
 * @returns Promise<boolean> - true if audio context is running, false otherwise
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
 * Loads audio samples for all tracks in the manifest.
 * Uses TRACK_REGISTRY as the source of truth for track configuration.
 *
 * CONTRACT:
 * - Idempotent: safe to call multiple times
 * - Does NOT start Transport; only prepares players
 * - Returns: Map<TrackID, Tone.Player>
 * - Errors: Log but don't block; allow partial playback
 * - Timeout: 10 seconds total; app remains usable even if samples fail to load
 *
 * PR #5: Added 10-second timeout with Promise.race to prevent indefinite hangs
 *
 * @param manifest - Beat manifest containing track data
 * @param onLoadProgress - Optional callback for tracking load progress (loaded, total)
 * @returns Promise<Map<TrackID, Tone.Player>> - Map of loaded players
 */
export async function loadAudioSamples(
  manifest: BeatManifest,
  onLoadProgress?: (loaded: number, total: number) => void,
): Promise<Map<TrackID, Tone.Player>> {
  const players = new Map<TrackID, Tone.Player>();
  let loadedCount = 0;
  const totalTracks = TRACK_REGISTRY.length;

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
        loadedCount++;
        onLoadProgress?.(loadedCount, totalTracks);
        return;
      }

      const player = new Tone.Player(sampleUrl).toDestination();
      await player.load(sampleUrl);

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

  // PR #5: Race with 10-second timeout - if timeout wins, log warning but resolve
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn(
        "[Audio Engine] Audio load timed out after 10 seconds. App remains usable but audio may be silent.",
      );
      resolve();
    }, 10000);
  });

  await Promise.race([Promise.all(loadPromises), timeoutPromise]);

  return players;
}

/**
 * Plays a single track sample at a specific time.
 * Respects the effective volume calculated from mute/solo/volume hierarchy.
 *
 * CONTRACT:
 * - Called once per 16th note step if grid[trackIndex][step] is true
 * - Checks effective volume using the Mute > Solo > Knob hierarchy
 * - Idempotent per step (safe to call multiple times for same step)
 *
 * @param player - Tone.Player instance for this track
 * @param effectiveVolume - Volume in dB (-Infinity to +6)
 * @param now - Tone.now() timestamp for precise scheduling
 */
export function playTrack(
  player: Tone.Player | undefined,
  effectiveVolume: number,
  now: number,
): void {
  if (!player) {
    console.log("[playTrack] No player provided");
    return;
  }
  if (effectiveVolume === -Infinity) {
    console.log("[playTrack] Track muted (volume -Infinity)");
    return;
  }

  try {
    console.log(
      `[playTrack] Setting volume to ${effectiveVolume}dB, starting at ${now}`,
    );
    player.volume.value = effectiveVolume;
    player.start(now);
    console.log(`[playTrack] Player started successfully`);
  } catch (err) {
    console.error("[Playback Error]", err);
  }
}
