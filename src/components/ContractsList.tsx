import React from "react";
import { ContractDisplay } from "./ContractDisplay";
import type { GameState, GameContext } from "../stores/gameStore";
import type { Contract } from "../Contract";

const SKIP_OPEN_MS = 50;

export type ContractsListType = "market" | "private" | "fulfilled";

export interface ContractsListProps {
  G: GameState;
  ctx: GameContext;
  type?: ContractsListType;
  playerID?: string | null;
  onToggleFulfilled: (contractID: string) => void;
  onDelete: (contractID: string) => void;
}

function compareContractsFn(a: Contract, b: Contract): number {
  const aValue = (a.type === "market" ? 10 : 0) + (a.fulfilled ? 100 : 0);
  const bValue = (b.type === "market" ? 10 : 0) + (b.fulfilled ? 100 : 0);
  if (aValue < bValue) return -1;
  if (aValue > bValue) return 1;
  return 0;
}

/**
 * Displays a list of Contract cards, either market or player-specific.
 */
export function ContractsList({
  G,
  ctx,
  type = "market",
  playerID = null,
  onToggleFulfilled,
  onDelete,
}: ContractsListProps): React.ReactElement {
  const [openContractId, setOpenContractId] = React.useState<string | null>(null);
  const [skipNextContractOpenUntil, setSkipNextContractOpenUntil] = React.useState(0);
  const isPlayerTurn = playerID == null ? true : playerID === ctx.currentPlayer;

  React.useEffect(() => {
    if (!isPlayerTurn) {
      setOpenContractId(null);
    }
  }, [isPlayerTurn]);

  const handleCardClick = React.useCallback(
    (id: string) => {
      if (Date.now() < skipNextContractOpenUntil) {
        setSkipNextContractOpenUntil(0);
        return;
      }
      setOpenContractId((prev: string | null) => (prev === id ? null : id));
    },
    [skipNextContractOpenUntil]
  );

  const handleMenuCloseOutside = React.useCallback(() => {
    setSkipNextContractOpenUntil(Date.now() + SKIP_OPEN_MS);
  }, []);

  const filteredContracts =
    type === "market"
      ? G.contracts.filter((c) => c.type === "market" && !c.fulfilled)
      : type === "private"
        ? G.contracts.filter((c) => c.playerID === playerID && !c.fulfilled)
        : G.contracts.filter((c) => c.playerID === playerID && c.fulfilled);

  return (
    <div className="contractsList">
      {[...filteredContracts].sort(compareContractsFn).map((contract: Contract) => (
        <ContractDisplay
          key={contract.id}
          contract={contract}
          isMenuOpen={openContractId === contract.id}
          onCardClick={isPlayerTurn ? () => handleCardClick(contract.id) : null}
          onClose={() => setOpenContractId(null)}
          onCloseOutside={handleMenuCloseOutside}
          onToggleFulfilled={onToggleFulfilled}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
