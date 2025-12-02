type PadProps = {
  color: string;
  isActive: boolean;
  isCurrentStep: boolean;
  is16thNote: boolean;
  onClick: () => void;
  disabled?: boolean; // PR #6: Visual feedback for failed tracks
};

export function Pad({
  color,
  isActive,
  isCurrentStep,
  is16thNote,
  onClick,
  disabled = false, // PR #6: Default to enabled
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

  return (
    <button
      className={`aspect-2/1 cursor-pointer rounded-sm hover:opacity-80 ${color} ${isActive ? "opacity-100" : "opacity-50"} ${isCurrentStep ? "brightness-175" : ""} ${is16thNote ? "brightness-135" : ""} [rounded-[10px] h-[25px] w-full p-2`}
      onClick={onClick}
    ></button>
  );
}
