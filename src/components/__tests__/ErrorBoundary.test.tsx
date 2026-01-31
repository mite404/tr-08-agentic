import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

const BombComponent = ({
  message = "Test explosion",
}: {
  message?: string;
}) => {
  throw new Error(message);
};

describe("ErrorBoundary component:", () => {
  beforeEach(() => {
    // Suppress console noise
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Mock window.location.reload
    delete (window as any).location;
    window.location = { reload: vi.fn() } as any;
  });

  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("displays fallback UI when child component throws error", () => {
    // Render ErrorBoundary with BombComponent
    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );

    // Verify error heading appears
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
    // Verify reload button appears
    expect(
      screen.getByRole("button", { name: /reload page/i }),
    ).toBeInTheDocument();
  });

  it("displays the error message in the fallback UI", () => {
    // Render with custom error message
    render(
      <ErrorBoundary>
        <BombComponent message="Test custom error message" />
      </ErrorBoundary>,
    );

    // Verify the custom message appears
    expect(screen.getByText("Test custom error message")).toBeInTheDocument();
  });

  it("calls window.location.reload when reload button is clicked", () => {
    // Render ErrorBoundary with error
    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );

    // Find the reload button
    const reloadButton = screen.getByRole("button", { name: /reload page/i });

    // Simulate the user clicking the button
    fireEvent.click(reloadButton);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
