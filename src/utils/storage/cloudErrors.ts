/**
 * Cloud storage reachability helpers.
 *
 * Free-tier Supabase projects pause after inactivity and stop serving the API.
 * supabase-js typically surfaces that as a fetch failure with status 0
 * (e.g. "TypeError: Failed to fetch" / "FetchError: fetch failed").
 */

/** Thrown when the cloud backend cannot be reached (paused project, network, DNS, etc.). */
export class CloudUnavailableError extends Error {
  readonly code = 'CLOUD_UNAVAILABLE' as const;

  constructor(message = 'Cloud storage is unavailable') {
    super(message);
    this.name = 'CloudUnavailableError';
  }
}

type SupabaseLikeError = {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
};

/** True when the error looks like a paused project or other unreachable cloud host. */
export function isCloudUnreachableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    const msg = String(error ?? '').toLowerCase();
    return isUnreachableMessage(msg);
  }

  const err = error as SupabaseLikeError & Error;
  if (err.status === 0) return true;
  if (err instanceof TypeError && isUnreachableMessage(err.message)) return true;

  const msg = `${err.message ?? ''} ${err.name ?? ''} ${err.code ?? ''}`.toLowerCase();
  return isUnreachableMessage(msg);
}

function isUnreachableMessage(msg: string): boolean {
  return (
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('err_connection') ||
    msg.includes('err_name_not_resolved') ||
    msg.includes('err_timed_out')
  );
}

/** Wrap a raw error as CloudUnavailableError when it matches unreachable patterns. */
export function toCloudUnavailableError(error: unknown): CloudUnavailableError | null {
  if (error instanceof CloudUnavailableError) return error;
  if (!isCloudUnreachableError(error)) return null;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Cloud storage is unavailable';

  return new CloudUnavailableError(message);
}
