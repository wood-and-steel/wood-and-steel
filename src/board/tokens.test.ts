import { applyBoardOp, emptyBoardState } from './boardOps';
import { CITY_POINTS } from './geometry/cityPoints';
import { ENGINE_WIDTH, RAILYARD_RADIUS, layoutTokens, moveTokenOp, nearestCity, tokenCity, type TokenRef } from './tokens';

const light0: TokenRef = { kind: 'engine', playerID: '0', slot: 0 };
const yard1: TokenRef = { kind: 'railyard', playerID: '1' };

describe('tokens', () => {
  it('moves tokens with board ops and reads their city back', () => {
    let board = applyBoardOp(emptyBoardState(), moveTokenOp(light0, 'Denver'));
    board = applyBoardOp(board, moveTokenOp(yard1, 'Omaha'));
    expect(tokenCity(board, light0)).toBe('Denver');
    expect(tokenCity(board, yard1)).toBe('Omaha');
    expect(tokenCity(applyBoardOp(board, moveTokenOp(light0, null)), light0)).toBeNull();
    expect(tokenCity(null, light0)).toBeNull();
  });

  it('lays out tokens sharing a city in a row centered on it, Railyards first', () => {
    let board = applyBoardOp(emptyBoardState(), moveTokenOp(light0, 'Denver'));
    board = applyBoardOp(board, moveTokenOp(yard1, 'Denver'));
    const placed = layoutTokens(board, ['0', '1']);
    expect(placed.map((p) => p.token.kind)).toEqual(['railyard', 'engine']);
    const denver = CITY_POINTS['Denver'];
    expect(placed.every((p) => p.y === denver.y)).toBe(true);
    // Row is centered: left edge of the Railyard and right edge of the engine are equidistant.
    const left = denver.x - (placed[0].x - RAILYARD_RADIUS);
    const right = placed[1].x + ENGINE_WIDTH / 2 - denver.x;
    expect(left).toBeCloseTo(right);
  });

  it('skips tokens of players not in the game and tokens in trays', () => {
    const board = applyBoardOp(emptyBoardState(), moveTokenOp({ kind: 'railyard', playerID: '9' }, 'Denver'));
    expect(layoutTokens(board, ['0'])).toEqual([]);
  });

  it('snaps to the nearest city only within the given distance of its circle', () => {
    const omaha = CITY_POINTS['Omaha'];
    expect(nearestCity({ x: omaha.x + omaha.r + 10, y: omaha.y }, 20)).toBe('Omaha');
    expect(nearestCity({ x: omaha.x + omaha.r + 30, y: omaha.y }, 20)).toBeNull();
  });
});
