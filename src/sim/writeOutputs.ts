import type { GameResult, SimulationParams } from './runSimulation';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
};

function getDirectoryPicker(): DirectoryPickerWindow['showDirectoryPicker'] {
  return (window as DirectoryPickerWindow).showDirectoryPicker;
}

function padGameNumber(gameNumber: number, totalGames: number): string {
  const width = Math.max(1, String(totalGames).length);
  return String(gameNumber).padStart(width, '0');
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatRunTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}-${min}-${s}`;
}

export function buildRunBaseName(params: SimulationParams, runDate = new Date()): string {
  const timestampPart = formatRunTimestamp(runDate);
  return `${timestampPart} ${params.numPlayers}P ${params.numRounds}R - ${params.numGames} games`;
}

export function buildCsv(results: GameResult[]): string {
  const header = [
    'Game Number',
    'Active Cities',
    'Active Cities Total',
    'Active Cities Average',
    'RR sizes',
    'Max RR size',
    'RR routes',
  ].join(',');

  const rows = results.map((result) =>
    [
      result.gameNumber,
      csvEscape(result.activeCities.join(', ')),
      result.activeCitiesTotal,
      result.activeCitiesAverage.toFixed(2),
      csvEscape(result.rrSizes.join(', ')),
      result.maxRrSize,
      csvEscape(result.rrRoutes.join(', ')),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

async function writeTextFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  contents: string
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function writeBlobFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export function supportsDirectoryPicker(): boolean {
  return typeof getDirectoryPicker() === 'function';
}

async function ensureWritePermission(
  dirHandle: FileSystemDirectoryHandle
): Promise<void> {
  const options = { mode: 'readwrite' as const };
  if ((await dirHandle.queryPermission(options)) === 'granted') {
    return;
  }
  if ((await dirHandle.requestPermission(options)) !== 'granted') {
    throw new Error('Write permission was denied for the selected folder.');
  }
}

export async function pickOutputDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = getDirectoryPicker();
  if (!picker) {
    throw new Error(
      'File System Access API is not supported in this browser. Use Chrome or Edge.'
    );
  }
  const dirHandle = await picker({ mode: 'readwrite' });
  // Confirm write access while the Launch click is still in the user-activation chain.
  await ensureWritePermission(dirHandle);
  return dirHandle;
}

export interface WriteOutputsOptions {
  params: SimulationParams;
  results: GameResult[];
  pngBlobs: Blob[];
  parentDir: FileSystemDirectoryHandle;
  runDate?: Date;
}

export async function writeSimulationOutputs({
  params,
  results,
  pngBlobs,
  parentDir,
  runDate = new Date(),
}: WriteOutputsOptions): Promise<string> {
  const baseName = buildRunBaseName(params, runDate);
  const csvFileName = `${baseName}.csv`;
  const pngDirName = baseName;

  await writeTextFile(parentDir, csvFileName, buildCsv(results));

  const pngDir = await parentDir.getDirectoryHandle(pngDirName, { create: true });
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const blob = pngBlobs[i];
    if (!result || !blob) continue;
    const pngName = `Game ${padGameNumber(result.gameNumber, params.numGames)}.png`;
    await writeBlobFile(pngDir, pngName, blob);
  }

  return baseName;
}
