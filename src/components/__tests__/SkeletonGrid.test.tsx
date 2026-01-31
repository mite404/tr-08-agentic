import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkeletonGrid } from "../SkeletonGrid";

describe("SkeletonGrid component:", () => {
  it("renders the correct number of skeleton pads", () => {
    // Render component
    render(<SkeletonGrid />);

    // Find all skeleton pads
    const pads = screen.getAllByTestId("skeleton-pad");

    // Verify we have 160 pads (10 rows × 16 columns)
    expect(pads).toHaveLength(160);
  });

  it("each pad has the skeleton stlying class", () => {
    render(<SkeletonGrid />);

    const pads = screen.getAllByTestId("skeleton-pad");

    // Each pad should have 'animate-pulse' class
    pads.forEach((pad) => {
      expect(pad).toHaveClass("animate-pulse");
    });
  });
});
