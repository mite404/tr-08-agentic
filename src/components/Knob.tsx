import { useState, useEffect } from "react";

type KnobProps = {
  _trackIndex: number;
  inputDb: number;
  onDbChange: (newDbValue: number) => void;
  disabled?: boolean; // PR #6: Visual feedback for failed tracks
};

// conversion constants
// const KNOB_STARTING_ANGLE = 320; // -5dB starting position
const MIN_ROTATION_ANGLE = 10;
const MAX_ROTATION_ANGLE = 256;
const MIN_DB = -45;
const MAX_DB = 5;
const KNOB_LINE_OFFSET = -130;

// convert input dB level to rotation angle
function getAngleFromDb(dbValue: number): number {
  return (
    ((dbValue - MIN_DB) / (MAX_DB - MIN_DB)) *
      (MAX_ROTATION_ANGLE - MIN_ROTATION_ANGLE) +
    MIN_ROTATION_ANGLE
  );
}

// convert input angle to dB level
function getDbFromAngle(angleValue: number): number {
  return (
    ((angleValue - MIN_ROTATION_ANGLE) /
      (MAX_ROTATION_ANGLE - MIN_ROTATION_ANGLE)) *
      (MAX_DB - MIN_DB) +
    MIN_DB
  );
}

// @ts-expect-error _trackIndex is intentionally unused for semantic clarity
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Knob({
  _trackIndex,
  inputDb,
  onDbChange,
  disabled = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);

  const rotationAngle = getAngleFromDb(inputDb);
  const renderKnob = rotationAngle + KNOB_LINE_OFFSET;

  function handleMouseDown() {
    setIsDragging(true);
  }

  useEffect(() => {
    function handleWindowMouseMove(event: MouseEvent) {
      // allows new angle with full movement unclamped
      let newAngle = rotationAngle - event.movementY;

      // possible oneliner solution: newAngle = Math.max(10, Math.min(270, newAngle))
      if (newAngle > MAX_ROTATION_ANGLE) {
        newAngle = MAX_ROTATION_ANGLE;
      } else if (newAngle < MIN_ROTATION_ANGLE) {
        newAngle = MIN_ROTATION_ANGLE;
      }

      // convert clamped angle back to dB
      const newDb = getDbFromAngle(newAngle);
      // console.log("dbValue: ", newDb, "rotationAngle: ", newAngle);

      onDbChange(newDb); // Fires repeatedly during drag
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
  }, [isDragging, rotationAngle, onDbChange]); // rotationAngle needed to be added for fresh value

  return (
    <div
      className={`pb-1 ${disabled ? "pointer-events-none opacity-40 grayscale" : ""}`}
      title={disabled ? "This track failed to load" : undefined}
    >
      <div className="flex h-[25px] w-[25px] items-center justify-center rounded-full bg-gray-900">
        <div
          className="flex h-5 w-5 cursor-pointer justify-center rounded-full bg-amber-500"
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
