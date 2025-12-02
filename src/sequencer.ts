import * as Tone from "tone";
import type { RefObject } from "react";
import type { TrackID, BeatManifest } from "./types/beat";
import { calculateEffectiveVolume } from "./lib/beatUtils";
import { playTrack } from "./lib/audioEngine";

type Grid = Array<Array<boolean>>;

/**
 * TR-08 Sequencer
 *
 * Manages the Tone.js Transport and step sequencing logic.
 * Refactored to use the audio engine and track registry.
 */

export function togglePad(grid: Grid, row: number, col: number): Grid {
  const newGrid = structuredClone(grid);
  newGrid[row][col] = !newGrid[row][col];
  return newGrid;
}

/**
 * Gets the list of active track indices at a specific step.
 *
 * @param step - Step index (0-15)
 * @param grid - 10×16 grid of active pads
 * @returns Array of track indices (row numbers) that should play
 */
export function getActiveSamplesAtStep(
  step: number,
  grid: Array<Array<boolean>>,
): Array<number> {
  const trackIdsThatAreActive: Array<number> = [];
  for (let trackIndex = 0; trackIndex < grid.length; trackIndex++) {
    const currentTrack: boolean[] = grid[trackIndex];
    const currentSettingOfTrackAtCurrentStep = currentTrack[step];
    if (currentSettingOfTrackAtCurrentStep === true) {
      trackIdsThatAreActive.push(trackIndex);
    }
  }
  return trackIdsThatAreActive;
}

/**
 * Creates the step sequencer using Tone.js Transport.
 *
 * REFACTORED (PR #2):
 * - Now accepts players Map instead of loading samples internally
 * - Uses TRACK_REGISTRY for track ordering
 * - Uses calculateEffectiveVolume for volume hierarchy
 * - Uses playTrack for sample triggering
 *
 * @param bpm - Initial tempo in beats per minute
 * @param onStep - Callback fired on each step (for UI update)
 * @param gridRef - Reference to the current grid state
 * @param playersMap - Map of TrackID -> Tone.Player (from loadAudioSamples)
 * @param manifestRef - Reference to current BeatManifest (for volume calculation)
 * @param trackIdsByRow - Array mapping row index to TrackID
 * @returns Sequencer control object
 */
export function createSequencer(
  bpm: number,
  onStep: (step: number) => void,
  gridRef: RefObject<Grid>,
  playersMap: Map<TrackID, Tone.Player>,
  manifestRef: RefObject<BeatManifest>,
  trackIdsByRow: TrackID[],
  isPageHiddenRef?: RefObject<boolean>,
) {
  let currentStep = 0;

  // Create Tone.js Transport
  const transport = Tone.getTransport();
  transport.bpm.value = bpm;

  const scheduledEventId = transport.scheduleRepeat((time) => {
    // Callback fires every 16th note
    if (gridRef.current === null || manifestRef.current === null) {
      console.warn("[Sequencer] Grid or manifest is null");
      return;
    }

    const stepToPlay = currentStep;

    // Get active tracks at THIS step
    const activeTrackIndices = getActiveSamplesAtStep(
      stepToPlay,
      gridRef.current,
    );

    if (activeTrackIndices.length > 0) {
      console.log(
        `[Sequencer] Step ${stepToPlay}: ${activeTrackIndices.length} active tracks`,
      );
    }

    // Play each active track with volume calculation
    for (const rowIndex of activeTrackIndices) {
      const trackId = trackIdsByRow[rowIndex];
      if (!trackId) {
        console.log(`[Sequencer] No trackId for row ${rowIndex}`);
        continue;
      }

      const player = playersMap.get(trackId);
      if (!player) {
        console.log(`[Sequencer] No player for ${trackId}`);
        continue;
      }

      // Calculate effective volume using the signal hierarchy
      const effectiveVolume = calculateEffectiveVolume(
        manifestRef.current,
        trackId,
      );

      console.log(
        `[Sequencer] Playing ${trackId} at step ${stepToPlay}, volume: ${effectiveVolume}dB`,
      );

      // Play the track
      playTrack(player, effectiveVolume, time);
    }

    // Schedule UI update (only if page is visible - PR #5: Browser lifecycle)
    Tone.Draw.schedule(() => {
      if (!isPageHiddenRef?.current) {
        onStep(stepToPlay);
      }
    }, time);

    // Advance to next step
    currentStep = (currentStep + 1) % 16;
  }, "16n");

  return {
    start() {
      transport.start();
    },

    stop() {
      transport.stop();
      currentStep = 0;
      console.log("UI Update:", currentStep);
      onStep(currentStep);
    },

    pause() {
      transport.pause();
    },

    updateBpm(newBpm: number) {
      transport.bpm.value = newBpm;
    },

    dispose() {
      transport.clear(scheduledEventId);
      transport.stop();
      currentStep = 0;
    },

    isPlaying(): boolean {
      return transport.state === "started";
    },
  };
}
