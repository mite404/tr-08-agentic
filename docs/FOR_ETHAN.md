# Quick Reference: Concepts to Study Further

## 1. Object Lookups for Dynamic Values

**Concept:** Instead of if/else chains, use objects as lookup tables.

**Example from Chiclet:**

```typescript
// ❌ Hard to read
let opacityClass;
if (state === "off") opacityClass = "opacity-25";
else if (state === "ghost") opacityClass = "opacity-75";
else opacityClass = "opacity-100";

// ✅ Clean lookup
const chicletOpacity = {
  off: "opacity-25",
  ghost: "opacity-75",
  on: "opacity-100",
};
const opacityClass = chicletOpacity[state];
```

**Why it matters:** You use the variable (`state`) as a key to get the value. Super common pattern in React for dynamic styling.

### When to Use Lookup Tables vs If Statements

**Use lookup tables when:**

1. **Simple mappings** - One input → one output (no complex logic)
   - `state === 'off'` → `'opacity-25'` ✅
   - `userRole === 'admin'` → `AdminDashboard` ✅
2. **Multiple conditions** - More than 2-3 branches
   - 3+ states, 4+ color variants, etc.
3. **Data-driven** - The mapping might come from a config/database later

   ```typescript
   const statusColors = {
     pending: "yellow",
     approved: "green",
     rejected: "red",
   };
   ```

**Use if/else when:**

1. **Complex logic** - Need to evaluate multiple variables or ranges

   ```typescript
   if (age < 18 && hasParentConsent) { ... }
   else if (age >= 18 && age < 65) { ... }
   ```

2. **Side effects** - Need to do more than just return a value

   ```typescript
   if (isError) {
     logError(error);
     showToast("Something went wrong");
     return null;
   }
   ```

3. **Only 2 branches** - Simple binary choice (though ternary works too)

   ```typescript
   const textColor = isActive ? "text-white" : "text-gray-500";
   ```

### Is This React-Specific?

**No!** Lookup tables are a general programming pattern. They work anywhere:

```javascript
// Vanilla JS
const httpStatusMessages = {
  200: "OK",
  404: "Not Found",
  500: "Server Error",
};
console.log(httpStatusMessages[response.status]);

// Node.js
const dbConnections = {
  development: "localhost:5432",
  production: "prod.db.com",
};
const dbUrl = dbConnections[process.env.NODE_ENV];
```

**Why it feels React-specific:**

- React developers use it A LOT for dynamic styling
- Component props often map cleanly to visual variants
- JSX makes the pattern very visible

### Do You Need Multiple Variables?

**No!** Works with single variables too:

```typescript
// Single variable lookup (what you're doing)
const opacity = opacityMap[state];

// Multiple variables (can still use lookups)
const key = `${size}-${variant}`;
const className = classMap[key];
// or
const className = classMap[size][variant];
```

### Rule of Thumb

**Ask yourself:**

1. Is this a simple "input X always maps to output Y" relationship? → **Lookup table**
2. Do I need to check multiple conditions or do calculations? → **If/else**
3. Is it just two options? → **Ternary** (`condition ? a : b`)

**Real examples from your code:**

✅ **Lookup table** (Chiclet opacity):

```typescript
const chicletOpacity = {
  off: "opacity-25",
  ghost: "opacity-75",
  on: "opacity-100",
};
```

Why? Simple 1:1 mapping, no logic needed.

✅ **If statement** (Chiclet disabled state):

```typescript
if (disabled) {
  return (
    <button className="..." disabled title="...">
    </button>
  );
}
```

Why? Early return with specific JSX, not just a value lookup.

✅ **Ternary** (Image state):

```typescript
const imageState = state === "off" ? "off" : "on";
```

Why? Only 2 outcomes, simple condition.

---

## 2. Background Images vs `<img>` Tags

**Two ways to display images:**

### Option A: `<img>` tag (semantic, for content)

```typescript
<button>
  <img src={chicletImage} alt="Chiclet" />
</button>
```

### Option B: CSS background-image (decorative, scales better)

```typescript
<button
  style={{
    backgroundImage: `url(${chicletImage})`,
    backgroundSize: 'cover',
    width: '125px',
    height: '90px',
  }}
/>
```

**When to use which:**

- `<img>`: When the image IS the content (product photos, avatars)
- `background-image`: When the image is decoration/UI (buttons, backgrounds)

**Why Chiclet uses background-image:**

- Button size controls the image size automatically
- Opacity/brightness filters apply to the whole button cleanly
- No extra DOM element needed

---

## 3. Component Data Flow (Props Down, Not Sideways)

**The pattern:**

```text
App.tsx (parent)
  ↓ passes props
Chiclet.tsx (child)
  ↓ renders
<button> (HTML)
```

**Key insight:**

- `variant` is computed in **App.tsx** (`getChicletVariant(colIndex)`)
- Passed down to **Chiclet** as a prop
- Chiclet uses it internally to look up the image

**Wrong mental model:**
"Chiclet needs to know the step number to pick a color"

**Correct mental model:**
"App.tsx knows the step number, computes the color variant, passes it to Chiclet. Chiclet just receives the answer."

---

## 4. Internal vs External State

**External state** (passed in as props):

- `isActive` - comes from `grid[rowIndex][colIndex]` in App.tsx
- `isAccented` - comes from manifest in App.tsx
- `variant` - computed in App.tsx

**Internal state** (computed inside Chiclet):

- `state` - derived from `isActive` and `isAccented`
- `opacityClass` - looked up from `state`
- `chicletImage` - looked up from `variant` and `state`

**Why this matters:**
Chiclet doesn't need to know HOW to compute `isActive` or `variant`. It just receives them and uses them. This is "separation of concerns."

---

## 5. Filter + Join Pattern for Dynamic Classes

**The problem:** How to conditionally add multiple CSS classes?

**The pattern:**

```typescript
const brightnessModifiers = [
  isCurrentStep && "brightness-175", // Only add if true
  is16thNote && "brightness-135", // Only add if true
]
  .filter(Boolean)
  .join(" ");
```

**How it works:**

1. Array of conditions: `[false && 'class1', true && 'class2']`
2. JavaScript short-circuit: `false && 'class1'` → `false`, `true && 'class2'` → `'class2'`
3. Result array: `[false, 'class2']`
4. `.filter(Boolean)` removes falsy values: `['class2']`
5. `.join(' ')` combines: `'class2'`

**Result:**

- If both true: `'brightness-175 brightness-135'`
- If only first true: `'brightness-175'`
- If neither: `''` (empty string)

---

## 6. Import Paths (Relative vs Absolute)

**From `src/components/Chiclet.tsx`:**

```typescript
// Relative (go up, then down)
import image from "../assets/images/photo.png";
//               ^^
//               Go up 1 level to src/

// Absolute (if configured in Vite)
import image from "src/assets/images/photo.png";
//                ^^^
//                Starts from project root
```

**Path breakdown:**

```text
src/
  components/
    Chiclet.tsx  ← You are here
  assets/
    images/
      photo.png  ← You want this
```

To get from Chiclet.tsx to photo.png:

- `../` = go up to `src/`
- `assets/images/photo.png` = go down

**Common mistake:**
Using `../../` (going up 2 levels) would put you outside `src/`, which is wrong.

---

## 7. Reserved Words vs Custom Components

**Lowercase = HTML elements:**

- `<button>` - native HTML button
- `<div>` - native HTML div
- `<img>` - native HTML image

**PascalCase = React components:**

- `<Button>` - custom component from `src/components/ui/button.tsx`
- `<Chiclet>` - your custom component
- `<Pad>` - your old component

**You can name files anything:**

- `src/components/ui/button.tsx` - the file
- Exports `function Button()` - the component (capitalized)
- Used as `<Button>` in JSX

**Why `button.tsx` isn't confusing:**

- The file is `button.tsx` (lowercase)
- The component inside is `Button` (PascalCase)
- JSX uses `<Button>` (knows it's custom) vs `<button>` (knows it's HTML)

---

## 8. Pure Functions vs Side Effects (The Golden Rule)

### The Simple Test: "Same Input, Same Output, No Surprises"

**Pure function checklist:**

1. ✅ Same inputs ALWAYS give same output
2. ✅ Doesn't change anything outside itself
3. ✅ Doesn't read anything that could change (except its parameters)

**If ANY of these fail → it has side effects**

---

### Visual Test: Can You Replace It With Its Return Value?

**Pure function** - You can replace the function call with its result:

```typescript
// Pure
const add = (a, b) => a + b;

const total = add(2, 3); // 5
const total = 5; // ← Could literally replace it. Same effect!
```

**Impure function** - Replacing it breaks things:

```typescript
// Impure
const logAndAdd = (a, b) => {
  console.log("Adding..."); // ← Side effect! Changes the console
  return a + b;
};

const total = logAndAdd(2, 3); // Logs "Adding..." AND returns 5
const total = 5; // ← NOT the same! No log message
```

---

### The "Outside World" Test

**Ask: Does this function touch anything outside its own scope?**

```typescript
// ❌ IMPURE - Touches outside world
let count = 0;
function increment() {
  count++; // ← Modifies external variable
  return count;
}

// ✅ PURE - Self-contained
function increment(count) {
  return count + 1; // ← Returns new value, doesn't modify anything
}
```

---

### Common Side Effects (Checklist)

Your function has side effects if it does ANY of these:

#### 1. **Modifies external state**

```typescript
// ❌ Side effect
let user = { name: "Ethan" };
function changeName(newName) {
  user.name = newName; // ← Mutates external object
}

// ✅ Pure
function changeName(user, newName) {
  return { ...user, name: newName }; // ← Returns new object
}
```

#### 2. **Calls I/O operations**

```typescript
// ❌ Side effects (all of these!)
console.log("Hello"); // Writing to console
fetch("/api/beats"); // Network request
localStorage.setItem("x", "5"); // Writing to storage
document.getElementById("x"); // Reading from DOM
fs.readFile("data.txt"); // Reading from filesystem
```

#### 3. **Depends on external mutable state**

```typescript
// ❌ Side effect
let globalConfig = { mode: "dark" };
function getTheme() {
  return globalConfig.mode; // ← Could return different values over time
}

// ✅ Pure
function getTheme(config) {
  return config.mode; // ← Same config always returns same theme
}
```

#### 4. **Uses non-deterministic sources**

```typescript
// ❌ Side effects
Math.random(); // Different value every time
Date.now(); // Changes every millisecond
new Date(); // Returns current time (changes)

// ✅ Pure
function formatDate(timestamp) {
  return new Date(timestamp).toISOString(); // Same timestamp → same output
}
```

#### 5. **Throws exceptions**

```typescript
// ❌ Side effect (debatable, but generally considered impure)
function divide(a, b) {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
}

// ✅ Pure
function divide(a, b) {
  if (b === 0) return null; // Or return a Result type
  return a / b;
}
```

---

### Real Examples from Your Chiclet Code

#### Pure Functions ✅

```typescript
// Example 1: State computation
const state = !isActive ? "off" : isAccented ? "ghost" : "on";

// Why pure?
// - Same isActive/isAccented always gives same state
// - Doesn't modify anything
// - No external dependencies
```

```typescript
// Example 2: Variant lookup
const getChicletVariant = (stepIndex: number) => {
  if (stepIndex < 4) return "red";
  if (stepIndex < 8) return "orange";
  if (stepIndex < 12) return "yellow";
  return "cream";
};

// Why pure?
// - stepIndex 5 ALWAYS returns 'orange'
// - Doesn't read or write external state
// - No I/O, no randomness
```

```typescript
// Example 3: Opacity lookup
const chicletOpacity = {
  off: "opacity-25",
  ghost: "opacity-75",
  on: "opacity-100",
};
const opacityClass = chicletOpacity[state];

// Why pure?
// - Same state always gives same opacity class
// - Just reading from a constant object
// - No mutations
```

#### Impure Functions ❌

```typescript
// Example 1: handlePadClick
function handlePadClick(rowIndex, colIndex) {
  const newGrid = [...grid]; // ← Reads external state (grid)
  newGrid[rowIndex][colIndex] = !grid[rowIndex][colIndex];
  setGrid(newGrid); // ← Modifies external state (React state)
  // ...
}

// Why impure?
// - Reads `grid` from outside
// - Calls `setGrid` (triggers React re-render)
// - Modifies `manifestRef.current`
```

```typescript
// Example 2: saveBeat
async function handleSaveBeat() {
  await saveBeat(/* ... */); // ← Network I/O!
  const beatList = await loadBeatList(); // ← More I/O!
  setBeats(beatList); // ← Modifies React state
}

// Why impure?
// - Network requests (fetch API calls)
// - Modifies external state (setBeats)
// - Can fail/succeed differently each time
```

```typescript
// Example 3: initPlayers
async function initPlayers() {
  const contextResumed = await resumeAudioContext(); // ← Browser API call
  const { players, failedTrackIds } = await loadAudioSamples(/* ... */);
  playersMapRef.current = players; // ← Mutates ref
  setFailedTrackIds(failedTrackIds); // ← Modifies state
}

// Why impure?
// - Calls browser Audio API
// - Mutates ref
// - Modifies React state
// - Can fail if audio files don't load
```

---

### The Repeatable Rule (Use This Every Time)

**Before writing a function, ask:**

1. **"If I call this twice with the same inputs, will I get the same result?"**
   - No? → Impure (side effect)
   - Yes? → Continue to #2

2. **"Does this function change anything outside itself?"**
   - Yes? → Impure (side effect)
   - No? → Continue to #3

3. **"Does this function read anything that could change over time?"**
   - Yes? → Impure (side effect)
   - No? → Pure! ✅

**Examples:**

```typescript
// Test: getChicletVariant(5)
// 1. Call twice with 5 → 'orange' both times ✅
// 2. Changes anything? No ✅
// 3. Reads mutable data? No ✅
// → PURE

// Test: handlePadClick(0, 0)
// 1. Call twice → Different results (grid changes) ❌
// → IMPURE

// Test: Math.random()
// 1. Call twice → Different results ❌
// → IMPURE

// Test: setGrid(newGrid)
// 2. Changes anything? Yes (React state) ❌
// → IMPURE
```

---

### Why This Matters

**Pure functions are:**

- Easy to test (no mocks needed)
- Easy to debug (predictable)
- Easy to refactor (can move anywhere)
- Can be cached (memoization)
- Can run in parallel (no race conditions)

**Side effects are necessary for:**

- User interaction (clicks, typing)
- Network requests (APIs)
- Storage (database, localStorage)
- Rendering UI (React setState)
- Logging/analytics

**The goal:** Keep side effects in specific places (event handlers, useEffect), keep everything else pure.

---

### In Your Chiclet Component

**Pure parts** (easy to test/reason about):

```typescript
const state = !isActive ? "off" : isAccented ? "ghost" : "on";
const imageState = state === "off" ? "off" : "on";
const chicletImage = chicletImages[variant][imageState];
const opacityClass = chicletOpacity[state];
```

**Impure parts** (React rendering side effect):

```typescript
return <button onClick={onClick} ... />  // ← Renders to DOM (side effect)
```

**Impure parts** (in App.tsx):

```typescript
onClick={() => handlePadClick(rowIndex, colIndex)}  // ← Modifies state
```

**This is good architecture!** Pure logic inside the component, side effects only at the boundaries (event handlers, React rendering).

---

## 9. Testing Browser APIs with Mocks (PR #22)

### The Challenge: Testing Code That Uses Browser APIs

Some code depends on browser APIs that don't work in the test environment. Examples:

- `window.matchMedia()` — Detect screen size, orientation
- `localStorage` — Persistent storage
- `fetch()` — Network requests
- `window.location` — URL and navigation
- `Date.now()` — Current time

**The problem:** Happy-dom (the fake browser) doesn't implement these APIs realistically.

**Example from PortraitBlocker:**

```typescript
// In the actual component
const mediaQuery = window.matchMedia(
  "(orientation: portrait) and (max-width: 768px)",
);
setIsPortrait(mediaQuery.matches); // Will always be false in tests
```

In happy-dom, `mediaQuery.matches` is always `false` because there's no real CSS engine to evaluate the media query.

### Solution: Mock the API

A **mock** is a fake version of an API that you control for testing. Here's how to mock `window.matchMedia`:

```typescript
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query === "(orientation: portrait) and (max-width: 768px)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
});
```

**What's happening:**

1. `Object.defineProperty(window, 'matchMedia', ...)` — Override the window's matchMedia
2. `value: (query: string) => ({ ... })` — When called, return a fake object
3. `matches: query === '(orientation: portrait) and (max-width: 768px)'` — Return `true` ONLY for portrait
4. Rest of properties — Required by the API spec, but we don't really use them

**Result:** When the component calls `window.matchMedia("(orientation: portrait) and (max-width: 768px)")`, it gets `matches: true`, and the component renders.

### Why This Matters

Without the mock:

- ❌ Component returns `null` (thinks it's not portrait)
- ❌ Nothing renders
- ❌ Tests fail because they can't find elements

With the mock:

- ✅ Component renders
- ✅ Tests can find the text and overlay
- ✅ Tests pass

### Common Mocking Pattern

When you encounter a test failure like "Unable to find element", ask:

1. **Is this element optional?** (Component might conditionally return `null`)
2. **Does it depend on a browser API?** (matchMedia, localStorage, fetch, etc.)
3. **Is the browser API returning unexpected values?** (false instead of true)

If any are yes, you probably need a mock.

---

## 10. Testing: The Verbal Formula (PR #22)

### The Test Naming Pattern

All tests follow this verbal formula:

```typescript
it("should [VERB] when [CONDITION]", () => {
  // ARRANGE - Set up the component/data
  // ACT - Do something (optional, usually skipped for static components)
  // ASSERT - Check the result
});
```

**Breaking down each part:**

| Part          | Meaning                 | Example                                       |
| ------------- | ----------------------- | --------------------------------------------- |
| `should`      | The expected behavior   | "should render"                               |
| `[VERB]`      | What the component does | "render", "display", "show", "hide"           |
| `when`        | The specific condition  | "when component loads"                        |
| `[CONDITION]` | What triggers it        | "when props are provided", "when user clicks" |

### Real Examples from Your Tests

#### Example 1: SkeletonGrid - Correct Count

**Reasoning (mental checklist):**

1. What should happen? → **render** ✓
2. What specifically? → **160 skeleton pads** ✓
3. Under what condition? → **on initial mount** ✓

**Test code:**

```typescript
it("should render 160 skeleton pads on initial mount", () => {
  // ARRANGE
  render(<SkeletonGrid />)

  // ACT - (skipped, nothing to click)

  // ASSERT
  const pads = screen.getAllByTestId("skeleton-pad")
  expect(pads).toHaveLength(160)
})
```

**Read it out loud:** "Should render 160 skeleton pads on initial mount. I render the component, find all skeleton pads, and verify the count is 160."

#### Example 2: SkeletonGrid - Apply Styling

**Reasoning:**

1. What? → **apply** (styling) ✓
2. What specifically? → **animate-pulse class** ✓
3. When? → **to each pad** ✓

```typescript
it("should apply animate-pulse class to each skeleton pad", () => {
  render(<SkeletonGrid />)
  const pads = screen.getAllByTestId("skeleton-pad")
  pads.forEach(pad => {
    expect(pad).toHaveClass("animate-pulse")
  })
})
```

#### Example 3: PortraitBlocker - Display Message

**Reasoning:**

1. What? → **display** ✓
2. What specifically? → **portrait warning message** ✓
3. When? → **when component renders** ✓

```typescript
it("should display portrait warning message when component renders", () => {
  render(<PortraitBlocker />)
  expect(screen.getByText(/rotate.*landscape/i)).toBeInTheDocument()
})
```

### Query Preference: getByRole > getByText > getByTestId

When finding elements in tests, prefer queries in this order:

| Query           | Best For                   | Example                                          |
| --------------- | -------------------------- | ------------------------------------------------ |
| **getByRole**   | Semantic HTML elements     | `getByRole('button')`, `getByRole('heading')`    |
| **getByText**   | Finding by visible text    | `getByText('Click me')` or `getByText(/click/i)` |
| **getByTestId** | Last resort (non-semantic) | `getByTestId('custom-widget')`                   |

**Why this order matters:**

- `getByRole` — Tests the accessibility layer (how screen readers see it). Most resilient.
- `getByText` — Tests what users see (visible content). Good for semantic elements without roles.
- `getByTestId` — Tests implementation details. Brittle if you change HTML structure, but necessary for non-semantic divs.

**Real example from PortraitBlocker:**

```typescript
// ✅ BEST: Uses semantic role
const overlay = screen.getByRole("region", { name: /portrait/i });

// ✅ GOOD: Uses visible text
expect(screen.getByText(/rotate/i)).toBeInTheDocument();

// ❌ AVOID unless necessary: Uses test ID
const overlay = screen.getByTestId("portrait-blocker");
```

### Quick Note: Regex Flags in Tests

When you see `/text/i` in a test query, the `/i` at the end is a **regex flag** that makes matching **case-insensitive**.

```typescript
// Without /i flag (case-sensitive)
/rotate/ matches only "rotate", not "Rotate" or "ROTATE"

// With /i flag (case-insensitive)
/rotate/i matches "rotate", "Rotate", "ROTATE", "rOtAtE", etc.
```

**Why this matters in tests:** UI text is often capitalized (`"Please Rotate Your Device"`), but you want to search for just the word regardless of case. The `/i` flag lets you write flexible, resilient tests.

**Other common regex flags you might see:**

| Flag | Meaning           | Example                             |
| ---- | ----------------- | ----------------------------------- |
| `i`  | Case-insensitive  | `/hello/i` matches "Hello", "HELLO" |
| `g`  | Global (find all) | `/a/g` finds every "a" in a string  |
| `m`  | Multiline         | `/^start/m` matches at line starts  |

### Common Test Verbs

These are the verbs you'll use most when writing test names:

| Verb         | Use When               | Real Example                           |
| ------------ | ---------------------- | -------------------------------------- |
| **render**   | Element appears in DOM | "should render the title"              |
| **display**  | Content shows to user  | "should display error text"            |
| **show**     | Make visible           | "should show loading spinner"          |
| **hide**     | Make invisible         | "should hide menu when closed"         |
| **apply**    | Add class/style        | "should apply disabled state"          |
| **handle**   | Respond to action      | "should handle click event"            |
| **call**     | Function triggered     | "should call onClick handler"          |
| **update**   | Change state           | "should update counter value"          |
| **preserve** | Keep intact            | "should preserve user input"           |
| **throw**    | Raise error            | "should throw error for invalid input" |

### Sequential Reasoning Checklist

When writing a test from scratch, use this mental process:

```text
1. WHAT should happen?        → "should [VERB]"
2. WHAT specifically?          → "the [OBJECT/CONTENT]"
3. UNDER what condition?       → "when [TRIGGER]"
4. HOW do I set it up?        → ARRANGE (render, create data, etc.)
5. DO I need to act?          → ACT (click, type) — usually NO for static components
6. HOW do I verify it?        → ASSERT (expect...)
```

### Anti-Pattern: Vague Test Names

❌ **Bad test names:**

```typescript
it("works", () => { ... })
it("renders correctly", () => { ... })
it("test 1", () => { ... })
```

**Problem:** Six months later, you won't remember what you were testing.

✅ **Good test names:**

```typescript
it("should render 160 skeleton pads when component mounts", () => { ... })
it("should apply animate-pulse class to loading placeholders", () => { ... })
it("should reset form when cancel button is clicked", () => { ... })
```

**Benefit:** Test name reads like documentation. Someone else (or future you) understands every promise the component makes.

### The AAA Pattern (Arrange, Act, Assert)

Every test follows this structure:

```typescript
it("should [behavior]", () => {
  // ===== ARRANGE =====
  // Set up: render component, create test data, set up mocks
  render(<MyComponent />)

  // ===== ACT =====
  // Do something: click, type, submit
  // (Often skipped for static components that don't respond to input)

  // ===== ASSERT =====
  // Check the result: did what we expect happen?
  expect(screen.getByText("Hello")).toBeInTheDocument()
})
```

**In film terms:**

1. **ARRANGE:** Set the stage (lights, camera, actors positioned)
2. **ACT:** Roll camera, action (perform the scene)
3. **ASSERT:** Check the footage (does it look right?)

### Assertion Methods: `toBe` vs `toEqual`

When asserting in tests, the method you choose depends on what you're comparing:

**`toBe()` — For Primitives (Reference Equality)**

Use when comparing simple values:

- Booleans: `expect(result.current.loading).toBe(false)`
- Numbers: `expect(count).toBe(5)`
- Strings: `expect(name).toBe("John")`
- `null` or `undefined`: `expect(value).toBe(null)`

`toBe` uses `===` (strict equality), checking if two variables point to the exact same thing in memory.

**`toEqual()` — For Objects & Arrays (Deep Comparison)**

Use when comparing complex values:

- Objects: `expect(result.current.session).toEqual(mockSession)`
- Arrays: `expect(list).toEqual([1, 2, 3])`
- Nested structures: `expect(result.current.user).toEqual({ id: "123", email: "test@example.com" })`

`toEqual` does a **deep comparison**, checking if the contents and structure match, even if they're different objects in memory.

**Why This Matters:**

In your hook tests, the `session` returned by the hook might be a different object reference than `mockSession` (React state might clone it), but it contains the same data. Using `toEqual` says "I don't care if it's the same object, just that it has the same values."

If you used `toBe(mockSession)`, the test would fail even though the hook is working correctly, because they're different objects.

---

## 13. Reading Function Definitions in Documentation

When you hover over a function or see it in MDN/TypeScript docs, the signature can look cryptic. Here's how to decode it.

### The Pattern

```typescript
functionName(parameter1: Type1, parameter2: Type2): ReturnType
```

**Reading order:**

1. **Function name** — What it's called
2. **Parameters** — What you pass in (inputs)
3. **Return type** — What you get back (output)

### Real Example 1: `expect.any()`

**What you saw:**

```typescript
(property) ExpectStatic.any: (constructor: unknown) => any
```

**Breaking it down:**

| Part                     | Meaning                         | Translation                                           |
| ------------------------ | ------------------------------- | ----------------------------------------------------- |
| `(property)`             | It's a property on an object    | Lives on the `expect` object                          |
| `ExpectStatic.any`       | The full path to this function  | `expect.any` (static method on expect)                |
| `(constructor: unknown)` | Takes one parameter of any type | You pass in a class/constructor (Error, String, etc.) |
| `=> any`                 | Returns a matcher of type `any` | Returns a test matcher                                |

**In plain English:**
"This is a function on the `expect` object called `any`. It takes a constructor (like `Error` or `String`) and returns a matcher you can use in tests."

**How you use it:**

```typescript
expect(consoleSpy).toHaveBeenCalledWith(
  expect.stringContaining("..."),
  expect.any(Error), // ← Pass Error class as the constructor
);
```

### Real Example 2: `Array.filter()`

**MDN signature:**

```typescript
filter(callbackFn: (element: T, index: number, array: T[]) => boolean): T[]
```

**Breaking it down:**

| Part                                                 | Meaning                              |
| ---------------------------------------------------- | ------------------------------------ |
| `filter`                                             | Function name                        |
| `callbackFn`                                         | Parameter name (you pass a function) |
| `(element: T, index: number, array: T[]) => boolean` | The callback function's signature    |
| `: T[]`                                              | Returns an array                     |

**Nested callback breakdown:**

| Part         | Meaning                                 |
| ------------ | --------------------------------------- |
| `element`    | Current item in array                   |
| `index`      | Position of item                        |
| `array`      | The original array                      |
| `=> boolean` | Your callback must return true or false |

**In plain English:**
"Pass a function that receives each element, its index, and the array. Your function returns `true` to keep the item, `false` to filter it out. Returns a new array with kept items."

**How you use it:**

```typescript
const numbers = [1, 2, 3, 4];
const evens = numbers.filter((num) => num % 2 === 0);
//                            ↑       ↑
//                         element  return true/false
```

### Real Example 3: `vi.spyOn()`

**What is `vi`?**

`vi` stands for **Vitest Interface** — it's Vitest's API object for mocking and spying, like a "mock API toolkit." Think of it like:

- Jest uses: `jest.fn()`, `jest.mock()`, `jest.spyOn()`
- Vitest uses: `vi.fn()`, `vi.mock()`, `vi.spyOn()`

**Common `vi` methods:**

```typescript
vi.fn(); // Create a mock function
vi.mock(path, impl); // Mock a module
vi.spyOn(obj, key); // Spy on an object's method
vi.clearAllMocks(); // Reset all mocks between tests
```

**Vitest signature:**

```typescript
spyOn<T, K extends keyof T>(
  object: T,
  method: K
): SpyInstance<T[K]>
```

**Breaking it down:**

| Part            | Meaning                                        |
| --------------- | ---------------------------------------------- |
| `spyOn`         | Function name                                  |
| `<T, K>`        | Generic types (you don't write these directly) |
| `object: T`     | First parameter: the object to spy on          |
| `method: K`     | Second parameter: name of method to spy on     |
| `: SpyInstance` | Returns a spy object                           |

**In plain English:**
"Pass an object and the name of one of its methods. Returns a spy that wraps that method."

**How you use it:**

```typescript
const consoleSpy = vi.spyOn(console, "error");
//                           ↑        ↑
//                         object   method name
```

### Reading Checklist

When you see a function signature, ask in this order:

1. **What's the function name?** (The part before `(`)
2. **How many parameters does it take?** (Count the commas)
3. **What type is each parameter?** (Look after the `:` for each param)
4. **Is any parameter optional?** (Look for `?` before the `:`)
5. **What does it return?** (Look after the closing `)` for the final `:`)

### Why `unknown` Instead of `any`?

You'll see both `unknown` and `any` in type signatures:

**`any`** — TypeScript turns off all type checking

```typescript
const x: any = 5;
x.toUpperCase(); // ✅ TypeScript allows this (will crash at runtime!)
```

**`unknown`** — TypeScript enforces checking before use

```typescript
const x: unknown = 5;
x.toUpperCase(); // ❌ TypeScript blocks this (protects you!)

// You must check the type first
if (typeof x === "string") {
  x.toUpperCase(); // ✅ Now TypeScript knows it's safe
}
```

**In function signatures:**

- `constructor: unknown` means "we accept anything, but we don't know what it is"
- This forces the library author to handle all possible types safely
- More type-safe than `constructor: any`

**Rule of thumb:** `unknown` is safer than `any`. If you see `unknown` in a signature, it means the library is being careful about type safety.

---

## 14. Error Boundaries and Lifecycle Methods (PR #23)

**Concept:** Error Boundaries are React components that catch errors in child components and prevent the entire app from crashing.

### Key Lifecycle Methods

**`getDerivedStateFromError(error)`**

```typescript
static getDerivedStateFromError(error: Error): State {
  return { hasError: true, error };
}
```

- Called **during render** when an error is caught
- Updates component state to trigger a re-render
- Controls what gets displayed (fallback UI vs normal children)
- Must be `static` (doesn't use `this`)

**`componentDidCatch(error, errorInfo)`**

```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  console.error("[ErrorBoundary] Caught error:", error);
  console.error("[ErrorBoundary] Error info:", errorInfo);
}
```

- Called **after render** when an error is caught
- Used for logging, analytics, error reporting
- Can access `errorInfo.componentStack` to see which component threw
- Does NOT control what renders (that's `getDerivedStateFromError`'s job)

### The Difference: Logging vs Rendering

**Important distinction you discovered:**

When ErrorBoundary catches an error:

1. `getDerivedStateFromError()` sets state → determines what to **render**
2. `componentDidCatch()` logs the error → goes to **console**
3. `render()` checks state and either shows fallback UI or children

**In your test:**

```typescript
// This logs to console (componentDidCatch)
console.error("[ErrorBoundary] Caught error:", error);

// This renders on the page (getDerivedStateFromError + render)
<p>{this.state.error?.message || "An unexpected error occurred"}</p>
```

So when testing ErrorBoundary:

- Look for the **rendered message** on the page (the actual fallback UI)
- Not the **console.error** text (which is just logging)

### Error Message Flow

```text
Component throws: new Error("Error in useEffect")
        ↓
ErrorBoundary catches it
        ↓
getDerivedStateFromError stores: { hasError: true, error }
        ↓
render() checks state and renders:
        ↓
<p>{this.state.error?.message}</p>  ← Displays "Error in useEffect"
        ↓
User sees on page: "Error in useEffect"
```

The error message string comes from the **`.message` property** of the caught error object.

### Common Testing Confusion: `getByText` vs `queryByText`

**The confusion you had:**

You tried to use `getByText()` to check if something does NOT exist:

```typescript
// ❌ This throws an error because getByText can't find the text
expect(
  screen.getByText("This component rendered successfully!"),
).toBeInTheDocument();
```

**The difference:**

| Method          | Behavior                    | When to use                         |
| --------------- | --------------------------- | ----------------------------------- |
| `getByText()`   | Throws error if not found   | Assert element **SHOULD** exist     |
| `queryByText()` | Returns `null` if not found | Assert element **SHOULD NOT** exist |

**The fix:**

```typescript
// ✅ This works - queryByText returns null, then we assert it's not there
expect(
  screen.queryByText("This component rendered successfully!"),
).not.toBeInTheDocument();
```

**Rule:** If you're using `.not.toBeInTheDocument()`, always use `query` methods. Never use `get` methods with `.not.` because `get` will throw before your assertion runs.

---

## 11. Destructuring with Defaults and Type Annotations

**Pattern:** `({ propertyName = defaultValue }: { propertyName?: Type })`

**You'll see this in test files and component props.** It combines two TypeScript features in one line.

### Breaking It Down

The pattern has **two sides** separated by a colon `:`:

**Left side: Default value**

```typescript
{
  message = "Test explosion";
}
```

Says: "Extract the `message` property. If it's `undefined`, use `"Test explosion"` instead."

**Right side: Type annotation**

```typescript
{ message?: string; }
```

Says: "The parameter is an object with an optional `message` property that must be a string."

### Real Example from Testing

```typescript
const BombComponent = ({
  message = "Test explosion",
}: {
  message?: string;
}) => {
  throw new Error(message);
};
```

**Without destructuring:**

```typescript
const BombComponent = (props) => {
  const message = props.message || "Test explosion"; // manually extract + default
  throw new Error(message);
};
```

**The destructured version is cleaner** because `message` is available directly as a variable.

### How It Works in Practice

```typescript
// Usage 1: No prop passed
<BombComponent />
// → message defaults to "Test explosion"

// Usage 2: Prop passed
<BombComponent message="Custom error" />
// → message is "Custom error"

// Usage 3: Explicitly undefined
<BombComponent message={undefined} />
// → message defaults to "Test explosion"
```

### Why the `?` Matters

The `?` in `message?: string` means "optional" — the property might not exist in the object. Compare:

```typescript
// Without ?: message MUST be provided
({ message }: { message: string })

// With ?: message is optional
({ message = "default" }: { message?: string })
```

### Common Pattern in React Components

This exact pattern appears in component props:

```typescript
interface ButtonProps {
  label?: string;
  onClick?: () => void;
}

function MyButton({ label = "Click me", onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}
```

You'll use this constantly as your components grow more complex.

---

## 12. Mocking Readonly Properties with `as any` (Testing Pattern)

**Quick reminder:** In tests, you sometimes need to mock **readonly** browser APIs like `window.location`.

```typescript
// In test setup:
delete (window as any).location; // Remove the readonly protection
window.location = { reload: vi.fn() } as any; // Assign fake object
```

**Why two `as any` casts?**

1. **First `as any`** — Tells TypeScript "let me delete this readonly property"
2. **Second `as any`** — Tells TypeScript "accept this fake object as a real location"

Each cast temporarily removes TypeScript's protection **just for that line**.

**Important:** Only use `as any` in **test code**. Never in production. It's a deliberate rule-break for testing purposes only.

**See also:** Section 9 covers general mocking patterns for browser APIs.

---

## 13. Reading Function Definitions in Documentation

When you hover over a function or see it in MDN/TypeScript docs, the signature can look cryptic. Here's how to decode it.

### The Pattern

```typescript
functionName(parameter1: Type1, parameter2: Type2): ReturnType
```

**Reading order:**

1. **Function name** — What it's called
2. **Parameters** — What you pass in (inputs)
3. **Return type** — What you get back (output)

### Real Example 1: `expect.any()`

**What you saw:**

```typescript
(property) ExpectStatic.any: (constructor: unknown) => any
```

**Breaking it down:**

| Part                     | Meaning                         | Translation                                           |
| ------------------------ | ------------------------------- | ----------------------------------------------------- |
| `(property)`             | It's a property on an object    | Lives on the `expect` object                          |
| `ExpectStatic.any`       | The full path to this function  | `expect.any` (static method on expect)                |
| `(constructor: unknown)` | Takes one parameter of any type | You pass in a class/constructor (Error, String, etc.) |
| `=> any`                 | Returns a matcher of type `any` | Returns a test matcher                                |

**In plain English:**
"This is a function on the `expect` object called `any`. It takes a constructor (like `Error` or `String`) and returns a matcher you can use in tests."

**How you use it:**

```typescript
expect(consoleSpy).toHaveBeenCalledWith(
  expect.stringContaining("..."),
  expect.any(Error), // ← Pass Error class as the constructor
);
```

### Real Example 2: `Array.filter()`

**MDN signature:**

```typescript
filter(callbackFn: (element: T, index: number, array: T[]) => boolean): T[]
```

**Breaking it down:**

| Part                                                 | Meaning                              |
| ---------------------------------------------------- | ------------------------------------ |
| `filter`                                             | Function name                        |
| `callbackFn`                                         | Parameter name (you pass a function) |
| `(element: T, index: number, array: T[]) => boolean` | The callback function's signature    |
| `: T[]`                                              | Returns an array                     |

**Nested callback breakdown:**

| Part         | Meaning                                 |
| ------------ | --------------------------------------- |
| `element`    | Current item in array                   |
| `index`      | Position of item                        |
| `array`      | The original array                      |
| `=> boolean` | Your callback must return true or false |

**In plain English:**
"Pass a function that receives each element, its index, and the array. Your function returns `true` to keep the item, `false` to filter it out. Returns a new array with kept items."

**How you use it:**

```typescript
const numbers = [1, 2, 3, 4];
const evens = numbers.filter((num) => num % 2 === 0);
//                            ↑       ↑
//                         element  return true/false
```

### Real Example 3: `vi.spyOn()`

**Vitest signature:**

```typescript
spyOn<T, K extends keyof T>(
  object: T,
  method: K
): SpyInstance<T[K]>
```

**Breaking it down:**

| Part            | Meaning                                        |
| --------------- | ---------------------------------------------- |
| `spyOn`         | Function name                                  |
| `<T, K>`        | Generic types (you don't write these directly) |
| `object: T`     | First parameter: the object to spy on          |
| `method: K`     | Second parameter: name of method to spy on     |
| `: SpyInstance` | Returns a spy object                           |

**In plain English:**
"Pass an object and the name of one of its methods. Returns a spy that wraps that method."

**How you use it:**

```typescript
const consoleSpy = vi.spyOn(console, "error");
//                           ↑        ↑
//                         object   method name
```

### Reading Checklist

When you see a function signature, ask in this order:

1. **What's the function name?** (The part before `(`)
2. **How many parameters does it take?** (Count the commas)
3. **What type is each parameter?** (Look after the `:` for each param)
4. **Is any parameter optional?** (Look for `?` before the `:`)
5. **What does it return?** (Look after the closing `)` for the final `:`)

### Why `unknown` Instead of `any`?

---

## Study Resources

### Topics to explore deeper

1. **Object destructuring** - How `{ variant, isActive, ...rest }` works
2. **Template literals** - How `` `url(${image})` `` constructs strings
3. **Ternary operators** - `condition ? valueIfTrue : valueIfFalse`
4. **Array methods** - `.map()`, `.filter()`, `.join()`
5. **CSS background properties** - `backgroundSize`, `backgroundPosition`, etc.
6. **Component composition** - When to split things into separate components
7. **TypeScript generics** - What `<T>` and `<K extends keyof T>` mean in signatures

### Good practice

When you see a pattern you don't understand, add it here! This becomes your
personal pattern library.

---

## Your Chiclet Implementation Notes

**What you built:**

- A component that takes step data and renders a styled image button
- Uses object lookups for dynamic values (opacity, image selection)
- Handles 3 visual states: off, on, ghost (accented)
- Applies brightness modifiers for playhead and 16th notes

**Key files:**

- `src/components/Chiclet.tsx` - The component
- `src/App.tsx` - Where it's used (in the grid rendering loop)
- `src/assets/images/` - Where the images live

**Props flow:**

```text
App.tsx calculates:
  - variant (from colIndex)
  - isActive (from grid array)
  - isAccented (from manifest)
  - isCurrentStep (from currentStep state)
  - is16thNote (from colIndex % 4)

Chiclet receives props and:
  - Computes state (off/on/ghost)
  - Looks up image
  - Looks up opacity
  - Combines brightness modifiers
  - Renders <button> with background image
```
