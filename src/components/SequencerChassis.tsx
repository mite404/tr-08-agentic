// =============================================================================
// SequencerChassis.tsx — The drum machine hardware UI
// =============================================================================
//
// This is a "presenter" component — it owns no state. Everything flows in
// via props from App.tsx (the "container"). Think of it as the physical
// stage set: it displays what the director tells it to, and reports back
// when the audience (user) interacts with something.
//
// Props are grouped by function:
//   - Display:   What to show (grid, knob values, tempo, etc.)
//   - Callbacks: What to do when user interacts (pad clicks, knob turns, etc.)
// =============================================================================

import type { JSX } from "react";
import type { TrackID } from "../types/beat";
import type { BeatSummary } from "../hooks/useLoadBeat";

// ── Child components ──────────────────────────────────────
import { Analyzer } from "./Analyzer";
import { BeatLibrary } from "./BeatLibrary";
import { Chiclet } from "./Chiclet";
import { ErrorBoundary } from "./ErrorBoundary";
import { Knob } from "./Knob";
import { PlayStopBtn } from "./PlayStopBtn";
import { SaveButton } from "./SaveButton";
import { SkeletonGrid } from "./SkeletonGrid";
import { TempoDisplay } from "./TempoDisplay";
import { TrackControls } from "./TrackControls";

// ── Data ──────────────────────────────────────────────────
import { TRACK_REGISTRY } from "../config/trackConfig";

// ── Image assets ──────────────────────────────────────────
import chassisBackground from "../assets/images/CHASSIS 07_TEST_1.png";
import transportOutline from "../assets/images/TRANSPORT_OUTLINE.png";
import stepNoteCountStrip from "../assets/images/STEP_NOTE_COUNT_STRIP.png";

// =============================================================================
// TYPES
// =============================================================================

export interface SequencerChassisProps {
  // ── Display: Title ──────────────────────────────────────
  displayTitle: JSX.Element;

  // ── Display: Grid State ─────────────────────────────────
  grid: boolean[][];
  currentStep: number;
  accentsByRow: boolean[][];
  failedTrackIds: TrackID[];
  isInitialDataLoaded: boolean;

  // ── Display: Global Knobs ───────────────────────────────
  masterVolume: number;
  drive: number;
  swing: number;

  // ── Display: Per-Track State ────────────────────────────
  trackVolumes: number[];
  trackPitches: number[];
  trackMutes: boolean[];
  trackSolos: boolean[];

  // ── Display: Tempo & Transport ──────────────────────────
  bpm: number;
  isLoading: boolean;

  // ── Display: Save & Load ────────────────────────────────
  isSaving: boolean;
  beats: BeatSummary[];

  // ── Callbacks: Grid ─────────────────────────────────────
  onPadClick: (rowIndex: number, colIndex: number) => void;

  // ── Callbacks: Global Knobs ─────────────────────────────
  onMasterVolumeChange: (value: number) => void;
  onDriveChange: (value: number) => void;
  onSwingChange: (value: number) => void;

  // ── Callbacks: Per-Track Controls ───────────────────────
  onVolumeChange: (trackIndex: number, value: number) => void;
  onPitchChange: (trackIndex: number, value: number) => void;
  onMuteToggle: (trackId: TrackID) => void;
  onSoloToggle: (trackId: TrackID) => void;
  onClearTrack: (trackId: TrackID) => void;

  // ── Callbacks: Tempo & Transport ────────────────────────
  onIncrementBpm: () => void;
  onDecrementBpm: () => void;
  onStartStop: () => void;

  // ── Callbacks: Save & Load ──────────────────────────────
  onSave: () => void;
  onLoadBeat: (beatId: string) => Promise<void>;
}

// =============================================================================
// LOCAL HELPERS (pure functions — no App.tsx state dependency)
// =============================================================================

/**
 * Maps a step index (0-15) to a chiclet color variant.
 * Steps 0-3: red, 4-7: orange, 8-11: yellow, 12-15: cream
 */
function getChicletVariant(stepIndex: number) {
  if (stepIndex < 4) return "red";
  if (stepIndex < 8) return "orange";
  if (stepIndex < 12) return "yellow";
  return "cream";
}

/**
 * Sorted array of track IDs in row order (0-9).
 * Computed once from TRACK_REGISTRY — no need to receive as a prop.
 */
const trackIdsByRow: TrackID[] = [...TRACK_REGISTRY]
  .sort((a, b) => a.rowIndex - b.rowIndex)
  .map((c) => c.trackId);

// =============================================================================
// COMPONENT
// =============================================================================

export function SequencerChassis({
  displayTitle,
  grid,
  currentStep,
  accentsByRow,
  failedTrackIds,
  isInitialDataLoaded,
  masterVolume,
  drive,
  swing,
  trackVolumes,
  trackPitches,
  trackMutes,
  trackSolos,
  bpm,
  isLoading,
  isSaving,
  beats,
  onPadClick,
  onMasterVolumeChange,
  onDriveChange,
  onSwingChange,
  onVolumeChange,
  onPitchChange,
  onMuteToggle,
  onSoloToggle,
  onClearTrack,
  onIncrementBpm,
  onDecrementBpm,
  onStartStop,
  onSave,
  onLoadBeat,
}: SequencerChassisProps) {
  return (
    <div
      className="flex flex-col rounded-xl"
      style={{
        backgroundImage: `url(${chassisBackground})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        aspectRatio: "3050 / 2550",
        maxWidth: "min(100vw, calc(95vh * 3050 / 2550))",
        maxHeight: "min(100vh, calc(100vw * 2550 / 3050))",
        width: "auto",
        height: "auto",
        padding: "3% 3% 3% 3%",
      }}
    >
      {/* HEADER container */}
      <div
        className="flex items-center justify-between gap-4"
        style={{ paddingTop: "3%" }}
      >
        <div className="flex items-center">{displayTitle}</div>
      </div>

      {/* TOP ROW: Beat name is in header, Analyzer in LCD bezel area (top-right) */}
      <div className="flex justify-end">
        {/* Analyzer - placeholder for LCD screen bezel (top-right) */}
        <Analyzer />
      </div>

      {/* PR #30: Main content - 2 column layout (global knobs | knobs+grid) */}
      <div className="relative z-10 flex w-full flex-col gap-2">
        {/* MAIN AREA: LEFT global knobs + RIGHT per-row knobs & grid */}
        <div className="w-full origin-top-left" style={{ zoom: 0.8 }}>
          <div className="flex w-full flex-row gap-4">
            {/* LEFT COLUMN: Global Knobs (OUTPUT, DRIVE, SWING) */}
            <div className="flex flex-none flex-col items-center justify-start gap-4">
              <Knob
                variant="swing"
                min={-60}
                max={6}
                value={masterVolume}
                onChange={onMasterVolumeChange}
                label="Output Volume"
              />
              <Knob
                variant="swing"
                min={0}
                max={100}
                value={drive}
                onChange={onDriveChange}
                label="Drive / Saturation"
              />
              <Knob
                variant="swing"
                min={0}
                max={100}
                value={swing}
                onChange={onSwingChange}
                label="Swing / Shuffle"
              />
            </div>

            {/* RIGHT AREA: Per-row knobs + Chiclet Grid */}
            <div className="flex flex-1 flex-col gap-1">
              {/* Header row with TONE and LEVEL labels (aligned with TrackControls) */}
              <div
                className="flex h-[50px] items-center"
                style={{ gap: "12px" }}
              >
                {/* Space for track label */}
                <div className="w-16" />

                {/* TONE label */}
                <div className="flex flex-col items-center justify-center">
                  <div className="eurostile text-xs font-normal text-white">
                    TONE
                  </div>
                </div>

                {/* LEVEL label */}
                <div className="flex flex-col items-center justify-center">
                  <div className="eurostile text-xs font-normal text-white">
                    LEVEL
                  </div>
                </div>

                {/* Space for M/S/CLR buttons */}
                <div className="flex gap-1">
                  <div className="w-[30px]" />
                  <div className="w-[30px]" />
                  <div className="w-[30px]" />
                </div>
              </div>

              {/* PR #5: Wrap grid in ErrorBoundary for crash protection */}
              <ErrorBoundary>
                {/* PR #4: Show skeleton while loading initial data */}
                {!isInitialDataLoaded ? (
                  <div className="p-0.5">
                    <SkeletonGrid />
                  </div>
                ) : (
                  /* 10 rows: each row = [TrackControls] [16 chiclets] */
                  <div className="flex flex-col gap-1">
                    {grid.map((_row, rowIndex) => {
                      const trackId = trackIdsByRow[rowIndex];
                      const trackConfig = TRACK_REGISTRY.find(
                        (c) => c.trackId === trackId,
                      );
                      const isTrackDisabled =
                        failedTrackIds.includes(trackId);

                      if (!trackConfig) return null;

                      return (
                        <div
                          // eslint-disable-next-line react-x/no-array-index-key
                          key={`row-${rowIndex}`}
                          className="flex items-center gap-1"
                        >
                          {/* Per-track controls: label + TONE + LEVEL + M/S/CLR */}
                          <TrackControls
                            trackId={trackId}
                            label={trackConfig.label}
                            isMuted={trackMutes[rowIndex]}
                            isSoloed={trackSolos[rowIndex]}
                            onMuteToggle={onMuteToggle}
                            onSoloToggle={onSoloToggle}
                            onClear={onClearTrack}
                            pitchValue={trackPitches[rowIndex]}
                            volumeValue={trackVolumes[rowIndex]}
                            onPitchChange={(newValue) =>
                              onPitchChange(rowIndex, newValue)
                            }
                            onVolumeChange={(newValue) =>
                              onVolumeChange(rowIndex, newValue)
                            }
                            disabled={isTrackDisabled}
                          />

                          {/* 16 chiclets for this row */}
                          <div className="grid flex-1 grid-cols-16 gap-1">
                            {grid[rowIndex].map((_, colIndex) => {
                              const isAccented =
                                accentsByRow[rowIndex]?.[colIndex] ?? false;

                              return (
                                <Chiclet
                                  // eslint-disable-next-line react-x/no-array-index-key
                                  key={`${rowIndex}-${colIndex}`}
                                  variant={getChicletVariant(colIndex)}
                                  isActive={grid[rowIndex][colIndex]}
                                  isAccented={isAccented}
                                  isCurrentStep={colIndex === currentStep}
                                  is16thNote={colIndex % 4 !== 0}
                                  onClick={() =>
                                    onPadClick(rowIndex, colIndex)
                                  }
                                  disabled={isTrackDisabled}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Tempo/Save row + Transport outline bar */}
        <div className="flex w-full flex-col gap-2">
          {/* Row 1: Tempo + Save */}
          <div className="flex items-center gap-2">
            <TempoDisplay
              bpmValue={bpm}
              onIncrementClick={onIncrementBpm}
              onDecrementClick={onDecrementBpm}
            />
            <SaveButton
              onClick={onSave}
              isSaving={isSaving}
              style={{ width: "48px" }}
            />
          </div>

          {/* Row 2: Transport outline (left) overlapping with Step Strip (right) */}
          <div className="relative flex w-full items-end">
            {/* Transport outline as a proper image with buttons overlaid */}
            <div className="relative flex-none" style={{ width: "40%" }}>
              <img
                src={transportOutline}
                alt=""
                className="block h-auto w-full"
                draggable={false}
              />
              {/* Buttons positioned on top of the transport outline */}
              <div
                className="absolute inset-0 flex items-center p-3"
                style={{ gap: "58px" }}
              >
                <PlayStopBtn
                  onClick={onStartStop}
                  disabled={isLoading}
                  style={{ position: "relative", top: "-10px" }}
                />
                <div className="flex flex-col items-center gap-1">
                  <BeatLibrary
                    beats={beats}
                    onLoadBeat={onLoadBeat}
                  />
                  <span className="text-[10px] font-semibold tracking-wide text-neutral-500"></span>
                </div>
              </div>
            </div>

            {/* Step Number Strip — overlaps the transport outline slightly via negative margin */}
            <div
              className="flex flex-1 items-end"
              style={{ marginLeft: "-1rem" }}
            >
              <img
                src={stepNoteCountStrip}
                alt="Step numbers 1-16"
                className="h-auto w-full"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
