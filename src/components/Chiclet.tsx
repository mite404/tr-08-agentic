import redChicletOn from "../assets/images/RED_ON_180x250.png";
import redChicletOff from "../assets/images/RED_OFF_180x250.png";
import orangeChicletOn from "../assets/images/ORANGE_ON_180x250.png";
import orangeChicletOff from "../assets/images/ORANGE_OFF_180x250.png";
import yellowChicletOn from "../assets/images/YELLOW_ON_180x250.png";
import yellowChicletOff from "../assets/images/YELLOW_OFF_180x250.png";
import creamChicletOn from "../assets/images/CREAM_ON_180x250.png";
import creamChicletOff from "../assets/images/CREAM_OFF_180x250.png";

type ChicletProps = {
  variant: "red" | "orange" | "yellow" | "cream";
  isActive: boolean;
  isAccented?: boolean;
  isCurrentStep: boolean;
  is16thNote: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export function Chiclet({
  variant,
  isActive,
  isAccented = false,
  isCurrentStep,
  is16thNote,
  onClick,
  disabled = false,
}: ChicletProps) {
  if (disabled) {
    return (
      <button
        className="aspect-2/1 h-[25px] w-full cursor-not-allowed rounded-sm bg-gray-800 opacity-30 grayscale"
        disabled
        title="This track failed to load"
      />
    );
  }

  const chicletImages = {
    red: { on: redChicletOn, off: redChicletOff },
    orange: { on: orangeChicletOn, off: orangeChicletOff },
    yellow: { on: yellowChicletOn, off: yellowChicletOff },
    cream: { on: creamChicletOn, off: creamChicletOff },
  };

  const state = !isActive ? "off" : isAccented ? "accent" : "on";

  const chicletImage = chicletImages[variant][state === "off" ? "off" : "on"];

  // map state to opacity
  const chicletOpacity = {
    on: "opacity-100",
    accent: "opacity-60",
    off: "opacity-25",
  };

  // map brightness to playhead & 16th note
  const brightnessModifiers = [
    isCurrentStep && "brightness-200",
    is16thNote && "brightness-135",
  ]
    .filter(Boolean)
    .join(" ");

  const opacityClass = chicletOpacity[state];

  return (
    <button
      className={`cursor-pointer border-none bg-transparent p-0 hover:opacity-80 ${opacityClass} ${brightnessModifiers}`}
      style={{
        filter: isCurrentStep
          ? "drop-shadow(0 0 8px rgba(255, 200, 0, 0.8))"
          : "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))",
        transition: "filter 0.15s ease",
      }}
      onClick={onClick}
    >
      <img
        src={chicletImage}
        alt=""
        className="h-auto w-full"
        draggable={false}
      />
    </button>
  );
}
