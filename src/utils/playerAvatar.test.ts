import { describe, expect, test } from 'vitest';
import {
  getAvatarTextColor,
  getOtherPlayerIdsInPlayOrder,
  getPlayerAvatarColor,
  getPlayerAvatarColorForIndex,
  getPlayerInitials,
  PLAYER_AVATAR_COLORS,
} from './playerAvatar';

describe('playerAvatar', () => {
  test('getPlayerInitials uses first character and first character after a space', () => {
    expect(getPlayerInitials('Alice')).toBe('A');
    expect(getPlayerInitials('Bob')).toBe('B');
    expect(getPlayerInitials('John Smith')).toBe('JS');
    expect(getPlayerInitials('  Zoe Moon  ')).toBe('ZM');
    expect(getPlayerInitials('John  Smith')).toBe('JS');
    expect(getPlayerInitials('A')).toBe('A');
    expect(getPlayerInitials('')).toBe('?');
  });

  test('getPlayerAvatarColorForIndex assigns fixed palette colors by player index', () => {
    expect(getPlayerAvatarColorForIndex(0)).toBe('#f83765');
    expect(getPlayerAvatarColorForIndex(1)).toBe('#ba951e');
    expect(getPlayerAvatarColorForIndex(2)).toBe('#0e86f4');
    expect(getPlayerAvatarColorForIndex(3)).toBe('#31b027');
    expect(getPlayerAvatarColorForIndex(4)).toBe('#505050');
    expect(getPlayerAvatarColorForIndex(9)).toBe('#505050');
    expect(PLAYER_AVATAR_COLORS).toHaveLength(5);
  });

  test('getPlayerAvatarColor prefers stored color and falls back by player id', () => {
    const stored = '#123456';
    expect(getPlayerAvatarColor('0', stored)).toBe(stored);
    expect(getPlayerAvatarColor('0')).toBe('#f83765');
    expect(getPlayerAvatarColor('1')).toBe('#ba951e');
  });

  test('getOtherPlayerIdsInPlayOrder returns remaining players in play order', () => {
    const playOrder = ['0', '1', '2'];
    expect(getOtherPlayerIdsInPlayOrder('0', playOrder)).toEqual(['1', '2']);
    expect(getOtherPlayerIdsInPlayOrder('1', playOrder)).toEqual(['2', '0']);
    expect(getOtherPlayerIdsInPlayOrder('2', playOrder)).toEqual(['0', '1']);
    expect(getOtherPlayerIdsInPlayOrder('missing', playOrder)).toEqual([]);
  });

  test('getAvatarTextColor returns black or white for hsl and hex colors', () => {
    expect(getAvatarTextColor('hsl(0, 80%, 80%)')).toBe('#000000');
    expect(getAvatarTextColor('hsl(0, 80%, 20%)')).toBe('#ffffff');
    expect(getAvatarTextColor('#505050')).toBe('#ffffff');
    expect(getAvatarTextColor('#ba951e')).toBe('#000000');
  });
});
