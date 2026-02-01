# Database Setup with Drizzle ORM

This project uses **Drizzle ORM** for schema management and migrations, while the React client continues to use `@supabase/supabase-js` for all client-side database operations.

## Architecture

- **Client-Side (React App)**: Uses `@supabase/supabase-js` for queries, auth, RLS
- **Server-Side (Scripts & Migrations)**: Uses Drizzle ORM for schema management
- **Database**: Supabase PostgreSQL

## Initial Setup

### 1. Get Database Connection String

1. Go to your Supabase dashboard: `https://app.supabase.com/project/YOUR-PROJECT-REF`
2. Navigate to **Settings → Database → Connection String → URI**
3. Copy the connection string (it includes your password)

### 2. Add to Environment Variables

Edit `.env.local` and replace the placeholders with your actual values:

```bash
DATABASE_URL='postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres'
```

### 3. Generate Schema from Existing Database

Run introspection to generate TypeScript schema definitions from your existing Supabase tables:

```bash
bun run db:introspect
```

This will:

- Connect to your Supabase database
- Scan `public` and `auth` schemas
- Generate `src/db/schema.ts` with your table definitions
- Handle foreign keys (e.g., `beats.user_id → auth.users.id`)

### 4. Test Connection

Verify everything works:

```bash
bun run db:test
```

This script will:

- Test database connectivity
- Count rows in `beats` and `profiles` tables
- Validate schema exports

## Available Commands

```bash
# Schema Management
bun run db:introspect    # Generate schema from existing DB (run once)
bun run db:generate      # Generate migration files from schema changes
bun run db:migrate       # Apply migrations to database
bun run db:push          # Push schema changes directly (no migrations)
bun run db:studio        # Open Drizzle Studio (visual DB browser)

# Testing
bun run db:test          # Test database connection
```

## Workflow for Schema Changes

### Option 1: Using Migrations (Recommended for Production)

1. Edit `src/db/schema.ts` to make your changes
2. Generate migration: `bun run db:generate`
3. Review the migration file in `drizzle/` directory
4. Apply migration: `bun run db:migrate`

### Option 2: Direct Push (Good for Development)

1. Edit `src/db/schema.ts`
2. Push changes: `bun run db:push`

## Schema Reference

After introspection, your schema will be available at `src/db/schema.ts`.

Example usage in scripts:

```typescript
import { db } from "../src/db";
import { beats, profiles } from "../src/db/schema";
import { eq } from "drizzle-orm";

// Query beats
const allBeats = await db.select().from(beats);

// Query with filter
const userBeats = await db
  .select()
  .from(beats)
  .where(eq(beats.user_id, userId));
```

## Important Notes

### Client-Side Queries

**DO NOT** import `src/db` in React components. Always use `@supabase/supabase-js`:

```typescript
// ❌ WRONG - Don't use Drizzle in React components
import { db } from "./db";

// ✅ CORRECT - Use Supabase client
import { supabase } from "./supabaseClient";
```

### Auth Schema

Drizzle will introspect the `auth` schema (for foreign key references), but you should NOT modify it directly. Supabase Auth manages the `auth` schema.

### RLS (Row Level Security)

Drizzle bypasses RLS because it uses the `postgres` role. For client-side queries with RLS, continue using `@supabase/supabase-js`.

## Troubleshooting

### Connection Failed

1. Verify `DATABASE_URL` in `.env.local`
2. Check your IP is whitelisted (or use Connection Pooling)
3. Ensure password is correct
4. Test with: `bun run db:test`

### Schema Not Found

If introspection fails to find tables:

1. Check `schemaFilter` in `drizzle.config.ts`
2. Verify tables exist in Supabase SQL Editor
3. Try running: `bunx drizzle-kit introspect --verbose`

### Foreign Key Issues

If you see errors about `auth.users`:

- Ensure `schemaFilter: ["public", "auth"]` is in `drizzle.config.ts`
- The introspection will create a reference to the `auth` schema

## File Structure

```text
├── drizzle.config.ts          # Drizzle configuration
├── src/
│   └── db/
│       ├── schema.ts          # Auto-generated schema definitions
│       └── index.ts           # Database client (scripts only)
├── scripts/
│   └── test-db.ts             # Connection test script
└── drizzle/                   # Generated migration files (gitignored)
```

## Next Steps

1. Run `bun run db:introspect` to generate your schema
2. Run `bun run db:test` to verify connection
3. Explore your database with `bun run db:studio`
4. Start managing schema changes with migrations!
