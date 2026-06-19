/**
 * Debug session logging: prints structured JSON to the browser console on every device
 * (useful when the Cursor NDJSON ingest at 127.0.0.1 is not reachable, e.g. staging/production).
 * Best-effort POST to the ingest URL still runs when the debug server is available locally.
 */

const DEBUG_SESSION_ID = '8374db';
const INGEST_URL = 'http://127.0.0.1:7287/ingest/31bb9207-062b-4d76-b909-fd405432f6bd';

export type DebugSessionPayload = {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
};

export function debugSessionLog(payload: DebugSessionPayload): void {
  const line = {
    sessionId: DEBUG_SESSION_ID,
    timestamp: Date.now(),
    ...payload,
  };
  console.info(`[agent-debug:${DEBUG_SESSION_ID}]`, JSON.stringify(line));
  if (typeof fetch === 'undefined') return;
  fetch(INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': DEBUG_SESSION_ID,
    },
    body: JSON.stringify(line),
  }).catch(() => {});
}
