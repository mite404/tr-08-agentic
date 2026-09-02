#!/usr/bin/env node

/**
 * control-tr-08.mjs
 * 
 * Control CLI for TR-08 drum machine web app.
 * Drives the app through playwright for verification and testing.
 * 
 * Usage:
 *   control-tr-08.mjs <command> [args]
 * 
 * Environment:
 *   VERIFY_PORT       - Port to use (default: 5174)
 *   VERIFY_STATE_DIR  - State directory (default: /tmp/tr-08-verify-<run-id>)
 *   VERIFY_RUN_ID     - Unique run identifier (default: process.pid)
 *   VERIFY_BASE_URL   - Override base URL (default: http://localhost:${VERIFY_PORT})
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Configuration
// ============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..', '..');

const PORT = parseInt(process.env.VERIFY_PORT || '5174', 10);
const RUN_ID = process.env.VERIFY_RUN_ID || `${process.pid}`;
const STATE_DIR = process.env.VERIFY_STATE_DIR || `/tmp/tr-08-verify-${RUN_ID}`;
const BASE_URL = process.env.VERIFY_BASE_URL || `http://localhost:${PORT}`;

const STATE_FILE = join(STATE_DIR, 'state.json');
const LOG_FILE = join(STATE_DIR, 'vite.log');
const SCREENSHOT_DIR = join(STATE_DIR, 'screenshots');
const ARTIFACTS_DIR = join(STATE_DIR, 'artifacts');
const BROWSER_FILE = join(STATE_DIR, 'browser.json');

// ============================================================================
// Helpers
// ============================================================================

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  if (!existsSync(ARTIFACTS_DIR)) {
    mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function readState() {
  if (!existsSync(STATE_FILE)) {
    return {};
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

function writeState(state) {
  ensureStateDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function updateState(updates) {
  const state = readState();
  Object.assign(state, updates);
  writeState(state);
}

async function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok || response.status === 304) {
        return true;
      }
    } catch {
      // Port not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function getPlaywright() {
  try {
    const { chromium } = await import('playwright');
    return { chromium };
  } catch {
    console.error('Playwright not found. Installing locally...');
    execSync('npm install --no-save playwright @playwright/test', {
      cwd: ROOT,
      stdio: 'inherit',
    });
    const { chromium } = await import('playwright');
    return { chromium };
  }
}

function readBrowserState() {
  if (!existsSync(BROWSER_FILE)) {
    return null;
  }
  return JSON.parse(readFileSync(BROWSER_FILE, 'utf-8'));
}

function writeBrowserState(state) {
  ensureStateDir();
  writeFileSync(BROWSER_FILE, JSON.stringify(state, null, 2));
}

async function getBrowserPage() {
  const browserState = readBrowserState();

  if (browserState && browserState.wsEndpoint) {
    try {
      const { chromium } = await getPlaywright();
      const browser = await chromium.connect(browserState.wsEndpoint);
      const contexts = browser.contexts();
      if (contexts.length > 0) {
        const pages = contexts[0].pages();
        if (pages.length > 0) {
          return { browser, page: pages[0], alreadyConnected: true };
        }
      }
    } catch {
      // Connection failed, will launch new browser
    }
  }

  // Launch new browser
  const { chromium } = await getPlaywright();
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // Save browser state
  const wsEndpoint = typeof browser.wsEndpoint === 'function' ? browser.wsEndpoint() : browser.wsEndpoint;
  writeBrowserState({
    wsEndpoint,
  });

  return { browser, page, alreadyConnected: false };
}

async function closeBrowser() {
  const browserState = readBrowserState();
  if (browserState && browserState.wsEndpoint) {
    try {
      const { chromium } = await getPlaywright();
      const browser = await chromium.connect(browserState.wsEndpoint);
      await browser.close();
    } catch {
      // Already closed
    }
  }
  if (existsSync(BROWSER_FILE)) {
    unlinkSync(BROWSER_FILE);
  }
}

// ============================================================================
// Commands
// ============================================================================

async function launch() {
  const state = readState();

  if (state.pid) {
    // Check if process is still running
    try {
      process.kill(state.pid, 0);
      console.error(`ERROR: Instance already running (pid: ${state.pid})`);
      process.exit(1);
    } catch {
      // Process is dead, clean up stale state
      console.log('Cleaning up stale state...');
      updateState({ pid: null, port: null });
    }
  }

  // Check if port is busy
  try {
    const response = await fetch(`http://localhost:${PORT}`);
    if (response.ok || response.status === 304) {
      console.error(`ERROR: Port ${PORT} is already in use`);
      process.exit(1);
    }
  } catch {
    // Port is free
  }

  console.log(`Launching TR-08 on port ${PORT}...`);
  ensureStateDir();

  // Try bun first (repo requirement), fallback to npm
  let command, args;
  try {
    execSync('which bun', { stdio: 'ignore' });
    command = 'bun';
    args = ['run', 'dev', '--', '--port', PORT.toString(), '--host'];
  } catch {
    console.log('bun not found, using npm fallback');
    command = 'npm';
    args = ['run', 'dev', '--', '--port', PORT.toString(), '--host'];
  }

  const vite = spawn(command, args, {
    cwd: ROOT,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logStream = writeFileSync(LOG_FILE, '');
  vite.stdout.on('data', (data) => {
    writeFileSync(LOG_FILE, data, { flag: 'a' });
  });
  vite.stderr.on('data', (data) => {
    writeFileSync(LOG_FILE, data, { flag: 'a' });
  });

  updateState({
    pid: vite.pid,
    port: PORT,
    startedAt: new Date().toISOString(),
    logFile: LOG_FILE,
  });

  console.log(`Waiting for server to be ready...`);
  const ready = await waitForPort(PORT);

  if (!ready) {
    console.error('ERROR: Server did not start within timeout');
    vite.kill();
    process.exit(1);
  }

  console.log(`✓ TR-08 is ready at ${BASE_URL}`);
  console.log(`  PID: ${vite.pid}`);
  console.log(`  Log: ${LOG_FILE}`);
  console.log(`  State: ${STATE_FILE}`);
}

async function doctor() {
  console.log('Running health check...');

  const state = readState();

  if (!state.pid) {
    console.error('✗ No instance is running');
    process.exit(1);
  }

  // Check if process is alive
  try {
    process.kill(state.pid, 0);
    console.log(`✓ Process is alive (pid: ${state.pid})`);
  } catch {
    console.error(`✗ Process ${state.pid} is not running`);
    process.exit(1);
  }

  // Check if port responds
  try {
    const response = await fetch(`${BASE_URL}/`);
    if (!response.ok && response.status !== 304) {
      console.error(`✗ Server returned ${response.status}`);
      process.exit(1);
    }
    console.log(`✓ Server responds at ${BASE_URL}`);
  } catch (error) {
    console.error(`✗ Cannot reach ${BASE_URL}: ${error.message}`);
    process.exit(1);
  }

  // Check for expected content - must contain TR-08 specifically
  try {
    const response = await fetch(`${BASE_URL}/`);
    const html = await response.text();

    // Assert string only this app serves
    if (!html.includes('TR-08') && !html.includes('tr-08')) {
      console.error('✗ Page does not contain expected TR-08 content');
      process.exit(1);
    }
    console.log('✓ Page contains TR-08 content');
  } catch (error) {
    console.error(`✗ Content check failed: ${error.message}`);
    process.exit(1);
  }

  console.log('✓ All checks passed');
}

async function cleanup() {
  console.log('Cleaning up...');

  // Close browser if running
  await closeBrowser();

  const state = readState();

  if (state.pid) {
    try {
      process.kill(state.pid, 0);
      console.log(`Killing process ${state.pid}...`);
      process.kill(state.pid, 'SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        process.kill(state.pid, 0);
        console.log(`Process still alive, sending SIGKILL...`);
        process.kill(state.pid, 'SIGKILL');
      } catch {
        // Already dead
      }

      console.log('✓ Process terminated');
    } catch {
      console.log('Process was not running');
    }
  }

  // Clear state but keep artifacts
  updateState({ pid: null, port: null });

  console.log('✓ Cleanup complete');
  console.log(`  Artifacts preserved at: ${ARTIFACTS_DIR}`);
  console.log(`  Screenshots preserved at: ${SCREENSHOT_DIR}`);
}

async function screenshot(name = 'screenshot') {
  const { browser, page, alreadyConnected } = await getBrowserPage();

  if (!alreadyConnected) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[aria-label="Start / Stop"]', { timeout: 10000 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  const filepath = join(SCREENSHOT_DIR, filename);

  await page.screenshot({ path: filepath, fullPage: true });

  console.log(`✓ Screenshot saved: ${filepath}`);
}

async function snapshot(name = 'snapshot') {
  const { browser, page, alreadyConnected } = await getBrowserPage();

  if (!alreadyConnected) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[aria-label="Start / Stop"]', { timeout: 10000 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.txt`;
  const filepath = join(ARTIFACTS_DIR, filename);

  // Get page structure
  const structure = await page.evaluate(() => {
    const getAriaTree = (el, depth = 0) => {
      const indent = '  '.repeat(depth);
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const label = el.getAttribute('aria-label') || '';
      const testid = el.getAttribute('data-testid') || '';

      let line = `${indent}${role}`;
      if (label) line += ` [${label}]`;
      if (testid) line += ` (testid: ${testid})`;

      const children = Array.from(el.children)
        .filter((child) => {
          const role = child.getAttribute('role');
          const label = child.getAttribute('aria-label');
          const testid = child.getAttribute('data-testid');
          return role || label || testid || child.tagName === 'BUTTON';
        })
        .map((child) => getAriaTree(child, depth + 1))
        .join('\n');

      return children ? `${line}\n${children}` : line;
    };

    return getAriaTree(document.body);
  });

  writeFileSync(filepath, structure);

  console.log(`✓ Snapshot saved: ${filepath}`);
}

async function waitSettle() {
  const { browser, page, alreadyConnected } = await getBrowserPage();

  if (!alreadyConnected) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[aria-label="Start / Stop"]', { timeout: 10000 });
  }

  // Wait for any loading states to clear
  await page.waitForTimeout(1000);

  console.log('✓ Page settled');
}

async function play() {
  const { browser, page, alreadyConnected } = await getBrowserPage();

  if (!alreadyConnected) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  }

  const button = await page.waitForSelector('button[aria-label="Start / Stop"]', { timeout: 10000 });
  await button.click();
  await page.waitForTimeout(500);

  console.log('✓ Play clicked');
}

async function stop() {
  const { browser, page, alreadyConnected } = await getBrowserPage();

  if (!alreadyConnected) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  }

  const button = await page.waitForSelector('button[aria-label="Start / Stop"]', { timeout: 10000 });
  await button.click();
  await page.waitForTimeout(500);

  console.log('✓ Stop clicked');
}

async function bpmUp() {
  const { browser, page, alreadyConnected } = await getBrowserPage();

  if (!alreadyConnected) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  }

  const button = await page.waitForSelector('button[aria-label="Increase tempo"]', { timeout: 10000 });
  await button.click();
  await page.waitForTimeout(200);

  console.log('✓ BPM increased');
}

async function bpmDown() {
  const { browser, page, alreadyConnected} = await getBrowserPage();

  if (!alreadyConnected) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  }

  const button = await page.waitForSelector('button[aria-label="Decrease tempo"]', { timeout: 10000 });
  await button.click();
  await page.waitForTimeout(200);

  console.log('✓ BPM decreased');
}

async function tapPad(track, step) {
  const { browser, page, alreadyConnected } = await getBrowserPage();

  if (!alreadyConnected) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[aria-label="Start / Stop"]', { timeout: 10000 });
  }

  // Find the pad at (track, step)
  // The grid is organized as 10 rows (tracks) × 16 columns (steps)
  const trackIndex = parseInt(track, 10);
  const stepIndex = parseInt(step, 10);

  if (trackIndex < 0 || trackIndex > 9 || stepIndex < 0 || stepIndex > 15) {
    console.error(`Invalid pad coordinates: track=${track}, step=${step}`);
    process.exit(1);
  }

  // Use nth-of-type to find the right button in the grid
  // The grid structure is a set of buttons arranged in grid-cols-16
  const padIndex = trackIndex * 16 + stepIndex;
  await page.click(`button:nth-of-type(${padIndex + 1})`);
  await page.waitForTimeout(200);

  console.log(`✓ Tapped pad at track ${track}, step ${step}`);
}

// ============================================================================
// Main
// ============================================================================

const command = process.argv[2];

try {
  switch (command) {
    case 'launch':
      await launch();
      break;
    case 'doctor':
      await doctor();
      break;
    case 'cleanup':
      await cleanup();
      break;
    case 'screenshot':
      await screenshot(process.argv[3]);
      break;
    case 'snapshot':
      await snapshot(process.argv[3]);
      break;
    case 'wait-settle':
      await waitSettle();
      break;
    case 'play':
      await play();
      break;
    case 'stop':
      await stop();
      break;
    case 'bpm-up':
      await bpmUp();
      break;
    case 'bpm-down':
      await bpmDown();
      break;
    case 'tap-pad':
      if (!process.argv[3] || !process.argv[4]) {
        console.error('Usage: control-tr-08.mjs tap-pad <track> <step>');
        process.exit(1);
      }
      await tapPad(process.argv[3], process.argv[4]);
      break;
    default:
      console.log(`TR-08 Control CLI

Usage: control-tr-08.mjs <command> [args]

Commands:
  launch           Start the TR-08 dev server
  doctor           Health check (process, port, content)
  cleanup          Stop the server and clean state (preserves artifacts)
  
  screenshot [name]  Capture full-page screenshot
  snapshot [name]    Capture ARIA tree structure
  wait-settle        Wait for page to fully load and settle
  
  play             Click play/start button
  stop             Click stop button
  bpm-up           Increase tempo by 1
  bpm-down         Decrease tempo by 1
  tap-pad <t> <s>  Tap pad at track t (0-9), step s (0-15)

Environment:
  VERIFY_PORT=${PORT}
  VERIFY_STATE_DIR=${STATE_DIR}
  VERIFY_RUN_ID=${RUN_ID}

State directory: ${STATE_DIR}
`);
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
