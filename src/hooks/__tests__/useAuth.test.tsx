import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { supabase } from "../../lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { Subscript } from "lucide-react";

function createMockSupabaseClient() {
  return {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  };
}

// Create initial mock instance
let mockSupabaseClient = createMockSupabaseClient();

// Intercept the supabase import before useAuth imports it
vi.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabaseClient;
  },
}));

// Test helpers
/**
 * Captures the callback passed to onAuthStateChange.
 * This lets us manually trigger auth events in tests.
 */
let authStateCallback:
  | ((event: string, session: Session | null) => void)
  | null = null;

/**
 * Helper to create a mock onAuthStateChangethat captures the callback.
 */
function createAuthListenerMock() {
  return vi.fn((callback) => {
    authStateCallback = callback;
    return {
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    };
  });
}

// Test suite
describe("useAuth hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    authStateCallback = null;

    // Default mocks for all tests
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockSupabaseClient.auth.onAuthStateChange = createAuthListenerMock();
  });

  // Phase 1: Initialization
  it("should initialize with loading=true", async () => {
    // TODO 1: Render the hook using renderHook()
    const { result } = renderHook(() => useAuth());
    // Assert that loading is initially true
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
  });

  // Phase 2: Session Initialization
  it("should call getSession on mount", async () => {
    // Render the hook
    renderHook(() => useAuth());

    // Assert getSession was called
    await waitFor(() => {
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
    });
  });

  it("should set loading to false after getSession resolves", async () => {
    // Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for loading to become false
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should populate session and user when getSession returns data", async () => {
    // Create mock session data
    const mockSession: Partial<Session> = {
      access_token: "mock-token",
      user: {
        id: "user-123",
        email: "test@example.com",
      } as User,
    };

    // Override the default mock to return our mock session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession as Session },
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual(mockSession);
    expect(result.current.user).toEqual(mockSession.user);
  });

  it("should register auth state listener on mount", async () => {
    // Use the callback capture mock
    mockSupabaseClient.auth.onAuthStateChange = createAuthListenerMock();

    renderHook(() => useAuth());

    // Assert that onAuthStateChange was called
    await waitFor(() => {
      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(1);
    });

    expect(authStateCallback).not.toBeNull();
  });

  it("should update session when auth state changes", async () => {
    mockSupabaseClient.auth.onAuthStateChange = createAuthListenerMock();

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Initially expect no session
    expect(result.current.session).toBeNull();

    // Create mock session
    const mockSession: Partial<Session> = {
      access_token: "mock-token",
      user: {
        id: "user-123",
        email: "test@example.com",
      } as User,
    };

    await waitFor(() => {
      // Trigger the auth state callback
      authStateCallback?.("SIGNED_IN", mockSession as Session);

      // Wait for session to update
      expect(result.current.session).toEqual(mockSession);
    });

    // Assert user is also updated
    expect(result.current.user).toEqual(mockSession.user);
  });

  it("should unsubscribe from listener on unmount", () => {
    // Create mock unsubscribe fn to verify it's called
    const mockUnsubscribe = vi.fn();

    // Override onAuthStateChange to track unsubscribe
    mockSupabaseClient.auth.onAuthStateChange = vi.fn((callback) => {
      authStateCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe,
          },
        },
      };
    });

    // Render the hook
    const { unmount } = renderHook(() => useAuth());

    // Verify unsubscribe hasn't benn called yet
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    // Unmount the hook
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
