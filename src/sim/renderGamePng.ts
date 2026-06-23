import { routes } from '../data';
import type { GameState } from '../stores/gameStore';
import {
  ACTIVE_CITY_COLOR,
  EXPANDED_CITY_COLOR,
  MAP_HEIGHT,
  MAP_WIDTH,
  getCityPixel,
  indieColor,
  mapImageUrl,
} from './mapCoordinates';
import type { AcquiredRailroad } from './runSimulation';

let cachedMapImage: HTMLImageElement | null = null;

function loadMapImage(): Promise<HTMLImageElement> {
  if (cachedMapImage) {
    return Promise.resolve(cachedMapImage);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cachedMapImage = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load simple-map.png'));
    img.src = mapImageUrl;
  });
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  routeKey: string,
  color: string,
  lineWidth: number,
  dashed = false
): void {
  const route = routes.get(routeKey);
  if (!route) return;

  const [cityA, cityB] = route.cities;
  const a = getCityPixel(cityA);
  const b = getCityPixel(cityB);
  if (!a || !b) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.setLineDash(dashed ? [8, 6] : []);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawActiveCity(
  ctx: CanvasRenderingContext2D,
  cityName: string,
  fillColor: string
): void {
  const pixel = getCityPixel(cityName);
  if (!pixel) return;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pixel.x, pixel.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** First two active cities per player are the seeded starting pair. */
function collectStartingCities(G: GameState): Set<string> {
  const starting = new Set<string>();
  for (const [, player] of G.players) {
    for (const city of player.activeCities.slice(0, 2)) {
      starting.add(city);
    }
  }
  return starting;
}

export async function renderGamePng(
  G: GameState,
  acquiredRailroads: AcquiredRailroad[],
  railroadColorIndices: Record<string, number>
): Promise<Blob> {
  const mapImage = await loadMapImage();
  const canvas = document.createElement('canvas');
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas 2d context');
  }

  ctx.drawImage(mapImage, 0, 0, MAP_WIDTH, MAP_HEIGHT);

  for (const [name, railroad] of Object.entries(G.independentRailroads)) {
    const colorIndex = railroadColorIndices[name];
    if (colorIndex === undefined) continue;
    const color = indieColor(colorIndex);
    for (const routeEntry of railroad.routes) {
      drawRoute(ctx, routeEntry.key, color, 5);
    }
  }

  acquiredRailroads.forEach((rr) => {
    const colorIndex = railroadColorIndices[rr.name];
    if (colorIndex === undefined) return;
    const color = indieColor(colorIndex);
    for (const routeEntry of rr.routes) {
      drawRoute(ctx, routeEntry.key, color, 5, true);
    }
  });

  const startingCities = collectStartingCities(G);
  const activeCities = new Set(
    G.players.flatMap(([, player]) => player.activeCities)
  );
  for (const cityName of activeCities) {
    const fillColor = startingCities.has(cityName)
      ? ACTIVE_CITY_COLOR
      : EXPANDED_CITY_COLOR;
    drawActiveCity(ctx, cityName, fillColor);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export PNG'));
      },
      'image/png'
    );
  });
}

/** Preload the base map so the first PNG render is faster. */
export function preloadMapImage(): Promise<void> {
  return loadMapImage().then(() => undefined);
}
