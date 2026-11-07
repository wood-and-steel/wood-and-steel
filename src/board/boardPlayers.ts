/**
 * Player display data for the board, derived read-only from G/ctx.
 * Physical tokens come in a light and a dark shade of each player hue (engines use both;
 * Hub, Railyard and Regional Office upgrade discs use the dark one).
 */
import type { GameContext, GameState, RegionCode } from '../stores/gameStore';
import { getPlayerAvatarColor } from '../utils/playerAvatar';

export interface BoardPlayer {
  id: string;
  name: string;
  color: string;
  light: string;
  dark: string;
  hubCity: string | null;
  regionalOffice: RegionCode | null;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Mix a hex color toward white (amount > 0) or black (amount < 0). Non-hex colors are returned unchanged. */
export function shadeColor(color: string, amount: number): string {
  const match = HEX_RE.exec(color.trim());
  if (!match) return color;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  const target = amount > 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const channels = [0, 2, 4].map((i) => {
    const value = Number.parseInt(hex.slice(i, i + 2), 16);
    return Math.round(value + (target - value) * t);
  });
  return `#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Players in play order (falling back to G order), with display colors. */
export function getBoardPlayers(G: GameState, ctx: GameContext): BoardPlayer[] {
  const byId = new Map(G.players ?? []);
  const order = ctx.playOrder?.length ? ctx.playOrder.filter((id) => byId.has(id)) : [...byId.keys()];
  return order.map((id) => {
    const props = byId.get(id)!;
    const color = getPlayerAvatarColor(id, props.avatarColor);
    return {
      id,
      name: props.name,
      color,
      light: shadeColor(color, 0.45),
      dark: shadeColor(color, -0.35),
      hubCity: props.hubCity ?? null,
      regionalOffice: props.regionalOffice ?? null,
    };
  });
}

/** "waiting_for_players" -> "Waiting for players" */
export function formatPhase(phase: string | undefined): string {
  if (!phase) return '—';
  const text = phase.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
