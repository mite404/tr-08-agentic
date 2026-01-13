import { describe, test, expect } from "bun:test";
import { calculateEffectiveVolume } from "./beatUtils";
import type { BeatManifest } from "../types/beat";

/**
 * Unit Tests for PR #8: Audio Engine Physics (Pitch & Accent)
 *
 * Tests the volume calculation logic including:
 * - Standard volume (no accent)
 * - Accent (Ghost Note -7dB)
 * - Accent + Knob interaction
 * - Mute override (defeats accent)
 * - Solo isolation
 */

describe("calculateEffectiveVolume - PR #8 (Accent Logic)", () => {
  test("Standard: Volume 0dB, Accent False → Output 0dB", () => {
    const manifest: BeatManifest = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, masterVolumeDb: 0 },
      tracks: {
        kick_01: {
          sampleId: "KICK_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        kick_02: {
          sampleId: "KICK_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_01: {
          sampleId: "BASS_TONE",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_02: {
          sampleId: "BASS_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_01: {
          sampleId: "CLAP",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_02: {
          sampleId: "SNARE_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        synth_01: {
          sampleId: "STAB_DM",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        clap: {
          sampleId: "STAB_C",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_01: {
          sampleId: "HAT_CLS",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_02: {
          sampleId: "HAT_OPN",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
      },
    };

    const result = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(result).toBe(0);
  });

  test("Accent: Volume 0dB, Accent True → Output -7dB", () => {
    const manifest: BeatManifest = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, masterVolumeDb: 0 },
      tracks: {
        kick_01: {
          sampleId: "KICK_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        kick_02: {
          sampleId: "KICK_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_01: {
          sampleId: "BASS_TONE",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_02: {
          sampleId: "BASS_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_01: {
          sampleId: "CLAP",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_02: {
          sampleId: "SNARE_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        synth_01: {
          sampleId: "STAB_DM",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        clap: {
          sampleId: "STAB_C",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_01: {
          sampleId: "HAT_CLS",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_02: {
          sampleId: "HAT_OPN",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
      },
    };

    const result = calculateEffectiveVolume(manifest, "kick_01", true);
    expect(result).toBe(-7);
  });

  test("Accent + Knob: Volume -10dB, Accent True → Output -17dB", () => {
    const manifest: BeatManifest = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, masterVolumeDb: 0 },
      tracks: {
        kick_01: {
          sampleId: "KICK_01",
          volumeDb: -10,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        kick_02: {
          sampleId: "KICK_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_01: {
          sampleId: "BASS_TONE",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_02: {
          sampleId: "BASS_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_01: {
          sampleId: "CLAP",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_02: {
          sampleId: "SNARE_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        synth_01: {
          sampleId: "STAB_DM",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        clap: {
          sampleId: "STAB_C",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_01: {
          sampleId: "HAT_CLS",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_02: {
          sampleId: "HAT_OPN",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
      },
    };

    const result = calculateEffectiveVolume(manifest, "kick_01", true);
    expect(result).toBe(-17);
  });

  test("Mute: Volume 0dB, Mute True → Output -Infinity (Accent doesn't matter)", () => {
    const manifest: BeatManifest = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, masterVolumeDb: 0 },
      tracks: {
        kick_01: {
          sampleId: "KICK_01",
          volumeDb: 0,
          mute: true,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        kick_02: {
          sampleId: "KICK_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_01: {
          sampleId: "BASS_TONE",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_02: {
          sampleId: "BASS_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_01: {
          sampleId: "CLAP",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_02: {
          sampleId: "SNARE_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        synth_01: {
          sampleId: "STAB_DM",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        clap: {
          sampleId: "STAB_C",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_01: {
          sampleId: "HAT_CLS",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_02: {
          sampleId: "HAT_OPN",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
      },
    };

    // Test with accent false
    const resultNoAccent = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(resultNoAccent).toBe(-Infinity);

    // Test with accent true (should still be -Infinity)
    const resultWithAccent = calculateEffectiveVolume(manifest, "kick_01", true);
    expect(resultWithAccent).toBe(-Infinity);
  });

  test("Solo: Solo is active elsewhere, this track not soloed → Output -Infinity", () => {
    const manifest: BeatManifest = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, masterVolumeDb: 0 },
      tracks: {
        kick_01: {
          sampleId: "KICK_01",
          volumeDb: 0,
          mute: false,
          solo: false, // This track is NOT solo'd
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        kick_02: {
          sampleId: "KICK_02",
          volumeDb: 0,
          mute: false,
          solo: true, // Another track IS solo'd
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_01: {
          sampleId: "BASS_TONE",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_02: {
          sampleId: "BASS_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_01: {
          sampleId: "CLAP",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_02: {
          sampleId: "SNARE_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        synth_01: {
          sampleId: "STAB_DM",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        clap: {
          sampleId: "STAB_C",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_01: {
          sampleId: "HAT_CLS",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_02: {
          sampleId: "HAT_OPN",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
      },
    };

    const result = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(result).toBe(-Infinity);
  });

  test("Master Volume: Track 0dB + Master -5dB → Output -5dB", () => {
    const manifest: BeatManifest = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, masterVolumeDb: -5 },
      tracks: {
        kick_01: {
          sampleId: "KICK_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        kick_02: {
          sampleId: "KICK_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_01: {
          sampleId: "BASS_TONE",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_02: {
          sampleId: "BASS_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_01: {
          sampleId: "CLAP",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_02: {
          sampleId: "SNARE_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        synth_01: {
          sampleId: "STAB_DM",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        clap: {
          sampleId: "STAB_C",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_01: {
          sampleId: "HAT_CLS",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_02: {
          sampleId: "HAT_OPN",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
      },
    };

    const result = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(result).toBe(-5);
  });

  test("Combined: Track -10dB + Accent True + Master -2dB → Output -19dB", () => {
    const manifest: BeatManifest = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, masterVolumeDb: -2 },
      tracks: {
        kick_01: {
          sampleId: "KICK_01",
          volumeDb: -10,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        kick_02: {
          sampleId: "KICK_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_01: {
          sampleId: "BASS_TONE",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        bass_02: {
          sampleId: "BASS_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_01: {
          sampleId: "CLAP",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        snare_02: {
          sampleId: "SNARE_02",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        synth_01: {
          sampleId: "STAB_DM",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        clap: {
          sampleId: "STAB_C",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_01: {
          sampleId: "HAT_CLS",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
        hh_02: {
          sampleId: "HAT_OPN",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: Array(16).fill(false),
          accents: Array(16).fill(false),
          pitch: 0,
        },
      },
    };

    const result = calculateEffectiveVolume(manifest, "kick_01", true);
    // -10 (track) + -7 (accent) + -2 (master) = -19
    expect(result).toBe(-19);
  });
});
