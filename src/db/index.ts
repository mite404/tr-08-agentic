/**
 * Drizzle Database Client
 *
 * IMPORTANT: This client is for SERVER-SIDE SCRIPTS ONLY (migrations, seeds, admin tasks).
 * The React app should continue using @supabase/supabase-js for client-side operations.
 *
 * Usage: Import this in scripts/ directory only, not in React components.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Validate DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not defined. Please add it to .env.local:\n" +
    "Get it from: Supabase Dashboard → Settings → Database → Connection String → URI"
  );
}

// Create postgres connection
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString, {
  max: 1, // For scripts, we only need one connection
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export schema for easy access
export * from "./schema";
