import mapImageUrl from '../../docs/simple-map.png';

export { mapImageUrl };

export const MAP_WIDTH = 1110;
export const MAP_HEIGHT = 696;

/** Modified Tableau 10 palette for independent railroad routes. */
export const TABLEAU_10 = [
  '#3d51f6',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
] as const;

/** Per-player active city fill colors (up to 5 players). */
export const PLAYER_CITY_COLORS = [
  '#a8f4ff',
  '#ffb6d5',
  '#ffe29c',
  '#90ff88',
  '#cbcddd',
] as const;

export const STARTING_CITY_SIZE = 22;
export const STARTING_CITY_BORDER_WIDTH = 1;
export const EXPANDED_CITY_BORDER_WIDTH = 0.8;

/** Active city marker radius on the map PNG. */
export const CITY_DOT_RADIUS = 9.5;

export function playerCityColor(playerIndex: number): string {
  return PLAYER_CITY_COLORS[playerIndex % PLAYER_CITY_COLORS.length];
}

/**
 * Pixel color for an independent railroad by index.
 * Uses Tableau 10 for the first nine; beyond that, golden-angle hues avoiding cyan (~180deg).
 */
export function indieColor(index: number): string {
  if (index < TABLEAU_10.length) {
    return TABLEAU_10[index];
  }
  const hue = (index * 137.508) % 360;
  const adjustedHue = hue >= 160 && hue <= 200 ? (hue + 80) % 360 : hue;
  return `hsl(${adjustedHue}, 65%, 45%)`;
}

/**
 * Hand-edited pixel coordinates on docs/simple-map.png (1110×858).
 * Format: [city name, x, y]
 */
export const CITY_PIXELS: readonly (readonly [string, number, number])[] = [
  ['Atlanta', 811, 499],
  ['Birmingham', 755, 511],
  ['Bismarck', 478, 163],
  ['Boise', 197, 212],
  ['Boston', 1020, 222],
  ['Butte', 274, 162],
  ['Calgary', 274, 25],
  ['Charleston', 903, 509],
  ['Chicago', 713, 294],
  ['Cincinnati', 785, 355],
  ['Cleveland', 830, 289],
  ['Dallas', 543, 541],
  ['Denver', 386, 345],
  ['Des Moines', 605, 303],
  ['Detroit', 806, 249],
  ['Duluth', 626, 164],
  ['Fargo', 544, 164],
  ['Flagstaff', 238, 448],
  ['Houston', 575, 621],
  ['Kansas City', 583, 371],
  ['Los Angeles', 99, 447],
  ['Memphis', 686, 474],
  ['Milwaukee', 706, 259],
  ['Minneapolis', 610, 215],
  ['Montreal', 958, 154],
  ['New Orleans', 693, 611],
  ['New York', 976, 273],
  ['Norfolk', 957, 390],
  ['Oklahoma City', 530, 470],
  ['Omaha', 560, 315],
  ['Ottawa', 916, 162],
  ['Philadelphia', 957, 303],
  ['Phoenix', 222, 496],
  ['Pittsburgh', 869, 310],
  ['Portland ME', 1024, 185],
  ['Portland OR', 94, 134],
  ['Quebec City', 982, 105],
  ['Raleigh', 916, 428],
  ['Regina', 421, 63],
  ['Saint Louis', 677, 382],
  ['Salt Lake City', 260, 303],
  ['San Diego', 114, 491],
  ['San Francisco', 36, 331],
  ['Santa Fe', 357, 452],
  ['Savannah', 878, 535],
  ['Seattle', 120, 85],
  ['Spokane', 195, 100],
  ['Sudbury', 796, 123],
  ['Syracuse', 921, 227],
  ['Tallahassee', 819, 587],
  ['Tampa', 870, 646],
  ['Thunder Bay', 674, 120],
  ['Toronto', 859, 222],
  ['Vancouver', 118, 33],
  ['Washington', 930, 340],
  ['Winnipeg', 542, 85],
];

export const cityPixels: Record<string, { x: number; y: number }> = Object.fromEntries(
  CITY_PIXELS.map(([name, x, y]) => [name, { x, y }])
);

export function getCityPixel(cityName: string): { x: number; y: number } | undefined {
  return cityPixels[cityName];
}
