import startStopBtn from "../assets/images/START_STOP_BTN.png";

type ButtonProps = {
  customStyles?: string;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
};

export function PlayStopBtn({ onClick, disabled, style }: ButtonProps) {
  return (
    <button
      className={`cursor-pointer border-none bg-transparent p-0 transition-all hover:brightness-110 ${disabled ? "opacity-50" : ""}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-label="Start / Stop"
    >
      <img
        src={startStopBtn}
        alt="Start / Stop"
        width={150}
        height={63}
        draggable={false}
      />
    </button>
  );
}
