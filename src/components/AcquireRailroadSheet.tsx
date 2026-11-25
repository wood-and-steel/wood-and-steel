import React from "react";
import type { GameState, PlayerProps } from "../stores/gameStore";
import type { Moves } from "../stores/moves";
import { independentRailroadPrice } from "../stores/gameActions";
import { formatMoney } from "../utils/money";
import { Sheet, ShortOfCash } from "./Sheet";

export interface AcquireRailroadSheetProps {
  G: GameState;
  /** The current round, to mark routes added at the last round end. */
  round: number;
  player: PlayerProps;
  moves: Moves;
  onBack?: () => void;
  onClose: () => void;
}

/**
 * The independent railroads with their routes and prices, reached from Actions' "Acquire a
 * railroad". Routes added at the last round end are marked with a dot.
 */
export function AcquireRailroadSheet({
  G,
  round,
  player,
  moves,
  onBack,
  onClose,
}: AcquireRailroadSheetProps): React.ReactElement {
  const railroads = Object.values(G.independentRailroads);

  return (
    <Sheet title="Acquire a railroad" onClose={onClose} onBack={onBack}>
      {railroads.length === 0 ? (
        <p className="sheet__note">No independent railroads are left.</p>
      ) : (
        <div className="sheet__options">
          {railroads.map((railroad) => {
            const price = independentRailroadPrice(G, railroad.name);
            return (
              <div key={railroad.name} className="sheet__option">
                <div className="sheet__row">
                  <strong>{railroad.name}</strong>
                  <span>{formatMoney(price)}</span>
                </div>
                <ul className="independentRailroads__routes" aria-label={`${railroad.name} routes`}>
                  {railroad.routes.map((route) => (
                    <li key={route.key} className="independentRailroads__route">
                      {route.key}
                      {round >= 2 && route.addedInRound === round - 1 && (
                        <span className="independentRailroads__route-dot" role="img" aria-label="new last round" />
                      )}
                    </li>
                  ))}
                </ul>
                {price > player.cash ? (
                  <ShortOfCash>{formatMoney(price - player.cash)} short</ShortOfCash>
                ) : (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      if (moves.acquireIndependentRailroad(railroad.name)) onClose();
                    }}
                  >
                    Acquire for {formatMoney(price)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="sheet__note">You can acquire a railroad once your network reaches one of its cities.</p>
    </Sheet>
  );
}
