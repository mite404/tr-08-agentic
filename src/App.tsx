import { useEffect, useRef, useState, type JSX } from "react";
import * as Tone from "tone";
import "./App.css";
import { Analyzer } from "./components/Analyzer";
import { PlayStopBtn } from "./components/PlayStopBtn";
import { TempoDisplay } from "./components/TempoDisplay";
import { TrackControls } from "./components/TrackControls";
import { Knob } from "./components/Knob"; // PR #14: Global Swing Knob
import { createSequencer } from "./sequencer";

import chassisBackground from "./assets/images/CHASSIS 07_TEST_1.png";
import pageBackground from "./assets/images/BACKGROUND_01.jpeg";
import transportOutline from "./assets/images/TRANSPORT_OUTLINE.png";
import stepNoteCountStrip from "./assets/images/STEP_NOTE_COUNT_STRIP.png";

// PR #2: Import new audio engine and track registry
import { TRACK_REGISTRY } from "./config/trackConfig";
import {
  loadAudioSamples,
  playTrack,
  resumeAudioContext,
  setMasterDrive,
  setMasterSwing,
  setMasterOutputVolume, // PR #29: Master output volume control
} from "./lib/audioEngine";
import { calculateEffectiveVolume } from "./lib/beatUtils";
import type { BeatManifest, TrackID } from "./types/beat";
import { getDefaultBeatManifest } from "./types/beat";

// PR #3: Import authentication and persistence hooks
import { useAuth } from "./hooks/useAuth";
import { useLoadBeat, type BeatSummary } from "./hooks/useLoadBeat";
import { useSaveBeat } from "./hooks/useSaveBeat";

// PR #4: Import UI components for loading states and auth
import { BeatLibrary } from "./components/BeatLibrary"; // PR #12: Beat Library Panel
import { LoginModalButton } from "./components/LoginModalButton";
import { PortraitBlocker } from "./components/PortraitBlocker";
import { SaveButton } from "./components/SaveButton";
import { SkeletonGrid } from "./components/SkeletonGrid";

// PR #5: Import error boundary for crash protection
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Chiclet } from "./components/Chiclet";

export type TrackObject = {
  name: string;
  sound: string;
  color: string;
  player?: Tone.Player; // LEGACY: kept for compatibility, will be removed in later PR
};

const initialGrid = [
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 0
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 1
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 2
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 3
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 4
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 5
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 6
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 7
  [
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  ], // track 8
  [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ], // track 9
];

// PR #2: Use TRACK_REGISTRY as source of truth, build legacy tracks array for UI compatibility
const tracks: Array<TrackObject> = TRACK_REGISTRY.map((config) => ({
  name: config.label,
  sound: "", // LEGACY: no longer used, samples loaded via audioEngine
  color: config.color,
}));

function App() {
  const [bpm, setBpm] = useState(140);
  const [grid, setGrid] = useState(initialGrid);
  const [currentStep, setCurrentStep] = useState(0);
  const [swing, setSwing] = useState<number>(0); // PR #14: Global swing (0-100%)
  const [drive, setDrive] = useState<number>(0); // PR #14: Master drive/distortion (0-100%)
  const [masterVolume, setMasterVolume] = useState<number>(0); // PR #29: Master output volume (-60 to +6 dB)
  const [loadedCount, setLoadedCount] = useState(0);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [beatName, setBeatName] = useState("TR-08");
  const [isEditTitleActive, setIsEditTitleActive] = useState(false);
  const [trackVolumes, setTrackVolumes] = useState<Array<number>>(
    Array(10).fill(-5),
  );
  // PR #9: Track pitch values for pitch knobs
  const [trackPitches, setTrackPitches] = useState<Array<number>>(
    Array(10).fill(0),
  );
  const [trackAccents, setTrackAccents] = useState<Array<Array<boolean>>>(
    Array(10)
      .fill(null)
      .map(() => Array(16).fill(false) as Array<boolean>),
  );
  // PR #6: Track failed audio samples for visual feedback
  const [failedTrackIds, setFailedTrackIds] = useState<Array<TrackID>>([]);
  // PR #11: Track mute and solo states per track
  const [trackMutes, setTrackMutes] = useState<Array<boolean>>(
    Array(10).fill(false),
  );
  const [trackSolos, setTrackSolos] = useState<Array<boolean>>(
    Array(10).fill(false),
  );

  // Master clock (audio)
  const createSequencerRef = useRef<ReturnType<typeof createSequencer>>(null);
  const gridRef = useRef(grid);
  const playersInitializedRef = useRef(false);

  // PR #5: Browser lifecycle management - prevent updates when backgrounded
  const isPageHiddenRef = useRef(false);

  // PR #3: Authentication and persistence hooks
  const {
    session,
    loading: authLoading,
    signInWithGoogle,
    signInWithGithub,
    signOut,
  } = useAuth();
  const { saveBeat, isSaving, error: saveError } = useSaveBeat(session);
  const {
    loadLatestBeat,
    loadBeatById, // PR #12: Load beat by ID for library
    loadBeatList, // PR #12: Load beat list for library
  } = useLoadBeat();

  // PR #4: Track initial data loading state
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);

  // PR #12: Beat library state
  const [beats, setBeats] = useState<BeatSummary[]>([]);

  // PR #2: New audio engine state
  const playersMapRef = useRef<Map<TrackID, Tone.Player>>(new Map());
  const manifestRef = useRef<BeatManifest>(getDefaultBeatManifest());
  const trackIdsByRowRef = useRef<TrackID[]>(
    [...TRACK_REGISTRY]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map((c) => c.trackId),
  );

  // PR #4: Auto-load the latest beat on mount if logged in
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsInitialDataLoaded(false);
        const loadedBeat = await loadLatestBeat();
        if (loadedBeat) {
          setGrid(loadedBeat.grid);
          setBpm(loadedBeat.bpm);
          setBeatName(loadedBeat.beatName);

          // BUG FIX: Sync Tone.Transport BPM immediately (not just React state)
          Tone.Transport.bpm.value = loadedBeat.bpm;
          if (createSequencerRef.current) {
            createSequencerRef.current.updateBpm(loadedBeat.bpm);
          }

          // PR #19: Sync global settings (Swing and Drive) to React state and audio engine
          setSwing(loadedBeat.swing ?? 0); // Updates knob UI
          setDrive(loadedBeat.drive ?? 0);
          setMasterSwing(loadedBeat.swing ?? 0); // Audio Engine control
          setMasterDrive(loadedBeat.drive ?? 0);

          // PR #9: Load pitch values into UI state
          const pitchArray = trackIdsByRowRef.current.map(
            (trackId) => loadedBeat.trackPitches[trackId] ?? 0,
          );
          setTrackPitches(pitchArray);

          // PR #11: Load mute and solo states into UI state
          const muteArray = trackIdsByRowRef.current.map(
            (trackId) => loadedBeat.trackMutes[trackId] ?? false,
          );
          setTrackMutes(muteArray);

          const soloArray = trackIdsByRowRef.current.map(
            (trackId) => loadedBeat.trackSolos[trackId] ?? false,
          );
          setTrackSolos(soloArray);

          // PR #11: Load volume values into UI state
          const volumeArray = trackIdsByRowRef.current.map(
            (trackId) => loadedBeat.trackVolumes[trackId] ?? 0,
          );
          setTrackVolumes(volumeArray);

          // PR
          const trackAccentsArray = trackIdsByRowRef.current.map(
            (trackId) => loadedBeat.trackAccents[trackId] ?? false,
          );
          setTrackAccents(trackAccentsArray);

          // PR #11: Update manifest with loaded states so sequencer has fresh data
          trackIdsByRowRef.current.forEach((trackId, index) => {
            if (manifestRef.current.tracks[trackId]) {
              manifestRef.current.tracks[trackId].pitch = pitchArray[index];
              manifestRef.current.tracks[trackId].mute = muteArray[index];
              manifestRef.current.tracks[trackId].solo = soloArray[index];
              manifestRef.current.tracks[trackId].volumeDb = volumeArray[index];
            }
          });

          console.log(
            `[App] Auto-loaded beat: "${loadedBeat.beatName}" at ${loadedBeat.bpm} BPM`,
          );
        } else {
          console.log("[App] No beats found, using default grid");
        }
      } catch (err) {
        console.error("[App] Auto-load failed:", err);
      } finally {
        setIsInitialDataLoaded(true);
      }
    };

    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // giving callback in createSequencer fresh state of grid
  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  // PR #12: Fetch beat list when session becomes available
  // This is separate from loadInitialData because auth check completes after mount
  useEffect(() => {
    if (session?.user) {
      const fetchBeats = async () => {
        const beatList = await loadBeatList(session.user.id);
        setBeats(beatList);
        console.log(
          `[App] Fetched ${beatList.length} beats for user ${session.user.id}`,
        );
      };
      void fetchBeats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loadBeatList]);

  // PR #5: Browser lifecycle management - handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageHiddenRef.current = document.hidden;
      console.log(`[App] Page visibility changed: hidden=${document.hidden}`);

      // When page becomes visible again, sync the playhead to current transport position
      if (!document.hidden && createSequencerRef.current) {
        const position = Tone.Transport.position;
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string
        console.log(`[App] Page visible, syncing playhead to ${position}`);
        // The sequencer's onStep callback will update the UI on the next step
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // PR #6: Show one-time warning when tracks fail to load
  useEffect(() => {
    if (failedTrackIds.length > 0) {
      console.warn(`[App] Failed tracks detected:`, failedTrackIds);
      window.alert(
        `⚠️ Warning: Audio assets for ${failedTrackIds.length} track(s) failed to load.\n\nFailed tracks: ${failedTrackIds.join(", ")}\n\nThese tracks will be disabled (grayed out).`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedTrackIds.length]); // Only run when the count changes

  // PR #2: Init sequencer with new audio engine architecture
  useEffect(() => {
    const sequencer = createSequencer(
      bpm,
      (step: number) => {
        setCurrentStep(step);
      },
      gridRef,
      playersMapRef.current,
      manifestRef,
      trackIdsByRowRef.current,
      isPageHiddenRef, // PR #5: Pass ref to prevent updates when backgrounded
    );
    createSequencerRef.current = sequencer;

    return () => {
      sequencer.dispose();
      createSequencerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // check if all players have loaded their samples
  useEffect(() => {
    if (loadedCount === 10) {
      setAllPlayersReady(true);
      console.log("loadedCount:", loadedCount);
    }
  }, [loadedCount]);

  // PR #2: Replaced with new audio engine loadAudioSamples
  async function initPlayers() {
    setIsLoading(true);
    setAllPlayersReady(false);
    setLoadedCount(0);

    try {
      // Resume audio context (required for autoplay policy)
      const contextResumed = await resumeAudioContext();
      if (!contextResumed) {
        console.error("[Audio Context] Failed to resume");
      }

      // Load samples using the new audio engine
      // PR #6 (Bulletproof): loadAudioSamples ALWAYS returns a valid result, never throws
      const { players: playersMap, failedTrackIds: failed } =
        await loadAudioSamples(manifestRef.current, (loaded, total) => {
          setLoadedCount(loaded);
          console.log(`Loading samples: ${loaded}/${total}`);
        });

      // IMPORTANT: Clear and populate the existing Map instead of replacing it
      // The sequencer holds a reference to playersMapRef.current
      playersMapRef.current.clear();
      playersMap.forEach((player, trackId) => {
        playersMapRef.current.set(trackId, player);
        console.log(`[Audio Engine] Loaded player for ${trackId}`);
      });

      // PR #6: Store failed track IDs for UI feedback (useEffect will show alert)
      setFailedTrackIds(failed);

      // PR #6 (Bulletproof): Partial success is OK - allow playback with working tracks
      const hasAnyPlayers = playersMapRef.current.size > 0;
      setAllPlayersReady(hasAnyPlayers);

      console.log(
        `[Audio Engine] Loaded ${playersMapRef.current.size} players, ${failed.length} failed`,
      );
      console.log(
        `[Audio Engine] Player map keys:`,
        Array.from(playersMapRef.current.keys()),
      );
    } catch (err) {
      // PR #6 (Bulletproof): This should never happen since loadAudioSamples never throws
      // But guarantee loading state is cleared if something unexpected occurs
      console.error(
        "[Audio Engine] Unexpected error during initialization:",
        err,
      );
      alert("⚠️ Audio initialization failed. Please reload the page.");
    } finally {
      // PR #6 (Bulletproof): GUARANTEED to clear loading state, even on unexpected errors
      setIsLoading(false);
    }
  }

  // PR #8: Console Harness for manual testing of pitch and accent
  useEffect(() => {
    // Expose debug API to window for manual testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (window as any).tr08 = {
      play: async (
        trackId: TrackID,
        pitch: number = 0,
        accent: boolean = false,
      ) => {
        // Ensure audio context is running
        await resumeAudioContext();

        // Get player from map
        const player = playersMapRef.current.get(trackId);
        if (!player) {
          console.error(`[Console Harness] Player not found for ${trackId}`);
          return;
        }

        // Calculate volume with accent
        const effectiveVolume = calculateEffectiveVolume(
          manifestRef.current,
          trackId,
          accent,
        );

        // Play immediately
        playTrack(player, effectiveVolume, Tone.now(), pitch);
        console.log(
          `[Console Harness] Playing ${trackId} | pitch: ${pitch} semitones | accent: ${accent} | volume: ${effectiveVolume}dB`,
        );
      },

      // Helper to list available tracks
      tracks: () => {
        console.log(
          "Available tracks:",
          Array.from(playersMapRef.current.keys()),
        );
      },

      // Helper to show current manifest
      manifest: () => {
        console.log("Current manifest:", manifestRef.current);
      },
    };

    console.log("🎹 TR-08 Console Harness Ready!");
    console.log("Try: window.tr08.play('kick_01', 0, false)");
    console.log("     window.tr08.play('kick_01', 12, false)  // +1 octave");
    console.log("     window.tr08.play('kick_01', -12, false) // -1 octave");
    console.log("     window.tr08.play('kick_01', 0, true)    // ghost note");
    console.log(
      "     window.tr08.tracks()                    // list all tracks",
    );
  }, []);

  // PR #10: 3-State Pad Interaction (OFF → ON Normal → ON Ghost → OFF)
  function handlePadClick(rowIndex: number, colIndex: number) {
    const trackId = trackIdsByRowRef.current[rowIndex];
    if (!trackId || !manifestRef.current.tracks[trackId]) {
      return;
    }

    const trackData = manifestRef.current.tracks[trackId];
    const isActive = grid[rowIndex][colIndex];
    const isAccented = trackData.accents[colIndex];

    // Determine current state and cycle to next
    if (!isActive) {
      // State 1: OFF → Turn ON (Normal Volume)
      const newGrid = structuredClone(grid);
      newGrid[rowIndex][colIndex] = true;
      trackData.steps[colIndex] = true;
      trackData.accents[colIndex] = false;

      // Update React state for the pad cell's Ghost note
      setTrackAccents((prev) => {
        const updated = structuredClone(prev);
        updated[rowIndex][colIndex] = false;
        return updated;
      });

      setGrid(newGrid);
      console.log(`[3-State] ${trackId} step ${colIndex}: OFF → ON (Normal)`);
    } else if (isActive && !isAccented) {
      // State 2: ON (Normal) → ON (Ghost)
      trackData.steps[colIndex] = true;
      trackData.accents[colIndex] = true; // Updates BeatManifest.tracks[trackId].accents[colIndex]

      setTrackAccents((prev) => {
        const updated = structuredClone(prev);
        updated[rowIndex][colIndex] = true;
        return updated;
      });

      console.log(
        `[3-State] ${trackId} step ${colIndex}: ON (Normal) → ON (Ghost)`,
      );
    } else {
      // State 3: ON (Ghost) → OFF
      const newGrid = structuredClone(grid);
      newGrid[rowIndex][colIndex] = false;
      trackData.steps[colIndex] = false;
      trackData.accents[colIndex] = false;

      setTrackAccents((prev) => {
        const updated = structuredClone(prev);
        updated[rowIndex][colIndex] = false;
        return updated;
      });

      setGrid(newGrid);
      console.log(`[3-State] ${trackId} step ${colIndex}: ON (Ghost) → OFF`);
    }
  }

  // PR #2: Updated to use async audio engine
  async function handleStartStopClick() {
    if (createSequencerRef.current === null) return;

    const isPlaying = Tone.getTransport().state === "started";

    if (isPlaying) {
      createSequencerRef.current.stop();
    } else {
      if (!playersInitializedRef.current) {
        await initPlayers();
        playersInitializedRef.current = true;
        // Auto-start after loading
        if (createSequencerRef.current && allPlayersReady) {
          createSequencerRef.current.start();
        }
        return;
      }
      if (allPlayersReady) {
        // Resume audio context before starting (CRITICAL for audio playback)
        const resumed = await resumeAudioContext();
        console.log(`[App] Audio context resumed: ${resumed}`);
        if (!resumed) {
          console.error(
            "[App] Failed to resume audio context - audio may not play",
          );
        }
        createSequencerRef.current.start();
        console.log("[App] Sequencer started");
      } else {
        setIsLoading(true);
      }
    }
  }

  function handleIncrementBpm() {
    const newBpm = bpm + 1;
    setBpm(newBpm);

    if (createSequencerRef.current) {
      createSequencerRef.current.updateBpm(newBpm);
    }
  }

  function handleDecrementBpm() {
    const newBpm = bpm - 1;
    setBpm(newBpm);

    if (createSequencerRef.current) {
      createSequencerRef.current.updateBpm(newBpm);
    }
  }

  // PR #3: Save beat handler
  async function handleSaveBeat() {
    if (!session) {
      alert("Please sign in to save beats");
      return;
    }

    try {
      // Convert arrays to Record format for saveBeat
      const trackMutesRecord: Record<TrackID, boolean> = {} as Record<
        TrackID,
        boolean
      >;
      const trackSolosRecord: Record<TrackID, boolean> = {} as Record<
        TrackID,
        boolean
      >;
      const trackPitchesRecord: Record<TrackID, number> = {} as Record<
        TrackID,
        number
      >;
      const trackVolumesRecord: Record<TrackID, number> = {} as Record<
        TrackID,
        number
      >;
      const trackAccentsRecord: Record<TrackID, Array<boolean>> = {} as Record<
        TrackID,
        Array<boolean>
      >;

      trackIdsByRowRef.current.forEach((trackId, index) => {
        trackMutesRecord[trackId] = trackMutes[index];
        trackSolosRecord[trackId] = trackSolos[index];
        trackPitchesRecord[trackId] = trackPitches[index];
        trackVolumesRecord[trackId] = trackVolumes[index];
        trackAccentsRecord[trackId] = trackAccents[index];
      });

      await saveBeat({
        grid,
        bpm,
        beatName,
        trackPitches: trackPitchesRecord,
        trackMutes: trackMutesRecord,
        trackSolos: trackSolosRecord,
        trackVolumes: trackVolumesRecord,
        trackAccents: trackAccentsRecord,
        swing, // PR #19: Save current swing/shuffle value
        drive, // PR #19: Save current drive/saturation value
      });

      // PR #12: Refresh beat list after successful save
      if (session?.user) {
        const beatList = await loadBeatList(session.user.id);
        setBeats(beatList);
      }

      alert(`Beat "${beatName}" saved successfully!`);
    } catch (err) {
      console.error("[App] Save failed:", err);
      alert(`Failed to save beat: ${saveError || "Unknown error"}`);
    }
  }

  // PR #12: Load beat by ID (for Beat Library sidebar)
  async function handleLoadBeatById(beatId: string) {
    try {
      const loadedBeat = await loadBeatById(beatId);
      if (loadedBeat) {
        setGrid(loadedBeat.grid);
        setBpm(loadedBeat.bpm);
        setBeatName(loadedBeat.beatName);

        // BUG FIX: Sync Tone.Transport BPM immediately (not just React state)
        Tone.Transport.bpm.value = loadedBeat.bpm;
        if (createSequencerRef.current) {
          createSequencerRef.current.updateBpm(loadedBeat.bpm);
        }

        // PR #19: Sync global settings (Swing and Drive) to React state and audio engine
        setSwing(loadedBeat.swing ?? 0);
        setDrive(loadedBeat.drive ?? 0);
        setMasterSwing(loadedBeat.swing ?? 0);
        setMasterDrive(loadedBeat.drive ?? 0);

        // Load pitch values
        const pitchArray = trackIdsByRowRef.current.map(
          (trackId) => loadedBeat.trackPitches[trackId] ?? 0,
        );
        setTrackPitches(pitchArray);

        // Load mute and solo states
        const muteArray = trackIdsByRowRef.current.map(
          (trackId) => loadedBeat.trackMutes[trackId] ?? false,
        );
        setTrackMutes(muteArray);

        const soloArray = trackIdsByRowRef.current.map(
          (trackId) => loadedBeat.trackSolos[trackId] ?? false,
        );
        setTrackSolos(soloArray);

        // Load volume values
        const volumeArray = trackIdsByRowRef.current.map(
          (trackId) => loadedBeat.trackVolumes[trackId] ?? 0,
        );
        setTrackVolumes(volumeArray);

        // Update manifest with loaded states
        trackIdsByRowRef.current.forEach((trackId, index) => {
          if (manifestRef.current.tracks[trackId]) {
            manifestRef.current.tracks[trackId].pitch = pitchArray[index];
            manifestRef.current.tracks[trackId].mute = muteArray[index];
            manifestRef.current.tracks[trackId].solo = soloArray[index];
            manifestRef.current.tracks[trackId].volumeDb = volumeArray[index];
          }
        });

        console.log(
          `[App] Loaded beat from library: "${loadedBeat.beatName}" at ${loadedBeat.bpm} BPM`,
        );
      }
    } catch (err) {
      console.error("[App] Load from library failed:", err);
      alert(`Failed to load beat: Unknown error`);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      const userInput = event.currentTarget.value;

      if (userInput.trim() === "") {
        return;
      }
      setBeatName(userInput);
      setIsEditTitleActive(false);
      console.log(event);
    } else if (event.key === "Escape") {
      setIsEditTitleActive(false);
    }
  }

  function handleTitleClick() {
    console.log("handle title click run");
    setIsEditTitleActive(true);
  }

  function getDisplayTitle(): JSX.Element {
    if (isEditTitleActive) {
      return (
        <input
          className="text-4xl"
          maxLength={25}
          onKeyDown={handleKeyDown}
          placeholder="Enter name..."
        ></input>
      );
    } else {
      return (
        <h1
          onClick={handleTitleClick}
          className="stack-sans-notch-display1 cursor-pointer text-7xl font-extralight"
        >
          {beatName}
        </h1>
      );
    }
  }

  // PR #2: Updated to modify manifest instead of individual players
  function handleDbChange(trackIndex: number, newDbValue: number) {
    console.log(`Volume for track ${trackIndex} updated to:`, newDbValue);
    setTrackVolumes((prev) => {
      const updated = [...prev];
      updated[trackIndex] = newDbValue;
      return updated;
    });

    // Update manifest with new volume
    const trackId = trackIdsByRowRef.current[trackIndex];
    if (trackId && manifestRef.current.tracks[trackId]) {
      manifestRef.current.tracks[trackId].volumeDb = newDbValue;
      console.log(`[Manifest] Updated ${trackId} volume to ${newDbValue}dB`);
    }
  }

  // PR #9: Handle pitch changes from pitch knobs
  function handlePitchChange(trackIndex: number, newPitchValue: number) {
    console.log(`Pitch for track ${trackIndex} updated to:`, newPitchValue);
    setTrackPitches((prev) => {
      const updated = [...prev];
      updated[trackIndex] = newPitchValue;
      return updated;
    });

    // Update manifest with new pitch
    const trackId = trackIdsByRowRef.current[trackIndex];
    if (trackId && manifestRef.current.tracks[trackId]) {
      manifestRef.current.tracks[trackId].pitch = newPitchValue;
      console.log(
        `[Manifest] Updated ${trackId} pitch to ${newPitchValue} semitones`,
      );
    }
  }

  // PR #11: Handle mute toggle for a track
  function handleMuteToggle(trackId: TrackID) {
    const trackIndex = trackIdsByRowRef.current.indexOf(trackId);
    if (trackIndex === -1) return;

    setTrackMutes((prev) => {
      const updated = [...prev];
      updated[trackIndex] = !updated[trackIndex];
      return updated;
    });

    // Update manifest with new mute state
    if (manifestRef.current.tracks[trackId]) {
      manifestRef.current.tracks[trackId].mute =
        !manifestRef.current.tracks[trackId].mute;
      console.log(
        `[Manifest] Updated ${trackId} mute to ${manifestRef.current.tracks[trackId].mute}`,
      );
    }
  }

  // PR #11: Handle solo toggle for a track
  function handleSoloToggle(trackId: TrackID) {
    const trackIndex = trackIdsByRowRef.current.indexOf(trackId);
    if (trackIndex === -1) return;

    setTrackSolos((prev) => {
      const updated = [...prev];
      updated[trackIndex] = !updated[trackIndex];
      return updated;
    });

    // Update manifest with new solo state
    if (manifestRef.current.tracks[trackId]) {
      manifestRef.current.tracks[trackId].solo =
        !manifestRef.current.tracks[trackId].solo;
      console.log(
        `[Manifest] Updated ${trackId} solo to ${manifestRef.current.tracks[trackId].solo}`,
      );
    }
  }

  // PR #14: Global swing control
  function handleSwingChange(newSwingPercent: number) {
    setSwing(newSwingPercent);
    setMasterSwing(newSwingPercent);

    // Update manifest for persistence
    if (manifestRef.current) {
      manifestRef.current.global.swing = newSwingPercent / 100;
    }

    console.log(`[App] Swing updated to ${newSwingPercent}%`);
  }

  // PR #14: Master drive control
  function handleDriveChange(newDrivePercent: number) {
    setDrive(newDrivePercent);
    setMasterDrive(newDrivePercent);

    console.log(`[App] Drive updated to ${newDrivePercent}%`);
  }

  // PR #29: Master output volume control
  function handleMasterVolumeChange(newVolumeDb: number) {
    setMasterVolume(newVolumeDb);
    setMasterOutputVolume(newVolumeDb);

    console.log(
      `[App] Master output volume updated to ${newVolumeDb.toFixed(1)} dB`,
    );
  }

  // PR #15: Clear track (steps and accents)
  function handleClearTrack(trackId: TrackID) {
    // Clear steps for this track
    setGrid((prev) => {
      const updated = prev.map((row, rowIndex) => {
        if (trackIdsByRowRef.current[rowIndex] === trackId) {
          return row.map(() => false); // Clear all steps
        }
        return row;
      });
      return updated;
    });

    // Clear steps and accents in manifest
    if (manifestRef.current.tracks[trackId]) {
      manifestRef.current.tracks[trackId].steps = manifestRef.current.tracks[
        trackId
      ].steps.map(() => false);
      if (manifestRef.current.tracks[trackId].accents) {
        manifestRef.current.tracks[trackId].accents =
          manifestRef.current.tracks[trackId].accents.map(() => false);
      }
      console.log(`[Manifest] Cleared track ${trackId} (steps and accents)`);
    }
  }

  function getChicletVariant(stepIndex: number) {
    if (stepIndex < 4) return "red";
    if (stepIndex < 8) return "orange";
    if (stepIndex < 12) return "yellow";
    return "cream";
  }

  return (
    <>
      {/* PR #4: Portrait blocker for mobile devices */}
      <PortraitBlocker />

      {/* whole page container */}
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          backgroundImage: `url(${pageBackground})`,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* device container */}
        {/* Background image is 3050x2550 (aspect ratio ~1.196:1) */}
        {/* Container scales to fit viewport while maintaining aspect ratio */}
        <div
          className="flex flex-col rounded-xl"
          style={{
            backgroundImage: `url(${chassisBackground})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            aspectRatio: "3050 / 2550",
            maxWidth: "min(100vw, calc(95vh * 3050 / 2550))",
            maxHeight: "min(100vh, calc(100vw * 2550 / 3050))",
            width: "auto",
            height: "auto",
            padding: "3% 3% 3% 3%",
          }}
        >
          {/* HEADER container */}
          <div
            className="flex items-center justify-between gap-4"
            style={{ paddingTop: "3%" }}
          >
            <div className="flex items-center">{getDisplayTitle()}</div>

            {/* PR #5: Auth Controls - Only show LoginModal in header */}
            <div className="flex items-center gap-3">
              {authLoading ? (
                // Loading: Show visible text while checking auth state
                <div className="px-4 py-2 text-sm font-medium text-gray-200">
                  Loading...
                </div>
              ) : (
                // Show LoginModal button (Sign In or Sign Out)
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
          {/* TOP ROW: Beat name is in header, Analyzer in LCD bezel area (top-right) */}
          <div className="flex justify-end">
            {/* Analyzer - placeholder for LCD screen bezel (top-right) */}
            <Analyzer />
          </div>

          {/* PR #30: Main content - 2 column layout (global knobs | knobs+grid) */}
          <div className="relative z-10 flex w-full flex-col gap-2">
            {/* MAIN AREA: LEFT global knobs + RIGHT per-row knobs & grid */}
            <div className="w-full origin-top-left" style={{ zoom: 0.8 }}>
              <div className="flex w-full flex-row gap-4">
                {/* LEFT COLUMN: Global Knobs (OUTPUT, DRIVE, SWING) */}
                <div className="flex flex-none flex-col items-center justify-start gap-4">
                  <Knob
                    variant="swing"
                    min={-60}
                    max={6}
                    value={masterVolume}
                    onChange={handleMasterVolumeChange}
                    label="Output Volume"
                  />
                  <Knob
                    variant="swing"
                    min={0}
                    max={100}
                    value={drive}
                    onChange={handleDriveChange}
                    label="Drive / Saturation"
                  />
                  <Knob
                    variant="swing"
                    min={0}
                    max={100}
                    value={swing}
                    onChange={handleSwingChange}
                    label="Swing / Shuffle"
                  />
                </div>

                {/* RIGHT AREA: Per-row knobs + Chiclet Grid */}
                <div className="flex flex-1 flex-col gap-1">
                  {/* Header row with TONE and LEVEL labels (aligned with TrackControls) */}
                  <div
                    className="flex h-[50px] items-center"
                    style={{ gap: "12px" }}
                  >
                    {/* Space for track label */}
                    <div className="w-16" />

                    {/* TONE label */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="eurostile text-xs font-normal text-white">
                        TONE
                      </div>
                    </div>

                    {/* LEVEL label */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="eurostile text-xs font-normal text-white">
                        LEVEL
                      </div>
                    </div>

                    {/* Space for M/S/CLR buttons */}
                    <div className="flex gap-1">
                      <div className="w-[30px]" />
                      <div className="w-[30px]" />
                      <div className="w-[30px]" />
                    </div>
                  </div>

                  {/* PR #5: Wrap grid in ErrorBoundary for crash protection */}
                  <ErrorBoundary>
                    {/* PR #4: Show skeleton while loading initial data */}
                    {!isInitialDataLoaded ? (
                      <div className="p-0.5">
                        <SkeletonGrid />
                      </div>
                    ) : (
                      /* 10 rows: each row = [TONE knob] [LEVEL knob] [16 chiclets] */
                      <div className="flex flex-col gap-1">
                        {tracks.map((_track, rowIndex) => {
                          const trackId = trackIdsByRowRef.current[rowIndex];
                          const trackConfig = TRACK_REGISTRY.find(
                            (c) => c.trackId === trackId,
                          );
                          const isTrackDisabled =
                            failedTrackIds.includes(trackId);

                          if (!trackConfig) return null;

                          return (
                            <div
                              // eslint-disable-next-line react-x/no-array-index-key
                              key={`row-${rowIndex}`}
                              className="flex items-center gap-1"
                            >
                              {/* Per-track controls: label + TONE + LEVEL + M/S/CLR */}
                              <TrackControls
                                trackId={trackId}
                                label={trackConfig.label}
                                isMuted={trackMutes[rowIndex]}
                                isSoloed={trackSolos[rowIndex]}
                                onMuteToggle={handleMuteToggle}
                                onSoloToggle={handleSoloToggle}
                                onClear={handleClearTrack}
                                pitchValue={trackPitches[rowIndex]}
                                volumeValue={trackVolumes[rowIndex]}
                                onPitchChange={(newValue) =>
                                  handlePitchChange(rowIndex, newValue)
                                }
                                onVolumeChange={(newValue) =>
                                  handleDbChange(rowIndex, newValue)
                                }
                                disabled={isTrackDisabled}
                              />

                              {/* 16 chiclets for this row */}
                              <div className="grid flex-1 grid-cols-16 gap-1">
                                {grid[rowIndex].map((_, colIndex) => {
                                  const isAccented =
                                    manifestRef.current.tracks[trackId]
                                      ?.accents?.[colIndex] ?? false;

                                  return (
                                    <Chiclet
                                      // eslint-disable-next-line react-x/no-array-index-key
                                      key={`${rowIndex}-${colIndex}`}
                                      variant={getChicletVariant(colIndex)}
                                      isActive={grid[rowIndex][colIndex]}
                                      isAccented={isAccented}
                                      isCurrentStep={colIndex === currentStep}
                                      is16thNote={colIndex % 4 !== 0}
                                      onClick={() =>
                                        handlePadClick(rowIndex, colIndex)
                                      }
                                      disabled={isTrackDisabled}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ErrorBoundary>
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION: Tempo/Save row + Transport outline bar */}
            <div className="flex w-full flex-col gap-2">
              {/* Row 1: Tempo + Save */}
              <div className="flex items-center gap-2">
                <TempoDisplay
                  bpmValue={bpm}
                  onIncrementClick={handleIncrementBpm}
                  onDecrementClick={handleDecrementBpm}
                />
                <SaveButton
                  onClick={handleSaveBeat}
                  isSaving={isSaving}
                  style={{ width: "48px" }}
                />
              </div>

              {/* Row 2: Transport outline (left) overlapping with Step Strip (right) */}
              <div className="relative flex w-full items-end">
                {/* Transport outline as a proper image with buttons overlaid */}
                <div className="relative flex-none" style={{ width: "40%" }}>
                  <img
                    src={transportOutline}
                    alt=""
                    className="block h-auto w-full"
                    draggable={false}
                  />
                  {/* Buttons positioned on top of the transport outline */}
                  <div
                    className="absolute inset-0 flex items-center p-3"
                    style={{ gap: "58px" }}
                  >
                    <PlayStopBtn
                      onClick={() => void handleStartStopClick()}
                      disabled={isLoading}
                      style={{ position: "relative", top: "-10px" }}
                    />
                    <div className="flex flex-col items-center gap-1">
                      <BeatLibrary
                        beats={beats}
                        onLoadBeat={handleLoadBeatById}
                      />
                      <span className="text-[10px] font-semibold tracking-wide text-neutral-500"></span>
                    </div>
                  </div>
                </div>

                {/* Step Number Strip — overlaps the transport outline slightly via negative margin */}
                <div
                  className="flex flex-1 items-end"
                  style={{ marginLeft: "-1rem" }}
                >
                  <img
                    src={stepNoteCountStrip}
                    alt="Step numbers 1-16"
                    className="h-auto w-full"
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
