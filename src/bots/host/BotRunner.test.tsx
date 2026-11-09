import React from 'react';
import { beforeEach, describe, expect, test } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { StorageProvider } from '../../providers/StorageProvider';
import { useGameStore } from '../../stores/gameStore';
import { addBotSeat, assignPlayerSeat, assignRandomPlayerIDs, createNewGame } from '../../utils/gameManager';
import { setStorageAdapter } from '../../utils/storage';
import { MemoryStorageAdapter } from '../../utils/storage/memoryStorageAdapter.testHelper';
import { setBotStatesAdapter } from '../state/botStatesAdapter';
import { loadBotStates } from '../state/botStatesSync';
import { MemoryBotStatesAdapter } from '../state/memoryBotStatesAdapter.testHelper';
import { BotRunner } from './BotRunner';

const HOST = 'host-device';
const storageAdapter = new MemoryStorageAdapter();
let botAdapter: MemoryBotStatesAdapter;
let code: string;

async function renderRunner(deviceId = HOST) {
  localStorage.setItem('device_id', deviceId);
  await act(async () => {
    render(
      <StorageProvider>
        <BotRunner gameCode={code} />
      </StorageProvider>
    );
  });
}

function setPhase(phase: string) {
  useGameStore.setState((s) => ({ ctx: { ...s.ctx, phase } }));
}

/** Let pending async work in the runner settle. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(async () => {
  localStorage.clear();
  storageAdapter.clear();
  setStorageAdapter(storageAdapter);
  botAdapter = new MemoryBotStatesAdapter();
  setBotStatesAdapter(botAdapter);
  useGameStore.getState().resetState(3);
  code = await createNewGame({ hostDeviceId: HOST, numPlayers: 3 });
});

describe('BotRunner (M2: bot state setup)', () => {
  test('host creates bot_states once the game has started', async () => {
    await addBotSeat(code, HOST, { name: 'Avery', strategy: 'builder' });
    await addBotSeat(code, HOST, { name: 'Sage', strategy: 'merchant' });
    const { assignments } = await assignRandomPlayerIDs(code, HOST);
    setPhase('setup');

    await renderRunner();

    await waitFor(async () => expect(await loadBotStates(code, botAdapter)).not.toBeNull());
    const { states } = (await loadBotStates(code, botAdapter))!;
    const botIDs = Object.entries(assignments!).filter(([seat]) => seat !== HOST).map(([, id]) => id);
    expect(Object.keys(states.bots).sort()).toEqual(botIDs.sort());
    expect(Object.values(states.bots).map((b) => b.name).sort()).toEqual(['Avery', 'Sage']);
  });

  test('does nothing before the game starts', async () => {
    await addBotSeat(code, HOST, { name: 'Avery', strategy: 'builder' });
    setPhase('waiting_for_players');
    await renderRunner();
    await settle();
    expect(botAdapter.saves).toBe(0);
  });

  test('does nothing on a non-host device', async () => {
    await addBotSeat(code, HOST, { name: 'Avery', strategy: 'builder' });
    await assignPlayerSeat(code, 'guest-device');
    await assignRandomPlayerIDs(code, HOST);
    setPhase('setup');
    await renderRunner('guest-device');
    await settle();
    expect(botAdapter.saves).toBe(0);
  });

  test('does nothing in a game without bots', async () => {
    await assignPlayerSeat(code, 'guest-1');
    await assignPlayerSeat(code, 'guest-2');
    await assignRandomPlayerIDs(code, HOST);
    setPhase('setup');
    await renderRunner();
    await settle();
    expect(botAdapter.saves).toBe(0);
  });
});
