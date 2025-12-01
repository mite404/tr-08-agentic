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
    // BPM Display
    <div className="flex w-full">
      <div
        className={`flex h-14 grow flex-col items-center justify-center rounded-tl-lg rounded-bl-lg bg-red-950 px-4`}
      >
        <div className="">
          <span className="text-sm text-red-600">TEMPO</span>
          <span className="text-5xl font-bold text-red-600">{bpmValue}</span>
        </div>
      </div>

      {/* arrow container */}
      <div className="flex h-14 flex-col">
        <button
          className="flex h-1/2 w-10 cursor-pointer items-center justify-center rounded-tr-lg border-b bg-gray-500 p-0 text-sm select-none hover:opacity-80"
          onClick={onIncrementClick}
        >
          ▲
        </button>
        <button
          className="flex h-1/2 w-10 cursor-pointer items-center justify-center rounded-br-lg bg-gray-500 p-0 text-sm select-none hover:opacity-80"
          onClick={onDecrementClick}
        >
          ▼
        </button>
      </div>
    </div>
  );
}
