import * as Tone from "tone";
import type { BeatManifest, TrackID } from "../types/beat";
import { getSampleUrl, TRACK_REGISTRY } from "../config/trackConfig";

let masterChannel: Tone.Channel | null = null;
let driveGain: Tone.Gain | null = null;
let softClipper: Tone.WaveShaper | null = null;
let outputComp: Tone.Gain | null = null;
let masterCompressor: Tone.Compressor | null = null;
let masterLimiter: Tone.Limiter | null = null;

// DEBUG: Set to true to bypass compressor/limiter (direct channel -> destination)
const BYPASS_MASTER_EFFECTS = false;

/**
 * Initializes the master effects chain: Channel -> DriveGain -> SoftClipper -> Compressor -> Limiter -> Destination
 * This is called automatically by getMasterChannel() to ensure effects are always in place.
 * PR #14: Added soft-clip saturation for warm, analog-style master drive control
 * Chain order: Drive signal into soft clipper, then compress for dynamics control, finally limit for safety
 */
function initializeMasterEffects(): void {
  if (masterChannel) {
    return; // Already initialized
  }

  // Create master channel (not connected to destination yet)
  masterChannel = new Tone.Channel();

  if (BYPASS_MASTER_EFFECTS) {
    // DEBUG MODE: Direct connection, no effects
    masterChannel.toDestination();
    console.log("[Master Effects] BYPASSED - Direct to destination");
    return;
  }

  // PR #14: Create soft clipper using WaveShaper with sigmoid curve
  // Sigmoid (tanh) provides smooth, analog-like soft clipping without harsh digital artifacts
  softClipper = new Tone.WaveShaper((x) => Math.tanh(x), 4096);

  // Input gain stage: controls how much signal drives into the soft clipper
  // Higher gain = more saturation; lower gain = clean signal
  driveGain = new Tone.Gain(1); // Start at unity (1.0)

  // Output compensation: reduces volume as drive increases to maintain consistent level
  // This prevents the output from getting louder as we add saturation
  outputComp = new Tone.Gain(1); // Start at unity (1.0)

  // Create compressor with specified settings
  masterCompressor = new Tone.Compressor({
    threshold: -6, // dB
    ratio: 8, // 8:1 compression ratio
    attack: 0.008, // 8ms attack
    release: 0.07, // 70ms release
  });

  // Create limiter for master bus limiting
  masterLimiter = new Tone.Limiter(-4); // -4dB ceiling

  // Wire the chain: Channel -> Compressor -> Limiter -> DriveGain -> SoftClipper -> OutputComp -> Destination
  // PR #18 (Iteration 3): Move compressor BEFORE drive to glue tracks together first,
  // then add distortion on top. This prevents compressor from reacting to distortion artifacts.
  masterCompressor.connect(masterLimiter);
  driveGain.connect(softClipper);
  softClipper.connect(outputComp);
  outputComp.toDestination();
  masterLimiter.connect(driveGain);
  masterChannel.connect(masterCompressor);

  console.log(
    "[Master Effects] Chain initialized: Channel -> Compressor -> Limiter -> DriveGain -> SoftClipper -> OutputComp -> Destination",
  );
}

export function getMasterChannel(): Tone.Channel {
  if (!masterChannel) {
    initializeMasterEffects();
  }
  return masterChannel as Tone.Channel;
}

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
 * Result object returned by loadAudioSamples.
 * Contains both successfully loaded players and a list of failed track IDs.
 *
 * PR #6: Added failedTrackIds for visual feedback
 */
export interface LoadAudioResult {
  players: Map<TrackID, Tone.Player>;
  failedTrackIds: TrackID[];
}

/**
 * Helper: Wraps a promise with a timeout that rejects if not resolved in time.
 * Used to prevent individual track loads from hanging indefinitely.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout occurs
 * @returns Promise that rejects on timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
    ),
  ]);
}

/**
 * Loads audio samples for all tracks in the manifest.
 * Uses TRACK_REGISTRY as the source of truth for track configuration.
 *
 * CONTRACT:
 * - BULLETPROOF: ALWAYS returns a valid LoadAudioResult, NEVER throws, NEVER hangs
 * - Individual Timeout: Each track load has 2-second timeout
 * - Global Timeout: 10-second failsafe for entire operation
 * - Partial Success: Returns successfully loaded tracks even if some fail
 * - Idempotent: safe to call multiple times
 * - Does NOT start Transport; only prepares players
 *
 * PR #5: Added 10-second timeout with Promise.race to prevent indefinite hangs
 * PR #6: Returns failedTrackIds for UI feedback on broken tracks
 * PR #6 (Bulletproof): Individual 2s timeouts, guaranteed return, explicit status tracking
 *
 * @param manifest - Beat manifest containing track data
 * @param onLoadProgress - Optional callback for tracking load progress (loaded, total)
 * @returns Promise<LoadAudioResult> - Object with loaded players and failed track IDs
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

  // Track loading logic wrapped in try-catch to guarantee it never throws
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

        const player = new Tone.Player(sampleUrl).connect(getMasterChannel());

        // PR #6 (Bulletproof): Individual 2-second timeout per track
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
        // Continue without this sample
      }
    });

    await Promise.allSettled(loadPromises); // Use allSettled to ensure all attempts complete
  };

  // PR #6 (Bulletproof): Global timeout as failsafe
  const globalTimeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn(
        `[Audio Engine] Global timeout reached (${GLOBAL_TIMEOUT_MS}ms). Proceeding with partial load.`,
      );
      resolve();
    }, GLOBAL_TIMEOUT_MS);
  });

  try {
    // Race between loading all tracks and global timeout
    await Promise.race([loadAllTracks(), globalTimeoutPromise]);
  } catch (err) {
    // This should never happen due to internal error handling, but guarantee no throw
    console.error("[Audio Engine] Unexpected error during load:", err);
  }

  // PR #6 (Bulletproof): Mark any track that's not explicitly loaded as failed
  const failedTrackIds: TrackID[] = [];
  for (const config of TRACK_REGISTRY) {
    const trackId = config.trackId;
    const trackData = manifest.tracks[trackId];

    // Skip tracks not in manifest
    if (!trackData) continue;

    // If track exists in manifest but isn't loaded, it failed
    if (!loadedTracks.has(trackId)) {
      if (!failedTracks.has(trackId)) {
        console.warn(
          `[Audio Engine] Track ${trackId} neither loaded nor explicitly failed - marking as failed`,
        );
      }
      failedTrackIds.push(trackId);
    }
  }

  console.log(
    `[Audio Engine] Load complete: ${loadedTracks.size} loaded, ${failedTrackIds.length} failed`,
  );

  // GUARANTEED RETURN: Always returns valid object, never undefined or throws
  return { players, failedTrackIds };
}

/**
 * Plays a single track sample at a specific time.
 * Respects the effective volume calculated from mute/solo/volume hierarchy.
 *
 * CONTRACT:
 * - Called once per 16th note step if grid[trackIndex][step] is true
 * - Checks effective volume using the Mute > Solo > Knob hierarchy
 * - Applies pitch shifting via playback rate (v1.1)
 * - Idempotent per step (safe to call multiple times for same step)
 *
 * @param player - Tone.Player instance for this track
 * @param effectiveVolume - Volume in dB (-Infinity to +6)
 * @param now - Tone.now() timestamp for precise scheduling
 * @param pitchSemis - Pitch shift in semitones (-12 to +12, 0 = no shift) [v1.1]
 */
export function playTrack(
  player: Tone.Player | undefined,
  effectiveVolume: number,
  now: number,
  pitchSemis: number = 0,
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
    // v1.1: Apply pitch shifting via playback rate
    // Formula: rate = 2^(semitones/12)
    // Safety: Always set playbackRate to ensure clean state (even if pitch is 0)
    if (pitchSemis === 0) {
      player.playbackRate = 1; // Strict reset to normal speed
    } else {
      const rate = Math.pow(2, pitchSemis / 12);
      player.playbackRate = rate;
    }

    console.log(
      `[playTrack] Setting volume to ${effectiveVolume}dB, pitch ${pitchSemis} semitones (rate ${player.playbackRate}), starting at ${now}`,
    );
    player.volume.value = effectiveVolume;
    player.start(now);
    console.log(`[playTrack] Player started successfully`);
  } catch (err) {
    console.error("[Playback Error]", err);
  }
}

/**
 * PR #18 (Iteration 2): Set master drive (soft-clip saturation input gain)
 * Maps 0-100% knob input to 1.0-5.0 gain on drive input
 * 0% knob = 1.0 gain (unity, no drive)
 * 100% knob = 5.0 gain (~14 dB into soft clipper, sweet spot)
 * Relaxed output compensation allows saturation warmth to pass through
 *
 * @param percent - Drive amount 0-100
 */
export function setMasterDrive(percent: number): void {
  if (!driveGain || !outputComp) {
    console.warn("[setMasterDrive] Drive or output comp not initialized");
    return;
  }

  const clampedPercent = Math.max(0, Math.min(100, percent));
  const driveGainValue = 1 + (clampedPercent / 100) * 4; // Map to 1.0-5.0 range (PR #18 Iteration 2: reduced from 8.0)

  // Set input gain that drives the soft clipper
  driveGain.gain.value = driveGainValue;

  // PR #18: Relaxed auto-gain compensation
  // Instead of full inverse (1 / driveGainValue), allow some warmth through
  // Formula: 1 / (driveGainValue * 0.7) lets ~70% of the saturation pass through
  const compensationValue = 1 / (driveGainValue * 0.7);
  outputComp.gain.value = compensationValue;

  const driveDb = Tone.gainToDb(driveGainValue);
  const compDb = Tone.gainToDb(compensationValue);

  console.log(
    `[Master Drive] Set to ${percent}% (drive: ${driveDb.toFixed(1)} dB, output comp: ${compDb.toFixed(1)} dB)`,
  );
}

/**
 * PR #14: Set master swing (shuffle amount)
 * Maps 0-100% input to 0.0-1.0 Tone.Transport.swing
 * Requires swingSubdivision to be "16n" for proper timing
 *
 * @param percent - Swing amount 0-100
 */
export function setMasterSwing(percent: number): void {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const swingValue = clampedPercent / 100; // Map to 0.0-1.0 range

  const transport = Tone.getTransport();
  transport.swing = swingValue;
  transport.swingSubdivision = "16n"; // Must be set for swing to work

  console.log(`[Master Swing] Set to ${percent}% (swing: ${swingValue})`);
}
