type PadProps = {
  color: string;
  isActive: boolean;
  isCurrentStep: boolean;
  is16thNote: boolean;
  onClick: () => void;
  disabled?: boolean; // PR #6: Visual feedback for failed tracks
  isAccented?: boolean; // PR #9: Ghost note visual feedback
};

export function Pad({
  color,
  isActive,
  isCurrentStep,
  is16thNote,
  onClick,
  disabled = false, // PR #6: Default to enabled
  isAccented = false, // PR #9: Default to not accented
}: PadProps) {
  // PR #6: If disabled, force gray background, remove interactivity, add grayscale
  if (disabled) {
    return (
      <button
        className="[rounded-[10px]] aspect-2/1 h-[25px] w-full cursor-not-allowed rounded-sm bg-gray-800 p-2 opacity-30 grayscale"
        disabled
        title="This track failed to load"
      ></button>
    );
  }

  // PR #10: 3-State visual feedback
  // OFF: opacity-20 (very dim)
  // ON Normal: opacity-100 (full brightness)
  // ON Ghost: opacity-50 (medium, ghosted)
  const baseOpacity = isActive
    ? isAccented
      ? "opacity-50"
      : "opacity-100"
    : "opacity-20";

  return (
    <button
      className={`aspect-2/1 cursor-pointer rounded-sm hover:opacity-80 ${color} ${baseOpacity} ${isCurrentStep ? "brightness-175" : ""} ${is16thNote ? "brightness-135" : ""} [rounded-[10px] h-[25px] w-full p-2`}
      onClick={onClick}
    ></button>
  );
}
