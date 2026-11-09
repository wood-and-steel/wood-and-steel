/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { beforeEach, describe, expect, test } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WaitingForPlayersScreen } from '../../components/WaitingForPlayersScreen';
import { StorageProvider } from '../../providers/StorageProvider';
import {
  addBotSeat,
  assignPlayerSeat,
  createNewGame,
  getPlayerSeats,
} from '../../utils/gameManager';
import { setStorageAdapter } from '../../utils/storage';
import { MemoryStorageAdapter } from '../../utils/storage/memoryStorageAdapter.testHelper';
import { BotSeatControls } from './BotSeatControls';

const HOST = 'host-device';
const adapter = new MemoryStorageAdapter();
let code: string;

async function renderScreen(numPlayers = 3) {
  await act(async () => {
    render(
      <StorageProvider>
        <WaitingForPlayersScreen gameCode={code} numPlayers={numPlayers} botSeatControls={BotSeatControls} />
      </StorageProvider>
    );
  });
}

beforeEach(async () => {
  localStorage.clear();
  adapter.clear();
  setStorageAdapter(adapter);
  localStorage.setItem('device_id', HOST);
  code = await createNewGame({ hostDeviceId: HOST, numPlayers: 3, hostPlayerName: 'Hana' });
});

describe('BotSeatControls on the waiting screen', () => {
  test('host adds a bot with a random strategy by default', async () => {
    await renderScreen();
    const bots = await screen.findByRole('region', { name: 'Bots' });
    expect(within(bots).getByLabelText('Strategy')).toHaveValue('random');

    await act(async () => {
      fireEvent.click(within(bots).getByRole('button', { name: 'Add bot' }));
    });

    const seats = (await getPlayerSeats(code))!;
    const bot = Object.values(seats).find((seat) => seat.bot);
    expect(bot?.playerName).toMatch(/^.+ \(bot\)$/);
    await waitFor(() => expect(within(bots).getByText(bot!.playerName)).toBeInTheDocument());
    // The players list shows the bot like any other player
    expect(screen.getAllByText(bot!.playerName)).toHaveLength(2);
  });

  test('host picks a strategy, which shows next to the bot', async () => {
    await renderScreen();
    const bots = await screen.findByRole('region', { name: 'Bots' });
    fireEvent.change(within(bots).getByLabelText('Strategy'), { target: { value: 'express' } });
    await act(async () => {
      fireEvent.click(within(bots).getByRole('button', { name: 'Add bot' }));
    });

    const bot = Object.values((await getPlayerSeats(code))!).find((seat) => seat.bot);
    expect(bot?.bot?.strategy).toBe('express');
    await waitFor(() => expect(within(bots).getByText('Express', { selector: '.botSeats__strategy' })).toBeInTheDocument());
  });

  test('host removes a bot', async () => {
    await addBotSeat(code, HOST, { name: 'Avery', strategy: 'builder' });
    await renderScreen();
    const bots = await screen.findByRole('region', { name: 'Bots' });
    await waitFor(() => expect(within(bots).getByText('Builder', { selector: '.botSeats__strategy' })).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(within(bots).getByRole('button', { name: 'Remove Avery (bot)' }));
    });

    expect(Object.keys((await getPlayerSeats(code))!)).toEqual([HOST]);
    await waitFor(() => expect(within(bots).queryByText('Avery (bot)')).not.toBeInTheDocument());
  });

  test('Add bot is disabled when every seat is filled', async () => {
    await addBotSeat(code, HOST, { name: 'Avery', strategy: 'builder' });
    await addBotSeat(code, HOST, { name: 'Sage', strategy: 'merchant' });
    await renderScreen();
    const bots = await screen.findByRole('region', { name: 'Bots' });
    await waitFor(() => expect(within(bots).getByRole('button', { name: 'Add bot' })).toBeDisabled());
    expect(within(bots).getByText('Every seat is filled.')).toBeInTheDocument();
  });

  test('non-host players do not see bot controls', async () => {
    await assignPlayerSeat(code, 'guest-device');
    localStorage.setItem('device_id', 'guest-device');
    await renderScreen();
    await screen.findByText(/Players \(2\/3\)/);
    expect(screen.queryByRole('region', { name: 'Bots' })).not.toBeInTheDocument();
  });
});
