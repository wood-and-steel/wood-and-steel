/**
 * Player display data for the board, derived read-only from G/ctx.
 * Physical tokens come in a light and a dark version of each player color (engines use both;
 * Hub, Railyard and Regional Office upgrade discs use the dark one). Dark is the player color itself.
 */
import type { GameContext, GameState, RegionCode } from '../stores/gameStore';
import { getPlayerAvatarColor, getPlayerLightColor } from '../utils/playerAvatar';

export { shadeColor } from '../utils/playerAvatar';

export interface BoardPlayer {
  id: string;
  name: string;
  color: string;
  light: string;
  dark: string;
  hubCity: string | null;
  regionalOffice: RegionCode | null;
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
      light: getPlayerLightColor(color),
      dark: color,
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
