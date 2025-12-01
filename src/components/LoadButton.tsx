/**
 * Load Button Component
 *
 * A button that triggers the load beat functionality with loading states.
 * Shows "Loading..." when the load operation is in progress.
 *
 * Props:
 *   - onClick: Function to call when the button is clicked
 *   - isLoading: Whether a load operation is currently in progress
 *   - disabled: Whether the button should be disabled
 */

export interface LoadButtonProps {
  onClick: () => void | Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
}

export function LoadButton({ onClick, isLoading, disabled }: LoadButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? (
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
          Loading...
        </span>
      ) : (
        "Load"
      )}
    </button>
  );
}
