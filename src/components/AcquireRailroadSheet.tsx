import React from "react";
import type { GameState, PlayerProps } from "../stores/gameStore";
import type { Moves } from "../stores/moves";
import { independentRailroadPrice } from "../stores/gameActions";
import { routes } from "../data";
import { formatMoney } from "../utils/money";
import { Sheet, ShortOfCash } from "./Sheet";

export interface AcquireRailroadSheetProps {
  G: GameState;
  player: PlayerProps;
  moves: Moves;
  onBack?: () => void;
  onClose: () => void;
}

/** Every city a railroad's routes touch, in alphabetical order. */
function connectedCities(routeKeys: string[]): string[] {
  const cityKeys = routeKeys.flatMap((key) => routes.get(key)?.cities ?? key.split("-"));
  return [...new Set(cityKeys)].sort((a, b) => a.localeCompare(b));
}

/**
 * The independent railroads with the cities they connect, reached from Actions' "Acquire a
 * railroad".
 */
export function AcquireRailroadSheet({ G, player, moves, onBack, onClose }: AcquireRailroadSheetProps): React.ReactElement {
  const railroads = Object.values(G.independentRailroads);

  return (
    <Sheet title="Acquire a railroad" onClose={onClose} onBack={onBack}>
      {railroads.length === 0 ? (
        <p className="sheet__note">No independent railroads are left.</p>
      ) : (
        <div className="sheet__list">
          {railroads.map((railroad) => {
            const price = independentRailroadPrice(G, railroad.name);
            return (
              <div key={railroad.name} className="sheet__listItem">
                <strong>{railroad.name}</strong>
                <span className="sheet__label">
                  {connectedCities(railroad.routes.map((route) => route.key)).join(", ")}
                </span>
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
                    Buy for {formatMoney(price)}
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
