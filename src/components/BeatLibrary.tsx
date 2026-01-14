/**
 * PR #12: Beat Library Side Panel
 *
 * Displays a sidebar with the user's saved beats in a list.
 * Uses Shadcn UI with Vega/Orange theme (scoped to .beat-library-theme).
 */

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Library } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Button } from "./ui/button";
import type { BeatSummary } from "../hooks/useLoadBeat";
import type { Session } from "@supabase/supabase-js";

interface BeatLibraryProps {
  session: Session;
  beats: BeatSummary[];
  onLoadBeat: (beatId: string) => Promise<void>;
}

export function BeatLibrary({ session, beats, onLoadBeat }: BeatLibraryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleBeatClick = async (beatId: string) => {
    await onLoadBeat(beatId);
    setIsOpen(false); // Close sheet after loading
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="beat-library-theme">
          <Library className="mr-2 h-4 w-4" />
          My Beats
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Your Saved Beats</SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-2">
          {beats.length === 0 ? (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              No beats found. Save a beat to see it here!
            </div>
          ) : (
            <div className="space-y-1">
              {beats.map((beat) => (
                <button
                  key={beat.id}
                  onClick={() => void handleBeatClick(beat.id)}
                  className="w-full rounded-md p-3 text-left transition-colors hover:bg-[hsl(var(--accent))]"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[hsl(var(--foreground))]">
                      {beat.beat_name}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {formatDistanceToNow(new Date(beat.updated_at), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
