# PR #23 Tutorial: Testing Error Boundaries (The Safety Net)

**Audience:** Intermediate TypeScript developer, new to React component testing  
**Prerequisites:** Completed PR #22 (test environment setup)  
**Learning Style:** Guided discovery with construction/safety net analogies  
**Estimated Time:** 60-90 minutes (includes exercises and experimentation)

---

## 🎯 What You'll Learn

By the end of this tutorial, you'll understand:

1. **Why ErrorBoundary must be a class component** (and what that means for testing)
2. **What "mocking" really means** (beyond copying patterns)
3. **How to test things that normally crash** (error simulation)
4. **When to suppress console output** (and when NOT to)
5. **How to verify user interactions** (button clicks)

---

## 📖 Table of Contents

1. [The Big Picture: Why Test Error Boundaries?](#the-big-picture)
2. [Concept: What is a Mock? (The Stunt Double)](#concept-mocking)
3. [Setup: The Safety Harness](#setup)
4. [Test 1: Normal Render (The Control Test)](#test-1)
5. [Test 2: Catching Errors (The Net Works)](#test-2)
6. [Test 3: Error Messages (Communication)](#test-3)
7. [Test 4: User Interactions (The Escape Hatch)](#test-4)
8. [Test 5: Logging Verification (The Black Box)](#test-5)
9. [Putting It All Together](#summary)
10. [Checkpoint: Verify Your Understanding](#checkpoint)

---

## <a name="the-big-picture"></a>The Big Picture: Why Test Error Boundaries?

### The Construction Site Analogy

Imagine you're building a skyscraper. Workers are installing windows on the 40th floor. You need:

1. **Safety nets** — Catch workers if they fall (ErrorBoundary)
2. **Test the nets** — Drop a dummy to verify the net works (our tests)
3. **Inspect the equipment** — Check that the net is properly anchored (verify logging, UI)

**ErrorBoundary is the safety net for your React app.** It catches errors so the entire app doesn't crash.

### Why This is Different from Testing Normal Components

In PR #22, you tested:

- `SkeletonGrid` — Does it render 160 pads? ✅
- `PortraitBlocker` — Does it show the warning? ✅

Both were **happy path tests** (things working normally).

**Now you need to test the _sad path_** — what happens when things break?

### The Challenge

How do you test something that **intentionally crashes**? You need:

1. A component that throws an error (the "dummy" we drop)
2. A way to verify the net caught it (check fallback UI appears)
3. Clean console output (so test results are readable)

---

## <a name="concept-mocking"></a>Concept: What is a Mock? (The Stunt Double)

### You Already Know This (From API Testing)

Remember testing backend fetch requests? You probably did something like:

```typescript
// Don't actually call the real API
const mockFetch = vi.fn().mockResolvedValue({ data: "fake response" });
```

**That's mocking!** You replaced the real thing with a fake version you control.

### Why Mock in Tests?

| Real Thing               | Problem                    | Mock Solution                     |
| ------------------------ | -------------------------- | --------------------------------- |
| API call                 | Slow, requires network     | Fake response, instant            |
| `console.error`          | Spams test output          | Silent fake, verify it was called |
| `window.location.reload` | Actually reloads the page! | Fake function, check if called    |

### Three Types of Mocks You'll Use Today

#### 1. **Spy** (The Observer)

Watches a function to see if/when it's called.

```typescript
const spy = vi.spyOn(console, "error").mockImplementation(() => {});
// console.error still exists, but does nothing
// You can check: expect(spy).toHaveBeenCalled();
```

**Construction analogy:** A camera watching the safety net to see if it's used.

#### 2. **Mock Implementation** (The Replacement)

Replaces a function entirely.

```typescript
delete (window as any).location;
window.location = { reload: vi.fn() } as any;
// window.location.reload is now a fake function
```

**Construction analogy:** A dummy net you can inspect without the real danger.

#### 3. **Fake Component** (The Test Dummy)

A component designed to fail on purpose.

```typescript
const BombComponent = () => {
  throw new Error("Test explosion");
};
```

**Construction analogy:** The weighted dummy you drop to test the net.

### 🤔 Pause & Predict

**Question:** If you mock `console.error`, can you still verify the ErrorBoundary logged the error?

<details>
<summary>Click to reveal answer</summary>

**Yes!** You create a spy that both:

1. **Suppresses output** (mockImplementation does nothing)
2. **Records calls** (you can check `expect(spy).toHaveBeenCalled()`)

It's like a muted microphone that still records audio.

</details>

---

## <a name="setup"></a>Setup: The Safety Harness

Before each test, you need to set up the "testing environment" — think of it as putting on safety gear before entering the construction site.

### Create the Test File

**File:** `src/components/__tests__/ErrorBoundary.test.tsx`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";
```

### The Bomb Component (Your Test Dummy)

```typescript
// This component's job is to crash on purpose
const BombComponent = ({
  message = "Test explosion",
}: {
  message?: string;
}) => {
  throw new Error(message);
};
```

**Why inline?** It's only used in this test file. No need for a separate file.

### The beforeEach Setup (Putting on Safety Gear)

```typescript
describe("ErrorBoundary component:", () => {
  beforeEach(() => {
    // 1. Suppress console noise
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // 2. Mock window.location.reload
    delete (window as any).location;
    window.location = { reload: vi.fn() } as any;
  });

  afterEach(() => {
    // 3. Clean up after each test
    vi.restoreAllMocks();
  });

  // Tests go here...
});
```

### 🤔 Pause & Predict

**Question:** Why mock `console.error` AND `console.warn`?

<details>
<summary>Click to reveal answer</summary>

React logs TWO types of messages when an error is caught:

1. **`console.error`** — Your custom ErrorBoundary logging
2. **`console.warn`** — React's internal warnings about the error

If you only mock `error`, you'll still see React's warnings. Mocking both gives clean output.

</details>

### 🤔 Pause & Predict

**Question:** Why `delete (window as any).location` instead of just assigning it?

<details>
<summary>Click to reveal answer</summary>

`window.location` is **readonly** in TypeScript. You can't reassign it directly.

**Solution:** Cast to `any` to bypass TypeScript's protection, delete the property, then reassign.

This is acceptable in **test code only** (never in production).

</details>

---

## <a name="test-1"></a>Test 1: Normal Render (The Control Test)

### The Question

**Before you crash the app, verify it works normally first.**

Like testing a parachute on the ground before jumping out of a plane.

### Your Task (Try First!)

Write a test that:

1. Renders `<ErrorBoundary>` with normal content inside
2. Verifies the normal content appears
3. Verifies the error fallback does NOT appear

**Hints:**

- Use `<div>Normal content</div>` as the child
- Use `getByText` to find "Normal content"
- Use `queryByText` (not `getByText`) to check that error UI is absent

### ✍️ Exercise: Write Test 1

```typescript
it('renders children when there is no error', () => {
  // 1. Render ErrorBoundary with normal content
  render(
    <ErrorBoundary>
      {/* TODO: What should go here? */}
    </ErrorBoundary>
  );

  // 2. Verify normal content appears
  // TODO: Write an expect() that checks for "Normal content"

  // 3. Verify error UI does NOT appear
  // TODO: Write an expect() that checks error UI is absent
});
```

<details>
<summary>Click to see the solution</summary>

```typescript
it('renders children when there is no error', () => {
  render(
    <ErrorBoundary>
      <div>Normal content</div>
    </ErrorBoundary>
  );

  expect(screen.getByText('Normal content')).toBeInTheDocument();
  expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
});
```

**Why `queryByText` for the error check?**

- `getByText` throws an error if not found
- `queryByText` returns `null` if not found
- `.not.toBeInTheDocument()` needs `null` to verify absence
</details>

### 🎯 Checkpoint: Run the Test

```bash
bun run test ErrorBoundary
```

**Expected output:**

```
✓ ErrorBoundary component:
  ✓ renders children when there is no error
```

**If it fails,** check:

- Did you import `ErrorBoundary` correctly?
- Is the text exact? ("Normal content" not "normal content")

---

## <a name="test-2"></a>Test 2: Catching Errors (The Net Works)

### The Question

**What happens when you throw the dummy off the building?**

The safety net (ErrorBoundary) should catch it and show fallback UI.

### Your Task (Try First!)

Write a test that:

1. Renders `<ErrorBoundary>` with `<BombComponent />` inside
2. Verifies "Something went wrong" appears
3. Verifies the "Reload Page" button appears

**Hints:**

- The BombComponent will throw an error during render
- ErrorBoundary will catch it with `getDerivedStateFromError`
- Use `getByRole('button')` to find the button

### ✍️ Exercise: Write Test 2

```typescript
it('displays fallback UI when child component throws error', () => {
  // 1. Render ErrorBoundary with the error component
  render(
    <ErrorBoundary>
      {/* TODO: What component should throw an error here? */}
    </ErrorBoundary>
  );

  // 2. Verify error heading appears
  // TODO: Write an expect() that checks for the error heading

  // 3. Verify reload button appears
  // TODO: Write an expect() that checks for the button
});
```

<details>
<summary>Click to see the solution</summary>

```typescript
it('displays fallback UI when child component throws error', () => {
  render(
    <ErrorBoundary>
      <BombComponent />
    </ErrorBoundary>
  );

  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
});
```

**Why `/reload page/i`?**

- The `/` slashes indicate regex
- `i` flag = case-insensitive
- Matches "Reload Page", "reload page", "RELOAD PAGE"
</details>

### 🤔 Pause & Predict

**Question:** Why doesn't the test output show a big red error message?

<details>
<summary>Click to reveal answer</summary>

Because of your `beforeEach` setup! You mocked `console.error` and `console.warn`.

**Without the mocks**, you'd see:

```
Error: Test explosion
  at BombComponent ...
Warning: React will try to recreate this component...
```

The mocks **suppress the noise** so you only see test results.

</details>

---

## <a name="test-3"></a>Test 3: Error Messages (Communication)

### The Question

**When the net catches someone, can you identify WHO fell?**

The ErrorBoundary should show the actual error message, not a generic one.

### Your Task (Try First!)

Write a test that:

1. Renders `<BombComponent message="Custom error message" />`
2. Verifies "Custom error message" appears in the UI

**Hint:** The ErrorBoundary displays `this.state.error?.message`

### ✍️ Exercise: Write Test 3

```typescript
it('displays the error message in the fallback UI', () => {
  // 1. Render with custom error message
  render(
    <ErrorBoundary>
      {/* TODO: How do you pass a custom message to BombComponent? */}
    </ErrorBoundary>
  );

  // 2. Verify the custom message appears
  // TODO: Write an expect() that checks for the custom message
});
```

<details>
<summary>Click to see the solution</summary>

```typescript
it('displays the error message in the fallback UI', () => {
  render(
    <ErrorBoundary>
      <BombComponent message="Custom error message" />
    </ErrorBoundary>
  );

  expect(screen.getByText('Custom error message')).toBeInTheDocument();
});
```

**Why this matters:**

- Helps debugging (you know WHAT broke)
- Better user experience (specific feedback)
</details>

---

## <a name="test-4"></a>Test 4: User Interactions (The Escape Hatch)

### The Question

**After the net catches someone, can they activate the evacuation procedure?**

The "Reload Page" button should trigger `window.location.reload()`.

### New Concept: fireEvent

In your API testing, you called functions directly:

```typescript
const result = await fetchUser(123);
expect(result).toBe(...);
```

In **UI testing**, you simulate user actions:

```typescript
const button = screen.getByRole("button");
fireEvent.click(button); // Simulate click
expect(mockFunction).toHaveBeenCalled(); // Verify effect
```

**Construction analogy:** Like pressing the emergency button on the safety harness to test the release mechanism.

### Your Task (Try First!)

Write a test that:

1. Renders ErrorBoundary with BombComponent (trigger error state)
2. Finds the "Reload Page" button
3. Clicks it with `fireEvent.click()`
4. Verifies `window.location.reload` was called

**Hints:**

- `window.location.reload` is a mock function (from `beforeEach`)
- Use `toHaveBeenCalledTimes(1)` to verify it was called once

### ✍️ Exercise: Write Test 4

```typescript
it('calls window.location.reload when reload button is clicked', () => {
  // 1. Render ErrorBoundary with error
  render(
    <ErrorBoundary>
      <BombComponent />
    </ErrorBoundary>
  );

  // 2. Find the reload button
  const reloadButton = screen.getByRole('button', { name: /reload page/i });

  // 3. Simulate the user clicking the button
  // TODO: Use fireEvent to click the button

  // 4. Verify reload was called
  // TODO: Write an expect() that verifies window.location.reload was called exactly once
});
```

<details>
<summary>Click to see the solution</summary>

```typescript
it('calls window.location.reload when reload button is clicked', () => {
  render(
    <ErrorBoundary>
      <BombComponent />
    </ErrorBoundary>
  );

  const reloadButton = screen.getByRole('button', { name: /reload page/i });
  fireEvent.click(reloadButton);

  expect(window.location.reload).toHaveBeenCalledTimes(1);
});
```

**Why `.toHaveBeenCalledTimes(1)` instead of just `.toHaveBeenCalled()`?**

- More specific assertion
- If button accidentally triggers twice, test would catch it
- Better debugging (you know exactly how many times it was called)
</details>

### 🤔 Pause & Predict

**Question:** What would happen if you DIDN'T mock `window.location.reload`?

<details>
<summary>Click to reveal answer</summary>

**The test runner would actually reload the page!**

This would:

1. Stop the test mid-execution
2. Restart the test suite from the beginning
3. Create an infinite loop of reloading

**Mocking prevents this chaos.**

</details>

---

## <a name="test-5"></a>Test 5: Logging Verification (The Black Box)

### The Question

**After an accident, can you review the black box recording?**

The ErrorBoundary should log errors to `console.error` for debugging.

### The Challenge

You mocked `console.error` to suppress output. But now you need to verify it was called!

**How?** The mock is BOTH:

1. A silencer (mockImplementation does nothing)
2. A recorder (you can check the call history)

### Your Task (Try First!)

Write a test that:

1. Creates a fresh console spy
2. Renders ErrorBoundary with BombComponent
3. Verifies `console.error` was called
4. Verifies it was called with the ErrorBoundary prefix `"[ErrorBoundary] Caught error:"`

**Hints:**

- Use `expect.stringContaining()` for partial string matching
- Use `expect.any(Error)` to match any Error object

### ✍️ Exercise: Write Test 5

```typescript
it('logs error to console when error is caught', () => {
  // 1. Create a fresh spy (this test needs to inspect calls)
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  // 2. Render with error
  render(
    <ErrorBoundary>
      <BombComponent message="Logged error" />
    </ErrorBoundary>
  );

  // 3. Verify console.error was called with the correct prefix and an Error
  // TODO: Write an expect() that checks:
  // - console.error was called with a string containing '[ErrorBoundary] Caught error:'
  // - AND it was called with an Error object as the second argument
});
```

<details>
<summary>Click to see the solution</summary>

```typescript
it('logs error to console when error is caught', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  render(
    <ErrorBoundary>
      <BombComponent message="Logged error" />
    </ErrorBoundary>
  );

  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('[ErrorBoundary] Caught error:'),
    expect.any(Error)
  );
});
```

**Why create a NEW spy in this test?**

- The `beforeEach` spy is for suppressing output
- This spy is for **inspection**
- Each test can have its own spy for specific verification needs
</details>

### 🤔 Pause & Predict

**Question:** What's the difference between `toHaveBeenCalled()` and `toHaveBeenCalledWith(...)`?

<details>
<summary>Click to reveal answer</summary>

| Matcher                      | Checks                                 | Use When                     |
| ---------------------------- | -------------------------------------- | ---------------------------- |
| `toHaveBeenCalled()`         | Was the function called at all?        | You just care IF it happened |
| `toHaveBeenCalledWith(args)` | Was it called with specific arguments? | You care WHAT was passed     |

**Example:**

```typescript
// Just checking IF
expect(mockFn).toHaveBeenCalled(); // ✅ Called at least once

// Checking WHAT
expect(mockFn).toHaveBeenCalledWith("specific", "args"); // ✅ Called with exact values
```

</details>

---

## <a name="summary"></a>Putting It All Together

### The Complete Test File

Here's what you've built:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const BombComponent = ({ message = "Test explosion" }: { message?: string }) => {
  throw new Error(message);
};

describe('ErrorBoundary component:', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete (window as any).location;
    window.location = { reload: vi.fn() } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Control test
  it('renders children when there is no error', () => { ... });

  // Test 2: Safety net works
  it('displays fallback UI when child component throws error', () => { ... });

  // Test 3: Error messages
  it('displays the error message in the fallback UI', () => { ... });

  // Test 4: User interaction
  it('calls window.location.reload when reload button is clicked', () => { ... });

  // Test 5: Black box recording
  it('logs error to console when error is caught', () => { ... });
});
```

### What Each Test Validates

| Test | Validates       | Why It Matters                            |
| ---- | --------------- | ----------------------------------------- |
| 1    | Normal render   | Ensures boundary doesn't break happy path |
| 2    | Error catching  | Core functionality works                  |
| 3    | Error messages  | Debugging information propagates          |
| 4    | Reload button   | User can escape error state               |
| 5    | Console logging | Developers can trace errors               |

---

## <a name="checkpoint"></a>Checkpoint: Verify Your Understanding

### Run All Tests

```bash
bun run test ErrorBoundary
```

**Expected output:**

```
✓ ErrorBoundary component: (5)
  ✓ renders children when there is no error
  ✓ displays fallback UI when child component throws error
  ✓ displays the error message in the fallback UI
  ✓ calls window.location.reload when reload button is clicked
  ✓ logs error to console when error is caught

Test Files  1 passed (1)
Tests       5 passed (5)
```

### Run Full Test Suite

```bash
bun run test
```

**Expected output:**

```
Test Files  4 passed (4)
Tests       44 passed (44)
```

### Concept Check Questions

Answer these without looking back:

**Q1:** Why can't you use a function component for ErrorBoundary?

<details>
<summary>Answer</summary>
Because error boundaries require lifecycle methods (`getDerivedStateFromError`, `componentDidCatch`) that only exist in class components. React hooks cannot catch errors.
</details>

**Q2:** What's the difference between a spy and a mock?

<details>
<summary>Answer</summary>
**Spy:** Watches an existing function to see if/how it's called (but keeps the original behavior)  
**Mock:** Replaces a function entirely with a fake implementation

In our tests, we use `vi.spyOn(...).mockImplementation(...)` which is BOTH — it spies (records calls) AND mocks (replaces behavior).

</details>

**Q3:** Why do we mock `window.location.reload`?

<details>
<summary>Answer</summary>
Because calling the real `window.location.reload()` would actually reload the test runner, creating an infinite loop and crashing the tests.
</details>

**Q4:** When would you NOT suppress console.error?

<details>
<summary>Answer</summary>
When testing code that should NOT log errors (like normal components). You only suppress expected errors (like in error boundary tests). Unexpected errors should fail loudly!
</details>

---

## Key Takeaways

### Patterns You Learned

1. **Per-test mocking** — Use `beforeEach`/`afterEach` for test-specific setup
2. **Error simulation** — Create "Bomb" components that throw on render
3. **Console mocking** — Suppress noise while verifying calls
4. **Window API mocking** — Replace readonly browser APIs
5. **User interaction testing** — Use `fireEvent` to simulate clicks

### When to Apply These Patterns

| Pattern          | Use When                      | Example                            |
| ---------------- | ----------------------------- | ---------------------------------- |
| Console mocking  | Testing code that logs errors | Error boundaries, error handlers   |
| Window mocking   | Testing navigation/reload     | Logout buttons, error recovery     |
| Error simulation | Testing error handling        | Error boundaries, try-catch blocks |
| fireEvent        | Testing user interactions     | Buttons, forms, clicks             |

### Next Steps

**Practice:** Try writing a test for the "Reload Page" button that verifies:

- The button text says "Reload Page" (not "Reload" or "Refresh")
- The button has red styling (`bg-red-600`)

**Challenge:** Create a second error boundary test that:

- Throws an error in a child component's `useEffect` (not during render)
- Verify ErrorBoundary does NOT catch it (ErrorBoundary only catches render errors)

**Explore:** Read the React docs on Error Boundaries to understand why class components are required:
https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary

---

## Success Criteria ✅

- [ ] All 5 tests written and passing
- [ ] Clean console output (no red error spam)
- [ ] Understand why each mock is needed
- [ ] Can explain the difference between spy/mock
- [ ] Know when to use `getByText` vs `queryByText`
- [ ] Can verify user interactions with `fireEvent`

**Congratulations!** You've leveled up from basic component testing (PR #22) to advanced error handling and mocking patterns. 🎉
