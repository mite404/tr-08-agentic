import { useEffect, useRef, useState, type JSX } from "react";
import * as Tone from "tone";
import "./App.css";
import { createSequencer } from "./sequencer";

import pageBackground from "./assets/images/BACKGROUND_01.jpeg";

// PR #2: Import new audio engine and track registry
import { TRACK_REGISTRY } from "./config/trackConfig";
import {
  loadAudioSamples,
  resumeAudioContext,
  setMasterDrive,
  setMasterSwing,
  setMasterOutputVolume, // PR #29: Master output volume control
} from "./lib/audioEngine";
import type { BeatManifest, TrackID } from "./types/beat";
import { getDefaultBeatManifest } from "./types/beat";

// PR #3: Import authentication and persistence hooks
import { useAuth } from "./hooks/useAuth";
import { useLoadBeat, type BeatSummary } from "./hooks/useLoadBeat";
import { useSaveBeat } from "./hooks/useSaveBeat";

// PR #31: Top-level navigation
import { NavBar } from "./components/NavBar";
import { PortraitBlocker } from "./components/PortraitBlocker";

// PR #32: Extracted chassis component
import { SequencerChassis } from "./components/SequencerChassis";

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

  // =========================================================================
  // PR #32: Build props for SequencerChassis
  // =========================================================================
  const accentsByRow: boolean[][] = trackIdsByRowRef.current.map((trackId) =>
    Array.from(
      { length: 16 },
      (_, col) => manifestRef.current.tracks[trackId]?.accents?.[col] ?? false,
    ),
  );

  const chassisProps = {
    // Display: Title
    displayTitle: getDisplayTitle(),

    // Display: Grid State
    grid,
    currentStep,
    accentsByRow,
    failedTrackIds,
    isInitialDataLoaded,

    // Display: Global Knobs
    masterVolume,
    drive,
    swing,

    // Display: Per-Track State
    trackVolumes,
    trackPitches,
    trackMutes,
    trackSolos,

    // Display: Tempo & Transport
    bpm,
    isLoading,

    // Display: Save & Load
    isSaving,
    beats,

    // Callbacks: Grid
    onPadClick: handlePadClick,

    // Callbacks: Global Knobs
    onMasterVolumeChange: handleMasterVolumeChange,
    onDriveChange: handleDriveChange,
    onSwingChange: handleSwingChange,

    // Callbacks: Per-Track Controls
    onVolumeChange: handleDbChange,
    onPitchChange: handlePitchChange,
    onMuteToggle: handleMuteToggle,
    onSoloToggle: handleSoloToggle,
    onClearTrack: handleClearTrack,

    // Callbacks: Tempo & Transport
    onIncrementBpm: handleIncrementBpm,
    onDecrementBpm: handleDecrementBpm,
    onStartStop: () => void handleStartStopClick(),

    // Callbacks: Save & Load
    onSave: handleSaveBeat,
    onLoadBeat: handleLoadBeatById,
  };

  return (
    <>
      {/* PR #31: Top-level Navigation with auth */}
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
        className="flex min-h-screen items-center justify-center pt-20"
        style={{
          backgroundImage: `url(${pageBackground})`,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* PR #32: Extracted chassis component */}
        <SequencerChassis {...chassisProps} />
      </div>
    </>
  );
}

export default App;
