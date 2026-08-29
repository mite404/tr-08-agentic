# PR #33: Hardware-Style Login Toggle Switch

**Goal:** Replace the blue "Sign In" button and red "Sign Out" button with stylized hardware toggle switches that match the TR-08's aesthetic.

**What You'll Learn:**
- How to replace buttons with image-based toggles
- CSS sizing and scaling for Retina/2x images
- Conditional rendering based on auth state
- Accessible image buttons with proper alt text

---

## The Design

You have two toggle switch images representing login state:

1. **Logged Out** (left position) — Silver knob on left, orange glow on right
2. **Logged In** (right position) — Silver knob on right, orange glow on left

The images are provided at **2x resolution** (316×168px) and need to be scaled down to **158×84px** for display.

---

## Phase 1: Add Images to Assets

### 1.1 Save the Images

Save your two toggle images in `src/assets/images/`:

```
src/assets/images/LOGIN_TOGGLE_OUT.png   // Logged out state (knob left)
src/assets/images/LOGIN_TOGGLE_IN.png    // Logged in state (knob right)
```

**Why these names?** `OUT` = logged out, `IN` = logged in. Clear semantic naming.

---

## Phase 2: Import and Use the Images

### 2.1 Import at the Top of LoginModalButton.tsx

Add these imports after the existing imports:

```tsx
import loginToggleOut from "../assets/images/LOGIN_TOGGLE_OUT.png";
import loginToggleIn from "../assets/images/LOGIN_TOGGLE_IN.png";
```

**How ES module imports work for images:**
- Vite processes the import path and returns a URL string
- The variable (`loginToggleOut`) holds the final bundled asset path
- You use it directly in `src={loginToggleOut}`

### 2.2 Understand the Current Button Logic

The component has **two separate buttons**:

1. **Logged Out** (`!session?.user`) → Blue "Sign In" button (lines 79-87)
2. **Logged In** (`session?.user`) → Red "Sign Out" button (lines 67-75)

You'll replace each button with its corresponding toggle image.

---

## Phase 3: Replace the Sign In Button (Logged Out State)

### 3.1 Find the Sign In Button

Locate this code block (around line 79):

```tsx
<button
  onClick={() => setIsModalOpen(true)}
  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
>
  Sign In
</button>
```

### 3.2 Replace with Image Toggle

Replace the entire button with:

```tsx
<button
  onClick={() => setIsModalOpen(true)}
  className="transition-opacity hover:opacity-80"
  aria-label="Sign in to save and load beats"
>
  <img
    src={loginToggleOut}
    alt="Sign In Toggle"
    className="h-[84px] w-[158px]"
    draggable={false}
  />
</button>
```

**What changed:**
- `className`: Removed colors, kept hover effect (opacity change)
- `aria-label`: Accessibility — screen readers announce the button's purpose
- `<img>`: The toggle image (logged out = knob on left)
- `h-[84px] w-[158px]`: Tailwind arbitrary values for exact pixel sizing (half of 2x image)
- `draggable={false}`: Prevents accidental drag-and-drop of the image

---

## Phase 4: Replace the Sign Out Button (Logged In State)

### 4.1 Find the Sign Out Button

Locate this code block (around line 67):

```tsx
<button
  onClick={() => void handleSignOut()}
  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
>
  Sign Out
</button>
```

### 4.2 Replace with Image Toggle

Replace the entire button with:

```tsx
<button
  onClick={() => void handleSignOut()}
  className="transition-opacity hover:opacity-80"
  aria-label="Sign out"
>
  <img
    src={loginToggleIn}
    alt="Sign Out Toggle"
    className="h-[84px] w-[158px]"
    draggable={false}
  />
</button>
```

**What changed:**
- Same pattern as Sign In, but uses `loginToggleIn` (knob on right)
- `onClick` stays the same (calls `handleSignOut`)
- Hover effect matches the Sign In toggle for consistency

---

## Phase 5: Understanding Image Sizing for Retina Displays

### Why Scale Images by Half?

Your images are **316×168px** (2x resolution). On modern displays, you want to display them at **158×84px** (1x size) so they look sharp on Retina/HiDPI screens.

**How it works:**
1. Browser displays at 158×84px (CSS pixels)
2. On 2x display (like MacBook Retina), browser uses all 316×168 physical pixels
3. Result: Crisp, sharp image with no pixelation

**Tailwind arbitrary values syntax:**
- `h-[84px]` → `height: 84px;`
- `w-[158px]` → `width: 158px;`

You could also use `style={{ height: '84px', width: '158px' }}` but Tailwind is more consistent with your codebase.

---

## Phase 6: Verify and Test

### 6.1 Build and Run

```bash
bun run build
bun run dev
```

### 6.2 Test Both States

1. **Logged Out:** You should see the toggle with knob on the **left** (orange glow on right)
2. Click the toggle → Auth modal opens
3. Sign in with Google/GitHub
4. **Logged In:** Toggle should switch to knob on the **right** (orange glow on left)
5. Click the toggle → Signs you out
6. Toggle switches back to logged-out state (knob left)

### 6.3 Check Hover Effect

- Hover over the toggle → Should fade slightly (`opacity-80`)
- Cursor should change to pointer (default for `<button>`)

---

## Conceptual Insights

### 1. Images as Interactive Elements

Instead of CSS-styled buttons, you're using **image-based UI** to match hardware aesthetics. This is common in skeuomorphic design (UI that mimics physical objects).

**Trade-off:**
- **Pro:** Matches the physical TR-08 aesthetic perfectly
- **Con:** Can't change colors/states with CSS alone (need separate images)

### 2. Conditional Rendering Based on Auth State

The component uses **two separate renders** instead of toggling CSS classes:

```tsx
if (session?.user) {
  return <ImageToggleIn />  // Knob right
}

return <ImageToggleOut />  // Knob left
```

**Why not use a single button with conditional `src`?**
You could, but the current pattern keeps the "logged in" vs "logged out" UX completely separate (different click handlers, different ARIA labels).

### 3. Accessibility with Image Buttons

When a button contains only an image (no text), you **must** provide:
- `aria-label` → Describes the action to screen readers
- `alt` text on `<img>` → Describes the visual content

**Example:**
```tsx
<button aria-label="Sign in to save and load beats">
  <img src={toggle} alt="Sign In Toggle" />
</button>
```

Screen reader announces: "Sign in to save and load beats, button"

---

## Optional Enhancements

### Add a Subtle Animation on State Change

If you want the toggle to "slide" when state changes, you could add a transition:

```tsx
<img
  src={session?.user ? loginToggleIn : loginToggleOut}
  alt={session?.user ? "Sign Out Toggle" : "Sign In Toggle"}
  className="h-[84px] w-[158px] transition-opacity duration-300"
  draggable={false}
/>
```

This fades between states smoothly (300ms). But since you're replacing the entire component on state change, you'd need to wrap it in a transition component like Framer Motion or use CSS animations.

### Use CSS `object-fit` if Images Have Different Aspect Ratios

If your images aren't exactly 316×168px:

```tsx
<img
  src={loginToggleOut}
  alt="Sign In Toggle"
  className="h-[84px] w-[158px] object-contain"
  draggable={false}
/>
```

`object-contain` ensures the image fits within the bounds without distortion.

---

## Final File Structure

After implementation, you'll have:

```
src/
├── assets/
│   └── images/
│       ├── LOGIN_TOGGLE_OUT.png   (316×168px, displayed at 158×84px)
│       └── LOGIN_TOGGLE_IN.png    (316×168px, displayed at 158×84px)
├── components/
│   └── LoginModalButton.tsx       (modified: 2 imports, 2 button replacements)
```

---

## Verification Checklist

- [ ] Images are in `src/assets/images/` with correct filenames
- [ ] Imports are at the top of `LoginModalButton.tsx`
- [ ] Sign In button replaced with `loginToggleOut` image
- [ ] Sign Out button replaced with `loginToggleIn` image
- [ ] Both toggles sized to `158×84px`
- [ ] `aria-label` present on both buttons
- [ ] `draggable={false}` on both images
- [ ] `bun run build` succeeds
- [ ] `bun run lint` passes
- [ ] Toggle switches state correctly when signing in/out
- [ ] Hover effect works (slight opacity fade)

---

## Common Mistakes to Avoid

1. **Forgetting the image import** → `loginToggleOut` will be undefined, image won't display
2. **Wrong image dimensions** → Using `316×168px` instead of `158×84px` makes toggle too large
3. **Missing `aria-label`** → Fails accessibility standards
4. **Forgetting `draggable={false}`** → Image can be accidentally dragged
5. **Swapping the images** → Logged in shows knob on left (should be right)

---

## Next Steps

After implementing the toggles, consider:
- **PR #34:** Add a subtle glow animation to the orange highlight when hovering
- **PR #35:** Add haptic feedback (vibration) on mobile when toggle is clicked
- **PR #36:** Store login state in localStorage to persist across sessions

---

**You've now learned how to replace text buttons with image-based hardware-style UI controls while maintaining accessibility and responsiveness.**
