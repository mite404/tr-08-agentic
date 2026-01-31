import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortraitBlocker } from "../PortraitBlocker";

describe("PortraitBlocker component:", () => {
  beforeEach(() => {
    // Mock window.matchMedia to simulate portrait orientation
    // This is needed because happy-dom doesn't implement a real CSS engine
    // without this mock, matchMedia().matches will always be false
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query === "(orientation: portrait) and (max-width: 768px)",
        media: query,
        onchange: null,
        addListener: () => {}, // deprecated but kept for compatibility
        removeListener: () => {}, // deprecated but kept for compatibility
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    });
  });

  it("renders the portrait warning text", () => {
    render(<PortraitBlocker />);

    expect(screen.getByText(/rotate/i)).toBeInTheDocument();
    expect(screen.getByText(/landscape/i)).toBeInTheDocument();
  });

  it("renders an overlay element", () => {
    render(<PortraitBlocker />);

    // check that the overlay exists (div w/ fixed positioning)
    const overlay = screen.getByRole("region", { name: /portrait/i });
    expect(overlay).toBeInTheDocument();
  });
});
