import type { TrackID } from "../types/beat";

// Import audio samples as ES modules (for production deployment)
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
 * TR-08 Track Configuration Registry
 *
 * This file provides the "Track Registry" — a canonical mapping of track IDs
 * to their visual properties (row index, label, color) and audio samples.
 *
 * Key Principles:
 * - Track order is defined by rowIndex (0-9)
 * - Each track has a unique sampleId that maps to SAMPLE_LIBRARY
 * - Colors use Tailwind CSS color classes for visual distinction
 */

/**
 * Configuration for a single track in the sequencer.
 */
export interface TrackConfig {
  trackId: TrackID; // Unique identifier
  rowIndex: number; // Visual row position (0-9)
  label: string; // Display name shown in UI
  sampleId: string; // Default sample from SAMPLE_LIBRARY
  color: string; // Tailwind CSS color class (e.g., "dark-orange-600")
}

/**
 * Sample library mapping sample IDs to audio file URLs.
 */
export interface SampleLibrary {
  [sampleId: string]: string;
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
 * Retrieves track configuration by trackId.
 *
 * @param trackId - The track identifier
 * @returns TrackConfig or undefined if not found
 */
export function getTrackConfig(trackId: TrackID): TrackConfig | undefined {
  const config = TRACK_REGISTRY.find((t) => t.trackId === trackId);
  return config;
}

/**
 * Retrieves the audio sample URL for a given sampleId.
 *
 * @param sampleId - The sample identifier (key in SAMPLE_LIBRARY)
 * @returns Audio file URL or undefined if not found
 */
export function getSampleUrl(sampleId: string): string | undefined {
  const url = SAMPLE_LIBRARY[sampleId];
  return url;
}
