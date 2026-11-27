// Draft rulebook figures for Wood and Steel. Usage: node make-figures.mjs <repo root>
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const out = path.join(root, 'docs/rulebook/illustrations');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ---- data ------------------------------------------------------------------
const PTS = {};
for (const m of read('src/data/cityPoints.ts').matchAll(/'([^']+)': \{ x: ([\d.]+), y: ([\d.]+), r: ([\d.]+) \}/g))
  PTS[m[1]] = { x: +m[2], y: +m[3], r: +m[4] };
const ROUTES = [];
for (const m of read('src/data/routes.ts').matchAll(/\[ "([^"]+)", \{ "length": (\d), "mountainous": (\w+), cities: \["([^"]+)", "([^"]+)"\]/g))
  ROUTES.push({ key: m[1], length: +m[2], mountain: m[3] === 'true', a: m[4], b: m[5] });
const CITIES = {};
for (const m of read('src/data/cities.ts').matchAll(/\[ "([^"]+)", \{ .*?"region": "(\w\w)".*?"large": (\w+).*?"commodities": \[([^\]]*)\]/g))
  CITIES[m[1]] = { region: m[2], large: m[3] === 'true', commodities: [...m[4].matchAll(/"([^"]+)"/g)].map((x) => x[1]) };

const price = (r) => (r.length + 1) * 1000 * (r.mountain ? 2 : 1);
const routeOf = (a, b) => ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
const LABEL = { 'Saint Louis': 'St. Louis', 'Portland ME': 'Portland, Maine', 'Portland OR': 'Portland, Ore.' };
const label = (c) => LABEL[c] ?? c;

// ---- style -----------------------------------------------------------------
const C = {
  paper: '#f4efe4', ink: '#2f2a25', soft: '#8b8275', route: '#ffffff', routeEdge: '#b9b0a2',
  red: '#b8423a', blue: '#3d6fa8', green: '#4e8a4a', tan: '#b8996a', pink: '#c86f9c', indie: '#1f1f1f',
  stamp: '#b0412e', note: '#6b6257',
  NE: '#e7e2d6', SE: '#dfe6d8', NC: '#dfe6d8', SC: '#e7e2d6', NW: '#e7e2d6', SW: '#dfe6d8',
};
const GROUP = {
  Metals: ['aluminum', 'copper', 'lead', 'nickel', 'precious metals'],
  Mined: ['bauxite', 'coal', 'iron ore', 'oil'],
  Livestock: ['cattle', 'fish', 'pork', 'sheep'],
  Crops: ['cotton', 'fruit', 'grain', 'rice', 'tobacco', 'wood'],
  Finished: ['imports', 'machinery', 'steel', 'textiles', 'tourists', 'wine'],
};
const GROUP_COLOR = { Metals: '#2f78c4', Mined: '#2b2b2b', Livestock: '#d9822b', Crops: '#3f9142', Finished: '#7b3fb0' };
const groupOf = (c) => Object.keys(GROUP).find((g) => GROUP[g].includes(c));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FONT = `font-family="Georgia, 'Times New Roman', serif"`;

function svg(w, h, body, fig, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${FONT}>
<title>${esc(title)}</title>
<rect width="${w}" height="${h}" fill="${C.paper}"/>
${body}
<g transform="translate(${w - 12},18)"><text text-anchor="end" font-size="11" letter-spacing="1.5" fill="${C.stamp}" font-family="Arial, sans-serif" font-weight="bold">DRAFT · FIG. ${fig}</text></g>
</svg>\n`;
}
const t = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.size ?? 13}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? 'start'}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.italic ? ' font-style="italic"' : ''}${o.family ? ` font-family="${o.family}"` : ''}>${esc(s)}</text>`;
const callout = (x, y, s, fill = C.ink) =>
  `<g><circle cx="${x}" cy="${y}" r="11" fill="${fill}"/><text x="${x}" y="${y + 4.5}" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif">${esc(s)}</text></g>`;
const commodityDot = (x, y, c, r = 7) =>
  `<g><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${GROUP_COLOR[groupOf(c)]}" stroke-width="1.6"/><text x="${x}" y="${y + r * 0.45}" font-size="${r * 1.2}" fill="${GROUP_COLOR[groupOf(c)]}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">${c[0].toUpperCase()}</text></g>`;
const mountainIcon = (x, y, s = 1) =>
  `<path d="M${x - 9 * s},${y + 5 * s} L${x - 3 * s},${y - 5 * s} L${x},${y} L${x + 3 * s},${y - 4 * s} L${x + 9 * s},${y + 5 * s} Z" fill="#6d4a2f"/>`;
function engineToken(x, y, color, dark = false, s = 1) {
  const fill = dark ? color : lighten(color);
  return `<g transform="translate(${x},${y}) scale(${s})"><rect x="-15" y="-11" width="30" height="22" rx="5" fill="${fill}" stroke="${C.ink}" stroke-width="1.2"/>
<path d="M-10,4 h20 v-6 h-6 v-5 h-5 v5 h-5 v-3 h-4 z" fill="${dark ? '#fff' : C.ink}" opacity="0.85"/></g>`;
}
function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v + (255 - v) * 0.55);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

// ---- map crops -------------------------------------------------------------
let clipCount = 0;
/**
 * opts: cities (to fit), width, pad, extraCities (drawn if inside), routes: [{a,b,color,offset,dash}]
 * labels: {city: 'left'|'right'|'above'|'below'}, showPrices, showCommodities, regionLine
 */
function mapCrop(opts) {
  const fit = opts.cities.map((c) => PTS[c]);
  const minX = Math.min(...fit.map((p) => p.x)), maxX = Math.max(...fit.map((p) => p.x));
  const minY = Math.min(...fit.map((p) => p.y)), maxY = Math.max(...fit.map((p) => p.y));
  const pad = opts.pad ?? 220;
  const w = opts.width ?? 640;
  const s = (w - 2 * (opts.margin ?? 40)) / (maxX - minX + 2 * pad);
  const h = Math.round((maxY - minY + 2 * pad) * s + 2 * (opts.margin ?? 40)) + (opts.extraHeight ?? 0);
  const ox = (opts.margin ?? 40) - (minX - pad) * s, oy = (opts.margin ?? 40) + (opts.top ?? 0) - (minY - pad) * s;
  const P = (c) => ({ x: PTS[c].x * s + ox, y: PTS[c].y * s + oy });
  const inside = (c) => { const p = P(c); return p.x > -60 && p.x < w + 60 && p.y > -60 && p.y < h + 60; };
  let body = '';
  // base routes
  for (const r of ROUTES) {
    if (!inside(r.a) && !inside(r.b)) continue;
    const A = P(r.a), B = P(r.b);
    body += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${C.routeEdge}" stroke-width="9" stroke-linecap="round"/>`;
    body += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${C.route}" stroke-width="6" stroke-linecap="round"/>`;
  }
  if (opts.under) body += opts.under(P, s);
  // drawn track
  for (const tr of opts.routes ?? []) {
    const A = P(tr.a), B = P(tr.b);
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    const nx = (-dy / len) * (tr.offset ?? 0), ny = (dx / len) * (tr.offset ?? 0);
    body += `<line x1="${A.x + nx}" y1="${A.y + ny}" x2="${B.x + nx}" y2="${B.y + ny}" stroke="${tr.color}" stroke-width="${tr.width ?? 4}" stroke-linecap="round"${tr.dash ? ` stroke-dasharray="${tr.dash}"` : ''}/>`;
  }
  // prices
  if (opts.showPrices !== false) {
    for (const r of ROUTES) {
      if (!inside(r.a) || !inside(r.b)) continue;
      const A = P(r.a), B = P(r.b);
      const drawn = (opts.routes ?? []).some((d) => (d.a === r.a && d.b === r.b) || (d.a === r.b && d.b === r.a));
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      const off = drawn ? 18 : 0;
      const mx = (A.x + B.x) / 2 + (-(B.y - A.y) / len) * off, my = (A.y + B.y) / 2 + ((B.x - A.x) / len) * off;
      const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
      const a2 = ang > 90 ? ang - 180 : ang < -90 ? ang + 180 : ang;
      const p = `$${price(r) / 1000},000`;
      body += `<g transform="translate(${mx},${my}) rotate(${a2})"><rect x="-21" y="-7" width="42" height="14" rx="4" fill="#77706a"/><text y="4" font-size="9.5" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif">${p}</text>${r.mountain ? mountainIcon(0, -12, 0.8) : ''}</g>`;
    }
  }
  // cities
  for (const c of Object.keys(PTS)) {
    if (!inside(c)) continue;
    const p = P(c);
    const r = CITIES[c]?.large ? 9 : 6.5;
    body += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#fff" stroke="${C.ink}" stroke-width="2"/>`;
    const side = opts.labels?.[c] ?? 'right';
    const lx = side === 'left' ? p.x - 12 : side === 'right' ? p.x + 12 : p.x;
    const ly = side === 'above' ? p.y - 13 : side === 'below' ? p.y + 22 : p.y + 4.5;
    const anchor = side === 'left' ? 'end' : side === 'right' ? 'start' : 'middle';
    body += t(lx, ly, label(c), { size: 13, anchor });
    if (opts.showCommodities) {
      const list = CITIES[c]?.commodities ?? [];
      const est = label(c).length * 6.6;
      list.forEach((cm, i) => {
        const cx = side === 'left' ? lx - est - 10 - i * 17 : side === 'right' ? lx + est + 10 + i * 17 : p.x - ((list.length - 1) * 17) / 2 + i * 17;
        const cy = side === 'above' ? ly - 16 : side === 'below' ? ly + 14 : ly - 4.5;
        body += commodityDot(cx, cy, cm);
      });
    }
  }
  if (opts.over) body += opts.over(P, s);
  const id = `clip${++clipCount}`;
  const mapH = h - (opts.extraHeight ?? 0);
  body = `<defs><clipPath id="${id}"><rect width="${w}" height="${mapH}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g>`;
  return { w, h, body, P };
}

const files = {};

// ---- Fig 0: cover placeholder ---------------------------------------------
files['fig-00-cover.svg'] = svg(900, 420, `
<rect x="20" y="30" width="860" height="370" fill="none" stroke="${C.soft}" stroke-width="1.5" stroke-dasharray="6 5"/>
<path d="M60,330 C220,250 380,300 520,240 S760,170 840,150" fill="none" stroke="${C.soft}" stroke-width="2"/>
<g fill="none" stroke="${C.ink}" stroke-width="2">
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${280 + i * 50},300 v-${40 + i * 3} m-25,0 h50"/>`).join('')}
  <path d="M250,258 L600,236"/>
</g>
<g transform="translate(420,214)">
  <rect x="-70" y="-30" width="120" height="40" rx="6" fill="${C.ink}"/>
  <rect x="50" y="-48" width="45" height="58" rx="4" fill="${C.ink}"/>
  <rect x="-58" y="-62" width="16" height="32" fill="${C.ink}"/>
  <path d="M-75,10 l-22,22 h26 z" fill="${C.ink}"/>
  ${[-40, -5, 30, 70].map((x) => `<circle cx="${x}" cy="20" r="${x > 60 ? 11 : 15}" fill="#fff" stroke="${C.ink}" stroke-width="3"/>`).join('')}
  <path d="M-52,-66 c-6,-18 20,-26 14,-44 c24,6 50,-6 76,-14" fill="none" stroke="${C.soft}" stroke-width="8" stroke-linecap="round" opacity="0.6"/>
</g>
${t(450, 82, 'WOOD AND STEEL', { size: 40, anchor: 'middle', weight: 'bold' })}
${t(450, 372, 'Cover art brief: a 4-4-0 American crossing a timber trestle at dawn; the continent and its routes fading to the west.', { size: 13, anchor: 'middle', italic: true, fill: C.note })}
`, 0, 'Cover placeholder');

// ---- Fig 1: loop -----------------------------------------------------------
{
  const cx = 450, cy = 215, R = 140;
  const steps = [
    ['Deliver', 'Run engines, pick up', 'and fulfill Contracts'],
    ['Earn', 'Cash and', 'Railroad Ties'],
    ['Invest', 'Track, engines,', 'Upgrades (or borrow)'],
    ['Reach farther', 'Bigger Contracts', 'across more Regions'],
  ];
  let b = '';
  b += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.soft}" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>`;
  steps.forEach((st, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    const x = cx + R * Math.cos(a) * 1.55, y = cy + R * Math.sin(a);
    b += `<rect x="${x - 95}" y="${y - 38}" width="190" height="76" rx="10" fill="#fff" stroke="${C.ink}" stroke-width="1.5"/>`;
    b += t(x, y - 12, st[0], { size: 18, anchor: 'middle', weight: 'bold' });
    b += t(x, y + 9, st[1], { size: 12.5, anchor: 'middle', fill: C.note });
    b += t(x, y + 26, st[2], { size: 12.5, anchor: 'middle', fill: C.note });
    // arrow toward next
    const a2 = a + Math.PI / 4;
    const ax = cx + R * Math.cos(a2) * 1.2, ay = cy + R * Math.sin(a2) * 1.0;
    const deg = (a2 * 180) / Math.PI + 90;
    b += `<g transform="translate(${ax},${ay}) rotate(${deg})"><path d="M-10,-6 L10,0 L-10,6 Z" fill="${C.red}"/></g>`;
  });
  b += t(cx, cy - 4, 'Two Actions', { size: 15, anchor: 'middle', weight: 'bold' });
  b += t(cx, cy + 16, 'a turn', { size: 13, anchor: 'middle', fill: C.note });
  b += t(cx, 410, 'Between rounds, Independent Railroads grow and the Market changes.', { size: 13, anchor: 'middle', italic: true, fill: C.note });
  files['fig-01-loop.svg'] = svg(900, 430, b, 1, 'The game loop');
}

// ---- Fig 2: components -----------------------------------------------------
{
  let b = '';
  const box = (x, y, w, h, letter, title, sub) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#fff" stroke="${C.soft}"/>${callout(x + 18, y + 18, letter)}${t(x + 36, y + 23, title, { size: 14, weight: 'bold' })}${sub ? t(x + 12, y + h - 12, sub, { size: 11.5, fill: C.note, italic: true }) : ''}`;
  // A map
  b += box(20, 40, 420, 250, 'A', 'Map board', 'Cities, Routes, Regions and Regional Office spaces');
  const m = mapCrop({ cities: Object.keys(PTS), width: 400, pad: 60, margin: 10, showPrices: false });
  b += `<g transform="translate(65,62)"><svg viewBox="0 0 ${m.w} ${m.h}" width="320" height="${(320 * m.h) / m.w}">${m.body.replace(/<text[^>]*>[^<]*<\/text>/g, '')}</svg></g>`;
  // B black marker
  b += box(460, 40, 200, 120, 'B', 'Black marker', 'Independent Railroads');
  b += `<g transform="translate(490,105) rotate(-12)"><rect width="120" height="18" rx="5" fill="${C.indie}"/><path d="M120,3 l20,6 l-20,6 z" fill="${C.indie}"/><rect x="-14" y="2" width="16" height="14" rx="3" fill="#555"/></g>`;
  // F phone
  b += box(680, 40, 200, 250, 'F', 'App (your phone)', 'One device per player');
  b += `<rect x="725" y="72" width="110" height="190" rx="14" fill="${C.ink}"/><rect x="732" y="84" width="96" height="166" rx="6" fill="#fbfaf7"/>`;
  b += t(740, 102, '$22K  Debt $10K', { size: 9.5, family: 'Arial, sans-serif' });
  b += `<rect x="738" y="110" width="84" height="18" rx="3" fill="#eee"/>${t(742, 123, 'Home', { size: 10, family: 'Arial, sans-serif', weight: 'bold' })}`;
  for (let i = 0; i < 5; i++) b += `<rect x="738" y="${136 + i * 20}" width="84" height="14" rx="3" fill="${i < 2 ? '#e7efe4' : '#f0ebe0'}"/>`;
  b += `<rect x="738" y="236" width="40" height="10" rx="2" fill="#d8d2c6"/><rect x="782" y="236" width="40" height="10" rx="2" fill="${C.ink}"/>`;
  // per player
  b += t(20, 325, 'For each player (blue, tan, green, pink, red)', { size: 15, weight: 'bold' });
  b += box(20, 340, 270, 140, 'C', '2 engine tokens', 'Light token and dark token');
  b += engineToken(100, 410, C.red, false, 1.8) + engineToken(200, 410, C.red, true, 1.8);
  b += box(310, 340, 230, 140, 'D', 'Marker in your color', 'Draws your track');
  b += `<g transform="translate(345,415) rotate(-12)"><rect width="120" height="18" rx="5" fill="${C.red}"/><path d="M120,3 l20,6 l-20,6 z" fill="${C.red}"/></g>`;
  b += box(560, 340, 320, 140, 'E', '3 discs', 'Placed on the map when bought');
  [['HUB', 620], ['RAIL\nYARD', 715], ['REG.\nOFFICE', 810]].forEach(([s, x]) => {
    b += `<circle cx="${x}" cy="410" r="32" fill="${C.red}" stroke="${C.ink}"/>`;
    s.split('\n').forEach((line, i, arr) => (b += t(x, 414 + (i - (arr.length - 1) / 2) * 14, line, { size: 12, anchor: 'middle', fill: '#fff', weight: 'bold', family: 'Arial, sans-serif' })));
  });
  files['fig-02-components.svg'] = svg(900, 500, b, 2, 'Components');
}

// ---- Fig 3: setup ----------------------------------------------------------
{
  const starts = [['Montreal', 'Quebec City'], ['Boston', 'Portland ME'], ['New York', 'Philadelphia'], ['Philadelphia', 'Washington'], ['Norfolk', 'Raleigh'], ['Charleston', 'Savannah']];
  const chosen = { 'New York|Philadelphia': C.red, 'Norfolk|Raleigh': C.blue, 'Boston|Portland ME': C.green };
  const indies = [['Duluth', 'Thunder Bay'], ['Thunder Bay', 'Winnipeg'], ['Kansas City', 'Omaha'], ['Dallas', 'Houston'], ['Seattle', 'Portland OR'], ['Phoenix', 'San Diego'], ['Memphis', 'Saint Louis'], ['Denver', 'Omaha'], ['Atlanta', 'Birmingham'], ['Bismarck', 'Fargo']];
  const indieRoutes = indies.map(([a, b2]) => ({ a, b: b2, color: C.indie, width: 4 }));
  // Left: the whole continent, with the Independent Railroads
  const L = mapCrop({ cities: Object.keys(PTS), width: 540, pad: 80, margin: 14, routes: indieRoutes, showPrices: false });
  const Lclean = L.body.replace(/<text[^>]*>[^<]*<\/text>/g, '');
  // East Coast inset frame on the left panel
  const eastCities = ['Quebec City', 'Montreal', 'Portland ME', 'Boston', 'New York', 'Philadelphia', 'Washington', 'Norfolk', 'Raleigh', 'Charleston', 'Savannah'];
  const ex = eastCities.map((c) => L.P(c));
  const fx0 = Math.min(...ex.map((p) => p.x)) - 14, fx1 = Math.max(...ex.map((p) => p.x)) + 14;
  const fy0 = Math.min(...ex.map((p) => p.y)) - 14, fy1 = Math.max(...ex.map((p) => p.y)) + 14;
  // Right: East Coast inset with the Starting Routes
  const routes = starts.map(([a, b2]) => {
    const col = chosen[`${a}|${b2}`];
    return { a, b: b2, color: col ?? '#9a9184', width: col ? 6 : 3, dash: col ? null : '5 4' };
  });
  const R = mapCrop({
    cities: eastCities, width: 330, pad: 120, margin: 14, routes, showPrices: false,
    labels: { 'New York': 'right', Philadelphia: 'left', Washington: 'left', Norfolk: 'right', Raleigh: 'left', Boston: 'right', 'Portland ME': 'above', Montreal: 'left', 'Quebec City': 'left', Charleston: 'right', Savannah: 'left', Syracuse: 'left', Pittsburgh: 'left', Atlanta: 'left', Ottawa: 'left', Toronto: 'left', Tallahassee: 'left', Tampa: 'left' },
    over: (P) => {
      let o = '';
      o += engineToken(P('New York').x + 22, P('New York').y - 18, C.red, false, 0.75);
      o += engineToken(P('Norfolk').x + 24, P('Norfolk').y - 18, C.blue, false, 0.75);
      o += engineToken(P('Boston').x + 22, P('Boston').y - 20, C.green, false, 0.75);
      o += callout(P('Raleigh').x + 34, P('Raleigh').y + 16, 'B');
      o += callout(P('New York').x + 50, P('New York').y - 34, 'C');
      return o;
    },
  });
  const rx = 560, ry = 30;
  let b = '';
  b += `<g transform="translate(0,30)">${Lclean}<rect x="${fx0}" y="${fy0}" width="${fx1 - fx0}" height="${fy1 - fy0}" fill="none" stroke="${C.red}" stroke-width="1.5" stroke-dasharray="4 3"/>${callout(26, 26, 'A')}${callout(L.P('Duluth').x + 26, L.P('Duluth').y - 20, 'D')}</g>`;
  b += `<line x1="${fx1}" y1="${fy0 + 30}" x2="${rx}" y2="${ry + 10}" stroke="${C.red}" stroke-width="1" stroke-dasharray="4 3"/>`;
  b += `<g transform="translate(${rx},${ry})"><rect width="${R.w}" height="${R.h}" fill="none" stroke="${C.red}" stroke-width="1.5"/>${R.body}</g>`;
  const by = 30 + L.h + 24;
  const legend = [
    ['A', 'Map board in the middle of the table.'],
    ['B', 'Starting Routes drawn in each player\'s color. Dashed grey: not taken.'],
    ['C', 'Each player\'s light engine token on one of their two Cities.'],
    ['D', 'Independent Railroads, drawn in black by the host.'],
  ];
  legend.forEach(([k, s], i) => (b += callout(30, by + i * 26, k) + t(50, by + 5 + i * 26, s, { size: 13 })));
  const ay = by + 4 * 26 + 10;
  b += `<rect x="20" y="${ay}" width="300" height="100" rx="10" fill="#fff" stroke="${C.soft}"/>${callout(40, ay + 18, 'E')}`;
  b += t(58, ay + 23, 'Each player\'s app', { size: 13, weight: 'bold' });
  b += t(36, ay + 46, '$10,000 Cash · $0 Debt', { size: 12.5 });
  b += t(36, ay + 66, 'Light token: 2-4-0 John Bull', { size: 12.5 });
  b += t(36, ay + 86, 'One Private Contract, kept secret', { size: 12.5 });
  files['fig-03-setup.svg'] = svg(900, Math.max(ay + 116, ry + R.h + 16), b, 3, 'Setup for three players');
}

// ---- Fig 4: map anatomy ----------------------------------------------------
{
  const m = mapCrop({
    cities: ['Pittsburgh', 'Philadelphia', 'Washington', 'Cleveland', 'New York'], width: 760, pad: 230, showCommodities: true,
    labels: { Philadelphia: 'right', Washington: 'right', Pittsburgh: 'above', Cleveland: 'above', 'New York': 'above', Cincinnati: 'left', Norfolk: 'right', Raleigh: 'left' },
    under: (P) => {
      // NE/SE border between Philadelphia and Washington (schematic)
      const a = P('Philadelphia'), b2 = P('Washington');
      const my = (a.y + b2.y) / 2 + 6;
      return `<path d="M${a.x - 420},${my + 60} L${a.x + 220},${my - 40}" stroke="#7a7264" stroke-width="2" stroke-dasharray="10 6" fill="none"/>`;
    },
    over: (P) => {
      let o = '';
      const ph = P('Philadelphia'), pi = P('Pittsburgh'), wa = P('Washington'), ny = P('New York');
      o += callout(pi.x - 22, pi.y + 24, '1') + callout(pi.x + 40, pi.y - 44, '2');
      const mid = { x: (ph.x + pi.x) / 2, y: (ph.y + pi.y) / 2 };
      o += callout(mid.x, mid.y + 26, '3');
      const mid2 = { x: (ny.x + ph.x) / 2, y: (ny.y + ph.y) / 2 };
      o += callout(mid2.x + 32, mid2.y + 8, '4');
      o += callout(wa.x - 120, wa.y - 32, '5');
      return o;
    },
  });
  let b = m.body;
  const leg = [
    ['1', 'City. A bigger circle is a large City.'],
    ['2', 'Commodities the City supplies (here, Coal and Steel).'],
    ['3', 'Mountain Route: the mountain marks it; its price is already doubled.'],
    ['4', 'Route with its build price.'],
    ['5', 'Region border (Northeast above, Southeast below).'],
  ];
  const ly = m.h + 10;
  leg.forEach(([n, s], i) => (b += callout(40, ly + i * 26, n) + t(60, ly + 5 + i * 26, s, { size: 13 })));
  b += t(40, ly + 5 * 26 + 8, 'Draft: commodity icons are stand-ins for the board\'s printed icons.', { size: 11, fill: C.note, italic: true });
  files['fig-04-map-anatomy.svg'] = svg(m.w, m.h + 150, b, 4, 'Reading the map');
}

// ---- Fig 5: regions --------------------------------------------------------
{
  let b = '';
  const cols = ['West', 'Central', 'East'], rows = ['North', 'South'];
  const names = [['Northwest', 'North Central', 'Northeast'], ['Southwest', 'South Central', 'Southeast']];
  const ties = [[4, 3, 2], [3, 2, 1]];
  const band = ['#e4d3c8', '#e9e1c8', '#dfe8d8'];
  const x0 = 120, y0 = 90, cw = 200, ch = 120;
  cols.forEach((c, i) => {
    b += `<rect x="${x0 + i * cw}" y="${y0 - 34}" width="${cw}" height="${ch * 2 + 34}" fill="${band[i]}"/>`;
    b += t(x0 + i * cw + cw / 2, y0 - 12, `${c}`, { size: 14, anchor: 'middle', weight: 'bold' });
  });
  rows.forEach((r, j) =>
    cols.forEach((c, i) => {
      const x = x0 + i * cw, y = y0 + j * ch;
      const dest = i === 2 && j === 1;
      b += `<rect x="${x + 8}" y="${y + 8}" width="${cw - 16}" height="${ch - 16}" rx="8" fill="${dest ? '#fff' : '#fffdf8'}" stroke="${dest ? C.red : C.soft}" stroke-width="${dest ? 3 : 1}"/>`;
      b += t(x + cw / 2, y + 34, names[j][i], { size: 14, anchor: 'middle' });
      b += t(x + cw / 2, y + 80, dest ? 'Destination' : `${ties[j][i]}`, { size: dest ? 15 : 34, anchor: 'middle', weight: 'bold', fill: dest ? C.red : C.ink });
      if (dest) b += t(x + cw / 2, y + 100, 'same Region: 1', { size: 12, anchor: 'middle', fill: C.note });
    })
  );
  b += t(450, 34, 'Railroad Ties for delivering to the Southeast, by where the Commodity comes from', { size: 14, anchor: 'middle', weight: 'bold' });
  // debt service key
  const ky = y0 + 2 * ch + 40;
  b += t(120, ky, 'Debt Service, by where you deliver', { size: 14, weight: 'bold' });
  const dk = [['West', 'Due on your first delivery here and every delivery after, anywhere'], ['Central', 'Due once, on your first delivery here'], ['East', 'Not due, unless you have already delivered to the West']];
  dk.forEach(([c, s], i) => {
    b += `<rect x="120" y="${ky + 14 + i * 28}" width="18" height="18" fill="${band[i]}" stroke="${C.soft}"/>`;
    b += t(148, ky + 28 + i * 28, `${c}: ${s}`, { size: 13 });
  });
  files['fig-05-regions.svg'] = svg(900, ky + 110, b, 5, 'Regions, Railroad Ties and Debt Service');
}

// ---- Fig 6: turn -----------------------------------------------------------
{
  let b = '';
  const box = (x, y, w, h, title, lines, fill = '#fff', stroke = C.ink) => {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${t(x + w / 2, y + 26, title, { size: 16, anchor: 'middle', weight: 'bold' })}`;
    lines.forEach((l, i) => (s += t(x + 16, y + 50 + i * 19, l, { size: 12.5 })));
    return s;
  };
  const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2 - 8}" y2="${y2}" stroke="${C.ink}" stroke-width="2"/><path d="M${x2},${y2} l-10,-6 v12 z" fill="${C.ink}"/>`;
  b += box(20, 50, 250, 230, '1 · Action', ['Run Trains', 'Build Track', 'Buy an Engine', 'Buy an Upgrade', 'Acquire an Indep. Railroad', 'Borrow Money · Repay Debt', 'Discard and Draw a New Contract']);
  b += arrow(270, 165, 320, 165);
  b += box(320, 50, 250, 230, '2 · Action', ['Any Action except one', 'you already took this turn', '', 'Run Trains may be taken', 'twice: each Engine still', 'runs only once per turn.']);
  b += arrow(570, 165, 620, 165);
  b += box(620, 110, 150, 110, '3 · End Turn', ['Press End Turn', 'in the app'], C.ink === '' ? '' : '#f3ece0');
  b += box(20, 300, 750, 92, 'Free Actions — any time in your turn, between or during Actions', ['Pick up a Commodity  ·  Claim a Market Contract (with a Mogul or better)  ·  Record Cargo in the app  ·  Undo', '', ], '#eef3ea', C.green);
  b += t(785, 170, '→ next player', { size: 12, fill: C.note });
  b += t(20, 30, 'Up to two Actions. You may take fewer.', { size: 13, italic: true, fill: C.note });
  files['fig-06-turn.svg'] = svg(900, 410, b, 6, 'A turn at a glance');
}

// ---- Fig 7: run trains -----------------------------------------------------
{
  const m = mapCrop({
    cities: ['Boston', 'New York', 'Philadelphia'], width: 640, pad: 200, showCommodities: true,
    routes: [{ a: 'New York', b: 'Philadelphia', color: C.red }, { a: 'New York', b: 'Boston', color: C.red }],
    labels: { Boston: 'right', 'New York': 'left', Philadelphia: 'left', Syracuse: 'above', 'Portland ME': 'right', Washington: 'left', Pittsburgh: 'left' },
    over: (P) => {
      const bo = P('Boston'), ny = P('New York'), ph = P('Philadelphia');
      let o = engineToken(bo.x + 6, bo.y - 30, C.red, false, 1);
      o += `<path d="M${bo.x - 10},${bo.y + 12} Q${(bo.x + ny.x) / 2 + 20},${(bo.y + ny.y) / 2 + 40} ${ny.x + 8},${ny.y + 14} Q${(ny.x + ph.x) / 2 + 10},${(ny.y + ph.y) / 2 + 40} ${ph.x + 10},${ph.y + 12}" fill="none" stroke="${C.red}" stroke-width="2.5" stroke-dasharray="7 5"/>`;
      o += `<path d="M${ph.x + 10},${ph.y + 12} l12,-4 l-4,12 z" fill="${C.red}"/>`;
      o += callout(bo.x + 34, bo.y - 30, '1') + callout(ny.x + 34, ny.y + 30, '2') + callout(ph.x - 30, ph.y + 28, '3');
      return o;
    },
  });
  let b = m.body;
  b += `<rect x="${m.w - 250}" y="${m.h - 96}" width="230" height="78" rx="8" fill="#fff" stroke="${C.soft}"/>`;
  b += t(m.w - 238, m.h - 74, 'Private Contract', { size: 11, fill: C.note });
  b += t(m.w - 238, m.h - 54, 'Machinery → Philadelphia', { size: 14, weight: 'bold' });
  b += t(m.w - 238, m.h - 32, '$6,000 · 1 Railroad Tie', { size: 13 });
  files['fig-07-run-trains.svg'] = svg(m.w, m.h, b, 7, 'Run Trains example');
}

// ---- Fig 8: debt service ---------------------------------------------------
{
  let b = '';
  const stops = [
    ['Boston', 'Northeast', 'East', '$0', '#dfe8d8'],
    ['Atlanta', 'Southeast', 'East', '$0', '#dfe8d8'],
    ['Cleveland', 'North Central', 'first Central', '$3,000', '#e9e1c8'],
    ['Kansas City', 'South Central', 'Central again', '$0', '#e9e1c8'],
    ['Denver', 'Southwest', 'first West', '$3,000', '#e4d3c8'],
    ['Boston', 'Northeast', 'after the West', '$3,000', '#e4d3c8'],
  ];
  b += t(30, 40, 'Green has $15,000 Debt: Debt Service is $3,000 when due.', { size: 15, weight: 'bold' });
  b += `<line x1="70" y1="150" x2="850" y2="150" stroke="${C.ink}" stroke-width="3"/>`;
  stops.forEach(([city, region, why, due, fill], i) => {
    const x = 90 + i * 150;
    b += `<rect x="${x - 66}" y="70" width="132" height="54" rx="8" fill="${fill}" stroke="${C.soft}"/>`;
    b += t(x, 92, city, { size: 14, anchor: 'middle', weight: 'bold' });
    b += t(x, 112, region, { size: 11.5, anchor: 'middle', fill: C.note });
    b += `<circle cx="${x}" cy="150" r="9" fill="#fff" stroke="${C.ink}" stroke-width="2.5"/>`;
    b += t(x, 182, due, { size: 20, anchor: 'middle', weight: 'bold', fill: due === '$0' ? C.green : C.red });
    b += t(x, 202, why, { size: 11.5, anchor: 'middle', fill: C.note });
  });
  b += t(30, 240, 'Deliveries in order, left to right. After the first Western delivery, every delivery pays.', { size: 12.5, italic: true, fill: C.note });
  files['fig-08-debt-service.svg'] = svg(900, 260, b, 8, 'Debt Service example');
}

// ---- Fig 9: build track ----------------------------------------------------
{
  const m = mapCrop({
    cities: ['Philadelphia', 'Pittsburgh', 'Cleveland', 'New York'], width: 700, pad: 210,
    routes: [
      { a: 'New York', b: 'Philadelphia', color: C.red },
      { a: 'Philadelphia', b: 'Pittsburgh', color: C.blue, offset: -5 },
      { a: 'Philadelphia', b: 'Pittsburgh', color: C.red, offset: 5, dash: '10 5' },
      { a: 'Pittsburgh', b: 'Cleveland', color: C.red, dash: '10 5' },
    ],
    labels: { Philadelphia: 'below', Pittsburgh: 'below', Cleveland: 'above', 'New York': 'right', Washington: 'left', Detroit: 'left', Syracuse: 'above', Cincinnati: 'left' },
  });
  let b = m.body;
  const bx = 20, by = m.h + 6;
  b += t(bx, by + 18, 'Red builds (dashed):', { size: 14, weight: 'bold' });
  b += t(bx, by + 40, 'Philadelphia – Pittsburgh   $6,000 printed (Mountain) + $2,000 parallel to Blue  =  $8,000', { size: 13 });
  b += t(bx, by + 60, 'Pittsburgh – Cleveland       $2,000 printed; touches the Route above, so it may be built  =  $2,000', { size: 13 });
  b += t(bx, by + 84, 'Total $10,000.   With a Hub in Philadelphia: $7,000 + $1,000 = $8,000.', { size: 13, weight: 'bold' });
  files['fig-09-build-track.svg'] = svg(m.w, m.h + 104, b, 9, 'Build Track example');
}

// ---- Fig 10: engine ladder ---------------------------------------------------
{
  const eng = [['2-4-0 John Bull', 1, 'start'], ['4-4-0 American', 2, 5], ['2-6-0 Mogul', 3, 7], ['2-8-0 Consolidation', 4, 10], ['2-6-2 Prairie', 5, 14], ['4-6-2 Pacific', 7, 18], ['2-8-2 Mikado', 8, 22], ['4-8-2 Mountain', 9, 26], ['4-6-6-4 Challenger', 11, 30]];
  let b = t(30, 40, 'Range (Routes per run) and price', { size: 15, weight: 'bold' });
  const x0 = 210, unit = 52;
  eng.forEach(([n, r, p], i) => {
    const y = 64 + i * 38;
    b += t(x0 - 12, y + 18, n, { size: 13, anchor: 'end' });
    b += `<rect x="${x0}" y="${y}" width="${r * unit}" height="26" rx="4" fill="${i >= 7 ? C.tan : i === 2 ? C.blue : '#8b8275'}"/>`;
    for (let k = 1; k < r; k++) b += `<line x1="${x0 + k * unit}" y1="${y + 4}" x2="${x0 + k * unit}" y2="${y + 22}" stroke="#fff" stroke-opacity="0.5"/>`;
    b += t(x0 + 8, y + 18, `${r}`, { size: 13, fill: '#fff', weight: 'bold' });
    b += t(x0 + r * unit + 10, y + 18, p === 'start' ? 'start of game' : `$${p},000`, { size: 13 });
  });
  b += t(30, 64 + 9 * 38 + 16, 'Blue: opens the Market and lets you claim Market Contracts.  Tan: Contracts it fulfills pay 1⅓×.', { size: 12, fill: C.note, italic: true });
  b += t(30, 64 + 9 * 38 + 34, 'You may buy only the next step above your best Engine (two steps with a Hub, for $5,000 more).', { size: 12, fill: C.note, italic: true });
  files['fig-10-engine-ladder.svg'] = svg(900, 64 + 9 * 38 + 52, b, 10, 'Engine ladder');
}

// ---- Fig 11: acquire -------------------------------------------------------
{
  const m = mapCrop({
    cities: ['Duluth', 'Thunder Bay', 'Winnipeg', 'Minneapolis'], width: 660, pad: 200, extraHeight: 34,
    routes: [
      { a: 'Minneapolis', b: 'Duluth', color: C.green },
      { a: 'Des Moines', b: 'Minneapolis', color: C.green },
      { a: 'Duluth', b: 'Thunder Bay', color: C.indie, width: 5 },
      { a: 'Thunder Bay', b: 'Winnipeg', color: C.indie, width: 5 },
    ],
    labels: { Duluth: 'right', 'Thunder Bay': 'above', Winnipeg: 'left', Minneapolis: 'left', Fargo: 'left', Milwaukee: 'right', 'Des Moines': 'left', Sudbury: 'above', Regina: 'above', Bismarck: 'left' },
    over: (P) => {
      const tb = P('Thunder Bay'), wi = P('Winnipeg');
      return `<g transform="translate(${(tb.x + wi.x) / 2 + 40},${(tb.y + wi.y) / 2 + 70})"><rect x="-90" y="-16" width="180" height="40" rx="6" fill="#fff" stroke="${C.indie}"/>${t(0, 0, 'Lake Superior & Northern', { size: 12, anchor: 'middle', weight: 'bold' })}${t(0, 16, '2 Routes × $3,000 = $6,000', { size: 11.5, anchor: 'middle' })}</g>`;
    },
  });
  let b = m.body + t(20, m.h - 14, 'Green\'s track (green) reaches Duluth, a City of the railroad (black). Green may acquire it: +1 Railroad Tie.', { size: 12.5, italic: true, fill: C.note });
  files['fig-11-acquire.svg'] = svg(m.w, m.h, b, 11, 'Acquire an Independent Railroad example');
}

// ---- Fig 12: upgrades ------------------------------------------------------
{
  const ups = [
    ['Service Yard', '$10,000', 'Consolidation and better: +1 Range', 'Once anyone owns a Consolidation'],
    ['Upgraded Stations', '$10,000', '+$3,000 every delivery', ''],
    ['Roundhouse', '$10,000', 'Relay a Commodity between your Engines', ''],
    ['Employment Office', '$10,000', 'Build 3 Routes per Action', ''],
    ['Railyard', '$10,000', 'One City supplies all within 2 Routes', 'Disc on the map'],
    ['Hub', '$15,000', 'Engine skip, extra offer, track discount', 'Disc on the map'],
    ['Timetable', '$15,000', 'Keep moving after a delivery', ''],
    ['Regional Office', '$20,000', '+2 Ties at end; extra offer', '5 Cities in a Region nobody else is in'],
    ['Commodities Exchange', '$20,000', 'Monopoly: 2–4 Ties at end', 'Reach every City supplying it'],
  ];
  let b = '';
  ups.forEach(([n, p, e, c], i) => {
    const x = 20 + (i % 3) * 290, y = 40 + Math.floor(i / 3) * 140;
    b += `<rect x="${x}" y="${y}" width="270" height="124" rx="6" fill="#fffdf6" stroke="${C.ink}" stroke-width="1.2"/><rect x="${x + 5}" y="${y + 5}" width="260" height="114" rx="4" fill="none" stroke="${C.soft}" stroke-dasharray="3 3"/>`;
    b += t(x + 135, y + 30, n.toUpperCase(), { size: 13.5, anchor: 'middle', weight: 'bold' });
    b += t(x + 135, y + 54, p, { size: 18, anchor: 'middle', fill: C.red, weight: 'bold' });
    b += t(x + 135, y + 80, e, { size: 12, anchor: 'middle' });
    if (c) b += t(x + 135, y + 104, c, { size: 11, anchor: 'middle', fill: C.note, italic: true });
  });
  files['fig-12-upgrades.svg'] = svg(900, 470, b, 12, 'Upgrades as deeds');
}

// ---- Fig 13: roundhouse ----------------------------------------------------
{
  const m = mapCrop({
    cities: ['Pittsburgh', 'Cincinnati', 'Saint Louis', 'Chicago', 'Kansas City', 'Omaha'], width: 820, pad: 170,
    routes: [
      ['Pittsburgh', 'Cincinnati'], ['Cincinnati', 'Saint Louis'], ['Chicago', 'Saint Louis'], ['Saint Louis', 'Kansas City'], ['Kansas City', 'Omaha'],
    ].map(([a, b2]) => ({ a, b: b2, color: C.red })),
    showPrices: false,
    labels: { Pittsburgh: 'right', Cincinnati: 'left', 'Saint Louis': 'below', Chicago: 'right', 'Kansas City': 'below', Omaha: 'left', 'Des Moines': 'above', Cleveland: 'above', Memphis: 'below', Detroit: 'above', Milwaukee: 'left' },
    over: (P) => {
      const pi = P('Pittsburgh'), sl = P('Saint Louis'), ch = P('Chicago'), om = P('Omaha');
      const ci = P('Cincinnati'), kc = P('Kansas City');
      const path = (pts, col, dash) => `<polyline points="${pts.map((p) => `${p.x},${p.y + 14}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-dasharray="${dash}"/>`;
      let o = path([pi, ci, sl], '#e08a83', '7 5') + path([ch, sl], C.ink, '3 4') + path([sl, kc, om], C.ink, '7 5');
      o += engineToken(pi.x + 4, pi.y - 26, C.red, false, 0.9) + engineToken(ch.x - 34, ch.y - 4, C.red, true, 0.9);
      o += callout((pi.x + ci.x) / 2 + 14, (pi.y + ci.y) / 2 + 34, '1');
      o += callout((ch.x + sl.x) / 2 + 22, (ch.y + sl.y) / 2, '2');
      o += callout((sl.x + om.x) / 2, (sl.y + om.y) / 2 + 34, '3');
      return o;
    },
  });
  let b = m.body;
  b += t(20, m.h + 8, '1  American (light token, Range 2) carries Steel: Pittsburgh → Cincinnati → St. Louis.', { size: 13 });
  b += t(20, m.h + 28, '2  Empty Mogul (dark token) moves Chicago → St. Louis (1 Route; at most 4) and takes the Steel.', { size: 13 });
  b += t(20, m.h + 48, '3  The Mogul runs normally, Range 3: St. Louis → Kansas City → Omaha, and delivers.', { size: 13 });
  files['fig-13-roundhouse.svg'] = svg(m.w, m.h + 64, b, 13, 'Roundhouse example');
}

// ---- Fig 14: round report --------------------------------------------------
{
  let b = '';
  b += `<rect x="300" y="30" width="300" height="520" rx="30" fill="${C.ink}"/><rect x="312" y="56" width="276" height="470" rx="12" fill="#fbfaf7"/>`;
  b += t(450, 86, 'Round 6 report', { size: 17, anchor: 'middle', weight: 'bold' });
  b += t(330, 116, 'Independent Railroads', { size: 13, weight: 'bold' });
  // Schematic mini map: the railroad's own Cities and Routes only, new Route bold
  const ok = { x: 400, y: 150 }, da = { x: 430, y: 210 }, ho = { x: 470, y: 272 };
  b += `<rect x="330" y="128" width="240" height="160" rx="6" fill="#f1ede3"/>`;
  b += `<line x1="${da.x}" y1="${da.y}" x2="${ho.x}" y2="${ho.y}" stroke="${C.indie}" stroke-width="3"/>`;
  b += `<line x1="${ok.x}" y1="${ok.y}" x2="${da.x}" y2="${da.y}" stroke="${C.indie}" stroke-width="7"/>`;
  for (const [p, n] of [[ok, 'Oklahoma City'], [da, 'Dallas'], [ho, 'Houston']]) b += `<circle cx="${p.x}" cy="${p.y}" r="6" fill="#fff" stroke="${C.ink}" stroke-width="2"/>` + t(p.x + 12, p.y + 4, n, { size: 12 });
  b += t(330, 302, 'Gulf & Prairie Railway: +1 Route', { size: 12.5 });
  b += t(330, 336, 'Market', { size: 13, weight: 'bold' });
  b += t(330, 358, '✕ Left: Wine → Chicago', { size: 12.5, fill: C.red });
  b += t(330, 378, '+ New: Copper → Kansas City', { size: 12.5, fill: C.green });
  b += t(330, 398, '⏳ Tobacco → Cleveland: 2 rounds left', { size: 12.5 });
  b += t(330, 432, 'Next round starts with Red.', { size: 12.5 });
  b += `<rect x="330" y="470" width="240" height="34" rx="6" fill="${C.ink}"/>${t(450, 492, 'Done', { size: 14, anchor: 'middle', fill: '#fff', weight: 'bold' })}`;
  b += t(640, 160, 'New Routes are drawn bold.', { size: 13, fill: C.note, italic: true });
  b += t(640, 180, 'Draw them on the board', { size: 13, fill: C.note, italic: true });
  b += t(640, 200, 'with the black marker.', { size: 13, fill: C.note, italic: true });
  b += t(40, 360, 'Draft: mock-up of the app screen;', { size: 13, fill: C.note, italic: true });
  b += t(40, 380, 'replace with a real screenshot.', { size: 13, fill: C.note, italic: true });
  files['fig-14-round-report.svg'] = svg(900, 580, b, 14, 'Round Report');
}

fs.mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(out, name), content);
console.log(Object.keys(files).join('\n'));
console.log('routes', ROUTES.length, 'cities', Object.keys(CITIES).length, 'points', Object.keys(PTS).length);
