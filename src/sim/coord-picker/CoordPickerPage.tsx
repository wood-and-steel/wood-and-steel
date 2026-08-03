/**
 * ONE-OFF TOOL — delete this entire folder and the /pick-coords route in App.tsx when done.
 *
 * Visit /pick-coords, click each city on the map in order, then copy or apply to mapCoordinates.ts.
 */
import React from 'react';
import mapImageUrl from '../../../docs/simple-map.png';
import './coord-picker.css';

const MAP_WIDTH = 1110;
const MAP_HEIGHT = 696;

/** Cities in the same order as CITY_PIXELS in mapCoordinates.ts. */
const CITY_NAMES = [
  'Atlanta',
  'Birmingham',
  'Bismarck',
  'Boise',
  'Boston',
  'Butte',
  'Calgary',
  'Charleston',
  'Chicago',
  'Cincinnati',
  'Cleveland',
  'Dallas',
  'Denver',
  'Des Moines',
  'Detroit',
  'Duluth',
  'Fargo',
  'Flagstaff',
  'Houston',
  'Kansas City',
  'Los Angeles',
  'Memphis',
  'Milwaukee',
  'Minneapolis',
  'Montreal',
  'New Orleans',
  'New York',
  'Norfolk',
  'Oklahoma City',
  'Omaha',
  'Ottawa',
  'Philadelphia',
  'Phoenix',
  'Pittsburgh',
  'Portland ME',
  'Portland OR',
  'Quebec City',
  'Raleigh',
  'Regina',
  'Saint Louis',
  'Salt Lake City',
  'San Diego',
  'San Francisco',
  'Santa Fe',
  'Savannah',
  'Seattle',
  'Spokane',
  'Sudbury',
  'Syracuse',
  'Tallahassee',
  'Tampa',
  'Thunder Bay',
  'Toronto',
  'Vancouver',
  'Washington',
  'Winnipeg',
] as const;

type CityCoord = readonly [string, number, number];

function formatCityPixelsArray(coords: CityCoord[]): string {
  const lines = coords.map(([name, x, y]) => `  ['${name}', ${x}, ${y}],`);
  return [
    'export const CITY_PIXELS: readonly (readonly [string, number, number])[] = [',
    ...lines,
    '];',
  ].join('\n');
}

const CITY_PIXELS_BLOCK_RE =
  /export const CITY_PIXELS: readonly \(readonly \[string, number, number\]\)\[\] = \[[\s\S]*?\];/;

function replaceCityPixelsInSource(source: string, coords: CityCoord[]): string {
  const block = formatCityPixelsArray(coords);
  if (!CITY_PIXELS_BLOCK_RE.test(source)) {
    throw new Error('Could not find CITY_PIXELS block in the selected file.');
  }
  return source.replace(CITY_PIXELS_BLOCK_RE, block);
}

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle[]>;
};

function clickToMapPixel(
  event: React.MouseEvent<HTMLDivElement>,
  image: HTMLImageElement
): { x: number; y: number } {
  const rect = image.getBoundingClientRect();
  const scaleX = image.naturalWidth / rect.width;
  const scaleY = image.naturalHeight / rect.height;
  const x = Math.round((event.clientX - rect.left) * scaleX);
  const y = Math.round((event.clientY - rect.top) * scaleY);
  return {
    x: Math.max(0, Math.min(MAP_WIDTH, x)),
    y: Math.max(0, Math.min(MAP_HEIGHT, y)),
  };
}

export function CoordPickerPage(): React.ReactElement {
  const imageRef = React.useRef<HTMLImageElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [coords, setCoords] = React.useState<CityCoord[]>([]);
  const [done, setDone] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [applyStatus, setApplyStatus] = React.useState<string | null>(null);
  const [applyError, setApplyError] = React.useState<string | null>(null);

  const currentIndex = coords.length;
  const currentCity = done ? null : CITY_NAMES[currentIndex];
  const output = done ? formatCityPixelsArray(coords) : '';

  const redrawMarkers = React.useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const rect = image.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = rect.width / image.naturalWidth;
    const scaleY = rect.height / image.naturalHeight;

    coords.forEach(([name, x, y], index) => {
      const px = x * scaleX;
      const py = y * scaleY;
      ctx.fillStyle = index === coords.length - 1 ? '#d62728' : '#1f77b4';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.fillText(name, px + 7, py - 7);
    });
  }, [coords]);

  React.useEffect(() => {
    redrawMarkers();
    const onResize = () => redrawMarkers();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [redrawMarkers]);

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (done || !currentCity) return;
    const image = imageRef.current;
    if (!image) return;

    const { x, y } = clickToMapPixel(event, image);
    const next = [...coords, [currentCity, x, y] as CityCoord];
    setCoords(next);
    if (next.length >= CITY_NAMES.length) {
      setDone(true);
    }
  };

  const handleUndo = () => {
    if (coords.length === 0) return;
    setDone(false);
    setCoords(coords.slice(0, -1));
    setCopyStatus(null);
    setApplyStatus(null);
    setApplyError(null);
  };

  const handleRestart = () => {
    setCoords([]);
    setDone(false);
    setCopyStatus(null);
    setApplyStatus(null);
    setApplyError(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopyStatus('Copied CITY_PIXELS array to clipboard.');
    } catch {
      setCopyStatus('Copy failed — select the text area and copy manually.');
    }
  };

  const handleApplyToFile = async () => {
    setApplyError(null);
    setApplyStatus(null);
    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) {
      setApplyError('File System Access API not available. Use Chrome/Edge and copy-paste instead.');
      return;
    }

    try {
      const [handle] = await picker({
        types: [{ description: 'TypeScript', accept: { 'text/typescript': ['.ts'] } }],
      });
      const file = await handle.getFile();
      const source = await file.text();
      const updated = replaceCityPixelsInSource(source, coords);
      const writable = await handle.createWritable();
      await writable.write(updated);
      await writable.close();
      setApplyStatus(`Updated ${handle.name}. Reload the dev server if needed.`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setApplyError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="coordPicker">
      <div className="coordPicker__header">
        <h1 className="coordPicker__title">City coordinate picker (one-off)</h1>
        {!done ? (
          <>
            <p className="coordPicker__prompt">
              Click on the map for: {currentCity ?? '—'}
            </p>
            <p className="coordPicker__progress">
              {currentIndex + 1} of {CITY_NAMES.length}
            </p>
          </>
        ) : (
          <p className="coordPicker__prompt">All cities recorded.</p>
        )}
        <div className="coordPicker__actions">
          <button
            className="button"
            type="button"
            onClick={handleUndo}
            disabled={coords.length === 0}
          >
            Undo last
          </button>
          <button className="button" type="button" onClick={handleRestart}>
            Restart
          </button>
          {done && (
            <>
              <button className="button button--primary" type="button" onClick={handleCopy}>
                Copy array
              </button>
              <button className="button button--primary" type="button" onClick={handleApplyToFile}>
                Apply to mapCoordinates.ts…
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className="coordPicker__mapWrap"
        onClick={handleMapClick}
        role="presentation"
      >
        <img
          ref={imageRef}
          className="coordPicker__map"
          src={mapImageUrl}
          alt="Map for coordinate picking"
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          onLoad={redrawMarkers}
        />
        <canvas ref={canvasRef} className="coordPicker__overlay" aria-hidden="true" />
      </div>

      {done && (
        <div className="coordPicker__done">
          <textarea
            className="coordPicker__output"
            readOnly
            value={output}
            aria-label="Generated CITY_PIXELS array"
          />
          <p className="coordPicker__hint">
            Replace the CITY_PIXELS block in src/sim/mapCoordinates.ts, or use Apply to write
            directly. Delete src/sim/coord-picker/ and the /pick-coords route when finished.
          </p>
          {copyStatus && <p className="coordPicker__status">{copyStatus}</p>}
          {applyStatus && <p className="coordPicker__status">{applyStatus}</p>}
          {applyError && <p className="coordPicker__error">{applyError}</p>}
        </div>
      )}
    </div>
  );
}
