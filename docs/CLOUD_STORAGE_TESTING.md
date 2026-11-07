# Cloud Storage Testing Guide

This document describes how to test the cloud storage features: real-time sync and conflict resolution. All games are stored in Supabase.

## Prerequisites

1. **Supabase Setup**: Ensure you have a Supabase project configured with:
   - `VITE_SUPABASE_URL` environment variable
   - `VITE_SUPABASE_ANON_KEY` environment variable
   - Database schema created (see `CLOUD_STORAGE_MIGRATION_PLAN.md`)

## Testing Real-Time Sync

### Setup
1. Open the app in two different browser windows/tabs (or use incognito mode for the second)
2. Ensure both are connected to the same Supabase instance
3. Create or load a game in the first window

### Test Steps
1. **Window 1**: Create a new game or load an existing game
2. **Window 2**: Enter the same game code
3. **Window 1**: Make a move (e.g., generate a contract, end turn)
4. **Window 2**: Should automatically update within 1-2 seconds without refresh

### Expected Behavior
- Both windows should show the same game state
- Changes in one window should appear in the other window automatically
- Console should show: `[App] Received real-time update for game: <CODE>`
- No page refresh required

## Testing Conflict Resolution

### Setup
1. Open the app in two browser windows
2. Load the same game in both windows
3. Make simultaneous changes

### Test Steps
1. **Window 1**: Make a move (e.g., generate a contract)
2. **Window 2**: Quickly make a different move before Window 1's save completes
3. Observe which change "wins"

### Expected Behavior
- Last write wins (the most recent save overwrites previous changes)
- Console should show: `[SupabaseAdapter.saveGame] Conflict detected... Last-write-wins`
- Both windows should eventually sync to the same state via real-time updates
- No data loss (one of the changes will be preserved)

### Manual Conflict Test
```javascript
// In Window 1 console:
const { getStorageAdapter } = await import('./src/utils/storage/index');
const adapter = getStorageAdapter();
await adapter.saveGame('TESTG', { G: { test: 1 }, ctx: { phase: 'test' } }, {});

// In Window 2 console (before Window 1 finishes):
await adapter.saveGame('TESTG', { G: { test: 2 }, ctx: { phase: 'test' } }, {});
// Should see conflict warning in console
```

## End-to-End Test Scenario

### Scenario: Multiplayer Game with Real-Time Sync

1. **Setup**
   - Window 1: Create new game (e.g., code: "ABCDE")
   - Window 2: Enter game code "ABCDE"

2. **Test Real-Time Sync**
   - Window 1: Player 0 generates starting contract
   - Window 2: Should see the contract appear automatically
   - Window 2: Player 1 generates starting contract
   - Window 1: Should see Player 1's contract appear automatically

3. **Test Conflict Resolution**
   - Window 1: Player 0 generates private contract
   - Window 2: Player 1 generates private contract (simultaneously)
   - Both windows should eventually show both contracts (last-write-wins)

## Troubleshooting

### Real-Time Not Working
- Check browser console for subscription errors
- Verify Supabase real-time is enabled on the `games` table
- Check network tab for WebSocket connections
- Ensure both windows are using the same Supabase instance

### Conflicts Not Detected
- Check that `updated_at` timestamps are being tracked
- Verify cache is being cleared/updated correctly
- Check console for conflict detection logs

## Storage Adapter Access

```javascript
// Storage adapter access
import { getStorageAdapter } from './src/utils/storage/index';
const adapter = getStorageAdapter();
```

## Expected Console Output

### Successful Real-Time Sync
```
[SupabaseAdapter.subscribeToGame] Subscribed to real-time updates for game "ABCDE"
[App] Received real-time update for game: ABCDE
[App] Updated game state from real-time subscription
```

### Conflict Detection
```
[SupabaseAdapter.saveGame] Conflict detected for game "ABCDE": expected <timestamp>, got <timestamp>. Last-write-wins.
[SupabaseAdapter.saveGame] Saved game "ABCDE" with conflict resolution (last-write-wins)
```

## Before going live (paused-project / dashboard link)

The lobby’s cloud-unavailable banner (paused free-tier Supabase, network failure, etc.) currently links to the **project owner’s** Supabase dashboard so a developer can sign in and resume the project. That is intentional for local/dev use only.

**Do not ship this as-is for a public or multiplayer production audience.** End users cannot resume your project, and a dashboard deep-link is not a product UX.

Before launch, replace or rework this path. Options include:

- Use a paid Supabase plan (or other hosting) that does not auto-pause, so the failure mode is rare
- Show a generic “cloud temporarily unavailable — try again later” message with no owner dashboard link
- Point support/status at a public status page or contact channel you control
- Optionally keep `VITE_SUPABASE_DASHBOARD_URL` / derived dashboard links **only in development builds** (or behind a private admin flag)

Related code: `SUPABASE_DASHBOARD_URL` in `src/config/storage.js`, cloud error UI in `src/components/LobbyScreen.tsx`, reachability helpers in `src/utils/storage/cloudErrors.ts`.
