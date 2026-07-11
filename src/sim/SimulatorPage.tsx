import React from 'react';
import '../shared/styles/simulator-screen.css';
import { preloadMapImage, renderGamePng } from './renderGamePng';
import { runSimulation, type SimulationParams } from './runSimulation';
import {
  pickOutputDirectory,
  supportsDirectoryPicker,
  writeSimulationOutputs,
} from './writeOutputs';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 30;
const MIN_GAMES = 1;
const MAX_GAMES = 1000;
const MIN_ACTIVE_CITIES_PER_ROUND = 0.1;
const MAX_ACTIVE_CITIES_PER_ROUND = 1;

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampFloat(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function validateParams(
  players: number,
  rounds: number,
  games: number,
  activeCitiesPerRound: number
): string | null {
  if (players < MIN_PLAYERS || players > MAX_PLAYERS) {
    return `Players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`;
  }
  if (rounds < MIN_ROUNDS || rounds > MAX_ROUNDS) {
    return `Rounds must be between ${MIN_ROUNDS} and ${MAX_ROUNDS}.`;
  }
  if (games < MIN_GAMES || games > MAX_GAMES) {
    return `Games must be between ${MIN_GAMES} and ${MAX_GAMES}.`;
  }
  if (
    activeCitiesPerRound < MIN_ACTIVE_CITIES_PER_ROUND ||
    activeCitiesPerRound > MAX_ACTIVE_CITIES_PER_ROUND
  ) {
    return `Active cities added each round must be between ${MIN_ACTIVE_CITIES_PER_ROUND} and ${MAX_ACTIVE_CITIES_PER_ROUND}.`;
  }
  if (players * 2 > 11) {
    return `Not enough starting cities for ${players} players (need ${players * 2}).`;
  }
  return null;
}

export function SimulatorPage(): React.ReactElement {
  const [numPlayers, setNumPlayers] = React.useState('3');
  const [numRounds, setNumRounds] = React.useState('20');
  const [numGames, setNumGames] = React.useState('100');
  const [activeCitiesPerRound, setActiveCitiesPerRound] = React.useState('0.4');
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    preloadMapImage().catch(() => {
      /* map preload is best-effort */
    });
  }, []);

  const handleLaunch = async () => {
    setError(null);
    setStatus(null);

    const params: SimulationParams = {
      numPlayers: clampInt(numPlayers, MIN_PLAYERS, MAX_PLAYERS, MIN_PLAYERS),
      numRounds: clampInt(numRounds, MIN_ROUNDS, MAX_ROUNDS, MIN_ROUNDS),
      numGames: clampInt(numGames, MIN_GAMES, MAX_GAMES, MIN_GAMES),
      activeCitiesPerRound: clampFloat(
        activeCitiesPerRound,
        MIN_ACTIVE_CITIES_PER_ROUND,
        MAX_ACTIVE_CITIES_PER_ROUND,
        MIN_ACTIVE_CITIES_PER_ROUND
      ),
    };

    const validationError = validateParams(
      params.numPlayers,
      params.numRounds,
      params.numGames,
      params.activeCitiesPerRound
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!supportsDirectoryPicker()) {
      setError('File System Access API is not supported. Use Chrome or Edge.');
      return;
    }

    setRunning(true);
    setProgress(0);

    try {
      const parentDir = await pickOutputDirectory();
      setStatus('Running simulation…');

      const results = runSimulation(params);
      const pngBlobs: Blob[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result) continue;
        pngBlobs.push(
          await renderGamePng(
            result.G,
            result.acquiredRailroads,
            result.railroadColorIndices,
            result.playerCityAcquiredInRound
          )
        );
        setProgress(Math.round(((i + 1) / results.length) * 100));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      setStatus('Writing CSV and PNG files…');
      const baseName = await writeSimulationOutputs({
        params,
        results,
        pngBlobs,
        parentDir,
      });

      setStatus(`Done. Wrote ${baseName}.csv and ${baseName}/ (${params.numGames} PNGs).`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('Cancelled — no files written.');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="simulatorPage">
      <div className="simulatorPage__content">
        <h1 className="simulatorPage__title">Independent Railroad Growth Simulator</h1>
        <p className="simulatorPage__intro">
          Batch-simulate indepdendent railroad growth over multiple rounds. Outputs a CSV summary and one
          PNG map per game into a folder you choose. Only runs on Chrome or Edge.
        </p>

        <form
          className="form simulatorPage__form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleLaunch();
          }}
        >
          <label className="simulatorPage__field">
            <span className="simulatorPage__label">Players ({MIN_PLAYERS}–{MAX_PLAYERS})</span>
            <input
              className="simulatorPage__input"
              type="number"
              min={MIN_PLAYERS}
              max={MAX_PLAYERS}
              value={numPlayers}
              onChange={(e) => setNumPlayers(e.target.value)}
              disabled={running}
            />
          </label>

          <label className="simulatorPage__field">
            <span className="simulatorPage__label">Rounds ({MIN_ROUNDS}–{MAX_ROUNDS})</span>
            <input
              className="simulatorPage__input"
              type="number"
              min={MIN_ROUNDS}
              max={MAX_ROUNDS}
              value={numRounds}
              onChange={(e) => setNumRounds(e.target.value)}
              disabled={running}
            />
          </label>

          <label className="simulatorPage__field">
            <span className="simulatorPage__label">Games ({MIN_GAMES}–{MAX_GAMES})</span>
            <input
              className="simulatorPage__input"
              type="number"
              min={MIN_GAMES}
              max={MAX_GAMES}
              value={numGames}
              onChange={(e) => setNumGames(e.target.value)}
              disabled={running}
            />
          </label>

          <label className="simulatorPage__field">
            <span className="simulatorPage__label">
              Active cities added reach round ({MIN_ACTIVE_CITIES_PER_ROUND}–{MAX_ACTIVE_CITIES_PER_ROUND})
            </span>
            <input
              className="simulatorPage__input"
              type="number"
              min={MIN_ACTIVE_CITIES_PER_ROUND}
              max={MAX_ACTIVE_CITIES_PER_ROUND}
              step={0.01}
              value={activeCitiesPerRound}
              onChange={(e) => setActiveCitiesPerRound(e.target.value)}
              disabled={running}
            />
          </label>

          <button className="button button--primary" type="submit" disabled={running}>
            {running ? 'Running…' : 'Launch simulation'}
          </button>
        </form>

        {running && (
          <div className="simulatorPage__progressWrap" aria-live="polite">
            <progress className="simulatorPage__progress" value={progress} max={100} />
            <span className="simulatorPage__progressLabel">{progress}%</span>
          </div>
        )}

        {status && <p className="simulatorPage__status">{status}</p>}
        {error && <p className="simulatorPage__error">{error}</p>}
      </div>
    </div>
  );
}
