/**
 * Storage Adapters
 *
 * Exports storage adapter classes and factory functions.
 * Unified interface for game storage operations.
 */

import { StorageAdapter } from './storageAdapter';
import { LocalStorageAdapter } from './localStorageAdapter';
import { SupabaseAdapter } from './supabaseAdapter';
import {
  STORAGE_TYPE,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from '../../config/storage';

export { StorageAdapter } from './storageAdapter';
export { LocalStorageAdapter } from './localStorageAdapter';
export { SupabaseAdapter } from './supabaseAdapter';
export * from './migration';

/** Normalized storage type for adapter selection. */
type NormalizedStorageType = 'local' | 'cloud';

function normalizeStorageType(type: string | null | undefined): NormalizedStorageType {
  const t = type ?? STORAGE_TYPE;
  return t === 'supabase' || t === 'cloud' ? 'cloud' : 'local';
}

/**
 * Create and return the appropriate storage adapter based on configuration.
 * @param storageType - Optional storage type ('local' or 'cloud'). If not provided, reads from env.
 */
export function createStorageAdapter(
  storageType?: string | null
): StorageAdapter {
  const normalizedType = normalizeStorageType(storageType ?? STORAGE_TYPE);

  if (normalizedType === 'cloud') {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn(
        '[createStorageAdapter] Supabase URL or key missing. Falling back to localStorage.'
      );
      return new LocalStorageAdapter();
    }
    return new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return new LocalStorageAdapter();
}

/** Cached storage adapter instances by storage type. */
const adapterCache = new Map<NormalizedStorageType, StorageAdapter>();

/**
 * Get or create a storage adapter instance for the given storage type.
 * Adapters are cached and reused.
 * @param storageType - Storage type ('local' or 'cloud'). If not provided, reads from env.
 */
export function getStorageAdapter(
  storageType?: string | null
): StorageAdapter {
  const normalizedType = normalizeStorageType(storageType ?? STORAGE_TYPE);

  const cached = adapterCache.get(normalizedType);
  if (cached) {
    return cached;
  }

  const adapter = createStorageAdapter(normalizedType);
  adapterCache.set(normalizedType, adapter);
  return adapter;
}

/**
 * Set a custom storage adapter instance for a specific storage type (e.g. for testing).
 * @param storageType - Storage type ('local' or 'cloud')
 * @param adapter - The storage adapter to use
 */
export function setStorageAdapter(
  storageType: string,
  adapter: StorageAdapter
): void {
  const normalizedType = normalizeStorageType(storageType);
  adapterCache.set(normalizedType, adapter);
}
