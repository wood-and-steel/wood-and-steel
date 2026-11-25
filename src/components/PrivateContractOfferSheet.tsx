import React from "react";
import { generatePrivateContractOffers, type Contract } from "../Contract";
import type { GameState, GameContext } from "../stores/gameStore";
import { ContractRows } from "./ContractRows";
import { Sheet } from "./Sheet";

export interface PrivateContractOfferSheetProps {
  G: GameState;
  ctx: GameContext;
  onSelect: (commodity: string, destinationKey: string) => void;
  onClose: () => void;
}

/**
 * The private contract offers to choose from: 2, 3, or 4 (3 with a Hub, one more with a
 * Regional Office; both are bought from the Actions sheet before offers are drawn). The offers
 * are drawn once, when the sheet opens. Closing it picks none.
 */
export function PrivateContractOfferSheet({ G, ctx, onSelect, onClose }: PrivateContractOfferSheetProps): React.ReactElement {
  const [offers] = React.useState<Contract[]>(() =>
    generatePrivateContractOffers(G, ctx).map((spec, index) => ({
      ...spec,
      id: `offer-${index}`,
      type: "private",
      fulfilled: false,
      playerID: null,
      creationTime: index,
      turnsHeld: null,
    }))
  );
  // Offers go to the current player, so their values are what that player would be paid.
  const player = G.players.find(([id]) => id === ctx.currentPlayer)?.[1];

  return (
    <Sheet title="Choose a new contract" onClose={onClose}>
      <ContractRows
        contracts={offers}
        player={player}
        keepOrder
        emptyText="No contracts can be offered right now."
        onSelect={(contract) => onSelect(contract.commodity, contract.destinationKey)}
      />
    </Sheet>
  );
}
