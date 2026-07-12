import { describe, expect, test } from 'vitest';
import {
  generatePlayerAvatarColor,
  getAvatarTextColor,
  getOtherPlayerIdsInPlayOrder,
  getPlayerAvatarColor,
  getPlayerInitials,
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

  test('generatePlayerAvatarColor uses HSL ranges', () => {
    for (let i = 0; i < 20; i++) {
      const color = generatePlayerAvatarColor();
      const match = color.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i);
      expect(match).not.toBeNull();
      const s = Number(match![2]) / 100;
      const l = Number(match![3]) / 100;
      expect(s).toBeGreaterThanOrEqual(0.7);
      expect(s).toBeLessThanOrEqual(0.9);
      expect(l).toBeGreaterThanOrEqual(0.3);
      expect(l).toBeLessThanOrEqual(0.6);
    }
  });

  test('getPlayerAvatarColor prefers stored color and falls back deterministically', () => {
    const stored = 'hsl(120, 80%, 45%)';
    expect(getPlayerAvatarColor('0', stored)).toBe(stored);
    expect(getPlayerAvatarColor('0')).toBe(getPlayerAvatarColor('0'));
    expect(getPlayerAvatarColor('1')).not.toBe(getPlayerAvatarColor('0'));
  });

  test('getOtherPlayerIdsInPlayOrder returns remaining players in play order', () => {
    const playOrder = ['0', '1', '2'];
    expect(getOtherPlayerIdsInPlayOrder('0', playOrder)).toEqual(['1', '2']);
    expect(getOtherPlayerIdsInPlayOrder('1', playOrder)).toEqual(['2', '0']);
    expect(getOtherPlayerIdsInPlayOrder('2', playOrder)).toEqual(['0', '1']);
    expect(getOtherPlayerIdsInPlayOrder('missing', playOrder)).toEqual([]);
  });

  test('getAvatarTextColor returns black or white', () => {
    expect(getAvatarTextColor('hsl(0, 80%, 80%)')).toBe('#000000');
    expect(getAvatarTextColor('hsl(0, 80%, 20%)')).toBe('#ffffff');
  });
});
