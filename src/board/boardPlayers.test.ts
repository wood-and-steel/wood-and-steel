import type { GameContext, GameState } from '../stores/gameStore';
import { PLAYER_AVATAR_COLORS } from '../utils/playerAvatar';
import { formatPhase, getBoardPlayers, shadeColor } from './boardPlayers';

describe('shadeColor', () => {
  it('mixes toward white or black', () => {
    expect(shadeColor('#808080', 0.5)).toBe('#c0c0c0');
    expect(shadeColor('#808080', -0.5)).toBe('#404040');
    expect(shadeColor('#fff', -1)).toBe('#000000');
  });

  it('returns non-hex colors unchanged', () => {
    expect(shadeColor('hsl(10, 50%, 50%)', 0.5)).toBe('hsl(10, 50%, 50%)');
  });
});

describe('getBoardPlayers', () => {
  it('orders players by play order and falls back to the palette color', () => {
    const G = {
      players: [
        ['0', { name: 'Ada', activeCities: [], hubCity: 'Atlanta', regionalOffice: null }],
        ['1', { name: 'Ben', activeCities: [], hubCity: null, regionalOffice: 'NE', avatarColor: '#000000' }],
      ],
    } as unknown as GameState;
    const ctx = { playOrder: ['1', '0'] } as GameContext;
    const players = getBoardPlayers(G, ctx);
    expect(players.map((p) => p.name)).toEqual(['Ben', 'Ada']);
    expect(players[0]).toMatchObject({ color: '#000000', dark: '#000000', regionalOffice: 'NE' });
    expect(players[1]).toMatchObject({ color: PLAYER_AVATAR_COLORS[0], hubCity: 'Atlanta' });
  });
});

describe('formatPhase', () => {
  it('humanizes phase ids', () => {
    expect(formatPhase('waiting_for_players')).toBe('Waiting for players');
    expect(formatPhase(undefined)).toBe('—');
  });
});
