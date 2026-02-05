import tempoLedScreen from "../assets/images/TEMPO_LED_SCREEN.png";
import tempoBtns from "../assets/images/TEMPO_BTNS.png";

type TempoBtnProps = {
  bpmValue: number;
  onIncrementClick: () => void;
  onDecrementClick: () => void;
};

export function TempoDisplay({
  bpmValue,
  onIncrementClick,
  onDecrementClick,
}: TempoBtnProps) {
  return (
    <div className="flex">
      {/* LED Screen with BPM overlay */}
      <div
        className="relative flex h-14 items-center justify-center"
        style={{
          backgroundImage: `url(${tempoLedScreen})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          aspectRatio: "2.2 / 1",
        }}
      >
        <span className="text-5xl font-bold text-red-600 drop-shadow-[0_0_6px_rgba(220,38,38,0.6)]">
          {bpmValue}
        </span>
      </div>

      {/* Arrow buttons with image background */}
      <div
        className="flex h-14 flex-col"
        style={{
          backgroundImage: `url(${tempoBtns})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          width: "28px",
        }}
      >
        <button
          className="flex h-1/2 w-full cursor-pointer items-center justify-center p-0 text-sm opacity-0 select-none hover:opacity-20"
          onClick={onIncrementClick}
          aria-label="Increase tempo"
        >
          ▲
        </button>
        <button
          className="flex h-1/2 w-full cursor-pointer items-center justify-center p-0 text-sm opacity-0 select-none hover:opacity-20"
          onClick={onDecrementClick}
          aria-label="Decrease tempo"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
