export const PLAYER_AVATAR_COLORS = [
  '#f83765',
  '#ba951e',
  '#0e86f4',
  '#31b027',
  '#505050',
] as const;

/** Assigns a fixed palette color by player index (0-based). */
export function getPlayerAvatarColorForIndex(playerIndex: number): string {
  return PLAYER_AVATAR_COLORS[playerIndex] ?? PLAYER_AVATAR_COLORS[PLAYER_AVATAR_COLORS.length - 1];
}

/** Stable color for a player within a game; uses stored value when present. */
export function getPlayerAvatarColor(playerId: string, avatarColor?: string): string {
  if (avatarColor) return avatarColor;
  const playerIndex = Number(playerId);
  if (Number.isInteger(playerIndex) && playerIndex >= 0) {
    return getPlayerAvatarColorForIndex(playerIndex);
  }
  return PLAYER_AVATAR_COLORS[PLAYER_AVATAR_COLORS.length - 1];
}

export function getPlayerInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const words = trimmed.split(/\s+/);
  const firstInitial = words[0][0].toUpperCase();
  if (words.length === 1) return firstInitial;

  return firstInitial + words[1][0].toUpperCase();
}

export function getOtherPlayerIdsInPlayOrder(
  viewingPlayerId: string,
  playOrder: string[]
): string[] {
  const startIndex = playOrder.indexOf(viewingPlayerId);
  if (startIndex === -1) return [];

  return Array.from({ length: playOrder.length - 1 }, (_, offset) =>
    playOrder[(startIndex + offset + 1) % playOrder.length]
  );
}

export function getAvatarTextColor(backgroundColor: string): "#000000" | "#ffffff" {
  const { r, g, b } = parseColor(backgroundColor);
  const luminance = relativeLuminance(r, g, b);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#000000";
}

function parseColor(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    return hexToRgb(color);
  }

  const { h, s, l } = parseHsl(color);
  return hslToRgb(h, s, l);
}

function hexToRgb(color: string): { r: number; g: number; b: number } {
  const normalized = color.replace('#', '');
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function parseHsl(color: string): { h: number; s: number; l: number } {
  const match = color.match(
    /hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i
  );
  if (!match) {
    return { h: 0, s: 0.8, l: 0.45 };
  }
  return {
    h: Number(match[1]),
    s: Number(match[2]) / 100,
    l: Number(match[3]) / 100,
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h < 60) {
    rPrime = c;
    gPrime = x;
  } else if (h < 120) {
    rPrime = x;
    gPrime = c;
  } else if (h < 180) {
    gPrime = c;
    bPrime = x;
  } else if (h < 240) {
    gPrime = x;
    bPrime = c;
  } else if (h < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return {
    r: rPrime + m,
    g: gPrime + m,
    b: bPrime + m,
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const transform = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

  return (
    0.2126 * transform(r) +
    0.7152 * transform(g) +
    0.0722 * transform(b)
  );
}
