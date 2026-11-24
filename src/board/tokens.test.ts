import { applyBoardOp, emptyBoardState } from './boardOps';
import { CITY_POINTS } from '../data/cityPoints';
import { ENGINE_SIZE, RAILYARD_SIZE, layoutTokens, moveTokenOp, nearestCity, tokenCity, type TokenRef } from './tokens';

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

  it('centers a Railyard on its city and alternates engines around it, left first', () => {
    const dark0: TokenRef = { kind: 'engine', playerID: '0', slot: 1 };
    const light1: TokenRef = { kind: 'engine', playerID: '1', slot: 0 };
    let board = emptyBoardState();
    for (const token of [light0, dark0, light1, yard1]) board = applyBoardOp(board, moveTokenOp(token, 'Denver'));
    const placed = layoutTokens(board, ['0', '1']);
    const denver = CITY_POINTS['Denver'];
    const xOf = (id: string) => placed.find((p) => `${p.token.kind}-${p.token.playerID}-${'slot' in p.token ? p.token.slot : ''}` === id)!.x;
    expect(placed.every((p) => p.y === denver.y)).toBe(true);
    expect(xOf('railyard-1-')).toBe(denver.x);
    // Play order: player 0's light engine goes left, their dark engine right, then player 1's light engine further left.
    const step = RAILYARD_SIZE / 2 + ENGINE_SIZE / 2;
    expect(xOf('engine-0-0')).toBeLessThan(denver.x - step);
    expect(xOf('engine-0-1') - denver.x).toBeCloseTo(denver.x - xOf('engine-0-0'));
    expect(xOf('engine-1-0')).toBeLessThan(xOf('engine-0-0') - ENGINE_SIZE);
  });

  it('centers a row of engines on a city with no Railyard', () => {
    const light1: TokenRef = { kind: 'engine', playerID: '1', slot: 0 };
    let board = applyBoardOp(emptyBoardState(), moveTokenOp(light0, 'Denver'));
    board = applyBoardOp(board, moveTokenOp(light1, 'Denver'));
    const [first, second] = layoutTokens(board, ['0', '1']);
    const denver = CITY_POINTS['Denver'];
    expect(first.token).toEqual(light0);
    expect(first.x).toBeLessThan(denver.x);
    expect(second.x - denver.x).toBeCloseTo(denver.x - first.x);
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
