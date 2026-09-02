# Beat Persistence

Save and load drum patterns to/from Supabase backend. Requires authentication.

## Sub-features

1. **Save Beat:** Store the current grid, BPM, track settings, and master settings to Supabase
2. **Load Beat:** Retrieve a saved beat by ID and apply it to the sequencer
3. **Beat Library:** Sidebar panel showing all saved beats for the current user
4. **Auto-load Latest:** On app mount, automatically load the most recently saved beat
5. **Beat Metadata:** Beats store: name, BPM, grid state, track volumes/pitches/mutes/solos, master swing/drive, created/updated timestamps

## How to get to it (user POV)

**Authentication:**

- Top navigation bar has a "Sign In" button
- Supports Google and GitHub OAuth via Supabase Auth UI
- When signed in, shows user avatar and "Sign Out" button

**Save:**

- **Save button:** Metal square button with floppy disk icon
  - Selector: `button[aria-label="Save beat"]`
- Clicking saves the current beat (or creates a new one if no beat is loaded)
- Shows a browser alert: "Beat '<name>' saved successfully!"

**Load:**

- **Load button:** Metal square button with folder icon
  - Selector: `button[aria-label="Load beat"]`
- Opens a sidebar (Shadcn Sheet component) with a list of beats
- Each beat shows: name, BPM, last modified time
- Click a beat to load it (sidebar closes automatically)

**Beat Library Sidebar:**

- Displays beats in reverse chronological order (newest first)
- Each beat item has:
  - Beat name
  - BPM display
  - "Last updated X ago" timestamp (via date-fns)
  - Click anywhere on the item to load that beat

## Driving it with control-tr-08

**NOT FULLY AUTOMATED.** Authentication flow requires real OAuth, which is not automatable without credentials.

**Workaround for manual verification:**

1. **Set up Supabase environment:**

   Create a `.env.local` file in the workspace root:

   ```env
   VITE_SUPABASE_URL=<your-supabase-url>
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

2. **Launch the app:**

   ```bash
   cd /workspace/.agents/skills/verify-tr-08/scripts
   export VERIFY_PORT=5174 VERIFY_RUN_ID=persistence-test

   ./control-tr-08.mjs launch
   ./control-tr-08.mjs doctor
   ./control-tr-08.mjs wait-settle
   ```

3. **Sign in manually:**

   - Open `http://localhost:5174` in a browser
   - Click "Sign In"
   - Complete OAuth flow (Google or GitHub)
   - You should see your avatar in the nav bar

4. **Verify auto-load:**

   - If you have saved beats, the app should load the latest one on mount
   - Check the console for: `[App] Auto-loaded beat: "<name>" at <BPM> BPM`

5. **Save a beat:**

   - Tap some pads to create a pattern
   - Adjust BPM
   - Click the save button
   - Verify alert: "Beat '<name>' saved successfully!"

6. **Load a beat:**

   - Click the load button
   - Sidebar opens with beat list
   - Click a beat
   - Verify grid updates to match the loaded beat

7. **Capture evidence:**

   ```bash
   ./control-tr-08.mjs screenshot after-sign-in
   ./control-tr-08.mjs screenshot after-save
   ./control-tr-08.mjs screenshot beat-library-open
   ./control-tr-08.mjs screenshot after-load
   ```

8. **Cleanup:**

   ```bash
   ./control-tr-08.mjs cleanup
   ```

## Gotchas

1. **Requires Supabase credentials:** Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the app will fail to connect to Supabase. You'll see errors in the console and auth features will not work.

2. **OAuth redirect:** Supabase OAuth redirects to the URL configured in your Supabase project settings. If you're running on `localhost:5174`, make sure `http://localhost:5174` is in your allowed redirect URLs.

3. **Session persistence:** Supabase stores the session in localStorage. If you clear localStorage, you'll need to sign in again.

4. **Auto-load on mount:** The app loads the latest beat BEFORE the auth check completes. If you're not signed in, it skips the auto-load. If you sign in, reload the page to trigger auto-load.

5. **Beat name editing:** The beat name is editable by clicking the title (default: "TR-08"). Changes persist on save.

6. **No delete feature:** The UI does not currently have a "delete beat" button. Beats can only be deleted via Supabase dashboard or SQL.

7. **No conflict resolution:** If you edit a beat on multiple devices simultaneously, the last save wins (no merge or conflict detection).

8. **Network errors:** If Supabase is unreachable, save/load operations fail silently (errors logged to console). The UI should show error messages (future enhancement).
