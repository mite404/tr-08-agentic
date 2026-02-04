/**
 * Save Button Component
 *
 * A button that triggers the save beat functionality with loading states.
 * Shows "Saving..." when the save operation is in progress.
 *
 * Props:
 *   - onClick: Function to call when the button is clicked
 *   - isSaving: Whether a save operation is currently in progress
 *   - disabled: Whether the button should be disabled
 */

export interface SaveButtonProps {
  onClick: () => void | Promise<void>;
  isSaving: boolean;
  disabled?: boolean;
}

export function SaveButton({ onClick, isSaving, disabled }: SaveButtonProps) {
  return (
    <button
      onClick={() => void onClick()}
      disabled={disabled || isSaving}
      className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSaving ? (
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
          Saving...
        </span>
      ) : (
        "Save"
      )}
    </button>
  );
}
