import { routes } from '../data';
import type { GameState } from '../stores/gameStore';
import {
  CITY_DOT_RADIUS,
  EXPANDED_CITY_BORDER_WIDTH,
  MAP_HEIGHT,
  MAP_WIDTH,
  STARTING_CITY_BORDER_WIDTH,
  STARTING_CITY_SIZE,
  getCityPixel,
  indieColor,
  mapImageUrl,
  playerCityColor,
} from './mapCoordinates';
import type { AcquiredRailroad, PlayerCityAcquiredInRound } from './runSimulation';

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

function drawStartingCity(
  ctx: CanvasRenderingContext2D,
  cityName: string,
  fillColor: string
): void {
  const pixel = getCityPixel(cityName);
  if (!pixel) return;

  const half = STARTING_CITY_SIZE / 2;
  const x = pixel.x - half;
  const y = pixel.y - half;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = STARTING_CITY_BORDER_WIDTH;
  ctx.fillRect(x, y, STARTING_CITY_SIZE, STARTING_CITY_SIZE);
  ctx.strokeRect(x, y, STARTING_CITY_SIZE, STARTING_CITY_SIZE);
}

function drawExpandedCity(
  ctx: CanvasRenderingContext2D,
  cityName: string,
  fillColor: string,
  acquiredInRound: number
): void {
  const pixel = getCityPixel(cityName);
  if (!pixel) return;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = EXPANDED_CITY_BORDER_WIDTH;
  ctx.beginPath();
  ctx.arc(pixel.x, pixel.y, CITY_DOT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';
  ctx.fillText(String(acquiredInRound), pixel.x, pixel.y + 1);
}

export async function renderGamePng(
  G: GameState,
  acquiredRailroads: AcquiredRailroad[],
  railroadColorIndices: Record<string, number>,
  playerCityAcquiredInRound: PlayerCityAcquiredInRound
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

  G.players.forEach(([playerId, player], playerIndex) => {
    const fillColor = playerCityColor(playerIndex);
    const rounds = playerCityAcquiredInRound[playerId];
    player.activeCities.forEach((cityName, cityIndex) => {
      if (cityIndex < 2) {
        drawStartingCity(ctx, cityName, fillColor);
      } else {
        const acquiredInRound = rounds?.[cityName] ?? 0;
        drawExpandedCity(ctx, cityName, fillColor, acquiredInRound);
      }
    });
  });

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
