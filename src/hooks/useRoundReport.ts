import React from "react";
import type { RoundReport } from "../stores/gameStore";
import { reportHasNews } from "../stores/roundReport";

/**
 * The round report's per-device state: whether it opens by itself after each round, and the
 * last round whose report this device has seen, per game. Both live in localStorage, never in
 * the game, and the app works without them (private windows, blocked storage).
 */
const AUTO_OPEN_KEY = "woodAndSteel.roundReport.autoOpen";
const seenKey = (gameCode: string) => `woodAndSteel.roundReport.seen.${gameCode}`;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the setting lasts until the page reloads.
  }
}

function readSeen(gameCode: string): number | null {
  const raw = readStorage(seenKey(gameCode));
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export interface RoundReportState {
  /** The report to show, while it's open. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** The latest report hasn't been seen on this device. */
  unseen: boolean;
  autoOpen: boolean;
  setAutoOpen: (on: boolean) => void;
}

/**
 * Opens the latest round report when a new one arrives (if it has news and the player hasn't
 * switched that off), marks it seen when opened, and otherwise leaves it unseen for the round
 * label's dot. A report with no news is marked seen without opening.
 */
export function useRoundReport(report: RoundReport | undefined, gameCode: string): RoundReportState {
  const [autoOpen, setAutoOpenState] = React.useState(() => readStorage(AUTO_OPEN_KEY) !== "false");
  const [seen, setSeen] = React.useState<number | null>(() => readSeen(gameCode));
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => setSeen(readSeen(gameCode)), [gameCode]);

  const latest = report?.round ?? null;
  const unseen = latest !== null && (seen === null || latest > seen);

  const markSeen = React.useCallback(
    (round: number) => {
      setSeen(round);
      writeStorage(seenKey(gameCode), String(round));
    },
    [gameCode]
  );

  React.useEffect(() => {
    if (!unseen || !report) return;
    if (!reportHasNews(report)) markSeen(report.round);
    else if (autoOpen) {
      setIsOpen(true);
      markSeen(report.round);
    }
    // Only a new report should open the sheet, not a change to the setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, unseen]);

  const open = React.useCallback(() => {
    setIsOpen(true);
    if (latest !== null) markSeen(latest);
  }, [latest, markSeen]);

  const setAutoOpen = React.useCallback((on: boolean) => {
    setAutoOpenState(on);
    writeStorage(AUTO_OPEN_KEY, on ? "true" : "false");
  }, []);

  return { isOpen: isOpen && report !== undefined, open, close: () => setIsOpen(false), unseen, autoOpen, setAutoOpen };
}
