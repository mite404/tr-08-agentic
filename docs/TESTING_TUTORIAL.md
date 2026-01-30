# Testing Tutorial for TR-08: Learning Testing from Scratch

**Audience:** Visual learners with film/design background, new to testing  
**Goal:** Understand each step of setting up and writing tests  
**Estimated Reading Time:** 30-40 minutes

---

## Table of Contents

1. [What is Testing? (The Big Picture)](#what-is-testing)
2. [Step 1: Configure vitest.config.ts](#step-1-configure-vitest)
3. [Step 2: Create Test Setup (src/test/setup.ts)](#step-2-create-setup)
4. [Step 3: Test SkeletonGrid](#step-3-test-skeletongrid)
5. [Step 4: Test PortraitBlocker](#step-4-test-portraitblocker)
6. [Key Concepts You Need](#key-concepts)

---

## What is Testing? (The Big Picture)

Imagine you're filming a scene for a movie. Before the final shoot, you need to:
- Check that the lights are positioned correctly
- Verify the camera is in focus
- Test that the audio equipment is working
- Confirm the actors hit their marks

**Testing code is exactly the same idea.** You write small automated checks to verify your code behaves the way you expect *before* shipping it to users.

### Three Levels of Testing (Your Testing Pyramid)

Think of testing like checking your film at different stages:

```
        ╱╲  E2E Tests (Full Movie)
       ╱  ╲ "Does the entire film work from start to finish?"
      ╱────╲
     ╱      ╲ Integration Tests (Scene Check)
    ╱        ╲ "Do multiple components work together?"
   ╱──────────╲
  ╱            ╲ Unit Tests (Individual Shots)
 ╱              ╲ "Does this one component render correctly?"
╱────────────────╲
```

**For PR #22, we're starting at the base: Unit Tests**
- Simplest to write
- Fastest to run
- Tests one component in isolation

### Why Test Components?

When you write a React component like `SkeletonGrid`, you're creating a **visual unit**. Testing verifies:
- ✅ It renders without crashing
- ✅ It shows the correct number of items
- ✅ It displays the right colors/styles
- ✅ It responds to user clicks

---

## Step 1: Configure vitest.config.ts

### What is Vitest?

**Vitest** is a testing framework (like a film critic who automatically watches your film and reports issues).

You already have Vitest installed. Now you need to tell it:
- What environment to use (how to simulate a browser)
- Where to find your tests
- How to handle React components

### Why `happy-dom`?

Testing requires a **fake browser environment** because you don't want to launch Chrome for every test (too slow).

Two popular options:
- **jsdom:** More realistic, slower
- **happy-dom:** Simpler, faster

**For TR-08: use `happy-dom`** (it's plenty realistic for your components).

### The Configuration File

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
})
```

**What each line does:**

| Line | Purpose |
|------|---------|
| `environment: 'happy-dom'` | Use the lightweight fake browser |
| `globals: true` | Make `describe`, `it`, `expect` available everywhere (no imports needed) |
| `setupFiles: ['src/test/setup.ts']` | Run this file before every test to set up shared helpers |

**Key Insight:** This file tells Vitest "pretend you're a browser, use happy-dom, and load these helpers first."

---

## Step 2: Create Test Setup (src/test/setup.ts)

### What is Test Setup?

Before running tests, you need to extend Vitest with extra matchers (assertions). Think of it like setting up your film equipment before shooting.

### What's a Matcher?

A **matcher** is a function that checks if something is true. Examples:

```typescript
expect(element).toBeInTheDocument()    // Is element on the page?
expect(text).toContain('Hello')        // Does text contain 'Hello'?
expect(count).toBe(5)                  // Is count exactly 5?
```

Some matchers come built-in. Others (like `.toBeInTheDocument()`) come from a library called **@testing-library/jest-dom**.

### The Setup File

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
```

That's it! One line.

**What happens:**
1. Vitest loads this file before running any tests
2. The import extends `expect` with 50+ new matchers
3. Now your tests can use `.toBeInTheDocument()`, `.toBeVisible()`, etc.

### Why This Matters

Without this setup, you'd have to write:

```typescript
// ❌ Without setup
expect(element !== null && element.ownerDocument.body.contains(element)).toBe(true)
```

With setup, you write:

```typescript
// ✅ With setup
expect(element).toBeInTheDocument()
```

Much clearer, right? That's what test helpers do — they make your tests readable.

---

## Step 3: Test SkeletonGrid

### What is SkeletonGrid?

A "skeleton" is a placeholder UI that shows while data loads. Think of it like a greyscale storyboard before the final colored film.

`SkeletonGrid` displays 10 rows × 16 columns = **160 skeleton pads** while the beats are loading.

### What Should We Test?

```
✅ Does it render without crashing?
✅ Does it render the correct number of pads (160)?
✅ Does each pad have the right classes/styling?
```

### Writing the Test

Create a new file: `src/components/__tests__/SkeletonGrid.test.tsx`

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SkeletonGrid from '../SkeletonGrid'

describe('SkeletonGrid', () => {
  it('renders the correct number of skeleton pads', () => {
    // 1. Render the component
    render(<SkeletonGrid />)
    
    // 2. Find all skeleton pads
    const pads = screen.getAllByTestId('skeleton-pad')
    
    // 3. Check that we got 160 (10 rows × 16 columns)
    expect(pads).toHaveLength(160)
  })

  it('each pad has the skeleton styling class', () => {
    render(<SkeletonGrid />)
    
    const pads = screen.getAllByTestId('skeleton-pad')
    
    // Each pad should have the 'animate-pulse' class (Tailwind loading animation)
    pads.forEach(pad => {
      expect(pad).toHaveClass('animate-pulse')
    })
  })
})
```

### Let's Break This Down

#### Part 1: The `describe` Block

```typescript
describe('SkeletonGrid', () => {
  // All tests for SkeletonGrid go here
})
```

**In film terms:** This is your "scene" or "chapter." All tests inside are about one component.

#### Part 2: The `it` Block

```typescript
it('renders the correct number of skeleton pads', () => {
  // This is one test
})
```

**In film terms:** This is one specific thing you're checking. "Does the lighting look right?" is one test. "Does the actor hit their mark?" is another test.

#### Part 3: Render

```typescript
render(<SkeletonGrid />)
```

**What it does:** Mounts the React component in the fake browser environment.

**In film terms:** This is like setting up the camera and pressing "record." You're creating the component to test it.

#### Part 4: Query

```typescript
const pads = screen.getAllByTestId('skeleton-pad')
```

**What it does:** Finds all elements with `data-testid="skeleton-pad"` in the rendered output.

**In film terms:** This is like the director saying "Find all extras wearing blue shirts on set."

#### Part 5: Assert (Check)

```typescript
expect(pads).toHaveLength(160)
```

**What it does:** Verifies that we found exactly 160 pads.

**In film terms:** This is where you confirm: "Yes, we have the right number of extras."

### Important: The `data-testid` Attribute

For the test to work, your `SkeletonGrid` component must have:

```typescript
// src/components/SkeletonGrid.tsx
export default function SkeletonGrid() {
  return (
    <div className="grid grid-cols-16 gap-1">
      {Array.from({ length: 160 }).map((_, i) => (
        <div
          key={i}
          data-testid="skeleton-pad"  // ← Add this
          className="bg-gray-400 rounded animate-pulse"
        />
      ))}
    </div>
  )
}
```

**Why `data-testid`?**
- Not a visual attribute (doesn't affect styling)
- Only exists for tests to find elements
- Clear intent: "This element is for testing"

### Running the Test

```bash
bun run test
```

Output:
```
✓ SkeletonGrid
  ✓ renders the correct number of skeleton pads (2ms)
  ✓ each pad has the skeleton styling class (1ms)

Test Files  1 passed (1)
Tests       2 passed (2)
```

---

## Step 4: Test PortraitBlocker

### What is PortraitBlocker?

A component that shows an overlay on mobile phones in portrait mode (vertical). It says "Rotate your device to landscape."

**The trick:** The overlay is ALWAYS in the DOM, but only *visible* in portrait mode via CSS media queries.

### The Question: What Should We Test?

Here's where it gets interesting. The comment in IMPLEMENTATION.md says:

> "Verify it renders text, but only visible under specific CSS conditions - _Note: usually we just test it renders into the DOM_"

### The Honest Answer

**Truly testing CSS media queries requires a real browser** because you need to actually change the viewport size and check computed styles.

In unit tests with happy-dom, we **usually skip the CSS part** and just verify:
- ✅ The text is in the DOM
- ✅ The overlay structure is correct

### Writing the Test

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PortraitBlocker from '../PortraitBlocker'

describe('PortraitBlocker', () => {
  it('renders the portrait warning text', () => {
    render(<PortraitBlocker />)
    
    // Check that the warning message is in the DOM
    expect(screen.getByText(/rotate.*landscape/i)).toBeInTheDocument()
  })

  it('renders an overlay element', () => {
    render(<PortraitBlocker />)
    
    // Check that the overlay (usually a div with fixed positioning) exists
    const overlay = screen.getByRole('region', { name: /portrait/i })
    expect(overlay).toBeInTheDocument()
  })
})
```

### Understanding the Test

#### The First Test

```typescript
expect(screen.getByText(/rotate.*landscape/i)).toBeInTheDocument()
```

**Breaking it down:**
- `screen.getByText(...)` — Find text matching this pattern
- `/rotate.*landscape/i` — Regex that matches "rotate" followed by anything, then "landscape" (case-insensitive)
- `.toBeInTheDocument()` — Assert it's on the page

**In film terms:** "Is there a message saying 'Rotate to Landscape' in the scene?"

#### The Second Test

```typescript
const overlay = screen.getByRole('region', { name: /portrait/i })
expect(overlay).toBeInTheDocument()
```

**Breaking it down:**
- `screen.getByRole('region', ...)` — Find an element with ARIA role 'region'
- `{ name: /portrait/i }` — The region's accessible name should match "portrait"
- `.toBeInTheDocument()` — Assert it exists

**In film terms:** "Is there a visual barrier/overlay marked as the 'portrait warning'?"

### Why Not Test CSS?

CSS is **rendered by the browser**, not by happy-dom. Happy-dom is a minimal fake browser that simulates the DOM but not the rendering engine.

**Real CSS testing requires:**
- ✅ Playwright (full browser simulation)
- ✅ Cypress (full browser simulation)
- ✗ Vitest with happy-dom (no CSS rendering)

**For now:** Unit tests verify the structure. E2E tests (later) verify the CSS actually hides/shows things.

### The Component Structure

For the test to work, your component might look like:

```typescript
// src/components/PortraitBlocker.tsx
export default function PortraitBlocker() {
  return (
    <div
      role="region"
      aria-label="Portrait orientation blocker"
      className="fixed inset-0 bg-black/90 flex items-center justify-center hidden md:flex"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          Please Rotate Your Device
        </h2>
        <p className="text-lg text-gray-300">
          This app works best in landscape mode
        </p>
      </div>
    </div>
  )
}
```

**Key points for testability:**
- `role="region"` — Makes it findable by `getByRole`
- `aria-label="..."` — Provides an accessible name for finding it
- Text in plain English — `getByText` can find it

---

## Key Concepts You Need

### 1. The Test Structure (AAA Pattern)

All tests follow this pattern:

```typescript
it('does something', () => {
  // ARRANGE: Set up the component and data
  render(<SkeletonGrid />)
  
  // ACT: Do something (click, type, etc.)
  // (Not always needed for static components)
  
  // ASSERT: Check the result
  expect(pads).toHaveLength(160)
})
```

**In film terms:**
1. **ARRANGE:** Set the stage (lights, camera, actors positioned)
2. **ACT:** Roll camera, action (perform the scene)
3. **ASSERT:** Check the footage (does it look right?)

### 2. Queries: How to Find Elements

React Testing Library provides queries to find elements in the DOM:

| Query | Use When | Example |
|-------|----------|---------|
| `getByTestId` | Element has `data-testid` | `screen.getByTestId('pad')` |
| `getByText` | Finding text content | `screen.getByText('Play')` |
| `getByRole` | Element has semantic role | `screen.getByRole('button')` |
| `getByPlaceholder` | Input has placeholder | `screen.getByPlaceholderText('Enter')` |
| `queryBy*` | Returns null if not found | `screen.queryByText('Missing')` |
| `getAllBy*` | Returns array of all matches | `screen.getAllByTestId('pad')` |

**Rule of thumb:** Prefer `getByRole` > `getByText` > `getByTestId`

**In film terms:** Different ways to find the right person on set:
- "Find everyone with the 'actor' role" → `getByRole`
- "Find the person who says this line" → `getByText`
- "Find person with name tag 'Lead'" → `getByTestId`

### 3. Matchers: How to Check Results

| Matcher | Checks | Example |
|---------|--------|---------|
| `.toBeInTheDocument()` | Element is in the DOM | `expect(button).toBeInTheDocument()` |
| `.toHaveLength(n)` | Array has n items | `expect(items).toHaveLength(5)` |
| `.toHaveClass(name)` | Element has CSS class | `expect(div).toHaveClass('hidden')` |
| `.toHaveTextContent(text)` | Element contains text | `expect(div).toHaveTextContent('Hello')` |
| `.toBe(value)` | Exact equality | `expect(count).toBe(5)` |
| `.toEqual(obj)` | Object equality | `expect(user).toEqual({ name: 'John' })` |

### 4. Why `data-testid`?

In the real world, you'd never add a `data-testid` attribute to production code just for testing. But here's the honest truth:

✅ **DO use** `data-testid` when:
- The element doesn't have a semantic role
- You can't reliably find it by text
- It's an internal UI detail you're testing

❌ **DON'T use** `data-testid` when:
- The element is a `<button>` (use `getByRole('button')`)
- The element is a heading (use `getByRole('heading')`)
- It has unique text content (use `getByText()`)

**In TR-08:** Your skeleton pads are divs with no text, so `data-testid="skeleton-pad"` is the right choice.

### 5. The Happy-Dom Limitation

Happy-dom simulates the DOM but **doesn't render CSS**. This means:

```typescript
// ✅ This works in happy-dom
expect(element).toBeInTheDocument()
expect(element).toHaveClass('hidden')

// ❌ This doesn't work in happy-dom
const styles = getComputedStyle(element)
expect(styles.display).toBe('none')  // Happy-dom returns empty string
```

**Why?** Computing styles requires a real CSS engine, which only exists in real browsers.

### 6. Test Organization

```
src/
├── components/
│   ├── SkeletonGrid.tsx
│   ├── PortraitBlocker.tsx
│   └── __tests__/            ← All tests go here
│       ├── SkeletonGrid.test.tsx
│       └── PortraitBlocker.test.tsx
└── test/
    └── setup.ts              ← Shared test configuration
```

**Convention:** Tests live in `__tests__/` folder next to the component.

---

## Next Steps (For Your Learning)

### After PR #22 is Complete

You'll have:
- ✅ Vitest configured
- ✅ Test setup working
- ✅ Two simple tests passing
- ✅ A foundation for more complex tests

### What Makes Tests Fail?

Tests fail when:
- Component doesn't render (missing import, syntax error)
- Expected text is missing or misspelled
- Element has wrong classes
- Count is wrong (160 vs 159)

**Debugging tip:** Run tests in watch mode:

```bash
bun run test --watch
```

When a test fails, the error message tells you exactly what went wrong.

### A Testing Mindset

Good tests answer this question: **"If I make a code change, will my tests catch the bug?"**

- ✅ If tests are good, small changes break them fast
- ❌ If tests are weak, bugs slip through

**In film terms:** Your tests are like a quality control checklist. The more thorough the checklist, the fewer problems reach the audience.

---

## Summary: What You're Building

| Step | Task | Purpose |
|------|------|---------|
| 1 | Configure `vitest.config.ts` | Tell Vitest: use happy-dom, load setup.ts |
| 2 | Create `src/test/setup.ts` | Import matchers (toBeInTheDocument, etc.) |
| 3 | Test SkeletonGrid | Verify 160 pads render with correct classes |
| 4 | Test PortraitBlocker | Verify text and structure are in DOM |

**After PR #22, you'll have:**
- A working test environment
- Two passing tests
- A pattern to follow for more tests
- A safety net for future changes

---

## Glossary

| Term | Definition |
|------|-----------|
| **Test** | An automated check that verifies code behaves as expected |
| **Unit Test** | Test of a single component in isolation |
| **Integration Test** | Test of multiple components working together |
| **E2E Test** | Test of entire app flow in a real browser |
| **Mock** | Fake object used to replace real dependencies |
| **Matcher** | Function that checks if something is true (e.g., `.toBe()`) |
| **Render** | Mount a React component in the test environment |
| **Query** | Function to find elements in the rendered output |
| **happy-dom** | Lightweight fake browser for fast unit tests |
| **Vitest** | Modern testing framework (replacement for Jest) |

---

## Further Learning

Once you master PR #22:

1. **PR #23** teaches ErrorBoundary testing (error handling)
2. **PR #24** introduces mocking (faking Supabase)
3. **PR #25** covers async logic (debounce, timers)
4. **PR #26-27** moves to E2E tests (real browser simulation)

Each PR builds on the previous skills.

Good luck! Testing is one of those skills that feels strange at first, but becomes incredibly powerful once you see tests catch real bugs.
