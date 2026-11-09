/**
 * Railroad ties (docs/Game rules.md, Object of the game and scoring). The app shows only
 * fulfillment ties, so the engine scores the bonuses itself. Connection bonuses and the West
 * Coast bonus aren't implemented in the app and aren't scored.
 */
import { commodities } from '../../data';
import { railroadTieValue } from '../../Contract';
import {
  CHALLENGER_END_TIES,
  MONOPOLY_TIES,
  REGIONAL_OFFICE_END_TIES,
  breadthBonus,
  depthBonus,
} from './rulesData';
import { connectedToAllSuppliers } from './costs';
import { engineTypes, fulfilledContracts, playerProps, type BotWorld } from './world';

export interface TieBreakdown {
  /** From fulfilled contracts; the game ends at 30. */
  fulfillment: number;
  breadth: number;
  depth: number;
  monopoly: number;
  /** End of game: depth (above), Regional Office, and Challenger. */
  regionalOffice: number;
  challenger: number;
  total: number;
}

/** Deliveries per commodity from fulfilled contracts. */
export function deliveriesByCommodity(world: BotWorld, playerID: string = world.playerID): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of fulfilledContracts(world, playerID)) counts[c.commodity] = (counts[c.commodity] ?? 0) + 1;
  return counts;
}

export function fulfillmentTies(world: BotWorld, playerID: string = world.playerID): number {
  return fulfilledContracts(world, playerID).reduce((sum, c) => sum + railroadTieValue(c), 0);
}

/** The bot's ties. Monopoly ties count only for the bot's own Commodities Exchange commodity. */
export function tieBreakdown(world: BotWorld, playerID: string = world.playerID): TieBreakdown {
  const counts = Object.values(deliveriesByCommodity(world, playerID));
  const fulfillment = fulfillmentTies(world, playerID);
  const breadth = breadthBonus(counts.length);
  const depth = depthBonus(Math.max(0, ...counts));
  const exchange = playerID === world.playerID ? world.bot.exchangeCommodity : null;
  const monopoly =
    exchange && connectedToAllSuppliers(world, exchange, playerID)
      ? (MONOPOLY_TIES[commodities.get(exchange)?.cities.length ?? 0] ?? 0)
      : 0;
  const regionalOffice = playerProps(world, playerID)?.regionalOffice ? REGIONAL_OFFICE_END_TIES : 0;
  const challenger = engineTypes(world, playerID).includes('challenger') ? CHALLENGER_END_TIES : 0;
  return {
    fulfillment,
    breadth,
    depth,
    monopoly,
    regionalOffice,
    challenger,
    total: fulfillment + breadth + depth + monopoly + regionalOffice + challenger,
  };
}
