import { useEffect, useRef, useState, type JSX } from "react";
import "./App.css";
import { Pad } from "./components/Pad";
import { TempoDisplay } from "./components/TempoDisplay";
import { PlayStopBtn } from "./components/PlayStopBtn";
import { createSequencer, togglePad } from "./sequencer";
import { Knob } from "./components/Knob";
import * as Tone from "tone";

import mpcMark from "./assets/images/MPC_mark.png";

// PR #2: Import new audio engine and track registry
import { loadAudioSamples, resumeAudioContext } from "./lib/audioEngine";
import { TRACK_REGISTRY } from "./config/trackConfig";
import { getDefaultBeatManifest } from "./types/beat";
import type { TrackID, BeatManifest } from "./types/beat";

// PR #3: Import authentication and persistence hooks
import { useAuth } from "./hooks/useAuth";
import { useSaveBeat } from "./hooks/useSaveBeat";
import { useLoadBeat } from "./hooks/useLoadBeat";

// PR #4: Import UI components for loading states and auth
import { SkeletonGrid } from "./components/SkeletonGrid";
import { PortraitBlocker } from "./components/PortraitBlocker";
import { SaveButton } from "./components/SaveButton";
import { LoadButton } from "./components/LoadButton";
import { LoginModalButton } from "./components/LoginModalButton";

// PR #5: Import error boundary for crash protection
import { ErrorBoundary } from "./components/ErrorBoundary";

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

const colorMap: { [key: string]: string } = {
  // dark         light
  "bg-red-900": "bg-red-600",
  "bg-yellow-800": "bg-yellow-500",
  "bg-yellow-900": "bg-yellow-600",
  "bg-orange-950": "bg-orange-600",
  "bg-orange-800": "bg-orange-500",

  "bg-green-700": "bg-green-400",
  "bg-green-800": "bg-green-500",
  "bg-blue-600": "bg-blue-400",
  "bg-blue-700": "bg-blue-500",
  "bg-purple-900": "bg-purple-500",
};

function App() {
  const [bpm, setBpm] = useState(140);
  const [grid, setGrid] = useState(initialGrid);
  const [currentStep, setCurrentStep] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [beatName, setBeatName] = useState("TR-08");
  const [isEditTitleActive, setIsEditTitleActive] = useState(false);
  const [trackVolumes, setTrackVolumes] = useState<number[]>(
    Array(10).fill(-5),
  );
  // PR #6: Track failed audio samples for visual feedback
  const [failedTrackIds, setFailedTrackIds] = useState<TrackID[]>([]);

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
    isLoading: loadingBeat,
    error: loadError,
  } = useLoadBeat();

  // PR #4: Track initial data loading state
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);

  // PR #2: New audio engine state
  const playersMapRef = useRef<Map<TrackID, Tone.Player>>(new Map());
  const manifestRef = useRef<BeatManifest>(getDefaultBeatManifest());
  const trackIdsByRowRef = useRef<TrackID[]>(
    [...TRACK_REGISTRY]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map((c) => c.trackId),
  );

  // PR #4: Auto-load the latest beat on mount (The Graffiti Wall)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsInitialDataLoaded(false);
        const loadedBeat = await loadLatestBeat();
        if (loadedBeat) {
          setGrid(loadedBeat.grid);
          setBpm(loadedBeat.bpm);
          setBeatName(loadedBeat.beatName);
          console.log(`[App] Auto-loaded beat: "${loadedBeat.beatName}"`);
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

  // PR #5: Browser lifecycle management - handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageHiddenRef.current = document.hidden;
      console.log(`[App] Page visibility changed: hidden=${document.hidden}`);

      // When page becomes visible again, sync the playhead to current transport position
      if (!document.hidden && createSequencerRef.current) {
        const position = Tone.Transport.position;
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

  const getActiveColor = (baseColor: string, isActive: boolean): string => {
    if (!isActive) {
      return baseColor;
    } else {
      return colorMap[baseColor] ?? baseColor;
    }
  };

  function handlePadClick(rowIndex: number, colIndex: number) {
    console.log(`Clicked: row ${rowIndex}, col ${colIndex}`);

    const newGrid = togglePad(grid, rowIndex, colIndex);
    setGrid(newGrid);
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
      await saveBeat({ grid, bpm, beatName });
      alert(`Beat "${beatName}" saved successfully!`);
    } catch (err) {
      console.error("[App] Save failed:", err);
      alert(`Failed to save beat: ${saveError || "Unknown error"}`);
    }
  }

  // PR #3: Load beat handler
  async function handleLoadBeat() {
    try {
      const loadedBeat = await loadLatestBeat();
      if (loadedBeat) {
        setGrid(loadedBeat.grid);
        setBpm(loadedBeat.bpm);
        setBeatName(loadedBeat.beatName);
        alert(`Loaded beat: "${loadedBeat.beatName}"`);
      } else {
        alert("No beats found");
      }
    } catch (err) {
      console.error("[App] Load failed:", err);
      alert(`Failed to load beat: ${loadError || "Unknown error"}`);
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

  return (
    <>
      {/* PR #4: Portrait blocker for mobile devices */}
      <PortraitBlocker />

      {/* whole page container */}
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        {/* device container */}
        <div className="rounded-xl bg-gray-600 p-4 pt-12 pr-8 pb-8 pl-8">
          {/* HEADER container */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center">
              <img
                className="w-[200px] p-6"
                src={mpcMark}
                alt="TR-08 Mark"
              ></img>
              {getDisplayTitle()}
            </div>

            {/* PR #5: Auth Controls - Conditional on session with loading state */}
            <div className="flex items-center gap-3">
              {authLoading ? (
                // Loading: Show visible text while checking auth state
                <div className="px-4 py-2 text-sm font-medium text-gray-200">
                  Loading...
                </div>
              ) : !session ? (
                // Guest: Show only Sign In button
                <LoginModalButton
                  session={session}
                  signInWithGoogle={signInWithGoogle}
                  signInWithGithub={signInWithGithub}
                  signOut={signOut}
                  loading={authLoading}
                />
              ) : (
                // Authenticated: Show Save, Load, and Sign Out
                <>
                  <SaveButton onClick={handleSaveBeat} isSaving={isSaving} />
                  <LoadButton
                    onClick={handleLoadBeat}
                    isLoading={loadingBeat}
                  />
                  <LoginModalButton
                    session={session}
                    signInWithGoogle={signInWithGoogle}
                    signInWithGithub={signInWithGithub}
                    signOut={signOut}
                    loading={authLoading}
                  />
                </>
              )}
            </div>
          </div>

          {/* container for KNOB & GRID divs */}
          <div className="flex w-full flex-row">
            {/* KNOB container */}
            <div className="flex-none pt-3.5 pr-1.5">
              {tracks.map((_track, trackIndex) => {
                // PR #6: Check if this track failed to load
                const trackId = trackIdsByRowRef.current[trackIndex];
                const isDisabled = failedTrackIds.includes(trackId);

                return (
                  <Knob
                    // eslint-disable-next-line react-x/no-array-index-key
                    key={trackIndex}
                    _trackIndex={trackIndex}
                    inputDb={trackVolumes[trackIndex]}
                    onDbChange={(newDbValue) => {
                      handleDbChange(trackIndex, newDbValue);
                    }}
                    disabled={isDisabled}
                  />
                );
              })}
            </div>
            {/* beat grid container */}
            <div className="flex-1 rounded-md border-10 border-gray-900">
              {/* PR #5: Wrap grid in ErrorBoundary for crash protection */}
              <ErrorBoundary>
                {/* PR #4: Show skeleton while loading initial data */}
                {!isInitialDataLoaded ? (
                  <div className="p-0.5">
                    <SkeletonGrid />
                  </div>
                ) : (
                  /* beat grid */
                  <div className="grid grid-cols-16 gap-1 p-0.5">
                    {grid.map((track, rowIndex) => {
                      // PR #6: Check if this track failed to load
                      const trackId = trackIdsByRowRef.current[rowIndex];
                      const isDisabled = failedTrackIds.includes(trackId);

                      return track.map((_, colIndex) => {
                        return (
                          <Pad
                            // eslint-disable-next-line react-x/no-array-index-key
                            key={`${rowIndex}-${colIndex}`}
                            color={getActiveColor(
                              tracks[rowIndex].color,
                              grid[rowIndex][colIndex],
                            )}
                            isActive={grid[rowIndex][colIndex]}
                            isCurrentStep={colIndex === currentStep}
                            is16thNote={colIndex % 4 !== 0}
                            onClick={() => handlePadClick(rowIndex, colIndex)}
                            disabled={isDisabled}
                          />
                        );
                      });
                    })}
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>

          {/* control buttons container */}
          <div className="mx-auto grid max-w-3/4 grid-cols-2 justify-center gap-2 p-6 pt-6">
            <div>
              <PlayStopBtn
                customStyles=""
                onClick={() => void handleStartStopClick()}
                disabled={isLoading}
              />
            </div>

            {/* set tempo controls container */}
            <div className="grid grid-cols-1">
              <TempoDisplay
                bpmValue={bpm}
                onIncrementClick={handleIncrementBpm}
                onDecrementClick={handleDecrementBpm}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
