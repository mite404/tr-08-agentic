/**
 * Database Connection Test Script
 *
 * This script verifies that Drizzle can connect to Supabase and query the database.
 * Run with: bun run db:test
 */

import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function testConnection() {
  console.log("🔍 Testing database connection...\n");

  try {
    // Test 1: Basic connection with raw SQL
    console.log("Test 1: Raw SQL query");
    const result = await db.execute(sql`SELECT NOW() as current_time`);
    console.log("✅ Connection successful!");
    console.log("   Server time:", result[0]?.current_time);
    console.log();

    // Test 2: Count beats table
    console.log("Test 2: Query beats table");
    const beatsCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM public.beats`
    );
    console.log("✅ Beats table accessible!");
    console.log(`   Total beats: ${beatsCount[0]?.count}`);
    console.log();

    // Test 3: Count profiles table
    console.log("Test 3: Query profiles table");
    const profilesCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM public.profiles`
    );
    console.log("✅ Profiles table accessible!");
    console.log(`   Total profiles: ${profilesCount[0]?.count}`);
    console.log();

    // Test 4: Check schema introspection (if schema.ts has been generated)
    console.log("Test 4: Check schema exports");
    const schemaModule = await import("../src/db/schema");
    const exportedKeys = Object.keys(schemaModule);
    console.log("✅ Schema exports available!");
    console.log(`   Exported items: ${exportedKeys.length > 0 ? exportedKeys.join(", ") : "None (run introspection first)"}`);
    console.log();

    console.log("🎉 All tests passed! Database connection is working correctly.");
    console.log("\n📝 Next steps:");
    console.log("   1. Run 'bunx drizzle-kit introspect' to generate schema.ts");
    console.log("   2. Use Drizzle Kit for migrations: bun run db:generate, db:migrate");
    console.log("   3. Continue using @supabase/supabase-js in your React app");

  } catch (error) {
    console.error("❌ Database connection failed!");
    console.error("\nError details:", error);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Check DATABASE_URL in .env.local");
    console.error("   2. Get connection string from: Supabase Dashboard → Settings → Database");
    console.error("   3. Ensure your IP is allowed in Supabase (or Connection Pooling is enabled)");
    console.error("   4. Verify your database password is correct");
    process.exit(1);
  }

  process.exit(0);
}

testConnection();
