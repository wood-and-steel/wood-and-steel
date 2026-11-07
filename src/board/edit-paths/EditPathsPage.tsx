/**
 * DEV-ONLY fix-up tool for board route geometry (docs/BOARD_APP_PLAN.md, milestone 0).
 *
 * Visit /board/edit-paths. Overlays every route path from routePaths.ts on the board art,
 * highlights flagged routes, lets you drag anchors and control points, and saves back to
 * src/board/geometry/routePaths.ts via the File System Access API (Chrome/Edge).
 */
import React from 'react';
import boardImageUrl from '../../../docs/map-board-full.png';
import { routes } from '../../data/routes';
import { BOARD_HEIGHT, BOARD_WIDTH, CITY_POINTS, REGIONAL_OFFICE_POINTS } from '../geometry/cityPoints';
import { EDITED_ROUTES, FLAGGED_ROUTES, ROUTE_PATHS } from '../geometry/routePaths';
import { formatPathD, parsePathD, type BezierPath, type Point } from '../geometry/pathData';
import {
  getHandlePoint,
  joinSegments,
  moveHandle,
  pathBounds,
  snapEnds,
  splitSegment,
  type PathHandle,
} from './pathEditing';
import { formatRoutePathsFile } from './routePathsFile';
import './edit-paths.css';

type Filter = 'flagged' | 'edited' | 'all';

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle[]>;
};

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Drag =
  | { kind: 'handle'; routeKey: string; handle: PathHandle }
  | { kind: 'pan'; startClient: Point; startView: ViewBox };

const FULL_VIEW: ViewBox = { x: 0, y: 0, w: BOARD_WIDTH, h: BOARD_HEIGHT };
const ROUTE_KEYS = [...routes.keys()].sort();
/** Handle radius and hit-stroke width in screen pixels. */
const HANDLE_SCREEN_RADIUS = 7;

function loadPaths(): Record<string, BezierPath> {
  return Object.fromEntries(
    Object.entries(ROUTE_PATHS).map(([key, d]) => [key, parsePathD(d)])
  );
}

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: p.x, y: p.y };
}

function handlesOf(path: BezierPath): PathHandle[] {
  return [
    ...path.segments.flatMap((_, i): PathHandle[] => [
      { kind: 'c1', segment: i },
      { kind: 'c2', segment: i },
    ]),
    ...[0, ...path.segments.map((_, i) => i + 1)].map(
      (index): PathHandle => ({ kind: 'anchor', index })
    ),
  ];
}

function handleId(handle: PathHandle): string {
  return handle.kind === 'anchor' ? `a${handle.index}` : `${handle.kind}-${handle.segment}`;
}

export function EditPathsPage(): React.ReactElement {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [paths, setPaths] = React.useState<Record<string, BezierPath>>(loadPaths);
  const [edited, setEdited] = React.useState<Set<string>>(() => new Set(EDITED_ROUTES));
  const [unsaved, setUnsaved] = React.useState<Set<string>>(() => new Set());
  const [selected, setSelected] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>(
    Object.keys(FLAGGED_ROUTES).length > 0 ? 'flagged' : 'all'
  );
  const [showAll, setShowAll] = React.useState(true);
  const [view, setView] = React.useState<ViewBox>(FULL_VIEW);
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [screenScale, setScreenScale] = React.useState(1);

  const missing = ROUTE_KEYS.filter((key) => !paths[key]);
  const flags = Object.fromEntries(
    Object.entries(FLAGGED_ROUTES).filter(([key]) => !edited.has(key))
  );
  const listed = ROUTE_KEYS.filter((key) =>
    filter === 'flagged' ? key in flags || !paths[key] : filter === 'edited' ? edited.has(key) : true
  );

  // Board units per screen pixel, so handles keep a constant on-screen size.
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0) setScreenScale(Math.max(view.w / rect.width, view.h / rect.height));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [view]);

  const updatePath = (key: string, next: BezierPath) => {
    setPaths((prev: Record<string, BezierPath>) => ({ ...prev, [key]: next }));
    setEdited((prev: Set<string>) => new Set(prev).add(key));
    setUnsaved((prev: Set<string>) => new Set(prev).add(key));
    setStatus(null);
  };

  const zoomTo = (key: string) => {
    const path = paths[key];
    if (!path) return;
    const b = pathBounds(path);
    const pad = 200;
    setView({ x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + pad * 2, h: b.maxY - b.minY + pad * 2 });
  };

  const select = (key: string, zoom: boolean) => {
    setSelected(key);
    if (zoom) zoomTo(key);
  };

  const selectNext = (step: 1 | -1) => {
    if (listed.length === 0) return;
    const i = selected ? listed.indexOf(selected) : -1;
    select(listed[(i + step + listed.length) % listed.length], true);
  };

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    if (unsaved.size === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const at = toSvgPoint(svg, event.clientX, event.clientY);
    const factor = event.deltaY > 0 ? 1.2 : 1 / 1.2;
    setView((v: ViewBox) => {
      const w = Math.min(BOARD_WIDTH * 2, Math.max(150, v.w * factor));
      const k = w / v.w;
      return { x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k, w, h: v.h * k };
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !drag) return;
    if (drag.kind === 'pan') {
      const dx = (event.clientX - drag.startClient.x) * screenScale;
      const dy = (event.clientY - drag.startClient.y) * screenScale;
      setView({ ...drag.startView, x: drag.startView.x - dx, y: drag.startView.y - dy });
      return;
    }
    const point = toSvgPoint(svg, event.clientX, event.clientY);
    updatePath(drag.routeKey, moveHandle(paths[drag.routeKey], drag.handle, point));
  };

  const startPan = (event: React.PointerEvent<SVGElement>) => {
    svgRef.current?.setPointerCapture(event.pointerId);
    setDrag({ kind: 'pan', startClient: { x: event.clientX, y: event.clientY }, startView: view });
  };

  const startHandleDrag = (event: React.PointerEvent<SVGElement>, routeKey: string, handle: PathHandle) => {
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    setDrag({ kind: 'handle', routeKey, handle });
  };

  const selectedPath: BezierPath | undefined = selected ? paths[selected] : undefined;
  const selectedRoute = selected ? routes.get(selected) : undefined;

  const resetSelected = () => {
    if (!selected || !ROUTE_PATHS[selected]) return;
    setPaths((prev: Record<string, BezierPath>) => ({ ...prev, [selected]: parsePathD(ROUTE_PATHS[selected]) }));
    setUnsaved((prev: Set<string>) => {
      const next = new Set(prev);
      next.delete(selected);
      return next;
    });
    if (!EDITED_ROUTES.includes(selected)) {
      setEdited((prev: Set<string>) => {
        const next = new Set(prev);
        next.delete(selected);
        return next;
      });
    }
  };

  const createMissing = () => {
    if (!selected || !selectedRoute) return;
    const [a, b] = selectedRoute.cities.map((c) => CITY_POINTS[c]);
    const third = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    updatePath(selected, { start: { x: a.x, y: a.y }, segments: [{ c1: third(1 / 3), c2: third(2 / 3), end: { x: b.x, y: b.y } }] });
  };

  const handleSave = async () => {
    setError(null);
    setStatus(null);
    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) {
      setError('File System Access API not available. Use Chrome or Edge.');
      return;
    }
    try {
      const [handle] = await picker({
        types: [{ description: 'TypeScript', accept: { 'text/typescript': ['.ts'] } }],
      });
      if (handle.name !== 'routePaths.ts') {
        setError(`Pick src/board/geometry/routePaths.ts (got ${handle.name}).`);
        return;
      }
      const ds = Object.fromEntries((Object.entries(paths) as [string, BezierPath][]).map(([key, p]) => [key, formatPathD(p)]));
      const writable = await handle.createWritable();
      await writable.write(formatRoutePathsFile(ds, flags, edited));
      await writable.close();
      setUnsaved(new Set());
      setStatus(`Saved ${Object.keys(ds).length} routes (${edited.size} hand-edited).`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRadius = HANDLE_SCREEN_RADIUS * screenScale;

  const routeClass = (key: string): string => {
    const classes = ['editPaths__route'];
    if (key in flags) classes.push('editPaths__route--flagged');
    if (edited.has(key)) classes.push('editPaths__route--edited');
    if (key === selected) classes.push('editPaths__route--selected');
    return classes.join(' ');
  };

  return (
    <div className="editPaths">
      <aside className="editPaths__sidebar">
        <h1 className="editPaths__title">Route path fix-up (dev)</h1>
        <p className="editPaths__hint">
          Click a route to select it. Drag the square anchors and round control points. Scroll to zoom; drag
          the map to pan; Esc deselects. Edited routes are kept when scripts/trace-routes.py is re-run.
        </p>

        <div className="editPaths__actions">
          <button className="button button--primary" type="button" onClick={handleSave}>
            Save routePaths.ts…
          </button>
          <button className="button" type="button" onClick={() => setView(FULL_VIEW)}>
            Fit board
          </button>
        </div>
        {unsaved.size > 0 && <p className="editPaths__unsaved">{unsaved.size} unsaved route(s)</p>}
        {status && <p className="editPaths__status">{status}</p>}
        {error && <p className="editPaths__error">{error}</p>}

        <label className="editPaths__toggle">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show all routes
        </label>

        {selected && (
          <section className="editPaths__selected">
            <h2 className="editPaths__routeName">{selected}</h2>
            {selectedRoute && (
              <p className="editPaths__meta">
                Length {selectedRoute.length}
                {selectedRoute.mountainous ? ', mountainous' : ''}
                {selectedPath ? `, ${selectedPath.segments.length} segment(s)` : ''}
              </p>
            )}
            {flags[selected] && <p className="editPaths__flag">Flagged: {flags[selected]}</p>}
            {selectedPath ? (
              <div className="editPaths__actions">
                {selectedPath.segments.length === 1 ? (
                  <button className="button" type="button" onClick={() => updatePath(selected, splitSegment(selectedPath, 0))}>
                    Split into 2
                  </button>
                ) : (
                  <button className="button" type="button" onClick={() => updatePath(selected, joinSegments(selectedPath))}>
                    Join into 1
                  </button>
                )}
                {selectedRoute && (
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      const [a, b] = selectedRoute.cities.map((c) => CITY_POINTS[c]);
                      updatePath(selected, snapEnds(selectedPath, a, b));
                    }}
                  >
                    Snap ends to cities
                  </button>
                )}
                <button className="button" type="button" onClick={() => updatePath(selected, selectedPath)}>
                  Mark reviewed
                </button>
                <button className="button" type="button" onClick={resetSelected} disabled={!unsaved.has(selected)}>
                  Revert
                </button>
              </div>
            ) : (
              <div className="editPaths__actions">
                <button className="button button--primary" type="button" onClick={createMissing}>
                  Create straight path
                </button>
              </div>
            )}
          </section>
        )}

        <div className="editPaths__filters" role="group" aria-label="Route filter">
          {(['flagged', 'edited', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`button${filter === f ? ' button--primary' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'flagged' ? `Flagged (${Object.keys(flags).length + missing.length})` : f === 'edited' ? `Edited (${edited.size})` : `All (${ROUTE_KEYS.length})`}
            </button>
          ))}
        </div>
        <div className="editPaths__actions">
          <button className="button" type="button" onClick={() => selectNext(-1)} disabled={listed.length === 0}>
            ◀ Prev
          </button>
          <button className="button" type="button" onClick={() => selectNext(1)} disabled={listed.length === 0}>
            Next ▶
          </button>
        </div>
        <ul className="editPaths__list">
          {listed.map((key) => (
            <li key={key}>
              <button
                type="button"
                className={`editPaths__listItem${key === selected ? ' editPaths__listItem--selected' : ''}`}
                onClick={() => select(key, true)}
              >
                <span>{key}</span>
                <span className="editPaths__listStatus">
                  {!paths[key] ? 'missing' : key in flags ? 'flagged' : edited.has(key) ? 'edited' : ''}
                  {unsaved.has(key) ? ' •' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <svg
        ref={svgRef}
        className={`editPaths__board${drag?.kind === 'pan' ? ' editPaths__board--panning' : ''}`}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        onWheel={handleWheel}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <image href={boardImageUrl} width={BOARD_WIDTH} height={BOARD_HEIGHT} onPointerDown={startPan} />

        {Object.entries(CITY_POINTS).map(([name, p]) => (
          <circle key={name} className="editPaths__city" cx={p.x} cy={p.y} r={p.r} />
        ))}
        {Object.entries(REGIONAL_OFFICE_POINTS).map(([code, p]) => (
          <circle key={code} className="editPaths__city" cx={p.x} cy={p.y} r={p.r} />
        ))}

        {(Object.entries(paths) as [string, BezierPath][])
          .filter(([key]) => showAll || key === selected)
          .map(([key, path]) => {
            const d = formatPathD(path);
            return (
              <g key={key}>
                <path className={routeClass(key)} d={d} />
                <path
                  className="editPaths__hit"
                  d={d}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    select(key, false);
                  }}
                >
                  <title>{key}</title>
                </path>
              </g>
            );
          })}

        {selected && selectedPath && (
          <g>
            {selectedPath.segments.map((segment, i) => {
              const p0 = i === 0 ? selectedPath.start : selectedPath.segments[i - 1].end;
              return (
                <g key={i}>
                  <line className="editPaths__arm" x1={p0.x} y1={p0.y} x2={segment.c1.x} y2={segment.c1.y} />
                  <line className="editPaths__arm" x1={segment.end.x} y1={segment.end.y} x2={segment.c2.x} y2={segment.c2.y} />
                </g>
              );
            })}
            {handlesOf(selectedPath).map((handle) => {
              const p = getHandlePoint(selectedPath, handle);
              const onPointerDown = (event: React.PointerEvent<SVGElement>) => startHandleDrag(event, selected, handle);
              return handle.kind === 'anchor' ? (
                <rect
                  key={handleId(handle)}
                  className="editPaths__handle editPaths__handle--anchor"
                  x={p.x - handleRadius}
                  y={p.y - handleRadius}
                  width={handleRadius * 2}
                  height={handleRadius * 2}
                  onPointerDown={onPointerDown}
                />
              ) : (
                <circle
                  key={handleId(handle)}
                  className="editPaths__handle"
                  cx={p.x}
                  cy={p.y}
                  r={handleRadius}
                  onPointerDown={onPointerDown}
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
