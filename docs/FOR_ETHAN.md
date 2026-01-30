# Quick Reference: Concepts to Study Further

## 1. Object Lookups for Dynamic Values

**Concept:** Instead of if/else chains, use objects as lookup tables.

**Example from Chiclet:**
```typescript
// ❌ Hard to read
let opacityClass;
if (state === 'off') opacityClass = 'opacity-25';
else if (state === 'ghost') opacityClass = 'opacity-75';
else opacityClass = 'opacity-100';

// ✅ Clean lookup
const chicletOpacity = {
  off: 'opacity-25',
  ghost: 'opacity-75',
  on: 'opacity-100',
};
const opacityClass = chicletOpacity[state];
```

**Why it matters:** You use the variable (`state`) as a key to get the value. Super common pattern in React for dynamic styling.

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
```
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
  isCurrentStep && 'brightness-175',  // Only add if true
  is16thNote && 'brightness-135',     // Only add if true
].filter(Boolean).join(' ');
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
import image from '../assets/images/photo.png';
//               ^^
//               Go up 1 level to src/

// Absolute (if configured in Vite)
import image from 'src/assets/images/photo.png';
//                ^^^
//                Starts from project root
```

**Path breakdown:**
```
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

## Study Resources

### Topics to explore deeper:
1. **Object destructuring** - How `{ variant, isActive, ...rest }` works
2. **Template literals** - How `` `url(${image})` `` constructs strings
3. **Ternary operators** - `condition ? valueIfTrue : valueIfFalse`
4. **Array methods** - `.map()`, `.filter()`, `.join()`
5. **CSS background properties** - `backgroundSize`, `backgroundPosition`, etc.
6. **Component composition** - When to split things into separate components

### Good practice:
When you see a pattern you don't understand, add it here! This becomes your personal pattern library.

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
```
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
