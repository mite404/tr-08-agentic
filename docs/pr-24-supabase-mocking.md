# PR #24: Supabase Mocking & Auth Hooks - Tutorial

**Goal:** Create comprehensive tests for the `useAuth` hook by mocking the Supabase client.

**Estimated Time:** ~2 hours  
**Learning Style:** Hybrid (fill-in-blanks + guided concepts)  
**Prerequisites:** Basic Vitest knowledge, React hooks familiarity

---

## Table of Contents

1. [Background Concepts](#background-concepts)
2. [Phase 1: Setup & Module Mock (15 min)](#phase-1-setup--module-mock)
3. [Phase 2: Session Initialization (20 min)](#phase-2-session-initialization)
4. [Phase 3: Auth State Listener (30 min)](#phase-3-auth-state-listener)
5. [Phase 4: Sign-In Methods (25 min)](#phase-4-sign-in-methods)
6. [Phase 5: Sign-Out (20 min)](#phase-5-sign-out)
7. [Phase 6: Documentation & Cleanup (10 min)](#phase-6-documentation--cleanup)
8. [Reference](#reference)

---

## Background Concepts

### What is Supabase Auth? (First Principles)

**What is it?**  
Supabase provides authentication as a service. Your app talks to Supabase's auth API through a JavaScript client. The client manages sessions, tokens, and user state.

**Key Methods You'll Mock:**

#### 1. `auth.getSession()`

- **What:** Fetches the current auth session (if any exists)
- **When:** Called once when your app loads to check if user is logged in
- **Returns:** `{ data: { session: Session | null }, error: Error | null }`
- **Session contains:** user info, access token, refresh token, expiry

**Real-world analogy:** Like checking your wallet for a valid ID card when entering a building.

#### 2. `auth.onAuthStateChange(callback)`

- **What:** Subscribes to auth events (sign-in, sign-out, token refresh)
- **When:** Set up once on app load
- **How it works:** You give Supabase a callback function, it calls your function whenever auth state changes
- **Returns:** `{ data: { subscription: { unsubscribe: () => void } } }`
- **Callback signature:** `(event: "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED", session: Session | null) => void`

**Real-world analogy:** Like subscribing to a newsletter — you give them your email (callback), they notify you when something happens.

#### 3. `auth.signInWithOAuth({ provider, options })`

- **What:** Initiates OAuth flow (redirects to Google/GitHub login)
- **Returns:** `{ error: Error | null }`
- **Throws:** If error exists

#### 4. `auth.signOut()`

- **What:** Signs user out, clears session
- **Returns:** `{ error: Error | null }`

---

### How `useAuth` Hook Works

**Purpose:** Wraps Supabase auth in a React hook so components can access auth state.

**Flow:**

```text
1. Component mounts with useAuth()
2. Hook calls getSession() → gets current session (or null)
3. Hook subscribes to onAuthStateChange() → listens for future changes
4. Hook returns { session, user, loading, signInWithGoogle, signInWithGithub, signOut }
5. Component unmounts → hook unsubscribes from listener
```

**State Management:**

- `loading`: true during initial fetch, false after
- `session`: null or Session object
- `user`: extracted from `session.user`

**Code:**

```typescript
// Simplified version of what the hook does:
const [loading, setLoading] = useState(true);
const [session, setSession] = useState(null);

useEffect(() => {
  // 1. Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setLoading(false);
  });

  // 2. Listen for changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    setSession(session);
    setLoading(false);
  });

  // 3. Cleanup
  return () => subscription.unsubscribe();
}, []);
```

---

### Why Mock Supabase?

**Problem:** Tests shouldn't talk to real Supabase servers because:

- **Slow:** Network requests take time
- **Unreliable:** Network failures, rate limits
- **Requires credentials:** Real API keys
- **Hard to test errors:** Can't easily simulate failure scenarios

**Solution:** Replace Supabase client with a fake one that:

- Returns predictable data instantly
- Lets us simulate success/error scenarios
- Doesn't make network requests

**Mocking Strategy:**

```typescript
// Real code does this:
import { supabase } from "../lib/supabase";
supabase.auth.getSession(); // Hits real API

// In tests, we intercept it:
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));
// Now getSession returns fake data instantly
```

---

## Phase 1: Setup & Module Mock

**Time:** 15 minutes  
**Concepts:** Module mocking, test file structure

### Concept: Module Mocking

**What is it?**  
Module mocking replaces a real module (like `../lib/supabase`) with a fake version during tests.

**Why?**  
The `useAuth` hook imports `supabase` from `../lib/supabase`. We need to replace that import with a fake Supabase client that we control.

**How it works:**

```typescript
// The hook imports the real supabase:
import { supabase } from "../lib/supabase";

// In tests, vi.mock() intercepts that import:
vi.mock("../lib/supabase", () => ({
  supabase: ourFakeSupabase, // Use our fake instead
}));
```

**Key:** `vi.mock()` must be called at the top level (not inside a test) and BEFORE importing the code that uses the mock.

---

### Step 1.1: Create the Test File Skeleton

Create `src/hooks/__tests__/useAuth.test.tsx` with the following structure:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { supabase } from "../../lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

// ============================================================================
// MOCK SETUP
// ============================================================================

/**
 * Creates a mock Supabase client with all auth methods.
 * This factory lets us reset mocks between tests.
 */
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

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Captures the callback passed to onAuthStateChange.
 * This lets us manually trigger auth events in tests.
 */
let authStateCallback:
  | ((event: string, session: Session | null) => void)
  | null = null;

/**
 * Helper to create a mock onAuthStateChange that captures the callback.
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

// ============================================================================
// TEST SUITE
// ============================================================================

describe("useAuth hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    authStateCallback = null;
  });

  // ========================================================================
  // PHASE 1: INITIALIZATION
  // ========================================================================

  it("should initialize with loading=true", () => {
    // TODO 1: Render the hook using renderHook()
    // Hint: const { propertyName } = renderHook(() => yourHookCall());
    // TODO 2: Assert that loading is initially true
    // Hint: expect(result.current.loading).toBe(???);
  });

  // ========================================================================
  // PHASE 2: SESSION INITIALIZATION
  // ========================================================================

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

    // Render the hook
    renderHook(() => useAuth());

    // TODO: Assert that getSession was called
    // Hint: expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(???);
  });

  it("should set loading to false after getSession resolves", async () => {
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

    // Render the hook
    const { result } = renderHook(() => useAuth());

    // Initially loading is true
    expect(result.current.loading).toBe(true);

    // TODO: Wait for loading to become false
    // Hint: await waitFor(() => { expect(result.current.loading).toBe(???); });
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

    // Mock getSession to return our mock session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession as Session },
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

    // Render the hook
    const { result } = renderHook(() => useAuth());

    // TODO: Wait for loading to become false
    // (Same pattern as previous test - wait for async work to complete)

    // TODO: Assert session is populated
    // Think: We mocked getSession to return mockSession. What should result.current.session be?
    // Use .toEqual() for objects (it checks properties), not .toBe() (which checks reference)

    // TODO: Assert user is populated
    // Think: The hook extracts user from the session. Check useAuth.ts to see how it's extracted.
    // What should result.current.user equal?
  });

  // ========================================================================
  // PHASE 3: AUTH STATE LISTENER
  // ========================================================================

  it("should register auth state listener on mount", () => {
    // Mock getSession
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Use our callback capture mock
    mockSupabaseClient.auth.onAuthStateChange = createAuthListenerMock();

    // Render the hook
    renderHook(() => useAuth());

    // TODO: Assert that onAuthStateChange was called
    // Think: How many times should the hook register a listener on mount?
    // Use the same matcher pattern from Phase 2

    // TODO: Assert that we captured a callback
    // Think: The variable authStateCallback should now contain the function. How do you check it's not null?
  });

  it("should update session when auth state changes", async () => {
    // Mock getSession to return null initially
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Use callback capture mock
    mockSupabaseClient.auth.onAuthStateChange = createAuthListenerMock();

    // Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Initially no session
    expect(result.current.session).toBeNull();

    // Create mock session
    const mockSession: Partial<Session> = {
      access_token: "new-token",
      user: {
        id: "user-456",
        email: "new@example.com",
      } as User,
    };

    // TODO: Trigger the auth state change callback
    // Think: We captured the callback in authStateCallback. Now we need to call it manually.
    // The callback signature is: (event: string, session: Session | null) => void
    // What event name should we pass? What session should we pass?
    // Note: The ! is TypeScript's non-null assertion operator

    // TODO: Wait for session to update
    // Think: After triggering the callback, the hook will update its state
    // This is async, so we need to wait. What should result.current.session equal after the update?

    // TODO: Assert user is also updated
    // Think: If session updated, what should result.current.user be?
  });

  it("should unsubscribe from listener on unmount", () => {
    // Mock getSession
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Create mock unsubscribe function
    const mockUnsubscribe = vi.fn();

    // Mock onAuthStateChange to return our mock unsubscribe
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: mockUnsubscribe,
        },
      },
    });

    // Render the hook
    const { unmount } = renderHook(() => useAuth());

    // Verify unsubscribe hasn't been called yet
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    // TODO: Unmount the hook
    // Think: renderHook returns an object with an unmount function
    // We destructured it above. Now call that function to simulate component unmount.

    // TODO: Assert unsubscribe was called
    // Think: The hook's cleanup function (useEffect return) should call unsubscribe
    // How do we verify our mock unsubscribe function was called?
  });

  // ========================================================================
  // PHASE 4: SIGN-IN METHODS
  // ========================================================================

  it("should call signInWithOAuth with google provider", async () => {
    // Mock getSession
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock listener
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    });

    // Mock signInWithOAuth to succeed
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
      error: null,
      data: {} as any,
    });

    // Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // TODO: Call signInWithGoogle
    // Think: The hook returns a signInWithGoogle function
    // Access it via result.current and call it
    // Remember: it's async, so you need await

    // TODO: Assert signInWithOAuth was called with correct provider
    // Think: Look at useAuth.ts - what arguments does signInWithGoogle pass to signInWithOAuth?
    // You need to verify the provider and the options object
    // Pattern: expect(mockFunction).toHaveBeenCalledWith(expectedArguments)
  });

  it("should call signInWithOAuth with github provider", async () => {
    // Mock getSession
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock listener
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    });

    // Mock signInWithOAuth to succeed
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
      error: null,
      data: {} as any,
    });

    // Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // TODO: Call signInWithGithub
    // Think: Same pattern as signInWithGoogle, but with the GitHub method

    // TODO: Assert signInWithOAuth was called with 'github' provider
    // Think: Check useAuth.ts - what's different between Google and GitHub calls?
  });

  it("should throw error when signInWithOAuth fails", async () => {
    // Mock getSession
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock listener
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    });

    // Mock signInWithOAuth to return error
    const mockError = new Error("OAuth failed");
    mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
      error: mockError,
      data: {} as any,
    });

    // Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // TODO: Assert that calling signInWithGoogle throws
    // Think: The hook should throw the error when Supabase returns an error
    // For async functions that throw, use: expect(asyncFunction()).rejects.toThrow()
    // What should the error be? (We created mockError above)
  });

  // ========================================================================
  // PHASE 5: SIGN-OUT
  // ========================================================================

  it("should call signOut on Supabase client", async () => {
    // Mock getSession
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock listener
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    });

    // Mock signOut to succeed
    mockSupabaseClient.auth.signOut.mockResolvedValue({
      error: null,
    });

    // Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // TODO: Call signOut
    // Think: Same pattern as signInWithGoogle - access via result.current, call the function

    // TODO: Assert signOut was called on Supabase client
    // Think: How do we verify the underlying Supabase method was called?
  });

  it("should throw error when signOut fails", async () => {
    // Mock getSession
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock listener
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    });

    // Mock signOut to fail
    const mockError = new Error("Sign out failed");
    mockSupabaseClient.auth.signOut.mockResolvedValue({
      error: mockError,
    });

    // Render the hook
    const { result } = renderHook(() => useAuth());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // TODO: Assert that calling signOut throws
    // Think: Same error testing pattern as Phase 4 - use .rejects.toThrow()
  });
});
```

---

### Step 1.2: Review the Skeleton File

The skeleton above contains:

1. **Imports:** Vitest, testing-library, React types
2. **Mock Factory:** `createMockSupabaseClient()` function
3. **Module Mock:** `vi.mock()` call that intercepts Supabase
4. **Test Helpers:** Callback capture setup for listener testing
5. **Test Suite:** `describe()` block with setup/teardown
6. **All Tests:** Skeleton with TODOs for all 12 tests

Copy this entire code block into `src/hooks/__tests__/useAuth.test.tsx`.

---

### Step 1.3: Fill in Phase 1 TODOs

In the first test (`should initialize with loading=true`), there are 2 TODOs:

**TODO 1:** Render the hook using `renderHook()`

**Conceptual Process:**

1. `renderHook()` is like `render()` for components, but specifically for testing hooks
2. The function takes a callback that returns the hook you want to test
3. It returns an object with a `result` property that lets you access the hook's return value
4. Pattern to remember: You need to destructure the returned object to get `result`

**Why this approach?** Industry standard for testing React hooks because hooks can't be called outside of React components. `renderHook()` creates a test component internally.

**TODO 2:** Assert that loading is initially true

**Conceptual Process:**

1. Access the hook's return value through `result.current`
2. The `useAuth` hook returns an object with several properties (check `useAuth.ts` to see what it returns)
3. On the very first render, before any async work completes, what should `loading` be?
4. Use the `.toBe()` matcher for strict equality checks with booleans

**Why test this?** We're verifying the initial state before any async operations complete. This ensures users see a loading state.

---

### Step 1.4: Run Phase 1 Test

```bash
bun run test src/hooks/__tests__/useAuth.test.tsx
```

**Expected Output:**

```text
✓ src/hooks/__tests__/useAuth.test.tsx (1)
  ✓ useAuth hook (1)
    ✓ should initialize with loading=true
```

**If it fails:**

- Check that you imported `renderHook` from `@testing-library/react`
- Verify the function is called with `() => useAuth()`
- Make sure you're checking `result.current.loading`

---

### Step 1.5: Understanding What Happened

When you run this test:

1. **Vitest loads your test file**
2. **`vi.mock()` intercepts the Supabase import** — replaces real client with mock
3. **Test executes:** `renderHook(() => useAuth())`
4. **useAuth hook runs:**
   - Sets `loading = true` (initial state)
   - Calls `supabase.auth.getSession()` (the mock)
   - Calls `supabase.auth.onAuthStateChange()` (the mock)
5. **You assert:** `loading` is `true` at this moment
6. **Test passes** ✅

**Key insight:** The hook's async work (getSession) hasn't completed yet, so loading is still true.

---

### ✅ Phase 1 Complete

You've learned:

- How to create a mock factory
- How to use `vi.mock()` to intercept module imports
- How to render a hook with `renderHook()`
- How to access hook return values with `result.current`

**Next:** Phase 2 - Testing async behavior when getSession resolves.

---

## Phase 2: Session Initialization

**Time:** 20 minutes  
**Concepts:** Async testing, `waitFor()`, testing state changes

### Concept: Async Testing with `waitFor()`

**The Problem:**  
React hooks update state asynchronously. When `getSession()` resolves, the hook updates `loading` to `false`. But this happens AFTER the initial render.

**Timeline:**

```text
t=0ms:  Hook renders, loading=true, getSession() called
t=5ms:  getSession() resolves (in our mock, instant)
t=10ms: Hook re-renders, loading=false, session populated
```

**The Solution: `waitFor()`**  
This utility repeatedly checks a condition until it passes (or times out).

```typescript
await waitFor(() => {
  expect(result.current.loading).toBe(false);
});
```

**What this does:**

1. Checks if `loading === false`
2. If false, continue (assertion fails)
3. Wait a bit (default: 50ms)
4. Check again
5. Repeat until assertion passes or timeout (default: 1000ms)

---

### Step 2.1: Add Tests for Session Initialization

Add these tests after your first test:

```typescript
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

  // Render the hook
  renderHook(() => useAuth());

  // TODO: Assert that getSession was called
  // Hint: expect(mockSupabaseClient.auth.getSession).toHaveBeenCalledTimes(???);
});

it("should set loading to false after getSession resolves", async () => {
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

  // Render the hook
  const { result } = renderHook(() => useAuth());

  // Initially loading is true
  expect(result.current.loading).toBe(true);

  // TODO: Wait for loading to become false
  // Hint: await waitFor(() => { expect(result.current.loading).toBe(???); });
});
```

---

### Step 2.2: Fill in the TODOs

**Test 1 TODO:** Assert getSession was called

**Conceptual Process:**

1. We have a mock function (`mockSupabaseClient.auth.getSession`)
2. We need to verify it was called when the hook mounted
3. Vitest provides matchers for checking mock function calls
4. Think: What matcher checks "how many times was this function called"?

**Why verify this?** We're ensuring the hook actually fetches the session on mount. If this isn't called, the hook won't initialize properly.

**Industry standard:** Always verify that critical async operations are triggered. This test would catch a bug where the hook forgets to call `getSession()`.

**Test 2 TODO:** Wait for loading to become false

**Conceptual Process:**

1. We know `loading` starts as `true`
2. After `getSession()` resolves (which happens asynchronously), the hook should update `loading` to `false`
3. This state update happens AFTER our initial assertion
4. We need a way to "wait" for the state to update before asserting
5. Use the `waitFor()` utility - it's specifically designed for this pattern

**Pattern to remember:**

- `waitFor()` is async, so you need `await`
- It takes a callback function with your assertion inside
- It will retry the assertion until it passes (or times out)

**Why this approach?** React state updates are asynchronous. Without `waitFor()`, your test would run too fast and assert before the state updates.

---

### Step 2.3: Add Test for Session Population

Add this test to verify session/user are set when getSession returns data:

```typescript
it("should populate session and user when getSession returns data", async () => {
  // Create mock session data
  const mockSession: Partial<Session> = {
    access_token: "mock-token",
    user: {
      id: "user-123",
      email: "test@example.com",
    } as User,
  };

  // Mock getSession to return our mock session
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: mockSession as Session },
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

  // Render the hook
  const { result } = renderHook(() => useAuth());

  // TODO: Wait for loading to become false
  // (Same pattern as previous test - wait for async work to complete)

  // TODO: Assert session is populated
  // Think: We mocked getSession to return mockSession. What should result.current.session be?
  // Use .toEqual() for objects (it checks properties), not .toBe() (which checks reference)

  // TODO: Assert user is populated
  // Think: The hook extracts user from the session. Check useAuth.ts to see how it's extracted.
  // What should result.current.user equal?
});
```

---

### Step 2.4: Fill in the TODOs

**TODO 1:** Wait for loading to become false

**Conceptual Process:**

- Same pattern as the previous test
- The hook does async work, so we need to wait for state updates
- Review the previous test if you need a reminder of the waitFor() pattern

**TODO 2:** Assert session is populated

**Conceptual Process:**

1. We mocked `getSession()` to return `mockSession`
2. The hook should store that session in its state
3. Access the hook's return value via `result.current.session`
4. Compare it to `mockSession`

**Key distinction: `.toBe()` vs `.toEqual()`**

- `.toBe()`: Checks if two values are the exact same reference (like `===`)
- `.toEqual()`: Checks if two objects have the same properties and values (deep equality)
- For objects, always use `.toEqual()`

**Why this matters:** Industry standard is to use `.toEqual()` for objects/arrays because you care about the content, not the memory reference.

**TODO 3:** Assert user is populated

**Conceptual Process:**

1. Look at `useAuth.ts` - how does it extract the user from the session?
2. The hook should expose this user via its return value
3. Check what `mockSession.user` contains
4. Assert that `result.current.user` matches that value

---

### Step 2.5: Run the Tests

```bash
bun run test src/hooks/__tests__/useAuth.test.tsx
```

**Expected Output:**

```text
✓ useAuth hook (4)
  ✓ should initialize with loading=true
  ✓ should call getSession on mount
  ✓ should set loading to false after getSession resolves
  ✓ should populate session and user when getSession returns data
```

**If tests fail:**

- Check that you're using `await waitFor()`
- Verify mock returns match expected structure
- Make sure `result.current` is used to access hook values

---

### ✅ Phase 2 Complete

You've learned:

- How to test async hook behavior with `waitFor()`
- How to verify functions were called with `.toHaveBeenCalledTimes()`
- How to create mock data for tests
- How to assert object equality with `.toEqual()`

**Next:** Phase 3 - Testing the auth listener with callback capture.

---

## Phase 3: Auth State Listener

**Time:** 30 minutes  
**Concepts:** Callback capture, listener pattern, cleanup testing

### Concept: Callback Capture Pattern

**The Challenge:**  
The `onAuthStateChange()` method takes a callback function:

```typescript
// Inside useAuth hook:
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setLoading(false);
});
```

**Question:** How do we test that this callback updates state?

**Answer:** Capture the callback, then call it ourselves!

**Pattern:**

```typescript
// 1. Create variable to store the callback
let capturedCallback: (event: string, session: Session | null) => void;

// 2. Mock onAuthStateChange to capture the callback
mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
  capturedCallback = callback; // Save it!
  return {
    data: {
      subscription: { unsubscribe: vi.fn() },
    },
  };
});

// 3. Later in test: manually trigger the callback
capturedCallback("SIGNED_IN", mockSession);

// 4. Assert: state updated based on callback
expect(result.current.session).toEqual(mockSession);
```

**Why this works:**

- We "spy" on what the hook passes to `onAuthStateChange`
- Then we simulate Supabase calling that callback
- This lets us test the hook's response to auth events

---

### Step 3.1: Write the Callback Capture Variable

**The Challenge:** We need a place to store the callback that `useAuth` passes to `onAuthStateChange()`. This way, we can trigger it manually in our tests to simulate auth state changes.

Add this code BEFORE your `describe()` block:

```typescript
// ============================================================================
// TEST HELPERS
// ============================================================================

// TODO 1: Create a variable to store the callback
// Think: The callback is a function that takes (event: string, session: Session | null)
// and returns void. What should the variable type be?
// Type hint: It starts as null, so use a union type with null.
// Example structure:
// let authStateCallback: ??? = null;
```

**Why this matters:**

- You're creating a "container" to hold a function that gets passed to `onAuthStateChange()`
- The callback signature tells us what parameters the auth listener expects
- By storing it, we can call it manually in tests

---

### Step 3.2: Write the Callback Capture Helper Function

Now write a helper function that creates a mock `onAuthStateChange`:

```typescript
// TODO 2: Create a function that captures the callback
// This function should:
//   1. Return a vi.fn() (a mock function)
//   2. That mock function takes a callback as a parameter
//   3. The callback should be saved to authStateCallback
//   4. The mock should return the subscription structure that onAuthStateChange returns
//
// Pattern hint:
// function createAuthListenerMock() {
//   return vi.fn((callback) => {
//     // TODO: Save the callback
//     // TODO: Return subscription structure
//   });
// }
//
// The return structure should match what Supabase returns:
// { data: { subscription: { unsubscribe: vi.fn() } } }
```

**Why this matters:**

- `mockImplementation` lets us intercept what parameters are passed to the mock
- By saving the callback, we can manually trigger auth events in tests
- This is the "callback capture pattern" — a powerful testing technique

---

### Step 3.3: Update beforeEach to Reset the Captured Callback

Add this reset logic to your `beforeEach`:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // TODO: Reset authStateCallback to null
  // This ensures each test starts fresh without leftover callbacks from previous tests
});
```

---

### Step 3.4: Fill in the Callback Capture TODOs

**TODO 1 - Create the callback variable:**

**Conceptual Process:**

1. Look at the callback signature: `(event: string, session: Session | null) => void`
2. This is a function type
3. Since it starts as `null` (no callback captured yet), use a union type
4. The pattern: `let authStateCallback: ??? = null;`

**TODO 2 - Create the helper function:**

**Conceptual Process:**

1. This function returns a mock function using `vi.fn()`
2. The mock accepts a `callback` parameter (this is what `useAuth` passes to `onAuthStateChange`)
3. Inside the mock, save that callback: `authStateCallback = callback`
4. Return the subscription structure that matches Supabase's real API
5. This is how we "trap" and store the callback for manual triggering later

**TODO 3 - Reset in beforeEach:**

Just add: `authStateCallback = null;` in the `beforeEach` hook so each test starts clean.

---

### Step 3.5: Add Test for Listener Registration

```typescript
it("should register auth state listener on mount", () => {
  // Mock getSession
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Use our callback capture mock
  mockSupabaseClient.auth.onAuthStateChange = createAuthListenerMock();

  // Render the hook
  renderHook(() => useAuth());

  // TODO: Assert that onAuthStateChange was called
  // Think: How many times should the hook register a listener on mount?
  // Use the same matcher pattern from Phase 2

  // TODO: Assert that we captured a callback
  // Think: The variable authStateCallback should now contain the function. How do you check it's not null?
});
```

---

### Step 3.6: Add Test for Callback Triggering

```typescript
it("should update session when auth state changes", async () => {
  // Mock getSession to return null initially
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Use callback capture mock
  mockSupabaseClient.auth.onAuthStateChange = createAuthListenerMock();

  // Render the hook
  const { result } = renderHook(() => useAuth());

  // Wait for initial load
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // Initially no session
  expect(result.current.session).toBeNull();

  // Create mock session
  const mockSession: Partial<Session> = {
    access_token: "new-token",
    user: {
      id: "user-456",
      email: "new@example.com",
    } as User,
  };

  // TODO: Trigger the auth state change callback
  // Think: We captured the callback in authStateCallback. Now we need to call it manually.
  // The callback signature is: (event: string, session: Session | null) => void
  // What event name should we pass? What session should we pass?
  // Note: The ! is TypeScript's non-null assertion operator

  // TODO: Wait for session to update
  // Think: After triggering the callback, the hook will update its state
  // This is async, so we need to wait. What should result.current.session equal after the update?

  // TODO: Assert user is also updated
  // Think: If session updated, what should result.current.user be?
});
```

---

### Step 3.7: Add Test for Cleanup

```typescript
it("should unsubscribe from listener on unmount", () => {
  // Mock getSession
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Create mock unsubscribe function
  const mockUnsubscribe = vi.fn();

  // Mock onAuthStateChange to return our mock unsubscribe
  mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
    data: {
      subscription: {
        unsubscribe: mockUnsubscribe,
      },
    },
  });

  // Render the hook
  const { unmount } = renderHook(() => useAuth());

  // Verify unsubscribe hasn't been called yet
  expect(mockUnsubscribe).not.toHaveBeenCalled();

  // TODO: Unmount the hook
  // Think: renderHook returns an object with an unmount function
  // We destructured it above. Now call that function to simulate component unmount.

  // TODO: Assert unsubscribe was called
  // Think: The hook's cleanup function (useEffect return) should call unsubscribe
  // How do we verify our mock unsubscribe function was called?
});
```

---

### Step 3.6: Fill in All TODOs and Run Tests

```bash
bun run test src/hooks/__tests__/useAuth.test.tsx
```

**Expected Output:**

```text
✓ useAuth hook (7)
  ✓ should initialize with loading=true
  ✓ should call getSession on mount
  ✓ should set loading to false after getSession resolves
  ✓ should populate session and user when getSession returns data
  ✓ should register auth state listener on mount
  ✓ should update session when auth state changes
  ✓ should unsubscribe from listener on unmount
```

---

### ✅ Phase 3 Complete

You've learned:

- Callback capture pattern for testing listeners
- How to manually trigger callbacks in tests
- How to test cleanup behavior with `unmount()`
- How to verify subscription/unsubscription

**Next:** Phase 4 - Testing sign-in methods.

---

## Phase 4: Sign-In Methods

**Time:** 25 minutes  
**Concepts:** Testing async methods, error scenarios

### Concept: Testing Hook Methods

The `useAuth` hook returns methods like `signInWithGoogle()` and `signInWithGithub()`. These are async functions that call Supabase internally.

**Pattern:**

```typescript
const { result } = renderHook(() => useAuth());

// Call the method
await result.current.signInWithGoogle();

// Assert the underlying Supabase method was called correctly
expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
  provider: "google",
  options: { redirectTo: window.location.origin },
});
```

---

### Step 4.1: Add Test for Google Sign-In

```typescript
it("should call signInWithOAuth with google provider", async () => {
  // Mock getSession
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Mock listener
  mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
    data: {
      subscription: { unsubscribe: vi.fn() },
    },
  });

  // Mock signInWithOAuth to succeed
  mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
    error: null,
    data: {} as any,
  });

  // Render the hook
  const { result } = renderHook(() => useAuth());

  // Wait for initial load
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // TODO: Call signInWithGoogle
  // Think: The hook returns a signInWithGoogle function
  // Access it via result.current and call it
  // Remember: it's async, so you need await

  // TODO: Assert signInWithOAuth was called with correct provider
  // Think: Look at useAuth.ts - what arguments does signInWithGoogle pass to signInWithOAuth?
  // You need to verify the provider and the options object
  // Pattern: expect(mockFunction).toHaveBeenCalledWith(expectedArguments)
});
```

---

### Step 4.2: Add Test for GitHub Sign-In

```typescript
it("should call signInWithOAuth with github provider", async () => {
  // Mock getSession
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Mock listener
  mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
    data: {
      subscription: { unsubscribe: vi.fn() },
    },
  });

  // Mock signInWithOAuth to succeed
  mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
    error: null,
    data: {} as any,
  });

  // Render the hook
  const { result } = renderHook(() => useAuth());

  // Wait for initial load
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // TODO: Call signInWithGithub
  // Think: Same pattern as signInWithGoogle, but with the GitHub method

  // TODO: Assert signInWithOAuth was called with 'github' provider
  // Think: Check useAuth.ts - what's different between Google and GitHub calls?
});
```

---

### Step 4.3: Add Test for Sign-In Error

```typescript
it("should throw error when signInWithOAuth fails", async () => {
  // Mock getSession
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Mock listener
  mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
    data: {
      subscription: { unsubscribe: vi.fn() },
    },
  });

  // Mock signInWithOAuth to return error
  const mockError = new Error("OAuth failed");
  mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
    error: mockError,
    data: {} as any,
  });

  // Render the hook
  const { result } = renderHook(() => useAuth());

  // Wait for initial load
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // TODO: Assert that calling signInWithGoogle throws
  // Think: The hook should throw the error when Supabase returns an error
  // For async functions that throw, use: expect(asyncFunction()).rejects.toThrow()
  // What should the error be? (We created mockError above)
});
```

---

### Step 4.4: Fill in TODOs and Verify

**Key Concept: Testing Async Errors**

When testing async functions that throw errors:

1. Use `expect(asyncFunction()).rejects.toThrow()` pattern
2. The `.rejects` matcher waits for the Promise to reject
3. The `.toThrow()` matcher checks that it threw an error

**Why this pattern?** You can't use try/catch in tests easily. The `.rejects` matcher is the industry standard for testing Promise rejections.

**What to verify:**

- That the function throws when Supabase returns an error
- Optionally, that it throws the specific error object

Run tests:

```bash
bun run test src/hooks/__tests__/useAuth.test.tsx
```

---

### ✅ Phase 4 Complete

You've learned:

- How to test hook methods by calling them directly
- How to verify method calls with specific arguments
- How to test error scenarios with `.rejects.toThrow()`

**Next:** Phase 5 - Testing sign-out.

---

## Phase 5: Sign-Out

**Time:** 20 minutes  
**Concepts:** Similar to sign-in testing

### Step 5.1: Add Sign-Out Success Test

```typescript
it("should call signOut on Supabase client", async () => {
  // Mock getSession
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Mock listener
  mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
    data: {
      subscription: { unsubscribe: vi.fn() },
    },
  });

  // Mock signOut to succeed
  mockSupabaseClient.auth.signOut.mockResolvedValue({
    error: null,
  });

  // Render the hook
  const { result } = renderHook(() => useAuth());

  // Wait for initial load
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // TODO: Call signOut
  // Think: Same pattern as signInWithGoogle - access via result.current, call the function

  // TODO: Assert signOut was called on Supabase client
  // Think: How do we verify the underlying Supabase method was called?
});
```

---

### Step 5.2: Add Sign-Out Error Test

```typescript
it("should throw error when signOut fails", async () => {
  // Mock getSession
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Mock listener
  mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
    data: {
      subscription: { unsubscribe: vi.fn() },
    },
  });

  // Mock signOut to fail
  const mockError = new Error("Sign out failed");
  mockSupabaseClient.auth.signOut.mockResolvedValue({
    error: mockError,
  });

  // Render the hook
  const { result } = renderHook(() => useAuth());

  // Wait for initial load
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // TODO: Assert that calling signOut throws
  // Think: Same error testing pattern as Phase 4 - use .rejects.toThrow()
});
```

---

### Step 5.3: Fill in TODOs

**Conceptual Guidance:**

**Test 1 - Calling signOut:**

- The pattern is identical to calling signInWithGoogle
- Access the method from the hook's return value
- It's async, so use await
- Then verify the underlying Supabase method was called

**Test 2 - Error handling:**

- Same pattern as testing signInWithGoogle errors
- Use the `.rejects.toThrow()` matcher for async error testing
- Verify it throws the error we mocked

Run tests:

```bash
bun run test src/hooks/__tests__/useAuth.test.tsx
```

**Expected:** All 12 tests passing.

---

### ✅ Phase 5 Complete

You've learned:

- How to test sign-out functionality
- Pattern recognition (sign-out tests mirror sign-in tests)

**Next:** Phase 6 - Documentation and cleanup.

---

## Phase 6: Documentation & Cleanup

**Time:** 10 minutes

### Step 6.1: Final Test Run

Run the complete test suite:

```bash
bun run test src/hooks/__tests__/useAuth.test.tsx
```

**Expected Output:**

```text
✓ src/hooks/__tests__/useAuth.test.tsx (12)
  ✓ useAuth hook (12)
    ✓ should initialize with loading=true
    ✓ should call getSession on mount
    ✓ should set loading to false after getSession resolves
    ✓ should populate session and user when getSession returns data
    ✓ should register auth state listener on mount
    ✓ should update session when auth state changes
    ✓ should unsubscribe from listener on unmount
    ✓ should call signInWithOAuth with google provider
    ✓ should call signInWithOAuth with github provider
    ✓ should throw error when signInWithOAuth fails
    ✓ should call signOut on Supabase client
    ✓ should throw error when signOut fails

Test Files  1 passed (1)
     Tests  12 passed (12)
```

---

### Step 6.2: Update IMPLEMENTATION.md

Open `docs/IMPLEMENTATION.md` and find PR #24 section:

Change this:

```markdown
#### PR #24: Supabase Mocking & Auth Hooks — 🚧 PLANNED
```

To this:

```markdown
#### PR #24: Supabase Mocking & Auth Hooks ✅ COMPLETE

**Completed:** 2026-01-31  
**Test File:** `src/hooks/__tests__/useAuth.test.tsx` (12 tests passing)
```

Update all checkboxes from `[ ]` to `[x]`.

---

### Step 6.3: Optional - Add Patterns to FOR_ETHAN.md

If you want to document what you learned, add a new section to `docs/FOR_ETHAN.md`:

```markdown
## 15. Testing React Hooks with Mocks

**Pattern:** Module mocking with Vitest

### Callback Capture Pattern

When testing hooks that register listeners, capture the callback:

\`\`\`typescript
let capturedCallback;
mockClient.onEvent.mockImplementation((callback) => {
capturedCallback = callback;
return { unsubscribe: vi.fn() };
});

// Later: trigger callback manually
capturedCallback('EVENT', data);
\`\`\`

### Async Hook Testing

Use `waitFor()` to wait for state updates:

\`\`\`typescript
await waitFor(() => {
expect(result.current.loading).toBe(false);
});
\`\`\`
```

---

### ✅ Phase 6 Complete - PR #24 Finished

**Congratulations!** You've successfully:

- Created comprehensive tests for the `useAuth` hook
- Learned module mocking with Vitest
- Mastered callback capture pattern
- Tested async hook behavior
- Established mocking patterns for future PRs

---

## Reference

### Common Patterns

#### Module Mock Structure

```typescript
const mockClient = {
  method1: vi.fn(),
  method2: vi.fn(),
};

vi.mock("../path/to/module", () => ({
  exportedName: mockClient,
}));
```

#### Hook Testing Template

```typescript
it("should do something", async () => {
  // 1. Setup mocks
  mockClient.method.mockResolvedValue({ data: {} });

  // 2. Render hook
  const { result } = renderHook(() => useMyHook());

  // 3. Wait for async work
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // 4. Assert
  expect(result.current.data).toEqual({});
});
```

#### Callback Capture

```typescript
let callback;
mock.registerListener.mockImplementation((cb) => {
  callback = cb;
  return { cleanup: vi.fn() };
});

// Trigger: callback('EVENT', data);
```

---

### Troubleshooting

**Problem:** "Cannot find module '@testing-library/react'"  
**Solution:** Run `bun install @testing-library/react`

**Problem:** "waitFor is not a function"  
**Solution:** Import it: `import { renderHook, waitFor } from '@testing-library/react'`

**Problem:** "Test times out"  
**Solution:** Check that your mock returns a Promise with `.mockResolvedValue()`

**Problem:** "result.current is undefined"  
**Solution:** Make sure you destructured: `const { result } = renderHook(...)`

---

### Key Takeaways

1. **Module mocks intercept imports** - Use `vi.mock()` before importing tested code
2. **Callback capture tests listeners** - Save callbacks, trigger them manually
3. **waitFor handles async** - Don't assert immediately, wait for state updates
4. **renderHook tests hooks** - Like `render()` but for hooks
5. **Mock return values matter** - Match Supabase's actual return structure

---

**End of Tutorial**
