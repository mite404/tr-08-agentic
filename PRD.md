# PRD: TR-08 v1.0 - "The Graffiti Wall"

**Status:** Approved
**Version:** 2.2 (Refined Audio Logic)
**Date:** 2025-11-18
**Execution Plan:** [See IMPLEMENTATION.md](./IMPLEMENTATION.md)

---

## 1. Executive Summary

**Objective:** Transform the TR-08 from a local instrument into a persistent, social music platform.
**Core Concept:** "The Graffiti Wall." The application state is global. Visitors immediately experience the last beat contributed to the platform.
**Success Metric:** A seamless "Remix Loop" where users can load the public beat, modify it, and publish a new version without friction or audio glitches.

---

## 2. System Architecture & Design Patterns

### 2.1 The "Two Clocks" Architecture

The application bridges two incompatible timing systems:

1.  **The Audio Clock (Tone.js):** The Master. Uses Sample-rate precision. Audio instances live in `useRef` (detached from React render).
2.  **The Visual Clock (React):** The Follower. Uses `useState` to represent the "Sheet Music."

### 2.2 Data Strategy: Semantic Schema-on-Read

We reject array-based storage (fragile) in favor of **Semantic Keying** (robust).

- **Storage:** Beats are stored as immutable JSONB blobs using strict ID keys (e.g., `"kick_1"`, not `index[0]`).
- **Retrieval:** The "Zod Gatekeeper" validates incoming data. A Transformer layer maps these Semantic Keys to the UI's visual array order at runtime.

---

## 3. User Flows

### 3.1 The "Guest" Experience (Read-Only)

1.  **Initialization:** App enters **Skeleton State** (UI dimmed). Fetches `ORDER BY created_at DESC LIMIT 1`.
2.  **Hydration:**
    - Data passes Zod Validation.
    - Transformer maps `tracks.kick_1` -> `Grid Row 0`.
    - Audio Samples pre-load.
3.  **Playback:**
    - Guest clicks "START".
    - App forces `Tone.context.resume()` before Transport starts.

### 3.2 The "Creator" Experience (Write Access)

1.  **Authentication:** OAuth (Google/GitHub). Postgres Trigger (`on_auth_user_created`) creates the Profile row.
2.  **Publishing:**
    - User clicks "SAVE".
    - **Serialization:** App converts UI Array State -> Semantic JSON Manifest.
    - **Insert:** New record created in `beats` table.

---

## 4. Technical Specifications

### 4.1 Database Schema (Supabase)

**1. `profiles` Table** (Managed via Trigger)

- `id`: UUID (PK), `username`: Text, `avatar_url`: Text

**2. `beats` Table**

- `id`: UUID (PK)
- `user_id`: UUID (FK)
- `name`: Text (Sanitized)
- `bpm`: Integer (40-300)
- `data`: JSONB (The Manifest)
- `created_at`: Timestamp

### 4.2 The Data Manifest (Semantic JSON Structure)

We do not rely on array indices. We identify tracks by their function.

```typescript
// The "Source of Truth" stored in DB
interface BeatManifest {
  meta: {
    version: string; // e.g. "1.0.0"
    engine: "TR-08";
  };
  global: {
    bpm: number;
    swing: number; // 0.0 - 1.0
    masterVolumeDb: number;
  };
  // Dictionary Pattern: Order independent
  tracks: Record<TrackID, TrackData>;
}

// Fixed Semantic Keys (The "DNA" of the drum machine)
type TrackID =
  | "bd_1"
  | "bd_2" // Bass Drums
  | "sd_1"
  | "sd_2" // Snares/Claps
  | "lt_1"
  | "mt_1" // Toms/Congas/Bass Synths
  | "ch_1"
  | "oh_1" // Hi-Hats
  | "cy_1"
  | "cb_1"; // Cymbal/Cowbell

interface TrackData {
  sampleId: string; // "KICK_01" (Allows future sample swapping)
  volumeDb: number; // -5.0
  mute: boolean;
  solo: boolean;
  steps: boolean[]; // The 16-step pattern
}
```

### 4.3 Audio Engine Integration

- **Track Registry:** The app maintains a configuration file (`trackConfig.ts`) that maps these `TrackID`s to specific `Tone.Player` instances and specific Rows in the UI Grid.
- **Volume Logic:** `Knob Angle` (UI) <-> `dB` (Logic). The DB only stores `dB`.

---

## 5. Quality Assurance Standards

### 5.1 Reliability

- **Zod Validation:** All IO must pass `BeatManifestSchema.safeParse()`.
  - _Sad Path:_ If validation fails, load default "Blank Beat" and log error. Do not crash.
- **Audio State:** No silent playback. Ensure AudioContext is `running` on first user gesture.

### 5.2 Performance

- **Asset Strategy:**
  - Current: Bundled ES Modules (WAV).
  - Requirement: Monitor load times. If >2s, implement "Lazy Audio Loading" (Load UI first, hydrate audio second).

---

## 6. Interaction Rules & Compliance (The "Blind Spots")

### 6.1 Audio Signal Logic (The Hierarchy)

The Audio Engine must calculate effective volume for every track on every frame using this strict precedence:

1.  **Mute Priority:** If a track's `Mute` is **ON**, the track is **SILENT** (Volume = -Infinity), regardless of any other setting.
2.  **Solo Isolation:**
    - First, check: Is there _at least one_ track in the system with `Solo` **ON**?
    - **If YES (Solo Mode Active):**
      - If current track `Solo` is **ON**: Play (at Knob Volume).
      - If current track `Solo` is **OFF**: **SILENT**.
    - **If NO (Normal Mode):**
      - Play all tracks (at Knob Volume).

_Summary:_ Mute defeats Solo. Solo defeats Normal Playback.

### 6.2 Browser Lifecycle Management

- **Background Throttling:** When `document.hidden` is true, the React Visual Loop must suspend updates to prevent CPU spikes upon re-entry.
- **Resync:** On `visibilitychange` (hidden -> visible), the UI must poll `Tone.Transport.position` to realign the visual playhead immediately.

### 6.3 Content Moderation

- **Sanitization:** All user-submitted strings (`beatName`) must pass a profanity filter check on the client-side before submission.
- **Rejection:** If a string is flagged, the UI blocks the "Save" action and prompts the user to choose a cleaner name.

### 6.4 Mobile Responsiveness

- **Constraint:** The 16-step grid requires horizontal width.
- **Enforcement:** Devices with `orientation: portrait` and `width < 768px` will see a full-screen overlay: "Please Rotate Your Device to Play."
