/**
 * Save Beat Hook
 *
 * This hook provides functionality to save the current beat to the database.
 * It includes debouncing, validation, and error handling.
 *
 * WORKFLOW:
 * 1. Convert grid array → BeatManifest using toManifest()
 * 2. Validate manifest using BeatManifestSchema
 * 3. Insert into Supabase beats table
 * 4. Handle errors gracefully
 *
 * Usage:
 *   const { saveBeat, isSaving, error } = useSaveBeat(session);
 *   await saveBeat({ grid, bpm, beatName });
 */

import { useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { toManifest } from "../lib/beatUtils";
import { BeatManifestSchema } from "../types/beat";
import type { Session } from "@supabase/supabase-js";
import type { TrackID } from "../types/beat";

export interface SaveBeatParams {
  grid: boolean[][];
  bpm: number;
  beatName: string;
  trackVolumes?: Record<TrackID, number>; // Optional, not stored in manifest
}

export interface UseSaveBeatReturn {
  saveBeat: (params: SaveBeatParams) => Promise<void>;
  saveBeatDebounced: (params: SaveBeatParams) => void;
  isSaving: boolean;
  error: string | null;
  lastSaved: Date | null;
}

export function useSaveBeat(session: Session | null): UseSaveBeatReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveBeat = useCallback(
    async ({ grid, bpm, beatName }: SaveBeatParams): Promise<void> => {
      // Validation: User must be authenticated
      if (!session?.user) {
        setError("You must be logged in to save beats");
        throw new Error("AUTH_REQUIRED");
      }

      // Validation: Beat name must be provided and within limits
      const trimmedName = beatName.trim();
      if (trimmedName.length === 0) {
        setError("Beat name cannot be empty");
        throw new Error("INVALID_BEAT_NAME");
      }
      if (trimmedName.length > 25) {
        setError("Beat name must be 25 characters or less");
        throw new Error("INVALID_BEAT_NAME");
      }

      setIsSaving(true);
      setError(null);

      try {
        // Step 1: Convert grid to BeatManifest
        const manifest = toManifest(grid, bpm);

        // Step 2: Validate manifest structure
        const validationResult = BeatManifestSchema.safeParse(manifest);
        if (!validationResult.success) {
          console.error("[Save] Validation failed:", validationResult.error);
          setError("Invalid beat data");
          throw new Error("VALIDATION_FAILED");
        }

        // Step 3: Insert into database
        const { error: dbError } = await supabase.from("beats").insert({
          user_id: session.user.id,
          beat_name: trimmedName,
          data: validationResult.data as any, // Type assertion needed due to JSONB
        });

        if (dbError) {
          console.error("[Save] Database error:", dbError);
          setError(`Failed to save: ${dbError.message}`);
          throw new Error("DATABASE_ERROR");
        }

        // Success!
        setLastSaved(new Date());
        console.log(`[Save] Beat "${trimmedName}" saved successfully`);
      } catch (err) {
        console.error("[Save] Save failed:", err);
        if (!error) {
          // Only set error if not already set
          setError(err instanceof Error ? err.message : "Unknown error");
        }
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [session, error],
  );

  /**
   * Debounced save function.
   * Waits 500ms after last call before actually saving.
   * Useful for auto-save on grid changes.
   */
  const saveBeatDebounced = useCallback(
    (params: SaveBeatParams): void => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        saveBeat(params).catch((err) => {
          console.error("[Save] Debounced save failed:", err);
        });
      }, 500);
    },
    [saveBeat],
  );

  return {
    saveBeat,
    saveBeatDebounced,
    isSaving,
    error,
    lastSaved,
  };
}
