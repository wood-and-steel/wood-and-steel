import mapImageUrl from '../../docs/simple-map.png';

export { mapImageUrl };

export const MAP_WIDTH = 1110;
export const MAP_HEIGHT = 858;

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
  ['Atlanta', 838, 537],
  ['Birmingham', 785, 549],
  ['Bismarck', 478, 218],
  ['Boise', 184, 277],
  ['Boston', 1043, 252],
  ['Butte', 273, 218],
  ['Calgary', 236, 99],
  ['Charleston', 935, 545],
  ['Chicago', 726, 326],
  ['Cincinnati', 804, 391],
  ['Cleveland', 850, 331],
  ['Dallas', 567, 587],
  ['Denver', 386, 401],
  ['Des Moines', 616, 346],
  ['Detroit', 821, 283],
  ['Duluth', 627, 216],
  ['Fargo', 546, 214],
  ['Flagstaff', 246, 504],
  ['Houston', 605, 667],
  ['Kansas City', 598, 427],
  ['Los Angeles', 102, 526],
  ['Memphis', 709, 513],
  ['Milwaukee', 713, 278],
  ['Minneapolis', 617, 260],
  ['Montreal', 973, 159],
  ['New Orleans', 723, 650],
  ['New York', 1003, 298],
  ['Norfolk', 985, 418],
  ['Oklahoma City', 549, 519],
  ['Omaha', 567, 361],
  ['Ottawa', 948, 200],
  ['Philadelphia', 976, 323],
  ['Phoenix', 232, 557],
  ['Pittsburgh', 889, 339],
  ['Portland ME', 1055, 203],
  ['Portland OR', 76, 215],
  ['Quebec City', 1016, 121],
  ['Raleigh', 957, 452],
  ['Regina', 399, 114],
  ['Saint Louis', 691, 423],
  ['Salt Lake City', 269, 369],
  ['San Diego', 122, 564],
  ['San Francisco', 40, 412],
  ['Santa Fe', 372, 512],
  ['Savannah', 913, 574],
  ['Seattle', 103, 157],
  ['Spokane', 180, 174],
  ['Sudbury', 825, 172],
  ['Syracuse', 943, 258],
  ['Tallahassee', 859, 622],
  ['Tampa', 907, 677],
  ['Thunder Bay', 687, 162],
  ['Toronto', 876, 251],
  ['Vancouver', 93, 108],
  ['Washington', 960, 369],
  ['Winnipeg', 532, 127],
];

export const cityPixels: Record<string, { x: number; y: number }> = Object.fromEntries(
  CITY_PIXELS.map(([name, x, y]) => [name, { x, y }])
);

export function getCityPixel(cityName: string): { x: number; y: number } | undefined {
  return cityPixels[cityName];
}
