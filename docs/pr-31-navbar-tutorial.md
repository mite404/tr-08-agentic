# PR #31: NavBar Component & Auth Relocation - Tutorial

> **Goal:** Extract the Sign In button from inside the drum machine chassis into a proper top-level NavBar component, styled to match the Roland brand reference design.
>
> **Estimated Time:** ~1.5 hours
>
> **Learning Style:** Concept-first with guided implementation. You'll build the NavBar step-by-step, making design decisions along the way.
>
> **Prerequisites:**
>
> - Understanding of React functional components and props
> - Familiarity with Tailwind CSS utility classes
> - Completed PR #30 (Layout Finesse) — the chassis layout is already in place

---

## Table of Contents

- [Background Concepts](#background-concepts)
  - [Why Move Auth Out of the Chassis?](#why-move-auth-out-of-the-chassis)
  - [The Container/Presenter Mental Model](#the-containerpresenter-mental-model)
  - [Fixed vs. Static Positioning](#fixed-vs-static-positioning)
- [Phase 1: Asset Preparation & NavBar Skeleton](#phase-1-asset-preparation--navbar-skeleton-20-min)
- [Phase 2: NavBar Layout & Styling](#phase-2-navbar-layout--styling-25-min)
- [Phase 3: Wire Up Auth Props](#phase-3-wire-up-auth-props-20-min)
- [Phase 4: Surgery on App.tsx](#phase-4-surgery-on-apptsx-15-min)
- [Phase 5: Verification & Cleanup](#phase-5-verification--cleanup-10-min)
- [Reference](#reference)

---

## Background Concepts

### Why Move Auth Out of the Chassis?

Right now, the Sign In button lives *inside* the drum machine chassis — the dark container with the background image that simulates physical hardware. Open `src/App.tsx` and look at lines 1058-1075:

```tsx
{/* PR #5: Auth Controls - Only show LoginModal in header */}
<div className="flex items-center gap-3">
  {authLoading ? (
    <div className="px-4 py-2 text-sm font-medium text-gray-200">
      Loading...
    </div>
  ) : (
    <LoginModalButton
      session={session}
      signInWithGoogle={signInWithGoogle}
      signInWithGithub={signInWithGithub}
      signOut={signOut}
      loading={authLoading}
    />
  )}
</div>
```

**The problem:** Authentication is a *web application* concern, not a *drum machine* concern. Imagine you're building a physical drum machine — would you bolt a "Sign In" button onto the faceplate? No. That's the door to the studio, not part of the gear.

**Film analogy:** Think of the current App.tsx like a film where the theater's "EXIT" sign is printed *into the movie footage*. It works, but it's in the wrong layer. The EXIT sign belongs to the theater (the web app shell), not the film (the drum machine UI). This PR moves it to the right layer.

### The Container/Presenter Mental Model

This refactor introduces a clean separation:

| Layer | Role | Film Analogy |
|-------|------|--------------|
| **App.tsx** | State management, orchestration | The Director |
| **NavBar** | Brand + auth + navigation | The Theater Lobby |
| **Chassis** (future PR #32) | Drum machine UI | The Screen |

The NavBar is "dumb" — it receives props and renders UI. It doesn't manage authentication state. It just displays what App.tsx tells it to display. All the decision-making stays in App.tsx.

### Fixed vs. Static Positioning

The NavBar will use `position: fixed` — it stays pinned to the top of the viewport even when the page scrolls. This is standard for app navigation bars.

**Why this matters:** When you fix-position an element, it's removed from the normal document flow. The elements below it don't know it exists — they'll slide underneath it. You need to add **top padding** to the page container to prevent the chassis from hiding behind the nav.

```
Without padding:          With padding:
┌─ NavBar (fixed) ──┐    ┌─ NavBar (fixed) ──┐
│ ████████████████  │    │ ████████████████  │
├───────────────────┤    ├───────────────────┤
│ Chassis hides     │    │ (64px gap)        │
│ behind NavBar!    │    ├───────────────────┤
│                   │    │ Chassis visible   │
└───────────────────┘    └───────────────────┘
```

**Pattern to remember:** Fixed nav → add `pt-16` (64px) to the content below it.

---

## Phase 1: Asset Preparation & NavBar Skeleton (20 min)

### Concept: Component File Structure

Every new component in this project follows a consistent pattern:

1. **Imports** at the top (React, types, assets, child components)
2. **Props interface** (typed contract for what the component accepts)
3. **Function component** (exported, named — no default exports)
4. **Return JSX** (the visual output)

This is the same pattern you've seen in `Chiclet.tsx`, `TrackControls.tsx`, `PlayStopBtn.tsx`, etc. We're not inventing anything new — just following the established conventions.

### Step 1.1: Copy the Roland Logo Asset

First, we need the Roland logo image inside our project's asset directory. The source file is:

```
/Users/ea/Downloads/photo-real-roland/Corporate Brand Logos/Roland/Roland_Logo_White.png
```

Copy it to:

```
src/assets/images/Roland_Logo_White.png
```

**Why inside `src/assets/`?** Vite treats files in `src/` as ES modules — they get bundled, hashed, and optimized in the production build. Files outside `src/` (like in `public/`) are served as-is without optimization. Since this logo will appear on every page load, we want it bundled.

**Run this in your terminal:**

```bash
cp "/Users/ea/Downloads/photo-real-roland/Corporate Brand Logos/Roland/Roland_Logo_White.png" \
   src/assets/images/Roland_Logo_White.png
```

**Verify it landed:**

```bash
ls -la src/assets/images/Roland_Logo_White.png
```

You should see the file listed with a reasonable file size.

### Step 1.2: Create the NavBar Component Skeleton

Create a new file at `src/components/NavBar.tsx`. Start with the skeleton below — it has the structure in place with `TODO` comments where you'll fill in the implementation.

```tsx
// =============================================================================
// NavBar.tsx — Top-level navigation bar for the TR-08 web application
// =============================================================================
//
// This component sits OUTSIDE the drum machine chassis. It's part of the
// web application shell — think of it as the "theater lobby" where you check
// your ticket (auth) before entering the screening room (the sequencer).
//
// Props are passed down from App.tsx — NavBar owns no state.
// =============================================================================

import type { Session } from "@supabase/supabase-js";
import { LoginModalButton } from "./LoginModalButton";
import rolandLogo from "../assets/images/Roland_Logo_White.png";

// =============================================================================
// TYPES
// =============================================================================

export interface NavBarProps {
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  authLoading: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function NavBar({
  session,
  signInWithGoogle,
  signInWithGithub,
  signOut,
  authLoading,
}: NavBarProps) {
  return (
    // TODO (Phase 2): Build the nav element
    // For now, render a placeholder so we can verify the file compiles
    <nav className="h-16 bg-neutral-900">
      <span className="text-white">NavBar placeholder</span>
    </nav>
  );
}
```

**Why start with a placeholder?** Same reason film crews do lighting tests before shooting a scene — we want to verify the basic setup works before committing to the full composition. This placeholder lets us:

1. Confirm the file imports correctly
2. Confirm TypeScript is happy with the props interface
3. See *something* render before we style it

### Step 1.3: Verify the Skeleton Compiles

Before we write any more code, let's make sure what we have so far is valid:

```bash
bun run build
```

**Expected:** The build should succeed. If you see errors about the image import, double-check that the logo file is in the right location (`src/assets/images/Roland_Logo_White.png`).

### ✅ Phase 1 Complete

You've learned:

- Why the auth button doesn't belong inside the chassis (separation of concerns)
- How Vite handles image imports in `src/assets/` (bundled as ES modules)
- The standard component file structure used in this project

**Next:** Phase 2 — We'll build out the NavBar layout and match the reference design.

---

## Phase 2: NavBar Layout & Styling (25 min)

### Concept: Anatomy of the Reference NavBar

Let's break down the reference image into its structural pieces. The NavBar has two sides:

```
┌──────────────────────────────────────────────────────────────┐
│  [A: Logo]              [B: LOG IN toggle]  [C: NAV LINKS]  │
└──────────────────────────────────────────────────────────────┘
```

| Zone | Content | Alignment |
|------|---------|-----------|
| **A** | Roland logo image | Left |
| **B** | "LOG IN" label + toggle-style button | Right (before links) |
| **C** | ABOUT, BEATS, COMMUNITY links | Right |

**Key visual characteristics from the reference:**

- Dark background (near-black, warm tone)
- Gold/beige text color for links
- Uppercase text with wide letter spacing
- The "LOG IN" area has a metallic toggle switch visual
- Generous horizontal padding

**Tailwind Translation:**

- Background: `bg-neutral-900` (or a custom dark)
- Text color: `text-amber-200` or `text-[#C4A35A]` (gold)
- Letter spacing: `tracking-widest`
- Text transform: `uppercase`
- Font weight: `font-semibold`
- Text size: `text-sm`

### Step 2.1: Build the Two-Sided Layout

Replace the placeholder `return` in `NavBar.tsx` with the full layout structure. This is the core structure — we'll refine the styling after.

```tsx
export function NavBar({
  session,
  signInWithGoogle,
  signInWithGithub,
  signOut,
  authLoading,
}: NavBarProps) {
  return (
    <nav
      className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-neutral-900 px-8"
    >
      {/* ── LEFT SIDE: Roland Logo ────────────────────────────── */}
      <div className="flex items-center">
        <img
          src={rolandLogo}
          alt="Roland"
          className="h-10"
          draggable={false}
        />
      </div>

      {/* ── RIGHT SIDE: Auth + Navigation Links ───────────────── */}
      <div className="flex items-center gap-8">
        {/* TODO (Step 2.2): Add navigation links */}

        {/* TODO (Step 2.3): Add auth control area */}
      </div>
    </nav>
  );
}
```

**Why `z-40`?**

Think of `z-index` like layers in After Effects or Photoshop:

| z-index | Element | Why |
|---------|---------|-----|
| `z-50` | PortraitBlocker | Must cover EVERYTHING when active |
| `z-40` | NavBar | Above page content, below blocker |
| `z-10` | Chassis content | Normal content layer |

The PortraitBlocker needs to be the highest layer because when it activates (portrait orientation on mobile), it should cover the entire screen — including the NavBar. If the NavBar were `z-50` too, you'd have a layer conflict.

**Why `border-b border-white/10`?** That's a very subtle white bottom border at 10% opacity. It creates a gentle visual separation between the NavBar and the content below without being harsh. Look at the reference image — there's a faint line at the bottom of the nav.

### Step 2.2: Add Navigation Links

Inside the `{/* TODO (Step 2.2) */}` area, add the navigation links. These are placeholder links for now — the pages don't exist yet, but we want the visual design to be complete.

```tsx
{/* Navigation Links */}
<a
  href="#about"
  className="text-sm font-semibold uppercase tracking-widest text-amber-200/80 transition-colors hover:text-amber-100"
>
  About
</a>
<a
  href="#beats"
  className="text-sm font-semibold uppercase tracking-widest text-amber-200/80 transition-colors hover:text-amber-100"
>
  Beats
</a>
<a
  href="#community"
  className="text-sm font-semibold uppercase tracking-widest text-amber-200/80 transition-colors hover:text-amber-100"
>
  Community
</a>
```

**Why `text-amber-200/80`?** The `/80` is Tailwind's opacity modifier — it makes the text 80% opaque by default, then the `hover:text-amber-100` brightens it on hover. This creates a subtle interactive feel without being too flashy. Gold at 80% has a warm, muted quality that matches the hardware aesthetic.

**Design choice — your call:** Look at the reference image. The links use a specific gold tone. If `text-amber-200` doesn't feel right when you see it in the browser, you can swap to a custom color like `text-[#C4A35A]` — that's a more saturated brass/gold.

### Step 2.3: Add the Auth Control Area

Replace the `{/* TODO (Step 2.3) */}` with the auth section. This is where the `LoginModalButton` component goes — the same component that was previously inside the chassis.

Here's the interesting part: **you need to decide how to present the auth state visually.**

The reference shows "LOG IN" with a toggle switch. There are a few approaches:

**Option A: Label + LoginModalButton side by side**

```tsx
<div className="flex items-center gap-3">
  <span className="text-sm font-semibold uppercase tracking-widest text-amber-200/80">
    {session ? "Signed In" : "Log In"}
  </span>
  {authLoading ? (
    <div className="text-sm text-neutral-400">...</div>
  ) : (
    <LoginModalButton
      session={session}
      signInWithGoogle={signInWithGoogle}
      signInWithGithub={signInWithGithub}
      signOut={signOut}
      loading={authLoading}
    />
  )}
</div>
```

**Option B: Just the LoginModalButton (no label)**

```tsx
<div className="flex items-center">
  {authLoading ? (
    <div className="text-sm text-neutral-400">...</div>
  ) : (
    <LoginModalButton
      session={session}
      signInWithGoogle={signInWithGoogle}
      signInWithGithub={signInWithGithub}
      signOut={signOut}
      loading={authLoading}
    />
  )}
</div>
```

**Think:** Which approach better matches the reference design? The reference shows a "LOG IN" text label next to a toggle element. But our `LoginModalButton` already renders its own button text ("Sign In" / "Sign Out"). Would doubling up the text feel redundant?

**Your decision here.** Pick whichever feels right — you can always adjust after seeing it in the browser. The important thing is that `LoginModalButton` receives the same 5 props it always has.

### Step 2.4: Check Your Work Visually

At this point, the NavBar component is complete but not yet wired into the app. We can't see it yet. Let's verify the code is valid:

```bash
bun run lint
bun run build
```

**Expected:** Both pass with no errors. If you get a TypeScript error about unused props, that's fine — we'll wire everything up in Phase 3.

### ✅ Phase 2 Complete

You've learned:

- How to translate a visual reference into Tailwind utility classes
- The z-index layering strategy (PortraitBlocker > NavBar > Content)
- How `border-white/10` and `text-amber-200/80` create subtle, polished UI
- That design decisions (like the auth label) are yours to make

**Next:** Phase 3 — We'll import NavBar into App.tsx and pass it the auth props.

---

## Phase 3: Wire Up Auth Props (20 min)

### Concept: Prop Threading

Right now, auth state is managed like this:

```
useAuth() hook (in App.tsx)
    │
    ├── session ──────────► LoginModalButton (inside chassis)
    ├── signInWithGoogle ──► LoginModalButton
    ├── signInWithGithub ──► LoginModalButton
    ├── signOut ───────────► LoginModalButton
    └── authLoading ───────► LoginModalButton
```

After this PR, the flow changes to:

```
useAuth() hook (in App.tsx)
    │
    ├── session ──────────► NavBar ──► LoginModalButton
    ├── signInWithGoogle ──► NavBar ──► LoginModalButton
    ├── signInWithGithub ──► NavBar ──► LoginModalButton
    ├── signOut ───────────► NavBar ──► LoginModalButton
    └── authLoading ───────► NavBar ──► LoginModalButton
```

**What changed?** NavBar is now an intermediary. It receives the auth props from App.tsx and passes them to `LoginModalButton`. This is called "prop threading" — the data passes through NavBar on its way to the component that actually uses it.

**Is that bad?** Not in this case. NavBar is a thin wrapper — it's just one extra hop. The alternative (using React Context or a global store) would be overkill for 5 props. If this were 5 levels deep, we'd reconsider. But one intermediary is perfectly fine and keeps the data flow explicit.

**Film analogy:** Think of it like a signal chain on a soundboard. The microphone signal goes through a preamp before reaching the mixer. The preamp doesn't *change* the signal — it just passes it along in the right format. NavBar is the preamp.

### Step 3.1: Import NavBar in App.tsx

Open `src/App.tsx`. Find the import section (top of the file, around lines 30-40).

Add this import alongside the other component imports:

```tsx
import { NavBar } from "./components/NavBar";
```

**Where exactly?** Put it near the other component imports. Look for lines like:

```tsx
import { LoginModalButton } from "./components/LoginModalButton";
import { PortraitBlocker } from "./components/PortraitBlocker";
```

Add the NavBar import in that same group.

### Step 3.2: Add NavBar to the JSX Return

Now find the `return` statement in App.tsx (line 1017). It currently starts like this:

```tsx
return (
  <>
    {/* PR #4: Portrait blocker for mobile devices */}
    <PortraitBlocker />

    {/* whole page container */}
    <div
      className="flex min-h-screen items-center justify-center"
      ...
```

**Add NavBar as the very first child of the fragment**, before `PortraitBlocker`:

```tsx
return (
  <>
    {/* PR #31: Top-level navigation bar with auth controls */}
    <NavBar
      session={session}
      signInWithGoogle={signInWithGoogle}
      signInWithGithub={signInWithGithub}
      signOut={signOut}
      authLoading={authLoading}
    />

    {/* PR #4: Portrait blocker for mobile devices */}
    <PortraitBlocker />

    {/* whole page container */}
    <div
      className="flex min-h-screen items-center justify-center"
      ...
```

**Why before PortraitBlocker?** DOM order doesn't determine visual stacking here — `z-index` does. PortraitBlocker is `z-50` and NavBar is `z-40`, so PortraitBlocker will cover the NavBar when active regardless of source order. We put NavBar first simply because it's the first thing you see on the page.

### Step 3.3: Add Top Padding to the Page Container

Remember the fixed positioning problem from the Background Concepts section? The NavBar is `position: fixed`, so it's removed from document flow. We need to push the page content down by the NavBar's height (64px = `h-16` = `pt-16`).

Find the "whole page container" div (line ~1023). Add `pt-16` to its `className`:

**Before:**

```tsx
<div
  className="flex min-h-screen items-center justify-center"
  style={{
    backgroundImage: `url(${pageBackground})`,
    ...
```

**After:**

```tsx
<div
  className="flex min-h-screen items-center justify-center pt-16"
  style={{
    backgroundImage: `url(${pageBackground})`,
    ...
```

That single `pt-16` accounts for the 64px NavBar height.

### Step 3.4: Verify the Wiring

At this point, the NavBar should appear at the top AND the old auth button is still in the chassis. We haven't removed it yet — that's Phase 4. This means you'll temporarily see the auth controls in *two places*. That's intentional.

```bash
bun run dev
```

Open the browser and check:

- [ ] NavBar appears at the top of the viewport
- [ ] Roland logo is visible on the left
- [ ] Navigation links appear on the right
- [ ] LoginModalButton appears in the NavBar
- [ ] The chassis content isn't hidden behind the NavBar (the `pt-16` is working)
- [ ] The old auth button is still visible inside the chassis (we haven't removed it yet)

**If the chassis is partially hidden:** The `pt-16` might not be enough, or it might be slightly too much. Adjust as needed — `pt-16` = 64px, `pt-20` = 80px. The goal is for the chassis to be fully visible below the NavBar.

### ✅ Phase 3 Complete

You've learned:

- How prop threading works (App.tsx → NavBar → LoginModalButton)
- Why one intermediary component is fine for prop passing
- How to compensate for `position: fixed` with padding
- The value of a "temporary duplication" approach (see both old + new before removing the old)

**Next:** Phase 4 — We'll surgically remove the auth controls from inside the chassis.

---

## Phase 4: Surgery on App.tsx (15 min)

### Concept: Surgical Deletion

We're about to remove code from a 1277-line file. This is like editing a film — you're cutting a scene and need to make sure the surrounding footage still flows smoothly. The key is knowing *exactly* what to cut and verifying the result immediately.

**The rule:** When removing code from a large file, always:

1. Identify the **exact boundaries** of what to remove
2. Check if anything around those boundaries needs adjustment
3. Verify the build immediately after
4. Verify visually in the browser

### Step 4.1: Remove the Auth Controls from the Chassis Header

Find the HEADER container in App.tsx (around line 1051). It currently looks like this:

```tsx
{/* HEADER container */}
<div
  className="flex items-center justify-between gap-4"
  style={{ paddingTop: "3%" }}
>
  <div className="flex items-center">{getDisplayTitle()}</div>

  {/* PR #5: Auth Controls - Only show LoginModal in header */}
  <div className="flex items-center gap-3">
    {authLoading ? (
      <div className="px-4 py-2 text-sm font-medium text-gray-200">
        Loading...
      </div>
    ) : (
      <LoginModalButton
        session={session}
        signInWithGoogle={signInWithGoogle}
        signInWithGithub={signInWithGithub}
        signOut={signOut}
        loading={authLoading}
      />
    )}
  </div>
</div>
```

**Delete everything from the `{/* PR #5: Auth Controls` comment through its closing `</div>`** — that's lines 1058-1075. The header should now only contain the beat name title:

```tsx
{/* HEADER container */}
<div
  className="flex items-center justify-between gap-4"
  style={{ paddingTop: "3%" }}
>
  <div className="flex items-center">{getDisplayTitle()}</div>
</div>
```

**Think:** The outer div still has `justify-between`. With only one child now, that doesn't do anything harmful — `justify-between` with one child just places it at the start. But you could simplify to `justify-start` if you want cleaner intent. This is a style choice, not a functional one.

### Step 4.2: Check — Can We Remove the LoginModalButton Import?

**Not yet!** Even though we removed the `<LoginModalButton>` usage from the chassis, App.tsx itself no longer uses it directly. But check: is `LoginModalButton` still imported?

Look at the imports (around line 37):

```tsx
import { LoginModalButton } from "./components/LoginModalButton";
```

**Can we delete this?** Yes — `LoginModalButton` is now only used inside `NavBar.tsx`, which has its own import. App.tsx no longer renders `LoginModalButton` directly.

**Delete the import line.** If you leave it, the linter will flag it as an unused import.

### Step 4.3: Build and Lint

```bash
bun run lint
bun run build
```

**Expected:** Both pass cleanly. If the linter complains about an unused variable related to `LoginModalButton`, you missed removing the import (Step 4.2).

### Step 4.4: Visual Verification

```bash
bun run dev
```

Open the browser and verify:

- [ ] The NavBar still shows at the top with the auth button
- [ ] The chassis header NO LONGER shows the auth button
- [ ] The beat name title still appears in the chassis header
- [ ] Clicking "Sign In" in the NavBar opens the auth modal
- [ ] Signing in/out works correctly
- [ ] The chassis has no weird spacing where the auth button used to be
- [ ] The PortraitBlocker still works (rotate your phone or use dev tools to test)

### Step 4.5: Test the Auth Flow End-to-End

This is critical — we moved the auth button but the auth *logic* didn't change. Walk through the full flow:

1. **Page load:** NavBar shows "Sign In" (or whatever your button text is). No auth button in chassis.
2. **Click Sign In:** Modal opens with Google/GitHub options.
3. **Sign in:** Session is established. NavBar reflects signed-in state.
4. **Save a beat:** Should still work (save requires `session` which is still in App.tsx state).
5. **Load a beat:** Should still work (beat list fetches when `session?.user?.id` changes).
6. **Sign out:** Click sign out in NavBar. Session clears. Save button should no longer save.

**If auth breaks:** The most likely cause is a props mismatch. Double-check that NavBar receives exactly these 5 props from App.tsx:

```tsx
<NavBar
  session={session}
  signInWithGoogle={signInWithGoogle}
  signInWithGithub={signInWithGithub}
  signOut={signOut}
  authLoading={authLoading}
/>
```

And that NavBar passes them to `LoginModalButton`:

```tsx
<LoginModalButton
  session={session}
  signInWithGoogle={signInWithGoogle}
  signInWithGithub={signInWithGithub}
  signOut={signOut}
  loading={authLoading}
/>
```

**Careful:** The prop is called `loading` on `LoginModalButton` but `authLoading` on NavBar. Make sure you map `authLoading` → `loading` when passing it through.

### ✅ Phase 4 Complete

You've learned:

- How to surgically remove code from a large component
- The importance of checking for orphaned imports after removing JSX usage
- How to verify that a "move" operation preserved all functionality
- That prop names can differ between components (`authLoading` vs `loading`)

**Next:** Phase 5 — Final cleanup and documentation.

---

## Phase 5: Verification & Cleanup (10 min)

### Step 5.1: Final Build Verification

Run the full build pipeline:

```bash
bun run lint
bun run build
```

Both should pass cleanly with zero warnings related to our changes.

### Step 5.2: Review What Changed

Let's take stock of what this PR accomplished:

**Files created:**

- `src/components/NavBar.tsx` — New NavBar component (~80-100 lines)

**Files modified:**

- `src/App.tsx` — Added NavBar to JSX, removed auth from chassis header, removed LoginModalButton import, added `pt-16` to page container

**Files added:**

- `src/assets/images/Roland_Logo_White.png` — Roland logo for the NavBar

**Lines of code:**

- Added: ~100 (NavBar component)
- Removed: ~20 (auth controls from chassis)
- Net change: ~+80 lines

### Step 5.3: The Architecture Before and After

**Before PR #31:**

```
App.tsx return JSX:
├── <PortraitBlocker />
└── Page container
    └── Chassis container (background image)
        ├── HEADER: [BeatName] ... [LoginModalButton]  ← Auth INSIDE chassis
        ├── Analyzer
        ├── Grid + Controls
        └── Transport
```

**After PR #31:**

```
App.tsx return JSX:
├── <NavBar session={...} signIn={...} signOut={...} />  ← Auth OUTSIDE chassis
├── <PortraitBlocker />
└── Page container (pt-16 for nav offset)
    └── Chassis container (background image)
        ├── HEADER: [BeatName]                            ← Auth REMOVED
        ├── Analyzer
        ├── Grid + Controls
        └── Transport
```

The chassis is now auth-free. It's purely drum machine UI. Auth lives in the application shell where it belongs.

### Step 5.4: Update FOR_ETHAN.md (Optional)

If you want to log what you learned, add a section to `docs/FOR_ETHAN.md`:

```markdown
## 16. Component Extraction: Moving UI to the Right Layer

### The Pattern: Separation of Concerns in UI

When a piece of UI doesn't belong to a component's "domain", extract it.
The Sign In button was part of the web app, not the drum machine.
Moving it to a NavBar:

- Makes the chassis reusable (it no longer assumes auth exists)
- Follows the "theater vs. film" principle (navigation = theater, sequencer = film)
- Keeps prop flow explicit (App → NavBar → LoginModalButton)

### Fixed Positioning Offset Pattern

When using `position: fixed` on a nav/header:

1. The fixed element leaves the document flow
2. Content below slides underneath
3. Fix: Add `padding-top` equal to the nav height on the content container
4. In Tailwind: `h-16` nav → `pt-16` on content
```

### ✅ Phase 5 Complete — PR #31 Finished

You've completed the NavBar extraction. Here's what you built:

1. **NavBar component** with Roland branding, nav links, and auth controls
2. **Clean separation** — auth is now a page-level concern, not a chassis concern
3. **Proper layering** — z-40 NavBar, z-50 PortraitBlocker, content flows naturally
4. **Zero functionality changes** — auth still works exactly as before

**Up next:** PR #32 will extract the entire chassis into a `SequencerChassis.tsx` component, completing the refactor that separates "the theater" from "the film."

---

## Reference

### Component Interface

```typescript
// NavBar.tsx
export interface NavBarProps {
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  authLoading: boolean;
}
```

### LoginModalButton Props (for reference)

```typescript
// LoginModalButton.tsx — what NavBar passes through
export interface LoginModalButtonProps {
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;  // Note: "loading" not "authLoading"
}
```

### Z-Index Layer Map

| z-index | Component | Purpose |
|---------|-----------|---------|
| `z-50` | PortraitBlocker | Full-screen overlay, covers everything |
| `z-40` | NavBar | Fixed top navigation |
| `z-10` | Chassis content | Normal content layer |

### Files Changed in PR #31

| File | Action | Lines |
|------|--------|-------|
| `src/components/NavBar.tsx` | Created | ~80-100 |
| `src/App.tsx` | Modified | ~+5, ~-20 |
| `src/assets/images/Roland_Logo_White.png` | Added | (binary) |

### Key Decisions

1. **NavBar is `position: fixed`** — stays visible during any scroll, requires `pt-16` offset
2. **z-40 for NavBar** — below PortraitBlocker (z-50), above content
3. **Nav links are placeholder `#` hrefs** — pages don't exist yet
4. **Prop threading through NavBar** — acceptable for 5 props, one intermediary
5. **`LoginModalButton` import removed from App.tsx** — it's only used in NavBar now

### Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| NavBar not visible | Missing from App.tsx return | Add `<NavBar .../>` before `<PortraitBlocker>` |
| Chassis hidden behind nav | Missing `pt-16` | Add `pt-16` to page container className |
| Auth modal doesn't open | Props not passed through | Check NavBar → LoginModalButton prop mapping |
| Sign in/out breaks | `loading` vs `authLoading` mismatch | NavBar receives `authLoading`, passes `loading={authLoading}` to LoginModalButton |
| Logo not showing | Wrong file path | Verify `src/assets/images/Roland_Logo_White.png` exists |
| PortraitBlocker doesn't cover NavBar | z-index conflict | NavBar should be `z-40`, PortraitBlocker `z-50` |
| Build fails on image import | File not in `src/assets/` | Copy logo to `src/assets/images/` (not `public/`) |
