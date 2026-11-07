"""
Dev-only: derive board geometry from docs/map-board-full.png (milestone 0 of docs/BOARD_APP_PLAN.md).

Outputs:
  src/board/geometry/cityPoints.ts   city circle centers/radii + Regional Office disc centers
  src/board/geometry/routePaths.ts   routeKey -> SVG path d (1-2 cubic Beziers), plus low-confidence flags

Never bundled. Requires: numpy, scipy, opencv-python-headless, scikit-image
  python -m venv .venv-trace && .venv-trace/Scripts/pip install numpy scipy opencv-python-headless scikit-image
  .venv-trace/Scripts/python scripts/trace-routes.py [--overlay out.png]

Pipeline:
  1. Cities: find every white disk enclosed by a dark ring, then match them to CITY_PIXELS x6
     (src/sim/mapCoordinates.ts) with an affine fit + optimal assignment.
  2. Routes: least-cost path between the two city centers over the thick-white route mask
     (other cities blocked, price pills bridged), then fit 1-2 cubic Beziers.
  3. Flag fits that are poor, leave the mask, or overlap another route's path.
"""

import argparse
import math
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage as ndi
from scipy.optimize import linear_sum_assignment
from skimage.graph import MCP_Geometric

ROOT = Path(__file__).resolve().parent.parent
BOARD_PNG = ROOT / 'docs' / 'map-board-full.png'
ROUTES_TS = ROOT / 'src' / 'data' / 'routes.ts'
MAP_COORDS_TS = ROOT / 'src' / 'sim' / 'mapCoordinates.ts'
OUT_DIR = ROOT / 'src' / 'board' / 'geometry'

SIMPLE_MAP_SCALE = 6
# Route strokes are ~23px of pure white; borders and text halos are a few px wide.
WHITE_MIN = 245
ROUTE_MIN_HALF_WIDTH = 5
BLOCKED_COST = 1e6
OFF_MASK_COST = 25.0
WEAK_MASK_COST = 6.0
# Fit quality thresholds (board pixels)
SINGLE_SEGMENT_TOLERANCE = 6.0
# Stroke half-width is ~11.5px; beyond this the curve visibly leaves the printed stroke.
FLAG_FIT_ERROR = 14.0
# Mountain icons and pills cover parts of short routes.
FLAG_OFF_MASK_FRACTION = 0.2
FLAG_OVERLAP_FRACTION = 0.15
TRIM_MARGIN = 30
# Trace length / chord length above this means the trace detoured (no stroke in the art).
FLAG_DETOUR_RATIO = 1.35
# Other cities are blocked out to r + 14; a trace within this of a disc is squeezing past it.
HUG_MARGIN = 22
REGION_ORDER = [['NW', 'NC', 'NE'], ['SW', 'SC', 'SE']]


# ---------------------------------------------------------------------------
# Source data


def read_routes():
    text = ROUTES_TS.read_text(encoding='utf-8')
    found = re.findall(r'\[\s*"([^"]+)",\s*\{\s*"length":\s*(\d+),\s*"mountainous":\s*(true|false),\s*cities:\s*\["([^"]+)",\s*"([^"]+)"\]', text)
    if not found:
        sys.exit(f'No routes parsed from {ROUTES_TS}')
    return [(key, a, b) for key, _len, _mtn, a, b in found]


def read_city_estimates():
    text = MAP_COORDS_TS.read_text(encoding='utf-8')
    found = re.findall(r"\['([^']+)',\s*(-?\d+),\s*(-?\d+)\]", text)
    return {name: (int(x) * SIMPLE_MAP_SCALE, int(y) * SIMPLE_MAP_SCALE) for name, x, y in found}


# ---------------------------------------------------------------------------
# Cities


def detect_city_disks(gray):
    """White disks enclosed by a dark ring: (x, y, radius)."""
    dark = gray < 70
    holes = ndi.binary_fill_holes(dark) & ~dark
    labels, count = ndi.label(holes)
    disks = []
    for index, sl in enumerate(ndi.find_objects(labels), start=1):
        region = labels[sl] == index
        area = region.sum()
        if area < 1200 or area > 8000:
            continue
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        circularity = area / (math.pi * (max(h, w) / 2) ** 2)
        if circularity < 0.9 or gray[sl][region].mean() < 240:
            continue
        ys, xs = np.nonzero(region)
        cx, cy = xs.mean() + sl[1].start, ys.mean() + sl[0].start
        disks.append((cx, cy, outer_radius(gray, cx, cy, math.sqrt(area / math.pi))))
    return disks


def outer_radius(gray, cx, cy, inner_r):
    """Radius to the outside of the black ring: median over directions, since strokes and labels touch the ring."""
    ends = []
    for angle in np.linspace(0, 2 * math.pi, 16, endpoint=False):
        dx, dy = math.cos(angle), math.sin(angle)
        is_dark = lambda r: gray[int(round(cy + r * dy)), int(round(cx + r * dx))] < 100
        r = inner_r - 3
        while r < inner_r + 6 and not is_dark(r):
            r += 0.5
        while r < inner_r * 2 and is_dark(r):
            r += 0.5
        ends.append(r)
    return float(np.median(ends))


def fit_affine(src, dst):
    a = np.hstack([src, np.ones((len(src), 1))])
    m, *_ = np.linalg.lstsq(a, dst, rcond=None)
    return m


def apply_affine(m, pts):
    return np.hstack([pts, np.ones((len(pts), 1))]) @ m


def match_cities(estimates, disks):
    names = sorted(estimates)
    est = np.array([estimates[n] for n in names], dtype=float)
    det = np.array([(x, y) for x, y, _ in disks])

    current = est.copy()
    for _ in range(4):
        cost = np.linalg.norm(current[:, None, :] - det[None, :, :], axis=2)
        rows, cols = linear_sum_assignment(cost)
        m = fit_affine(est[rows], det[cols])
        current = apply_affine(m, est)
    cost = np.linalg.norm(current[:, None, :] - det[None, :, :], axis=2)
    rows, cols = linear_sum_assignment(cost)
    result = {}
    for r, c in zip(rows, cols):
        residual = cost[r, c]
        if residual > 250:
            print(f'  warning: {names[r]} matched with residual {residual:.0f}px', file=sys.stderr)
        x, y, rad = disks[c]
        result[names[r]] = (x, y, rad)
    missing = set(names) - set(result)
    if missing:
        sys.exit(f'Unmatched cities: {sorted(missing)}')
    return result


def detect_regional_offices(gray):
    """Six discs in the printed Regional Offices panel (bottom-left)."""
    x0, y0, x1, y1 = 150, 3150, 1300, 4050
    crop = cv2.medianBlur(gray[y0:y1, x0:x1], 5)
    circles = cv2.HoughCircles(crop, cv2.HOUGH_GRADIENT, dp=1, minDist=250, param1=60, param2=40, minRadius=110, maxRadius=180)
    if circles is None or len(circles[0]) < 6:
        sys.exit('Could not detect the six Regional Office discs')
    found = sorted(circles[0][:6], key=lambda c: c[1])
    rows = [sorted(found[:3], key=lambda c: c[0]), sorted(found[3:], key=lambda c: c[0])]
    result = {}
    for row_codes, row in zip(REGION_ORDER, rows):
        for code, (x, y, r) in zip(row_codes, row):
            result[code] = (x + x0, y + y0, r)
    return result


# ---------------------------------------------------------------------------
# Route tracing


def build_cost(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    white = (gray >= WHITE_MIN).astype(np.uint8)
    half_width = cv2.distanceTransform(white, cv2.DIST_L2, 5)
    route = half_width >= ROUTE_MIN_HALF_WIDTH
    # Keep full stroke width (centerline pull comes from the half-width term).
    route_full = cv2.dilate(route.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & (white > 0)
    # Price pills are neutral grey; they interrupt the stroke.
    b, g, r = [image[:, :, i].astype(int) for i in range(3)]
    neutral = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) < 18
    pill = neutral & (gray > 90) & (gray < 175)
    # Open to drop the thin grey stroke outlines, then close over the white price digits so the
    # trace crosses a pill straight instead of following glyphs.
    pill = cv2.morphologyEx(pill.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    pill = cv2.morphologyEx(pill, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8)).astype(bool)
    stroke = route_full & ~pill

    cost = np.full(gray.shape, OFF_MASK_COST, dtype=np.float32)
    cost[pill | (white > 0)] = WEAK_MASK_COST
    centered = np.clip(12 - half_width, 0, 12)
    cost[stroke] = (1.0 + 0.6 * centered)[stroke]
    return cost, route_full | pill, stroke


def city_mask(shape, city, grow):
    x, y, r = city
    mask = np.zeros(shape, dtype=np.uint8)
    cv2.circle(mask, (int(round(x)), int(round(y))), int(round(r + grow)), 1, -1)
    return mask.astype(bool)


def trace_route(cost, cities, a, b):
    ax, ay, ar = cities[a]
    bx, by, br = cities[b]
    span = math.hypot(bx - ax, by - ay)
    pad = int(250 + 0.35 * span)
    h, w = cost.shape
    x0, y0 = max(0, int(min(ax, bx)) - pad), max(0, int(min(ay, by)) - pad)
    x1, y1 = min(w, int(max(ax, bx)) + pad), min(h, int(max(ay, by)) + pad)
    local = cost[y0:y1, x0:x1].copy()
    for name, (cx, cy, cr) in cities.items():
        if name in (a, b):
            continue
        if x0 - 100 < cx < x1 + 100 and y0 - 100 < cy < y1 + 100:
            local[city_mask(local.shape, (cx - x0, cy - y0, cr), 14)] = BLOCKED_COST
    start = (int(round(ay)) - y0, int(round(ax)) - x0)
    end = (int(round(by)) - y0, int(round(bx)) - x0)
    mcp = MCP_Geometric(local)
    mcp.find_costs([start], [end])
    path = np.array(mcp.traceback(end), dtype=float)  # (row, col)
    pts = np.column_stack([path[:, 1] + x0, path[:, 0] + y0])
    return pts


def hugs_other_city(pts, cities, a, b):
    """A trace squeezed against another city's (blocked) disc is riding that city's strokes, not its own."""
    for name, (x, y, r) in cities.items():
        if name not in (a, b) and np.hypot(pts[:, 0] - x, pts[:, 1] - y).min() < r + HUG_MARGIN:
            return True
    return False


def trim_to_outside(pts, cities, a, b):
    ax, ay, ar = cities[a]
    bx, by, br = cities[b]
    da = np.hypot(pts[:, 0] - ax, pts[:, 1] - ay)
    db = np.hypot(pts[:, 0] - bx, pts[:, 1] - by)
    # Near a city the stroke enters the disc off-center while the curve is pinned to the center;
    # that stretch is hidden under the disc, so leave it out of the fit.
    keep = (da > ar + TRIM_MARGIN) & (db > br + TRIM_MARGIN)
    return pts[keep]


# ---------------------------------------------------------------------------
# Bezier fitting


def bernstein(t):
    mt = 1 - t
    return np.column_stack([mt ** 3, 3 * mt ** 2 * t, 3 * mt * t ** 2, t ** 3])


def bezier_eval(ctrl, t):
    return bernstein(t) @ ctrl


def bezier_deriv(ctrl, t):
    mt = (1 - t)[:, None]
    t = t[:, None]
    d = 3 * np.diff(ctrl, axis=0)
    return mt ** 2 * d[0] + 2 * mt * t * d[1] + t ** 2 * d[2]


def bezier_deriv2(ctrl, t):
    d2 = 6 * np.diff(ctrl, n=2, axis=0)
    t = t[:, None]
    return (1 - t) * d2[0] + t * d2[1]


def chord_params(pts):
    seg = np.hypot(*np.diff(pts, axis=0).T)
    u = np.concatenate([[0], np.cumsum(seg)])
    return u / u[-1]


def reparameterize(ctrl, pts, t):
    for _ in range(3):
        diff = bezier_eval(ctrl, t) - pts
        d1 = bezier_deriv(ctrl, t)
        d2 = bezier_deriv2(ctrl, t)
        num = (diff * d1).sum(1)
        den = (d1 * d1).sum(1) + (diff * d2).sum(1)
        step = np.where(np.abs(den) > 1e-9, num / np.where(den == 0, 1, den), 0)
        t = np.clip(t - step, 0, 1)
    return t


def fit_segment(pts, p0, p3, tan0=None, tan3=None, iterations=12):
    """Least-squares cubic with fixed endpoints. Optional unit tangents constrain P1/P2 to a scalar along them."""
    all_pts = np.vstack([p0, pts, p3])
    t = chord_params(all_pts)
    for _ in range(iterations):
        basis = bernstein(t)
        rhs = all_pts - np.outer(basis[:, 0], p0) - np.outer(basis[:, 3], p3)
        cols, unpack = [], []
        if tan0 is None:
            cols += [np.column_stack([basis[:, 1], 0 * t]), np.column_stack([0 * t, basis[:, 1]])]
            unpack.append(('p1', 2))
        else:
            cols.append(np.outer(basis[:, 1], tan0))
            unpack.append(('a', 1))
        if tan3 is None:
            cols += [np.column_stack([basis[:, 2], 0 * t]), np.column_stack([0 * t, basis[:, 2]])]
            unpack.append(('p2', 2))
        else:
            cols.append(np.outer(basis[:, 2], tan3))
            unpack.append(('b', 1))
        mat = np.stack([c.reshape(-1) for c in cols], axis=1)
        sol, *_ = np.linalg.lstsq(mat, rhs.reshape(-1), rcond=None)
        i = 0
        p1 = p2 = None
        for kind, n in unpack:
            v = sol[i:i + n]
            i += n
            if kind == 'p1':
                p1 = v
            elif kind == 'a':
                p1 = p0 + max(v[0], 1.0) * tan0
            elif kind == 'p2':
                p2 = v
            else:
                p2 = p3 + max(v[0], 1.0) * tan3
        ctrl = np.array([p0, p1, p2, p3])
        t = reparameterize(ctrl, all_pts, t)
    return ctrl


def max_error(segments, pts):
    samples = np.vstack([bezier_eval(c, np.linspace(0, 1, 200)) for c in segments])
    d = np.hypot(pts[:, None, 0] - samples[None, :, 0], pts[:, None, 1] - samples[None, :, 1])
    return d.min(1).max()


def path_tangent(pts, i, window=25):
    lo, hi = max(0, i - window), min(len(pts) - 1, i + window)
    v = pts[hi] - pts[lo]
    return v / np.linalg.norm(v)


def fit_route(pts, p0, p3):
    sparse = pts[::4] if len(pts) > 8 else pts
    single = fit_segment(sparse, p0, p3)
    err = max_error([single], pts)
    if err <= SINGLE_SEGMENT_TOLERANCE or len(sparse) < 12:
        return [single], err
    best = ([single], err)
    for frac in np.linspace(0.3, 0.7, 9):
        j = int(frac * (len(pts) - 1))
        joint = pts[j]
        tangent = path_tangent(pts, j)
        first = fit_segment(pts[:j:4], p0, joint, tan3=-tangent)
        second = fit_segment(pts[j::4], joint, p3, tan0=tangent)
        e = max_error([first, second], pts)
        if e < best[1] - 0.5:
            best = ([first, second], e)
    return best


def to_path_d(segments):
    fmt = lambda p: f'{int(round(p[0]))} {int(round(p[1]))}'
    parts = [f'M {fmt(segments[0][0])}']
    for c in segments:
        parts.append(f'C {fmt(c[1])} {fmt(c[2])} {fmt(c[3])}')
    return ' '.join(parts)


# ---------------------------------------------------------------------------
# Output


def write_city_points(cities, offices):
    lines = [
        '/**',
        ' * GENERATED by scripts/trace-routes.py from docs/map-board-full.png. Do not hand-edit;',
        ' * re-run the script instead. Coordinates are in full board PNG pixels.',
        ' */',
        '',
        'export const BOARD_WIDTH = 6660;',
        'export const BOARD_HEIGHT = 4173;',
        '',
        'export interface BoardPoint {',
        '  x: number;',
        '  y: number;',
        '  /** Outer radius of the printed circle, including its ring. */',
        '  r: number;',
        '}',
        '',
        'export const CITY_POINTS: Record<string, BoardPoint> = {',
    ]
    for name in sorted(cities):
        x, y, r = cities[name]
        lines.append(f"  '{name}': {{ x: {x:.1f}, y: {y:.1f}, r: {r:.1f} }},")
    lines += [
        '};',
        '',
        '/** Discs in the printed Regional Offices panel, keyed by region code. */',
        'export const REGIONAL_OFFICE_POINTS: Record<string, BoardPoint> = {',
    ]
    for row in REGION_ORDER:
        for code in row:
            x, y, r = offices[code]
            lines.append(f'  {code}: {{ x: {x:.1f}, y: {y:.1f}, r: {r:.1f} }},')
    lines += ['};', '']
    (OUT_DIR / 'cityPoints.ts').write_text('\n'.join(lines), encoding='utf-8', newline='\n')


def read_edited_paths():
    """Routes already fixed up in /board/edit-paths; re-tracing must not overwrite them."""
    path = OUT_DIR / 'routePaths.ts'
    if not path.exists():
        return {}
    text = path.read_text(encoding='utf-8')
    block = re.search(r'EDITED_ROUTES[^=]*=\s*\[(.*?)\]', text, re.S)
    edited = set(re.findall(r"'([^']+)'", block.group(1))) if block else set()
    paths = dict(re.findall(r"^  '([^']+)': '(M [^']+)',$", text, re.M))
    return {key: paths[key] for key in edited if key in paths}


def write_route_paths(paths, flags, edited):
    """Keep this format in sync with formatRoutePathsFile in src/board/edit-paths/routePathsFile.ts."""
    lines = [
        '/**',
        ' * GENERATED by scripts/trace-routes.py, then fixed up with /board/edit-paths (dev only).',
        ' * Coordinates are in full board PNG pixels. Each value is "M x y C x y x y x y" with 1-2 C segments.',
        ' */',
        '',
        'export const ROUTE_PATHS: Record<string, string> = {',
    ]
    for key in sorted(paths):
        lines.append(f"  '{key}': '{paths[key]}',")
    lines += [
        '};',
        '',
        '/** Routes whose auto-trace looked unreliable, with the reason. Cleared per route once edited in /board/edit-paths. */',
        'export const FLAGGED_ROUTES: Record<string, string> = {',
    ]
    for key in sorted(flags):
        lines.append(f"  '{key}': '{flags[key]}',")
    lines += [
        '};',
        '',
        '/** Routes hand-edited in /board/edit-paths. scripts/trace-routes.py keeps these paths when re-run. */',
        'export const EDITED_ROUTES: readonly string[] = [',
    ]
    for key in sorted(edited):
        lines.append(f"  '{key}',")
    lines += ['];', '']
    (OUT_DIR / 'routePaths.ts').write_text('\n'.join(lines), encoding='utf-8', newline='\n')


def write_overlay(image, cities, offices, paths, flags, out_path):
    vis = image.copy()
    for key, segments in paths.items():
        color = (0, 0, 255) if key in flags else (255, 80, 0)
        pts = np.vstack([bezier_eval(c, np.linspace(0, 1, 80)) for c in segments]).astype(np.int32)
        cv2.polylines(vis, [pts], False, color, 7, cv2.LINE_AA)
        for c in segments:
            for p in c[1:3]:
                cv2.circle(vis, tuple(int(v) for v in p), 9, (0, 160, 0), -1)
    for name, (x, y, r) in {**cities, **offices}.items():
        cv2.circle(vis, (int(x), int(y)), int(r), (255, 0, 255), 4)
        cv2.putText(vis, name, (int(x + r + 6), int(y - r)), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (255, 0, 255), 4)
    cv2.imwrite(str(out_path), vis)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--overlay', help='write a debug overlay PNG (full resolution) to this path')
    args = parser.parse_args()

    image = cv2.imread(str(BOARD_PNG))
    if image is None:
        sys.exit(f'Could not read {BOARD_PNG}')
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    routes = read_routes()
    route_cities = {c for _, a, b in routes for c in (a, b)}
    estimates = {n: p for n, p in read_city_estimates().items() if n in route_cities}

    disks = detect_city_disks(gray)
    print(f'Detected {len(disks)} city disks for {len(estimates)} cities')
    cities = match_cities(estimates, disks)
    offices = detect_regional_offices(gray)

    cost, on_mask, stroke = build_cost(image)
    raw_paths, fits, flags = {}, {}, {}
    for key, a, b in routes:
        pts = trim_to_outside(trace_route(cost, cities, a, b), cities, a, b)
        if len(pts) < 4:
            flags[key] = 'trace failed'
            continue
        p0, p3 = np.array(cities[a][:2]), np.array(cities[b][:2])
        trace_len = np.hypot(*np.diff(pts, axis=0).T).sum() + cities[a][2] + cities[b][2] + 2 * TRIM_MARGIN
        if trace_len / np.linalg.norm(p3 - p0) > FLAG_DETOUR_RATIO or hugs_other_city(pts, cities, a, b):
            fits[key] = [np.array([p0, p0 + (p3 - p0) / 3, p0 + 2 * (p3 - p0) / 3, p3])]
            flags[key] = 'no stroke found in art; straight line'
            continue
        raw_paths[key] = pts
        ix, iy = pts[:, 0].astype(int), pts[:, 1].astype(int)
        # Fit and score only on the plain stroke; price pills and their digits are bridged approximately.
        on_stroke = pts[stroke[iy, ix]]
        segments, err = fit_route(on_stroke if len(on_stroke) >= 8 else pts, p0, p3)
        fits[key] = segments
        off = 1 - on_mask[iy, ix].mean()
        reasons = []
        if err > FLAG_FIT_ERROR:
            reasons.append(f'fit error {err:.0f}px')
        if off > FLAG_OFF_MASK_FRACTION:
            reasons.append(f'{off:.0%} off route art')
        if reasons:
            flags[key] = ', '.join(reasons)

    # Overlap: a trace that rides along another route's stroke probably took a wrong turn.
    owner = {}
    for key, pts in raw_paths.items():
        for p in {(int(x) // 6, int(y) // 6) for x, y in pts}:
            owner.setdefault(p, set()).add(key)
    for key, pts in raw_paths.items():
        cells = {(int(x) // 6, int(y) // 6) for x, y in pts}
        shared = sum(1 for c in cells if len(owner[c]) > 1) / len(cells)
        if shared > FLAG_OVERLAP_FRACTION:
            others = sorted({k for c in cells for k in owner[c]} - {key})
            msg = f'{shared:.0%} shared with {", ".join(others[:2])}'
            flags[key] = f'{flags[key]}, {msg}' if key in flags else msg

    edited = read_edited_paths()
    path_ds = {k: to_path_d(s) for k, s in fits.items()}
    path_ds.update(edited)
    for key in edited:
        flags.pop(key, None)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_city_points(cities, offices)
    write_route_paths(path_ds, flags, edited)
    print(f'Wrote {len(path_ds)} route paths ({len(flags)} flagged, {len(edited)} kept as hand-edited) and {len(cities)} city points to {OUT_DIR}')
    for key in sorted(flags):
        print(f'  flagged {key}: {flags[key]}')
    if args.overlay:
        write_overlay(image, cities, offices, fits, flags, args.overlay)
        print(f'Overlay: {args.overlay}')


if __name__ == '__main__':
    main()
