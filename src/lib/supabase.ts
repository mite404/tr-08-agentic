/**
 * Supabase Client Initialization
 *
 * This file initializes the Supabase client for client-side operations.
 * All database queries from the React app should use this client to ensure
 * Row-Level Security (RLS) policies are enforced.
 *
 * IMPORTANT:
 * - Use this client for ALL client-side database operations
 * - RLS policies protect user data automatically
 * - Never use the Drizzle client (src/db) in React components
 */

import { createClient } from "@supabase/supabase-js";

// Validate environment variables at module load time
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check .env.local:\n" +
      "- VITE_SUPABASE_URL\n" +
      "- VITE_SUPABASE_ANON_KEY",
  );
}

/**
 * Supabase client instance.
 * Uses the anon key which respects Row-Level Security policies.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
