import React from "react";
import { railroadTieValue, type Contract } from "../Contract";
import type { PlayerProps } from "../stores/gameStore";
import { defaultDeliveringEngine, deliveryBreakdown } from "../rules/finance";
import { formatCommodity, getEngineType, type EngineSlot } from "../rules/playerBoard";
import { formatMoney } from "../utils/money";
import { Sheet } from "./Sheet";

export interface ClaimSheetProps {
  contract: Contract;
  player: PlayerProps;
  /** Why the player can't claim it (no Mogul, already holds a claim), or null if they can. */
  refusal: string | null;
  /** `cargoSlot` records the commodity on that engine; undefined claims without recording cargo. */
  onClaim: (cargoSlot: EngineSlot | undefined) => boolean;
  onClose: () => void;
}

const SLOT_NAMES: Record<EngineSlot, string> = { 0: "Light", 1: "Dark" };

/**
 * Claim an open market contract, optionally recording its commodity on one of the player's
 * engines (cargo is optional; contracts can be fulfilled without it).
 */
export function ClaimSheet({ contract, player, refusal, onClaim, onClose }: ClaimSheetProps): React.ReactElement {
  const slots = ([0, 1] as EngineSlot[]).filter((slot) => player.engines[slot] !== null);
  const emptySlot = slots.find((slot) => player.cargo[slot] === null);
  const [cargoSlot, setCargoSlot] = React.useState<EngineSlot | null>(emptySlot ?? null);
  const receipt = deliveryBreakdown(player, contract, defaultDeliveringEngine(player.engines));
  const ties = railroadTieValue(contract);
  const commodity = formatCommodity(contract.commodity);

  return (
    <Sheet title={`Claim ${contract.commodity} to ${contract.destinationKey}`} onClose={onClose}>
      <div className="sheet__box">
        <div className="sheet__row">
          <span className="sheet__label">Worth to you</span>
          <span>
            <strong>{formatMoney(receipt.net)}</strong> · {ties} {ties === 1 ? "tie" : "ties"}
          </span>
        </div>
      </div>
      {refusal ? (
        <p className="sheet__warning" role="alert">
          {refusal}
        </p>
      ) : (
        <>
          <span className="sheet__label">Record the {contract.commodity} on an engine? This is optional.</span>
          <div className="sheet__options" role="radiogroup" aria-label="Record cargo">
            {slots.map((slot) => {
              const current = player.cargo[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={cargoSlot === slot}
                  className={`sheet__option${cargoSlot === slot ? " sheet__option--selected" : ""}`}
                  onClick={() => setCargoSlot(slot)}
                >
                  <span>
                    {SLOT_NAMES[slot]}: {getEngineType(player.engines[slot]!).name}
                  </span>
                  <span className="sheet__label">
                    {current ? `Replaces ${formatCommodity(current).toLowerCase()}` : "No cargo recorded"}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={cargoSlot === null}
              className={`sheet__option${cargoSlot === null ? " sheet__option--selected" : ""}`}
              onClick={() => setCargoSlot(null)}
            >
              <span>Don't record cargo</span>
            </button>
          </div>
          <button
            type="button"
            className="button sheet__primary"
            onClick={() => {
              if (onClaim(cargoSlot ?? undefined)) onClose();
            }}
          >
            Claim contract
          </button>
          <p className="sheet__note">
            A new market contract replaces this one for everyone. {commodity} still has to reach{" "}
            {contract.destinationKey} to fulfill it.
          </p>
        </>
      )}
    </Sheet>
  );
}
