/**
 * Storage Adapters
 *
 * Exports the storage adapter classes and the shared adapter instance.
 * Games are stored in Supabase (cloud) only.
 */

import { StorageAdapter } from './storageAdapter';
import { SupabaseAdapter } from './supabaseAdapter';
import { CloudUnavailableError } from './cloudErrors';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config/storage';

export { StorageAdapter } from './storageAdapter';
export { SupabaseAdapter } from './supabaseAdapter';
export {
  CloudUnavailableError,
  isCloudUnreachableError,
  toCloudUnavailableError,
} from './cloudErrors';

/** Shared adapter instance. A single instance avoids multiple Supabase GoTrueClient warnings. */
let adapterInstance: StorageAdapter | null = null;

/**
 * Get (or lazily create) the storage adapter.
 * Throws CloudUnavailableError when Supabase is not configured.
 */
export function getStorageAdapter(): StorageAdapter {
  if (adapterInstance) {
    return adapterInstance;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new CloudUnavailableError(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  adapterInstance = new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY);
  return adapterInstance;
}

/** Replace the storage adapter instance (tests use an in-memory adapter). */
export function setStorageAdapter(adapter: StorageAdapter): void {
  adapterInstance = adapter;
}
