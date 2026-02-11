# Cloud Storage Testing Guide

This document describes how to test the cloud storage features: real-time sync, conflict resolution, and migration tools.

## Prerequisites

1. **Supabase Setup**: Ensure you have a Supabase project configured with:
   - `VITE_SUPABASE_URL` environment variable
   - `VITE_SUPABASE_ANON_KEY` environment variable
   - Database schema created (see `CLOUD_STORAGE_MIGRATION_PLAN.md`)

2. **Storage Configuration**: Set `VITE_STORAGE_TYPE=supabase` in your `.env` file to use cloud storage.

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

### Browser Console Testing
```javascript
// Test real-time subscription manually
await window.testMigration.testRealtimeSync('TESTG');
// Then make changes to the game in another window/tab
```

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

## Testing Migration Tool

### Export from localStorage

#### Browser Console
```javascript
// Export all games from localStorage
const games = await window.testMigration.exportFromLocalStorage();
console.log(`Exported ${games.length} games`);

// Export to JSON string
const json = await window.testMigration.exportToJSON();
console.log(json);
// Copy the JSON to clipboard or save to file
```

#### Programmatic
```javascript
import { exportFromLocalStorage, exportToJSON } from './src/utils/storage/migration';

// Export games array
const games = await exportFromLocalStorage();

// Export as JSON string
const json = await exportToJSON();
```

### Import to Supabase

#### Browser Console
```javascript
// Migrate all games from localStorage to Supabase
const results = await window.testMigration.migrateToSupabase({ overwrite: false });
console.log(results);
// Results: { exported: N, imported: { success: X, failed: Y, skipped: Z, errors: [...] } }

// With overwrite enabled (replaces existing games)
const results2 = await window.testMigration.migrateToSupabase({ overwrite: true });
```

#### Programmatic
```javascript
import { migrateLocalStorageToSupabase, importToSupabase } from './src/utils/storage/migration';

// Full migration
const results = await migrateLocalStorageToSupabase({
  overwrite: false,
  onProgress: (current, total, code, phase) => {
    console.log(`${phase}: ${current}/${total}${code ? ` - ${code}` : ''}`);
  }
});

// Import specific games
const games = [/* array of games */];
const importResults = await importToSupabase(games, { overwrite: false });
```

### Import from JSON

```javascript
// Import from JSON string
const jsonString = `[{"code": "ABC", "state": {...}, "metadata": {...}}, ...]`;
const results = await window.testMigration.importFromJSON(jsonString, { overwrite: false });
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

4. **Test Migration**
   - Window 1: Create several test games
   - Run migration: `await window.testMigration.migrateToSupabase({ overwrite: true })`
   - Window 2: Verify games are accessible via Supabase

## Troubleshooting

### Real-Time Not Working
- Check browser console for subscription errors
- Verify Supabase real-time is enabled on the `games` table
- Check network tab for WebSocket connections
- Ensure both windows are using the same Supabase instance

### Migration Fails
- Verify Supabase credentials are correct
- Check browser console for specific error messages
- Ensure database schema is created correctly
- Check RLS policies allow anon role access

### Conflicts Not Detected
- Check that `updated_at` timestamps are being tracked
- Verify cache is being cleared/updated correctly
- Check console for conflict detection logs

## Test Utilities Available in Browser Console

When running in development mode, these utilities are available:

```javascript
// Migration utilities
window.testMigration.exportFromLocalStorage()
window.testMigration.migrateToSupabase({ overwrite: true })
window.testMigration.exportToJSON()
window.testMigration.importFromJSON(jsonString)
window.testMigration.testRealtimeSync(gameCode)

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

### Migration
```
[Migration] Starting export from localStorage...
[Migration] Exported game: ABCDE
[Migration] Export complete: 5 games exported
[Migration] Starting import to Supabase (5 games)...
[Migration] Imported game: ABCDE
[Migration] Import complete: 5 succeeded, 0 failed, 0 skipped
```
