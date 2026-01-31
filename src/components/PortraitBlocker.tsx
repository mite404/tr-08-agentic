/**
 * Portrait Blocker Component
 *
 * Displays a full-screen overlay when the device is in portrait mode on mobile.
 * This ensures the drum machine grid is only usable in landscape orientation
 * where there's sufficient screen width.
 *
 * Visible only when: orientation is portrait AND max-width is 768px
 */

import { useEffect, useState } from "react";

export default function PortraitBlocker() {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    // Check if device is in portrait mode on mobile
    const mediaQuery = window.matchMedia(
      "(orientation: portrait) and (max-width: 768px)",
    );

    // Set initial state
    setIsPortrait(mediaQuery.matches);

    // Listen for orientation changes
    const listener = (event: MediaQueryListEvent) => {
      setIsPortrait(event.matches);
    };

    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  if (!isPortrait) {
    return null;
  }

  return (
    <div
      data-testid="portrait-blocker"
      role="region"
      aria-label="Portrait orientation warning"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <svg
          className="h-16 w-16 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <h1 className="text-2xl font-bold text-white">
          Please Rotate Your Device to Play
        </h1>
        <p className="text-gray-400">
          This drum machine requires landscape orientation for the best
          experience.
        </p>
      </div>
    </div>
  );
}
