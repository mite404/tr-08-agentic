/**
 * Load Beat Hook
 *
 * This hook provides functionality to load beats from the database.
 * It includes data normalization, validation, and error handling.
 *
 * WORKFLOW:
 * 1. Fetch most recent beat (ORDER BY created_at DESC LIMIT 1)
 * 2. Pass through normalizeBeatData() for safety
 * 3. Convert to grid format using toGridArray()
 * 4. Return hydrated data for UI
 *
 * Usage:
 *   const { loadLatestBeat, loadBeatById, isLoading, error } = useLoadBeat();
 *   const beatData = await loadLatestBeat();
 */

import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { normalizeBeatData, getDefaultBeatManifest } from "../types/beat";
import { toGridArray } from "../lib/beatUtils";
import type { TrackID } from "../types/beat";

export interface LoadedBeatData {
  grid: boolean[][];
  bpm: number;
  beatName: string;
  trackVolumes: Record<TrackID, number>;
  trackPitches: Record<TrackID, number>; // v1.1
  trackAccents: Record<TrackID, boolean[]>; // v1.1
  trackMutes: Record<TrackID, boolean>; // v1.2
  trackSolos: Record<TrackID, boolean>; // v1.2
  beatId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BeatSummary {
  id: string;
  beat_name: string;
  updated_at: string;
}

export interface UseLoadBeatReturn {
  loadLatestBeat: () => Promise<LoadedBeatData | null>;
  loadBeatById: (beatId: string) => Promise<LoadedBeatData | null>;
  loadUserBeats: (userId: string) => Promise<LoadedBeatData[]>;
  loadBeatList: (userId: string) => Promise<BeatSummary[]>; // PR #12: List summary for sidebar
  isLoading: boolean;
  error: string | null;
}

export function useLoadBeat(): UseLoadBeatReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Safely processes a beat record from the database.
   * Validates and normalizes the data before converting to grid format.
   */
  const processBeatRecord = useCallback(
    (
      record: {
        id: string;
        beat_name: string;
        data: unknown;
        created_at: string;
        updated_at: string;
      } | null,
    ): LoadedBeatData | null => {
      if (!record) {
        return null;
      }

      // Safety: Validate and normalize the manifest
      const normalizedResult = normalizeBeatData(record.data);

      if (!normalizedResult.valid) {
        console.error("[Load] Invalid beat data:", normalizedResult.error);
        console.warn("[Load] Using default manifest as fallback");

        // Fallback to default manifest
        const defaultManifest = getDefaultBeatManifest();
        const gridData = toGridArray(defaultManifest);

        return {
          ...gridData,
          beatName: record.beat_name,
          beatId: record.id,
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        };
      }

      // Convert manifest to grid format
      const gridData = toGridArray(normalizedResult.data);

      return {
        ...gridData,
        beatName: record.beat_name,
        beatId: record.id,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      };
    },
    [],
  );

  /**
   * Loads the most recently created beat from the database.
   * Returns null if no beats exist.
   */
  const loadLatestBeat =
    useCallback(async (): Promise<LoadedBeatData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: dbError } = await supabase
          .from("beats")
          .select("id, beat_name, data, created_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (dbError) {
          // No beats found is not an error
          if (dbError.code === "PGRST116") {
            console.log("[Load] No beats found");
            return null;
          }

          console.error("[Load] Database error:", dbError);
          setError(`Failed to load: ${dbError.message}`);
          throw new Error("DATABASE_ERROR");
        }

        return processBeatRecord(data);
      } catch (err) {
        console.error("[Load] Load failed:", err);
        if (!error) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    }, [error, processBeatRecord]);

  /**
   * Loads a specific beat by ID.
   * Returns null if beat doesn't exist.
   */
  const loadBeatById = useCallback(
    async (beatId: string): Promise<LoadedBeatData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: dbError } = await supabase
          .from("beats")
          .select("id, beat_name, data, created_at, updated_at")
          .eq("id", beatId)
          .single();

        if (dbError) {
          console.error("[Load] Database error:", dbError);
          setError(`Failed to load: ${dbError.message}`);
          throw new Error("DATABASE_ERROR");
        }

        return processBeatRecord(data);
      } catch (err) {
        console.error("[Load] Load failed:", err);
        if (!error) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [error, processBeatRecord],
  );

  /**
   * Loads all beats for a specific user.
   * Returns empty array if no beats exist.
   */
  const loadUserBeats = useCallback(
    async (userId: string): Promise<LoadedBeatData[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: dbError } = await supabase
          .from("beats")
          .select("id, beat_name, data, created_at, updated_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (dbError) {
          console.error("[Load] Database error:", dbError);
          setError(`Failed to load: ${dbError.message}`);
          throw new Error("DATABASE_ERROR");
        }

        if (!data || data.length === 0) {
          return [];
        }

        // Process all records
        return data
          .map((record) => processBeatRecord(record))
          .filter((beat): beat is LoadedBeatData => beat !== null);
      } catch (err) {
        console.error("[Load] Load failed:", err);
        if (!error) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [error, processBeatRecord],
  );

  /**
   * PR #12: Loads a lightweight list of beats for the sidebar.
   * Only fetches id, beat_name, and updated_at (no full manifest data).
   */
  const loadBeatList = useCallback(
    async (userId: string): Promise<BeatSummary[]> => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: dbError } = await supabase
          .from("beats")
          .select("id, beat_name, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (dbError) {
          console.error("[Load] Database error:", dbError);
          setError(`Failed to load beat list: ${dbError.message}`);
          throw new Error("DATABASE_ERROR");
        }

        return data || [];
      } catch (err) {
        console.error("[Load] Load beat list failed:", err);
        if (!error) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [error],
  );

  return {
    loadLatestBeat,
    loadBeatById,
    loadUserBeats,
    loadBeatList,
    isLoading,
    error,
  };
}
