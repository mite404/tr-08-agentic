import { useState, useEffect } from "react";

type KnobProps = {
  value: number; // Current value (was 'inputDb')
  min: number; // Minimum value (e.g., -45 for volume, -12 for pitch)
  max: number; // Maximum value (e.g., 5 for volume, 12 for pitch)
  onChange: (newValue: number) => void; // Callback with new value
  color?: string; // Optional color class for the knob (e.g., "bg-amber-500")
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
  color = "bg-cyan-500",
  disabled = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);

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
      <div className="flex h-[25px] w-[25px] items-center justify-center rounded-full bg-gray-900">
        <div
          className={`flex h-5 w-5 cursor-pointer justify-center rounded-full ${color}`}
          style={{ transform: `rotate(${renderKnob}deg)` }}
          onMouseDown={handleMouseDown}
        >
          {/* black line on knob */}
          <div className="h-2 w-1 bg-black"></div>
        </div>
      </div>
    </div>
  );
}
