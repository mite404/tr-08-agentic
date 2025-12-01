/**
 * Supabase Database Type Definitions
 *
 * This file provides TypeScript type definitions for the Supabase database schema.
 * These types ensure type safety when querying the database via the Supabase client.
 */

import type { BeatManifest } from "./beat";

export interface Database {
  public: {
    Tables: {
      beats: {
        Row: {
          id: string;
          user_id: string;
          beat_name: string;
          data: BeatManifest;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          beat_name: string;
          data: BeatManifest;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          beat_name?: string;
          data?: BeatManifest;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
