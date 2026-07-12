/** Temporary per-player avatar color; algorithm will be replaced soon. */
export function generatePlayerAvatarColor(): string {
  const h = Math.random() * 360;
  const s = 0.7 + Math.random() * 0.2;
  const l = 0.3 + Math.random() * 0.3;
  return formatHsl(h, s, l);
}

/** Stable color for a player within a game; uses stored value when present. */
export function getPlayerAvatarColor(playerId: string, avatarColor?: string): string {
  if (avatarColor) return avatarColor;
  return generatePlayerAvatarColorFromSeed(seedFromString(playerId));
}

export function getPlayerInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const words = trimmed.split(/\s+/);
  const firstInitial = words[0][0].toUpperCase();
  if (words.length === 1) return firstInitial;

  return firstInitial + words[1][0].toUpperCase();
}

export function getAvatarTextColor(backgroundColor: string): "#000000" | "#ffffff" {
  const { h, s, l } = parseHsl(backgroundColor);
  const { r, g, b } = hslToRgb(h, s, l);
  const luminance = relativeLuminance(r, g, b);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#000000";
}

function formatHsl(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s * 100}%, ${l * 100}%)`;
}

function seedFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generatePlayerAvatarColorFromSeed(seed: number): string {
  const rng = mulberry32(seed);
  const h = rng() * 360;
  const s = 0.7 + rng() * 0.2;
  const l = 0.3 + rng() * 0.3;
  return formatHsl(h, s, l);
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
