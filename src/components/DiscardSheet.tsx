import React from "react";
import type { Contract } from "../Contract";
import { formatCommodity } from "../rules/playerBoard";
import { RadioOption, Sheet } from "./Sheet";

export interface DiscardSheetProps {
  /** The player's unfulfilled contracts (private and claimed market ones). */
  mine: Contract[];
  /** The open market contracts. */
  market: Contract[];
  onDiscard: (contractID: string) => void;
  onClose: () => void;
}

function name(c: Contract): string {
  return `${formatCommodity(c.commodity)} to ${c.destinationKey}`;
}

/**
 * Discard one of the player's contracts or an open market contract. A discarded market
 * contract is not replaced.
 */
export function DiscardSheet({ mine, market, onDiscard, onClose }: DiscardSheetProps): React.ReactElement {
  const [chosen, setChosen] = React.useState<string | null>(null);

  const options = (contracts: Contract[]) =>
    contracts.map((c) => (
      <RadioOption key={c.id} name="discardContract" checked={chosen === c.id} onSelect={() => setChosen(c.id)}>
        <span>{name(c)}</span>
        {c.type === "market" && c.playerID !== null && <span className="sheet__label">Claimed market contract</span>}
      </RadioOption>
    ));

  return (
    <Sheet title="Discard contract" onClose={onClose}>
      {mine.length === 0 && market.length === 0 ? (
        <p className="sheet__note">There are no contracts to discard.</p>
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <div className="sheet__subhead">Yours</div>
              <div className="sheet__options" role="radiogroup" aria-label="Your contracts">
                {options(mine)}
              </div>
            </>
          )}
          {market.length > 0 && (
            <>
              <div className="sheet__subhead">Market</div>
              <div className="sheet__options" role="radiogroup" aria-label="Market contracts">
                {options(market)}
              </div>
            </>
          )}
          <button
            type="button"
            className="button sheet__primary"
            disabled={chosen === null}
            onClick={() => {
              if (chosen === null) return;
              onDiscard(chosen);
              onClose();
            }}
          >
            Discard contract
          </button>
          <p className="sheet__note">A discarded market contract isn't replaced.</p>
        </>
      )}
    </Sheet>
  );
}
