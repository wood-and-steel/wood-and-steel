import React from "react";
import { railroadTieValue, type Contract } from "../Contract";
import type { PlayerProps } from "../stores/gameStore";
import { formatCommodity, getEngineType, type EngineSlot } from "../rules/playerBoard";
import { payoutFor } from "./ContractRows";
import { EngineSlotIcon } from "./EngineIcon";
import { RadioOption, Sheet } from "./Sheet";

export interface ClaimSheetProps {
  contract: Contract;
  player: PlayerProps;
  /** The player's seat, for their engine token colors. */
  playerID: string;
  /** Why the player can't claim it (no Mogul, already holds a claim), or null if they can. */
  refusal: string | null;
  /** `cargoSlot` records the commodity on that engine; undefined claims without recording cargo. */
  onClaim: (cargoSlot: EngineSlot | undefined) => boolean;
  onClose: () => void;
}

/**
 * Claim an open market contract, optionally recording its commodity on one of the player's
 * engines (cargo is optional; contracts can be fulfilled without it).
 */
export function ClaimSheet({ contract, player, playerID, refusal, onClaim, onClose }: ClaimSheetProps): React.ReactElement {
  const slots = ([0, 1] as EngineSlot[]).filter((slot) => player.engines[slot] !== null);
  // An engine already carrying this commodity comes first, then an empty one.
  const carryingSlot = slots.find((slot) => player.cargo[slot] === contract.commodity);
  const emptySlot = slots.find((slot) => player.cargo[slot] === null);
  const [cargoSlot, setCargoSlot] = React.useState<EngineSlot | null>(carryingSlot ?? emptySlot ?? null);
  const payout = payoutFor(contract, player);
  const ties = railroadTieValue(contract);
  const commodity = formatCommodity(contract.commodity);

  return (
    <Sheet title={`Claim ${contract.commodity} to ${contract.destinationKey}`} onClose={onClose}>
      <div className="sheet__box">
        <div className="sheet__row">
          <span className="sheet__label">Worth to you</span>
          <span>
            <strong>{payout.net}</strong> · {ties} {ties === 1 ? "tie" : "ties"}
          </span>
        </div>
        {payout.byEngine && <p className="sheet__note">Depends on which engine delivers.</p>}
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
                <RadioOption key={slot} name="claimCargo" checked={cargoSlot === slot} onSelect={() => setCargoSlot(slot)}>
                  <span className="engineLabel">
                    <EngineSlotIcon playerID={playerID} avatarColor={player.avatarColor} slot={slot} />
                    {getEngineType(player.engines[slot]!).name}
                  </span>
                  <span className="sheet__label">
                    {!current
                      ? "No cargo recorded"
                      : current === contract.commodity
                        ? `Carrying ${formatCommodity(current).toLowerCase()}`
                        : `Replaces ${formatCommodity(current).toLowerCase()}`}
                  </span>
                </RadioOption>
              );
            })}
            <RadioOption name="claimCargo" checked={cargoSlot === null} onSelect={() => setCargoSlot(null)}>
              <span>Don't record cargo</span>
            </RadioOption>
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
