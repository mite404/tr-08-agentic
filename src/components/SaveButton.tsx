import metalSquareBtn from "../assets/images/METAL_SQUARE_BTN.png";

export interface SaveButtonProps {
  onClick: () => void | Promise<void>;
  isSaving: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function SaveButton({
  onClick,
  isSaving,
  disabled,
  style,
}: SaveButtonProps) {
  return (
    <button
      onClick={() => void onClick()}
      disabled={disabled || isSaving}
      style={style}
      className={`relative cursor-pointer border-none bg-transparent p-0 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
      aria-label="Save beat"
    >
      <img
        src={metalSquareBtn}
        alt="Save"
        className="h-auto w-full"
        draggable={false}
      />
      {isSaving && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="h-5 w-5 animate-spin text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
