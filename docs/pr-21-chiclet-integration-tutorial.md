# Chiclet Component Tutorial: Step-by-Step Implementation Guide

## Overview
You'll be creating a new `Chiclet` component to replace the current `Pad` component, adding photorealistic visuals with 4-step color banding (Red → Orange → Yellow → Cream).

---

## What You're Building

**Current State:** Simple rounded buttons with opacity-based states  
**Target State:** Photo-realistic chiclet buttons with color-grouped steps (like the TR-08)

**Visual Pattern:**
```
Steps:   [0][1][2][3] [4][5][6][7] [8][9][10][11] [12][13][14][15]
Colors:  RED  RED  RED  RED | ORANGE ORANGE ORANGE ORANGE | YELLOW YELLOW YELLOW YELLOW | CREAM CREAM CREAM CREAM
```

---

## Step 1: Create the Chiclet Component

### 1.1 - Create the File
Create a new file: `src/components/Chiclet.tsx`

### 1.2 - Define the Props Interface

The Chiclet needs similar props to Pad, with two key differences:

**Try writing the interface yourself with these props:**
- `variant`: One of 'red', 'orange', 'yellow', or 'cream' (union type)
- `state`: One of 'off', 'on', or 'ghost' (union type)
- `isCurrentStep`: boolean
- `is16thNote`: boolean
- `onClick`: function that returns void
- `disabled`: optional boolean

**Hint:** Look at `Pad.tsx` for reference on the syntax.

### 1.3 - Write the Component Function

Your component needs to do these things **in order**:

**Step A: Handle the disabled state first**
- If `disabled` is true, return early with a grayscale button
- Copy the disabled return from Pad.tsx - it's the same

**Step B: Create a color mapping object**
- You need an object that maps each variant to two colors (off and on)
- Structure: `{ red: { off: 'bg-red-950', on: 'bg-red-600' }, ... }`
- Use Tailwind colors: `bg-{color}-950` for dark, `bg-{color}-600` for bright
- For cream, use `amber` instead (Tailwind doesn't have cream)

**Step C: Pick the right background color**
- If state is 'off', use the dark color
- If state is 'on' or 'ghost', use the bright color
- Store this in a `bgColor` variable

**Step D: Map state to opacity**
- 'off' → 'opacity-20'
- 'on' → 'opacity-100'
- 'ghost' → 'opacity-50'

**Step E: Add brightness modifiers**
- If `isCurrentStep` is true, add 'brightness-175'
- If `is16thNote` is true, add 'brightness-135'
- You can use an array with `.filter(Boolean).join(' ')` to combine them

**Step F: Return the button**
- Same structure as Pad, but with your new classes
- Combine: `${bgColor} ${opacityClass} ${brightnessModifiers}`

**Try implementing this yourself before looking at the reference solution below!**

---

## Step 2: Integrate into SequencerGrid

Now you'll modify `App.tsx` to use the new Chiclet component instead of Pad.

### 2.1 - Import the Chiclet Component

**Task:** Update the import at the top of `App.tsx` to import Chiclet instead of Pad.

### 2.2 - Add the Color Helper Function

**Task:** Write a function called `getChicletVariant` that:
- Takes a `stepIndex` (number from 0-15)
- Returns 'red' | 'orange' | 'yellow' | 'cream'
- Logic:
  - Steps 0-3 return 'red'
  - Steps 4-7 return 'orange'
  - Steps 8-11 return 'yellow'
  - Steps 12-15 return 'cream'

**Where to put it:** Near line 600 in `App.tsx`, close to the `getActiveColor` function.

### 2.3 - Replace the Pad Rendering Logic

**Find this section:** Around line 1160-1200, inside the grid rendering loop where `<Pad>` components are created.

**Your task:** Modify the inner `.map()` function to:

1. Get `isActive` from `grid[rowIndex][colIndex]`
2. Get `isAccented` from the manifest (already there)
3. Calculate `chicletState`:
   - If not active → 'off'
   - If active AND accented → 'ghost'
   - If active AND not accented → 'on'
4. Replace `<Pad>` with `<Chiclet>`
5. Pass these props to Chiclet:
   - `key` (same as before)
   - `variant` (use your helper function with colIndex)
   - `state` (the chicletState you calculated)
   - `isCurrentStep` (same as before)
   - `is16thNote` (same as before)
   - `onClick` (same as before)
   - `disabled` (same as before)

**What to remove:**
- The `color` prop (Chiclet doesn't use it)
- The `isActive` prop (Chiclet uses `state` instead)
- The `isAccented` prop (Chiclet uses `state` instead)

---

## Step 3: Understanding the Logic Flow

Let me break down how the state mapping works:

### How State is Determined:

```
Step clicked → Check grid[row][col] → isActive?
                                          ↓
                                    ┌─────┴─────┐
                                    NO          YES
                                    ↓           ↓
                              state='off'    Check accents[col]
                                                ↓
                                          ┌─────┴─────┐
                                          NO          YES
                                          ↓           ↓
                                    state='on'   state='ghost'
```

### How Color is Determined:

```
colIndex → getChicletVariant(colIndex) → variant
   0-3   →         'red'               → Red background
   4-7   →       'orange'              → Orange background
   8-11  →       'yellow'              → Yellow background
  12-15  →       'cream'               → Cream background
```

### How Final Appearance is Built:

```
variant + state → background color
    'red' + 'off'   → bg-red-950 (dark) + opacity-20
    'red' + 'on'    → bg-red-600 (bright) + opacity-100
    'red' + 'ghost' → bg-red-600 (bright) + opacity-50
```

---

## Step 4: Testing Your Implementation

### 4.1 - Save All Files
- `src/components/Chiclet.tsx` (new file)
- `src/App.tsx` (modified import + rendering logic)

### 4.2 - Run the Dev Server
```bash
bun run dev
```

### 4.3 - Visual Verification Checklist

Open the app and verify:

1. **Color Banding:**
   - Steps 0-3: Red
   - Steps 4-7: Orange
   - Steps 8-11: Yellow
   - Steps 12-15: Cream

2. **3-State Interaction:**
   - Click an off pad → Should turn bright (on state)
   - Click again → Should dim slightly (ghost state)
   - Click again → Should turn very dim (off state)

3. **Playhead Animation:**
   - Press Play → The current step should glow brighter than others

4. **16th Note Highlighting:**
   - Quarter notes (0, 4, 8, 12) should be slightly less bright than 16th notes

5. **Failed Track Handling:**
   - If any tracks failed to load, they should be grayscale

---

## Step 5: Common Issues & Troubleshooting

### Issue: "Chiclet is not defined"
**Solution:** Make sure you exported the component with `export function Chiclet`

### Issue: All buttons are the same color
**Solution:** Check that `getChicletVariant(colIndex)` is being called with the correct index

### Issue: Opacity not changing on click
**Solution:** Verify that `handlePadClick` is still updating both `grid` and `manifestRef.current.tracks[trackId].accents`

### Issue: TypeScript errors about props
**Solution:** Make sure the `ChicletProps` interface matches what you're passing from App.tsx

---

## Concept Explanations (For Learning)

### 1. **Why use `variant` instead of passing `colIndex` directly?**
This is called "Separation of Concerns":
- The Chiclet component doesn't need to know what step it is
- It only needs to know what color to be
- This makes the component more reusable and testable

### 2. **Why simplify to `state` instead of `isActive` + `isAccented`?**
This is called "Derived State":
- Instead of making the component figure out the state from two booleans
- You calculate the state once in the parent and pass it down
- This makes the component logic simpler and more predictable

### 3. **What's happening with the className template literal?**
```typescript
className={`${bgColor} ${opacityClass} ${brightnessModifiers}`}
```
This is concatenating multiple CSS classes together:
- `bgColor` might be `'bg-red-600'`
- `opacityClass` might be `'opacity-100'`
- `brightnessModifiers` might be `'brightness-175 brightness-135'`
- Final result: `'bg-red-600 opacity-100 brightness-175 brightness-135'`

---

## Summary of Changes

**Files Created:**
- `src/components/Chiclet.tsx` (new component)

**Files Modified:**
- `src/App.tsx`:
  - Import statement (line ~4)
  - Added `getChicletVariant()` helper (line ~600)
  - Grid rendering logic (line ~1160-1200)

**Total Lines of Code:** ~100 lines

**Estimated Time:** 30-45 minutes (including testing)

---

## Next Steps After Implementation

Once this works, potential enhancements:
1. Add PNG assets for even more realistic chiclets (like the knobs)
2. Add subtle shadow/highlight gradients
3. Add click animation (scale down on press)
4. Add hover state differentiation

---

## Questions to Consider

Before starting, think about:
1. Do you want to keep the old `Pad.tsx` file as a backup?
2. Should failed tracks show as grayscale chiclets or just disappear?
3. Do you want the brightness modifiers to be configurable?

---

## Reference Solutions (Check Your Work!)

### Solution: Chiclet Component (Complete)

<details>
<summary>Click to expand reference solution</summary>

```typescript
type ChicletProps = {
  variant: 'red' | 'orange' | 'yellow' | 'cream';
  state: 'off' | 'on' | 'ghost';
  isCurrentStep: boolean;
  is16thNote: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export function Chiclet({
  variant,
  state,
  isCurrentStep,
  is16thNote,
  onClick,
  disabled = false,
}: ChicletProps) {
  // Handle disabled tracks
  if (disabled) {
    return (
      <button
        className="aspect-2/1 h-[25px] w-full cursor-not-allowed rounded-sm bg-gray-800 opacity-30 grayscale"
        disabled
        title="This track failed to load"
      />
    );
  }

  // Map variant to background colors
  const colorClasses = {
    red: {
      off: 'bg-red-950',
      on: 'bg-red-600',
    },
    orange: {
      off: 'bg-orange-950',
      on: 'bg-orange-600',
    },
    yellow: {
      off: 'bg-yellow-900',
      on: 'bg-yellow-500',
    },
    cream: {
      off: 'bg-amber-900',
      on: 'bg-amber-400',
    },
  };

  // Pick background color based on state
  const bgColor = state === 'off' 
    ? colorClasses[variant].off
    : colorClasses[variant].on;

  // Map state to opacity
  const opacityClass = {
    off: 'opacity-20',
    on: 'opacity-100',
    ghost: 'opacity-50',
  }[state];

  // Add brightness modifiers
  const brightnessModifiers = [
    isCurrentStep && 'brightness-175',
    is16thNote && 'brightness-135',
  ].filter(Boolean).join(' ');

  // Render button
  return (
    <button
      className={`
        aspect-2/1 h-[25px] w-full
        rounded-sm cursor-pointer
        hover:opacity-80
        ${bgColor}
        ${opacityClass}
        ${brightnessModifiers}
      `.trim().replace(/\s+/g, ' ')}
      onClick={onClick}
    />
  );
}
```

</details>

### Solution: Color Helper Function

<details>
<summary>Click to expand reference solution</summary>

```typescript
const getChicletVariant = (stepIndex: number): 'red' | 'orange' | 'yellow' | 'cream' => {
  if (stepIndex < 4) return 'red';
  if (stepIndex < 8) return 'orange';
  if (stepIndex < 12) return 'yellow';
  return 'cream';
};
```

</details>

### Solution: Grid Rendering Logic

<details>
<summary>Click to expand reference solution</summary>

```typescript
return track.map((_, colIndex) => {
  const isActive = grid[rowIndex][colIndex];
  const isAccented = manifestRef.current.tracks[trackId]?.accents?.[colIndex] ?? false;
  
  // Determine the state for this chiclet
  const chicletState = !isActive 
    ? 'off' 
    : isAccented 
      ? 'ghost' 
      : 'on';

  return (
    <Chiclet
      key={`${rowIndex}-${colIndex}`}
      variant={getChicletVariant(colIndex)}
      state={chicletState}
      isCurrentStep={colIndex === currentStep}
      is16thNote={colIndex % 4 !== 0}
      onClick={() => handlePadClick(rowIndex, colIndex)}
      disabled={isDisabled}
    />
  );
});
```

</details>

---

Let me know if you need clarification on any part of this tutorial!
