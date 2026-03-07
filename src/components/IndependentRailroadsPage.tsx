import React from "react";
import { useGame } from "../hooks/useGame";

/**
 * Page component displaying all independent railroad companies with their routes.
 * Each railroad can be acquired via the "Acquire" button.
 */
export function IndependentRailroadsPage(): React.ReactElement {
  const { G, ctx, playerID } = useGame();
  const isPlayerTurn = playerID === ctx.currentPlayer;

  const railroadsArray = Object.values(G.independentRailroads);

  return (
    <div className="pageContent">
      <div>
        <div className="independentRailroads">
          {railroadsArray.map((railroad) => (
            <div key={railroad.name} className="independentRailroads__item">
              <div className="independentRailroads__header">
                <div className="independentRailroads__name">{railroad.name}</div>
                {isPlayerTurn && (
                  <button
                    name="acquireIndependentRailroad"
                    id={railroad.name}
                    className="button independentRailroads__button"
                  >
                    Acquire
                  </button>
                )}
              </div>
              <div className="independentRailroads__body">
                {railroad.routes.map((route) => (
                  <div
                    key={route.key}
                    className="independentRailroads__route"
                  >
                    {ctx.round >= 2 && route.addedInRound === ctx.round - 1 && (
                      <span className="independentRailroads__route-dot" aria-hidden />
                    )}
                    {route.key}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
