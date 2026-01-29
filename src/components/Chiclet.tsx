import redChicletOn from "src/assets/images/RED_ON_180x250.png";
import redChicletOff from "src/assets/images/RED_OFF_180x250.png";
import orangeChicletOn from "src/assets/images/ORANGE_ON_180x250.png";
import orangeChicletOff from "src/assets/images/ORANGE_OFF_180x250.png";
import yellowChicletOn from "src/assets/images/YELLOW_ON_180x250.png";
import yellowChicletOff from "src/assets/images/YELLOW_OFF_180x250.png";
import creamChicletOn from "src/assets/images/CREAM_ON_180x250.png";
import creamChicletOff from "src/assets/images/CREAM_OFF_180x250.png";

type ChicletProps = {
  variant: "red" | "orange" | "yellow" | "cream";
  color?: string;
  isActive: boolean;
  isAccented?: boolean;
  isCurrentStep: boolean;
  is16thNote: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export function Chiclet({
  variant,
  color,
  isActive,
  isAccented = false,
  isCurrentStep,
  is16thNote,
  onClick,
  disabled = false,
}: ChicletProps) {
  if (disabled) return;

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
    accent: "opacity-75",
    off: "opacity-25",
  };

  // map brightness to playhead & 16th note
  const brightnessModifiers = [
    isCurrentStep && "brightness-175",
    is16thNote && "brightness-135",
  ]
    .filter(Boolean)
    .join(" ");

  const opacityClass = chicletOpacity[state];

  return (
    <button
      className={`${opacityClass} ${brightnessModifiers}`}
      style={{ backgroundImage: `url(${chicletImage})` }}
      onClick={onClick}
    />
  );
}
