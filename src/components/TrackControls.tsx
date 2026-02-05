import type { TrackID } from "../types/beat";
import { Knob } from "./Knob";

type TrackControlsProps = {
  trackId: TrackID;
  label: string;
  isMuted: boolean;
  isSoloed: boolean;
  onMuteToggle: (trackId: TrackID) => void;
  onSoloToggle: (trackId: TrackID) => void;
  onClear: (trackId: TrackID) => void;
  pitchValue: number;
  volumeValue: number;
  onPitchChange: (newValue: number) => void;
  onVolumeChange: (newValue: number) => void;
  disabled?: boolean;
};

/**
 * TrackControls Component
 *
 * Channel strip for a single track containing all controls:
 * - Track label
 * - Pitch knob (amber)
 * - Volume knob (cyan)
 * - Mute button (M): Red when active (#B43131)
 * - Solo button (S): Amber when active (#B49531)
 * - Clear button (C): Red on hover (#8B0000) - PR #15
 * - Inactive buttons: Dark Gray (#504F4F)
 */
export function TrackControls({
  trackId,
  label,
  isMuted,
  isSoloed,
  onMuteToggle,
  onSoloToggle,
  onClear,
  pitchValue,
  volumeValue,
  onPitchChange,
  onVolumeChange,
  disabled = false,
}: TrackControlsProps) {
  // Colors from Figma design
  const MUTE_ACTIVE = "#B43131"; // Red
  const SOLO_ACTIVE = "#B49531"; // Amber
  const INACTIVE = "#504F4F"; // Dark gray

  return (
    <div className="flex items-center" style={{ gap: "12px" }}>
      {/* Track Label */}
      <div className="w-16 truncate text-left text-xs font-semibold text-white">
        {label}
      </div>

      {/* Pitch Knob */}
      <Knob
        value={pitchValue}
        min={-12}
        max={12}
        onChange={onPitchChange}
        variant="tone"
        disabled={disabled}
      />

      {/* Volume Knob */}
      <Knob
        value={volumeValue}
        min={-45}
        max={5}
        onChange={onVolumeChange}
        variant="level"
        disabled={disabled}
      />

      {/* Mute Button */}
      <button
        className="h-[25px] w-[30px] rounded-md text-xs font-bold text-white transition-colors"
        style={{
          backgroundColor: isMuted ? MUTE_ACTIVE : INACTIVE,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
        }}
        onClick={() => onMuteToggle(trackId)}
        title={isMuted ? "Unmute" : "Mute"}
        data-node-id="28:4"
      >
        M
      </button>

      {/* Solo Button */}
      <button
        className="h-[25px] w-[30px] rounded-md text-xs font-bold text-white transition-colors"
        style={{
          backgroundColor: isSoloed ? SOLO_ACTIVE : INACTIVE,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
        }}
        onClick={() => onSoloToggle(trackId)}
        title={isSoloed ? "Unsolo" : "Solo"}
        data-node-id="28:3"
      >
        S
      </button>

      {/* Clear Button (PR #15) - closest to grid */}
      <button
        className="h-[25px] w-[30px] rounded-md text-xs font-bold transition-colors"
        style={{
          backgroundColor: INACTIVE,
          color: "#A3A3A3",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#8B0000";
          e.currentTarget.style.color = "white";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = INACTIVE;
          e.currentTarget.style.color = "#A3A3A3";
        }}
        onClick={() => onClear(trackId)}
        title="Clear track (steps and accents)"
        data-node-id="28:5"
      >
        CLR
      </button>
    </div>
  );
}
