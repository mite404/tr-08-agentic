import { useState, useEffect } from "react";
import volumeKnob from "../assets/images/VOLUME_KNOB.png";
import pitchKnob from "../assets/images/TONE_KNOB.png";

type KnobProps = {
  value: number; // Current value (was 'inputDb')
  min: number; // Minimum value (e.g., -45 for volume, -12 for pitch)
  max: number; // Maximum value (e.g., 5 for volume, 12 for pitch)
  onChange: (newValue: number) => void; // Callback with new value
  variant?: "level" | "tone"; // Knob type: "level" (volume/orange) or "tone" (pitch/cream)
  disabled?: boolean; // Visual feedback for failed tracks
};

// Internal visual constants (Physical limits of the knob graphic)
const MIN_ROTATION_ANGLE = 10;
const MAX_ROTATION_ANGLE = 256;
const KNOB_LINE_OFFSET = -130;

export function Knob({
  value,
  min,
  max,
  onChange,
  variant = "level",
  disabled = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Select knob image based on variant
  const knobImage = variant === "tone" ? pitchKnob : volumeKnob;

  // 1. Calculate visual angle based on percentage
  // Formula: Percent * RangeAngle + StartAngle
  const percentage = (value - min) / (max - min);
  const rotationAngle =
    percentage * (MAX_ROTATION_ANGLE - MIN_ROTATION_ANGLE) + MIN_ROTATION_ANGLE;

  const renderKnob = rotationAngle + KNOB_LINE_OFFSET;

  function handleMouseDown() {
    if (!disabled) setIsDragging(true);
  }

  useEffect(() => {
    function handleWindowMouseMove(event: MouseEvent) {
      // 2. Drag Logic: Calculate new angle
      // Note: We use -movementY so dragging UP increases value
      let newAngle = rotationAngle - event.movementY;

      // Clamp visual rotation
      if (newAngle > MAX_ROTATION_ANGLE) {
        newAngle = MAX_ROTATION_ANGLE;
      } else if (newAngle < MIN_ROTATION_ANGLE) {
        newAngle = MIN_ROTATION_ANGLE;
      }

      // 3. Convert Angle back to Value using dynamic min/max
      const anglePercent =
        (newAngle - MIN_ROTATION_ANGLE) /
        (MAX_ROTATION_ANGLE - MIN_ROTATION_ANGLE);
      const newValue = anglePercent * (max - min) + min;

      onChange(newValue);
    }

    function handleWindowMouseUp() {
      setIsDragging(false);
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleWindowMouseMove);
      window.addEventListener("mouseup", handleWindowMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging, rotationAngle, min, max, onChange]);

  return (
    <div
      className={disabled ? "pointer-events-none opacity-40 grayscale" : ""}
      title={disabled ? "This track failed to load" : undefined}
    >
      <img
        src={knobImage}
        alt={variant === "tone" ? "Pitch Knob" : "Volume Knob"}
        width={28}
        height={28}
        className="drag-none h-[28px] w-[28px] cursor-pointer select-none"
        style={{ transform: `rotate(${renderKnob}deg)` }}
        onMouseDown={handleMouseDown}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}
