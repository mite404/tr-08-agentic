import { describe, it, expect } from "vitest";
import { toManifest, toGridArray, calculateEffectiveVolume } from "./beatUtils";
import { normalizeBeatData } from "../types/beat";
import type { TrackID, BeatManifest, TrackData } from "../types/beat";

/**
 * Test Suite 1: Volume Calculation (PR #8 - Accent Logic)
 * Tests calculateEffectiveVolume with various accent, mute, and solo states
 */
describe("calculateEffectiveVolume - Volume Calculation Logic", () => {
  const createDefaultManifest = (
    overrides?: Partial<BeatManifest>,
  ): BeatManifest => ({
    meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
    global: { bpm: 140, swing: 0, drive: 0, masterVolumeDb: 0 },
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
    ...overrides,
  });

  it("should return 0dB for standard volume (no accent)", () => {
    const manifest = createDefaultManifest();
    const result = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(result).toBe(0);
  });

  it("should apply -7dB accent offset when accented", () => {
    const manifest = createDefaultManifest();
    const result = calculateEffectiveVolume(manifest, "kick_01", true);
    expect(result).toBe(-7);
  });

  it("should add track volume to calculation", () => {
    const manifest = createDefaultManifest();
    manifest.tracks.kick_01.volumeDb = 5;
    const result = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(result).toBe(5);
  });

  it("should combine track volume + accent offset", () => {
    const manifest = createDefaultManifest();
    manifest.tracks.kick_01.volumeDb = 5;
    const result = calculateEffectiveVolume(manifest, "kick_01", true);
    expect(result).toBe(-2); // 5 + (-7) = -2
  });

  it("should return -Infinity when track is muted", () => {
    const manifest = createDefaultManifest();
    manifest.tracks.kick_01.mute = true;
    const result = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(result).toBe(-Infinity);
  });

  it("should return -Infinity for non-solo tracks when any track is solo'd", () => {
    const manifest = createDefaultManifest();
    manifest.tracks.kick_02.solo = true; // Another track is solo'd
    const result = calculateEffectiveVolume(manifest, "kick_01", false); // kick_01 is not solo'd
    expect(result).toBe(-Infinity);
  });

  it("should allow solo'd tracks to play when other tracks are solo'd", () => {
    const manifest = createDefaultManifest();
    manifest.tracks.kick_02.solo = true;
    manifest.tracks.kick_01.solo = true;
    const result = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(result).toBe(0); // Can play because it's also solo'd
  });

  it("should apply master volume to all tracks", () => {
    const manifest = createDefaultManifest({
      global: { ...createDefaultManifest().global, masterVolumeDb: -5 },
    });
    const result = calculateEffectiveVolume(manifest, "kick_01", false);
    expect(result).toBe(-5);
  });

  it("should combine track + accent + master volumes", () => {
    const manifest = createDefaultManifest({
      global: { ...createDefaultManifest().global, masterVolumeDb: -2 },
    });
    manifest.tracks.kick_01.volumeDb = -10;
    const result = calculateEffectiveVolume(manifest, "kick_01", true);
    expect(result).toBe(-19); // -10 + (-7) + (-2) = -19
  });
});

/**
 * Test Suite 2: Save/Load Cycle
 * Tests that all track states (pitch, volume, mute, solo, accents) persist through save/load
 */
describe("beatUtils - Save/Load Cycle", () => {
  const mockGrid: boolean[][] = Array(10)
    .fill(null)
    .map(() => Array(16).fill(false));

  // Add some active steps
  mockGrid[0][0] = true;
  mockGrid[0][4] = true;
  mockGrid[7][2] = true;
  mockGrid[7][6] = true;

  const trackPitches: Record<TrackID, number> = {
    kick_01: 0,
    kick_02: 0,
    bass_01: 5,
    bass_02: -3,
    snare_01: 0,
    snare_02: 0,
    synth_01: 0,
    clap: 0,
    hh_01: 0,
    hh_02: 0,
  };

  const trackVolumes: Record<TrackID, number> = {
    kick_01: 2,
    kick_02: 0,
    bass_01: -5,
    bass_02: -8,
    snare_01: 3,
    snare_02: 1,
    synth_01: -2,
    clap: 4,
    hh_01: -4,
    hh_02: -6,
  };

  const trackMutes: Record<TrackID, boolean> = {
    kick_01: false,
    kick_02: true,
    bass_01: false,
    bass_02: false,
    snare_01: false,
    snare_02: false,
    synth_01: false,
    clap: true,
    hh_01: false,
    hh_02: false,
  };

  const trackSolos: Record<TrackID, boolean> = {
    kick_01: false,
    kick_02: false,
    bass_01: true,
    bass_02: false,
    snare_01: false,
    snare_02: false,
    synth_01: false,
    clap: false,
    hh_01: false,
    hh_02: false,
  };

  const trackAccents: Record<TrackID, boolean[]> = {
    kick_01: Array(16).fill(false),
    kick_02: Array(16).fill(false),
    bass_01: [
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ],
    bass_02: Array(16).fill(false),
    snare_01: Array(16).fill(false),
    snare_02: Array(16).fill(false),
    synth_01: Array(16).fill(false),
    clap: Array(16).fill(false),
    hh_01: Array(16).fill(false),
    hh_02: Array(16).fill(false),
  };

  it("should preserve pitch values in save/load cycle", () => {
    const bpm = 140;
    const savedManifest = toManifest(mockGrid, bpm, trackPitches);
    const loadedData = toGridArray(savedManifest);

    expect(loadedData.trackPitches.bass_01).toBe(5);
    expect(loadedData.trackPitches.bass_02).toBe(-3);
    expect(loadedData.trackPitches.clap).toBe(0);
  });

  it("should preserve volume values in save/load cycle", () => {
    const bpm = 140;
    const savedManifest = toManifest(
      mockGrid,
      bpm,
      undefined,
      undefined,
      undefined,
      undefined,
      trackVolumes,
    );
    const loadedData = toGridArray(savedManifest);

    expect(loadedData.trackVolumes.kick_01).toBe(2);
    expect(loadedData.trackVolumes.bass_01).toBe(-5);
    expect(loadedData.trackVolumes.clap).toBe(4);
  });

  it("should preserve mute states in save/load cycle", () => {
    const bpm = 140;
    const savedManifest = toManifest(
      mockGrid,
      bpm,
      undefined,
      undefined,
      trackMutes,
    );
    const loadedData = toGridArray(savedManifest);

    expect(loadedData.trackMutes.kick_02).toBe(true);
    expect(loadedData.trackMutes.clap).toBe(true);
    expect(loadedData.trackMutes.kick_01).toBe(false);
  });

  it("should preserve solo states in save/load cycle", () => {
    const bpm = 140;
    const savedManifest = toManifest(
      mockGrid,
      bpm,
      undefined,
      undefined,
      undefined,
      trackSolos,
    );
    const loadedData = toGridArray(savedManifest);

    expect(loadedData.trackSolos.bass_01).toBe(true);
    expect(loadedData.trackSolos.kick_01).toBe(false);
    expect(loadedData.trackSolos.clap).toBe(false);
  });

  it("should preserve accent patterns in save/load cycle", () => {
    const bpm = 140;
    const savedManifest = toManifest(mockGrid, bpm, undefined, trackAccents);
    const loadedData = toGridArray(savedManifest);

    expect(loadedData.trackAccents.bass_01[1]).toBe(true);
    expect(loadedData.trackAccents.bass_01[0]).toBe(false);
  });

  it("should preserve grid steps in save/load cycle", () => {
    const bpm = 140;
    const savedManifest = toManifest(mockGrid, bpm);
    const loadedData = toGridArray(savedManifest);

    expect(loadedData.grid).toEqual(mockGrid);
  });

  it("should preserve BPM in save/load cycle", () => {
    const bpm = 150;
    const savedManifest = toManifest(mockGrid, bpm);
    const loadedData = toGridArray(savedManifest);

    expect(loadedData.bpm).toBe(150);
  });

  it("should preserve all track states together in full save/load cycle", () => {
    const bpm = 140;
    const savedManifest = toManifest(
      mockGrid,
      bpm,
      trackPitches,
      trackAccents,
      trackMutes,
      trackSolos,
      trackVolumes,
    );
    const loadedData = toGridArray(savedManifest);

    // Verify pitch
    expect(loadedData.trackPitches.bass_01).toBe(5);
    // Verify volume
    expect(loadedData.trackVolumes.bass_01).toBe(-5);
    // Verify mute
    expect(loadedData.trackMutes.kick_02).toBe(true);
    // Verify solo
    expect(loadedData.trackSolos.bass_01).toBe(true);
    // Verify accents
    expect(loadedData.trackAccents.bass_01[1]).toBe(true);
  });

  it("should default missing states to false for backward compatibility", () => {
    const bpm = 140;
    const savedManifest = toManifest(mockGrid, bpm, trackPitches);
    const loadedData = toGridArray(savedManifest);

    // All tracks should default to not muted/solo'd
    expect(loadedData.trackMutes.kick_01).toBe(false);
    expect(loadedData.trackMutes.clap).toBe(false);
    expect(loadedData.trackSolos.kick_01).toBe(false);
    expect(loadedData.trackSolos.clap).toBe(false);
  });

  it("should preserve volume state even when track is muted", () => {
    const bpm = 140;
    const savedManifest = toManifest(
      mockGrid,
      bpm,
      undefined,
      undefined,
      trackMutes, // THIS includes muted tracks
      undefined,
      trackVolumes, // THIS includes volumes for those muted tracks
    );
    const loadedData = toGridArray(savedManifest);

    // Should still get the volume knob value, not -Infinity
    expect(loadedData.trackVolumes.kick_02).toBe(0); // Was muted but volume should still be readable
  });

  it("should preserve accent state upon load", () => {
    const bpm = 140;
    const savedManifest = toManifest(
      mockGrid,
      bpm,
      undefined,
      trackAccents,
      undefined,
      undefined,
      undefined,
    );
    const loadedData = toGridArray(savedManifest);

    // Accents appear in right structure within the manifest
    expect(loadedData.trackAccents.kick_01).toEqual(trackAccents.kick_01);
    expect(loadedData.trackAccents.bass_01).toEqual(trackAccents.bass_01);

    // Verify a specific accent pattern is correct
    expect(loadedData.trackAccents.bass_01[1]).toBe(true);
    expect(loadedData.trackAccents.bass_01[0]).toBe(false);
  });

  it("should add default accents to beats missing them", () => {
    const oldManifest = {
      meta: {
        version: "1.0.0",
        engine: "tone.js@15.1.22",
      },
      global: {
        bpm: 140,
        swing: 0,
        drive: 0,
        masterVolumeDb: 0,
      },
      tracks: {
        sampleId: "KICK_01",
        volumeDb: 0,
        mute: false,
        solo: false,
        steps: Array(16).fill(false),
        pitch: 0,
        accents: undefined,
      },
    } as unknown as BeatManifest;
    const loadedData = toGridArray(oldManifest as BeatManifest);

    // Verify that missing accents default to all false
    expect(loadedData.trackAccents.kick_01).toEqual(Array(16).fill(false));
  });
});

/**
 * Test Suite 3: Knob Interaction
 * Tests knob angle-to-pitch conversion
 */
describe("Knob - Pitch Conversion", () => {
  // Constants from Knob.tsx
  const MIN_ROTATION_ANGLE = 10;
  const MAX_ROTATION_ANGLE = 256;

  // Helper: Convert angle to pitch value (mimics Knob logic)
  const angleToPitch = (angle: number, min: number, max: number): number => {
    const anglePercent =
      (angle - MIN_ROTATION_ANGLE) / (MAX_ROTATION_ANGLE - MIN_ROTATION_ANGLE);
    return anglePercent * (max - min) + min;
  };

  it("should return min pitch at minimum rotation angle", () => {
    const pitch = angleToPitch(MIN_ROTATION_ANGLE, -12, 12);
    expect(pitch).toBe(-12);
  });

  it("should return max pitch at maximum rotation angle", () => {
    const pitch = angleToPitch(MAX_ROTATION_ANGLE, -12, 12);
    expect(pitch).toBe(12);
  });

  it("should return 0 pitch at middle rotation angle", () => {
    const midAngle = (MIN_ROTATION_ANGLE + MAX_ROTATION_ANGLE) / 2;
    const pitch = angleToPitch(midAngle, -12, 12);
    expect(pitch).toBeCloseTo(0, 1); // Allow 1 decimal place tolerance
  });

  it("should return pitch within -12 to +12 range for any valid angle", () => {
    for (
      let angle = MIN_ROTATION_ANGLE;
      angle <= MAX_ROTATION_ANGLE;
      angle += 10
    ) {
      const pitch = angleToPitch(angle, -12, 12);
      expect(pitch).toBeGreaterThanOrEqual(-12);
      expect(pitch).toBeLessThanOrEqual(12);
    }
  });

  it("should scale angle proportionally across pitch range", () => {
    const quarterAngle =
      MIN_ROTATION_ANGLE + (MAX_ROTATION_ANGLE - MIN_ROTATION_ANGLE) * 0.25;
    const pitch = angleToPitch(quarterAngle, -12, 12);
    expect(pitch).toBeCloseTo(-6, 1); // Should be at 25% = -6
  });

  it("should handle different pitch ranges (volume knob)", () => {
    const midAngle = (MIN_ROTATION_ANGLE + MAX_ROTATION_ANGLE) / 2;
    const volume = angleToPitch(midAngle, -45, 5);
    expect(volume).toBeCloseTo(-20, 1); // (-45 + 5) / 2 = -20
  });
});

/**
 * Test Suite 4: Migration Defaults (PR #19 - Backward Compatibility)
 * Tests that old beat data (v1.0 and v1.1) loads with safe defaults when
 * swing, drive, pitch, and accents fields are missing.
 *
 * This ensures users' older beats don't break when they upgrade to v1.2.
 */
describe("normalizeBeatData - Migration Defaults (PR #19)", () => {
  // Helper to create minimal complete track data
  const createDefaultTrack = (sampleId: string): TrackData => ({
    sampleId,
    volumeDb: 0,
    mute: false,
    solo: false,
    steps: Array(16).fill(false),
    accents: Array(16).fill(false),
    pitch: 0,
  });

  // Helper to create all 10 required tracks
  const createAllTracks = () => ({
    kick_01: createDefaultTrack("KICK_01"),
    kick_02: createDefaultTrack("KICK_02"),
    bass_01: createDefaultTrack("BASS_TONE"),
    bass_02: createDefaultTrack("BASS_01"),
    snare_01: createDefaultTrack("CLAP"),
    snare_02: createDefaultTrack("SNARE_02"),
    synth_01: createDefaultTrack("STAB_DM"),
    clap: createDefaultTrack("STAB_C"),
    hh_01: createDefaultTrack("HAT_CLS"),
    hh_02: createDefaultTrack("HAT_OPN"),
  });

  it("should inject drive: 0 when missing from v1.1 beat", () => {
    const oldBeatData = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, masterVolumeDb: 0 }, // Missing swing and drive
      tracks: createAllTracks(),
    };

    const result = normalizeBeatData(oldBeatData);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.global.drive).toBe(0);
    }
  });

  it("should inject swing: 0 when missing from v1.1 beat", () => {
    const oldBeatData = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, masterVolumeDb: 0 }, // Missing swing and drive
      tracks: createAllTracks(),
    };

    const result = normalizeBeatData(oldBeatData);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.global.swing).toBe(0);
    }
  });

  it("should inject both drive and swing when missing", () => {
    const oldBeatData = {
      meta: { version: "1.1.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, masterVolumeDb: 0 },
      tracks: createAllTracks(),
    };

    const result = normalizeBeatData(oldBeatData);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.global.drive).toBe(0);
      expect(result.data.global.swing).toBe(0);
    }
  });

  it("should inject pitch: 0 when missing from v1.0 track data", () => {
    const tracks = createAllTracks();
    // Remove pitch from all tracks to simulate v1.0 data
    Object.values(tracks).forEach((track: any) => {
      delete track.pitch;
    });

    const oldBeatData = {
      meta: { version: "1.0.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, drive: 0, masterVolumeDb: 0 },
      tracks,
    };

    const result = normalizeBeatData(oldBeatData);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.tracks.kick_01.pitch).toBe(0);
    }
  });

  it("should inject accents array when missing from v1.0 track data", () => {
    const tracks = createAllTracks();
    // Remove accents from all tracks to simulate v1.0 data
    Object.values(tracks).forEach((track: any) => {
      delete track.accents;
    });

    const oldBeatData = {
      meta: { version: "1.0.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 0, drive: 0, masterVolumeDb: 0 },
      tracks,
    };

    const result = normalizeBeatData(oldBeatData);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.tracks.kick_01.accents).toEqual(Array(16).fill(false));
    }
  });

  it("should inject all missing fields (v1.0 to v1.2 migration)", () => {
    const tracks = createAllTracks();
    // Remove pitch and accents to simulate v1.0 data
    Object.values(tracks).forEach((track: any) => {
      delete track.pitch;
      delete track.accents;
    });

    const oldBeatData = {
      meta: { version: "1.0.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, masterVolumeDb: 0 }, // Missing swing, drive
      tracks,
    };

    const result = normalizeBeatData(oldBeatData);
    expect(result.valid).toBe(true);
    if (result.valid) {
      // Global fields
      expect(result.data.global.swing).toBe(0);
      expect(result.data.global.drive).toBe(0);
      // Track fields
      expect(result.data.tracks.kick_01.pitch).toBe(0);
      expect(result.data.tracks.kick_01.accents).toEqual(Array(16).fill(false));
    }
  });

  it("should preserve existing drive and swing values when present", () => {
    const existingBeatData = {
      meta: { version: "1.2.0", engine: "tone.js@15.1.22" },
      global: { bpm: 140, swing: 35, drive: 60, masterVolumeDb: 0 },
      tracks: createAllTracks(),
    };

    const result = normalizeBeatData(existingBeatData);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.global.swing).toBe(35);
      expect(result.data.global.drive).toBe(60);
    }
  });

  it("should handle complete v1.0 beat without any new fields", () => {
    const v10BeatData = {
      meta: { version: "1.0.0", engine: "tone.js@15.1.22" },
      global: { bpm: 120, masterVolumeDb: 0 },
      tracks: {
        kick_01: {
          sampleId: "KICK_01",
          volumeDb: 0,
          mute: false,
          solo: false,
          steps: [
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
          ],
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
          sampleId: "CLAP",
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
      },
    };

    const result = normalizeBeatData(v10BeatData);
    expect(result.valid).toBe(true);
    if (result.valid) {
      // All tracks should have injected defaults
      expect(result.data.global.swing).toBe(0);
      expect(result.data.global.drive).toBe(0);
      Object.keys(result.data.tracks).forEach((trackId) => {
        expect(result.data.tracks[trackId as never].pitch).toBe(0);
        expect(result.data.tracks[trackId as never].accents).toEqual(
          Array(16).fill(false),
        );
      });
    }
  });
});
