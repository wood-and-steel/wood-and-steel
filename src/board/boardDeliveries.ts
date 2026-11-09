/**
 * Unloading on delivery: when a contract becomes fulfilled in G, the player's engine standing in
 * the destination city with that commodity has delivered it, so its cargo is cleared. Only
 * contracts fulfilled since the board last looked count, so a later pickup isn't undone.
 * Clearing is an absolute op, so several screens (or a bot that already cleared it) agree.
 */
import type { GameState } from '../stores/gameStore';
import { playerCargo, type BoardOp, type BoardState, type EngineSlot } from './boardOps';

/** IDs of fulfilled contracts. */
export function fulfilledIds(G: GameState): Set<string> {
  return new Set((G.contracts ?? []).filter((c) => c.fulfilled).map((c) => c.id));
}

/** Ops that unload the engine that delivered each contract fulfilled since `seen`. */
export function deliveryCargoOps(seen: Set<string>, G: GameState, board: BoardState): BoardOp[] {
  const ops: BoardOp[] = [];
  const cleared = new Set<string>();
  for (const contract of G.contracts ?? []) {
    if (!contract.fulfilled || seen.has(contract.id) || contract.playerID === null) continue;
    const playerID = contract.playerID;
    const places = board.engines[playerID] ?? [null, null];
    const cargo = playerCargo(board, playerID);
    const slot = ([0, 1] as EngineSlot[]).find(
      (s) => places[s] === contract.destinationKey && cargo[s] === contract.commodity && !cleared.has(`${playerID}:${s}`)
    );
    if (slot === undefined) continue;
    cleared.add(`${playerID}:${slot}`);
    ops.push({ type: 'setCargo', playerID, slot, commodity: null });
  }
  return ops;
}
