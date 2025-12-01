#!/usr/bin/env bun
/**
 * Pre-Flight Check for PR #3 Manual Smoke Testing
 *
 * Verifies that all required files, environment variables, and dependencies
 * are in place before the user starts manual testing.
 *
 * This does NOT test OAuth or database operations - those are manual tests.
 */

import { existsSync } from "fs";
import { resolve } from "path";

const checks: Array<{ name: string; fn: () => boolean | Promise<boolean>; required: boolean }> = [];

// Color codes for terminal output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function checkFileExists(path: string): boolean {
  return existsSync(resolve(process.cwd(), path));
}

// Check 1: Environment variables file exists
checks.push({
  name: "Environment file (.env.local) exists",
  fn: () => checkFileExists(".env.local"),
  required: true,
});

// Check 2: Required source files exist
const requiredFiles = [
  "src/lib/supabase.ts",
  "src/types/database.ts",
  "src/hooks/useAuth.ts",
  "src/hooks/useSaveBeat.ts",
  "src/hooks/useLoadBeat.ts",
  "src/components/LoginModal.tsx",
];

requiredFiles.forEach((file) => {
  checks.push({
    name: `Source file exists: ${file}`,
    fn: () => checkFileExists(file),
    required: true,
  });
});

// Check 3: Environment variables are set (not just file exists)
checks.push({
  name: "VITE_SUPABASE_URL is set",
  fn: () => {
    const envFile = Bun.file(".env.local");
    return envFile.text().then((content) => content.includes("VITE_SUPABASE_URL="));
  },
  required: true,
});

checks.push({
  name: "VITE_SUPABASE_ANON_KEY is set",
  fn: () => {
    const envFile = Bun.file(".env.local");
    return envFile.text().then((content) => content.includes("VITE_SUPABASE_ANON_KEY="));
  },
  required: true,
});

// Check 4: Documentation exists
const docFiles = [
  "docs/PR3_SMOKE_TEST.md",
  "docs/OAUTH_SETUP.md",
  "docs/SPEC.md",
  "docs/IMPLEMENTATION_PLAN.md",
];

docFiles.forEach((file) => {
  checks.push({
    name: `Documentation exists: ${file}`,
    fn: () => checkFileExists(file),
    required: false,
  });
});

// Check 5: Dependencies installed
checks.push({
  name: "node_modules exists (dependencies installed)",
  fn: () => checkFileExists("node_modules"),
  required: true,
});

// Check 6: TypeScript compiles (no syntax errors)
checks.push({
  name: "TypeScript compilation succeeds",
  fn: async () => {
    try {
      const proc = Bun.spawn(["bunx", "tsc", "--noEmit"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      return exitCode === 0;
    } catch {
      return false;
    }
  },
  required: true,
});

// Run all checks
async function runPreFlightChecks() {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   PR #3 Pre-Flight Check                         ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════╝${colors.reset}\n`);

  let passedCount = 0;
  let failedCount = 0;
  let warningCount = 0;

  for (const check of checks) {
    process.stdout.write(`${check.name}... `);

    try {
      const result = await check.fn();

      if (result) {
        console.log(`${colors.green}✓ PASS${colors.reset}`);
        passedCount++;
      } else {
        if (check.required) {
          console.log(`${colors.red}✗ FAIL${colors.reset}`);
          failedCount++;
        } else {
          console.log(`${colors.yellow}⚠ WARN${colors.reset}`);
          warningCount++;
        }
      }
    } catch (error) {
      if (check.required) {
        console.log(`${colors.red}✗ ERROR${colors.reset}`);
        failedCount++;
      } else {
        console.log(`${colors.yellow}⚠ ERROR${colors.reset}`);
        warningCount++;
      }
      console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Summary
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✓ Passed:${colors.reset}  ${passedCount}`);

  if (warningCount > 0) {
    console.log(`${colors.yellow}⚠ Warnings:${colors.reset} ${warningCount}`);
  }

  if (failedCount > 0) {
    console.log(`${colors.red}✗ Failed:${colors.reset}  ${failedCount}`);
  }

  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);

  if (failedCount > 0) {
    console.log(`${colors.red}❌ Pre-flight check FAILED${colors.reset}`);
    console.log("Please fix the failed checks before starting manual testing.\n");
    process.exit(1);
  } else if (warningCount > 0) {
    console.log(`${colors.yellow}⚠️  Pre-flight check passed with warnings${colors.reset}`);
    console.log("Non-critical issues detected. You can proceed with caution.\n");
  } else {
    console.log(`${colors.green}✅ Pre-flight check PASSED${colors.reset}`);
    console.log("\nYour codebase is ready for manual smoke testing!");
    console.log(`\nNext steps:`);
    console.log(`1. Configure OAuth providers in Supabase Dashboard (see docs/OAUTH_SETUP.md)`);
    console.log(`2. Run: bun run dev`);
    console.log(`3. Follow the manual testing checklist in docs/PR3_SMOKE_TEST.md\n`);
  }
}

runPreFlightChecks().catch((error) => {
  console.error(`${colors.red}Pre-flight check crashed:${colors.reset}`, error);
  process.exit(1);
});
