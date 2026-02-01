import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { supabase } from "../../lib/supabase";
import { Session, User } from "@supabase/supabase-js";

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

let mockSupabaseClient = createMockSupabaseClient();

// Intercept the supabase import before useAuth imports it
vi.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabaseClient;
  },
}));

// Test helpers
let authStateCallback:
  | ((event: string, session: Session | null) => void)
  | null = null;

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

describe("useAuth hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    authStateCallback = null;
  });

  it("should call getSession on mount", async () => {
    // Mock getSession to return null session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock the listener
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });

    // render the hook
    renderHook(() => useAuth());

    // TODO: assert getSession was called
  });
});
