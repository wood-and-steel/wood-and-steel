/**
 * Turn bookkeeping kept in bot_states: each applied action is a step key, from which the
 * turn's counted actions and run engines are rebuilt after a reload.
 */
import type { EngineSlot } from '../../board/boardOps';
import type { GameContext, GameState } from '../../stores/gameStore';
import { actionKind, type Action, type GameMove } from '../engine/actions';
import { emptyTurnState, type ActionKind, type TurnState } from '../engine/world';

/** "runTrains:0,1", "buildTrack", or "free:pickUp". */
export function stepKey(action: Action): string {
  const kind = actionKind(action);
  if (kind === 'runTrains' && action.type === 'runTrains') return `runTrains:${action.runs.map((r) => r.slot).join(',')}`;
  return kind ?? `free:${action.type}`;
}

export function turnStateFromSteps(steps: string[]): TurnState {
  const state = emptyTurnState();
  for (const step of steps) {
    if (step.startsWith('free:')) continue;
    const [kind, slots] = step.split(':');
    state.actions.push(kind as ActionKind);
    if (slots) state.enginesRun.push(...slots.split(',').map((s) => Number(s) as EngineSlot));
  }
  return state;
}

/** Whether a move's result is already in G/ctx, so resuming after a reload doesn't repeat it. */
export function isMoveDone(
  move: GameMove,
  G: GameState,
  ctx: GameContext,
  playerID: string,
  turn: { turn: number; playOrderPos: number }
): boolean {
  const me = G.players.find(([id]) => id === playerID)?.[1];
  const contract = (id: string) => G.contracts.find((c) => c.id === id);
  switch (move.name) {
    case 'generateStartingContract':
      return (me?.activeCities.length ?? 0) > 0;
    case 'toggleContractFulfilled':
      return contract(move.args[0])?.fulfilled === true;
    case 'claimMarketContract':
      return contract(move.args[0])?.playerID === playerID;
    case 'addContract': {
      const [commodity, destination] = move.args;
      return G.contracts.some(
        (c) => c.type === 'private' && c.playerID === playerID && !c.fulfilled && c.commodity === commodity && c.destinationKey === destination
      );
    }
    case 'deleteContract':
      return contract(move.args[0]) === undefined;
    case 'acquireIndependentRailroad':
      return !(move.args[0] in (G.independentRailroads ?? {}));
    case 'claimHubCity':
      return me?.hubCity != null;
    case 'claimRegionalOffice':
      return me?.regionalOffice != null;
    case 'endTurn':
      return ctx.currentPlayer !== playerID || ctx.turn !== turn.turn || ctx.playOrderPos !== turn.playOrderPos;
  }
}
