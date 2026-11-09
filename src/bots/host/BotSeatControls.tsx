/**
 * Host's bot controls on the waiting screen (docs/BOT_PLAN.md, Seats): lists bot seats with
 * their strategy and a Remove button, and adds a bot with a chosen or random strategy.
 * Lazy-loaded by App.tsx in playtest builds only.
 */
import React from 'react';
import type { BotSeatControlsProps } from '../../components/WaitingForPlayersScreen';
import { useStorage } from '../../providers/StorageProvider';
import { STRATEGIES, getStrategy, isStrategyId } from '../heuristic/strategies';
import { pickBotName, resolveStrategy, type StrategyChoice } from '../seating';
import '../../shared/styles/bots.css';

const ERROR_MESSAGES: Record<string, string> = {
  GAME_FULL: 'There are no open seats.',
  GAME_STARTED: 'The game has already started.',
  NOT_HOST: 'Only the host can add or remove bots.',
};

function errorMessage(action: 'add' | 'remove', code: string | undefined): string {
  return (code && ERROR_MESSAGES[code]) || `Could not ${action} the bot. Try again.`;
}

export function BotSeatControls({
  gameCode,
  seats,
  openSeats,
  onSeatsChanged,
}: BotSeatControlsProps): React.ReactElement {
  const storage = useStorage();
  const [choice, setChoice] = React.useState<StrategyChoice>('random');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const botSeats = Object.entries(seats).filter(([, seat]) => seat.bot != null);

  const handleAdd = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const strategy = resolveStrategy(choice, seats);
      const name = pickBotName(seats);
      const result = await storage.addBotSeat(gameCode, { name, strategy });
      if (!result.success) setError(errorMessage('add', result.error));
      await onSeatsChanged();
    } catch (e) {
      console.error('[BotSeatControls] Error adding bot:', e);
      setError(errorMessage('add', undefined));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (seatKey: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await storage.removeBotSeat(gameCode, seatKey);
      if (!result.success) setError(errorMessage('remove', result.error));
      await onSeatsChanged();
    } catch (e) {
      console.error('[BotSeatControls] Error removing bot:', e);
      setError(errorMessage('remove', undefined));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="botSeats" aria-label="Bots">
      <h2 className="waitingScreen__playersTitle">Bots</h2>

      {botSeats.length > 0 && (
        <ul className="botSeats__list">
          {botSeats.map(([seatKey, seat]) => {
            const strategy = seat.bot && isStrategyId(seat.bot.strategy) ? getStrategy(seat.bot.strategy) : null;
            return (
              <li key={seatKey} className="botSeats__item">
                <span className="botSeats__name">{seat.playerName}</span>
                <span className="botSeats__strategy" title={strategy?.summary}>
                  {strategy?.label ?? seat.bot?.strategy}
                </span>
                <button
                  type="button"
                  className="button botSeats__remove"
                  onClick={() => void handleRemove(seatKey)}
                  disabled={busy}
                  aria-label={`Remove ${seat.playerName}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="botSeats__add">
        <label className="botSeats__label" htmlFor="botStrategy">
          Strategy
        </label>
        <select
          id="botStrategy"
          className="botSeats__select"
          value={choice}
          onChange={(e) => setChoice(e.target.value as StrategyChoice)}
          disabled={busy}
        >
          <option value="random">Random</option>
          {STRATEGIES.map((s) => (
            <option key={s.id} value={s.id} title={s.summary}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button botSeats__addButton"
          onClick={() => void handleAdd()}
          disabled={busy || openSeats <= 0}
        >
          Add bot
        </button>
      </div>

      {openSeats <= 0 && <p className="botSeats__hint">Every seat is filled.</p>}
      {error && <div className="waitingScreen__error">{error}</div>}
    </section>
  );
}
