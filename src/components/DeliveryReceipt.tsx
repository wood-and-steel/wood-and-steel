import React from "react";
import { railroadTieValue, type Contract } from "../Contract";
import type { PlayerProps } from "../stores/gameStore";
import { defaultDeliveringEngine, deliveringEngineMatters, deliveryBreakdown, serviceOn } from "../rules/finance";
import { getEngineType, type EngineSlot } from "../rules/playerBoard";
import { formatMoney, formatMoneyChange } from "../utils/money";
import { CommoditySources } from "./CommoditySources";
import { EngineSlotIcon } from "./EngineIcon";
import { BeforeAfter, RadioOption, Sheet } from "./Sheet";

export interface DeliveryReceiptProps {
  contract: Contract;
  player: PlayerProps;
  /** The player's seat, for their engine token colors. */
  playerID: string;
  /** Earned so far from contracts, for the before/after line. */
  ties: number;
  onDeliver: (engineSlot: EngineSlot | undefined) => boolean;
  onClose: () => void;
}

/**
 * What a delivery pays, line by line, before the player confirms. Bonus and debt-service
 * lines appear only when they change the total; the engine is asked for only when the two
 * engines would pay differently.
 */
export function DeliveryReceipt({ contract, player, playerID, ties, onDeliver, onClose }: DeliveryReceiptProps): React.ReactElement {
  const slots = ([0, 1] as EngineSlot[]).filter((slot) => player.engines[slot] !== null);
  const askEngine = deliveringEngineMatters(player.engines);
  const [slot, setSlot] = React.useState<EngineSlot | undefined>(askEngine ? slots[0] : undefined);
  const engine = slot !== undefined ? player.engines[slot] : defaultDeliveringEngine(player.engines);
  const receipt = deliveryBreakdown(player, contract, engine);
  const contractTies = railroadTieValue(contract);
  const commodity = contract.commodity;

  return (
    <Sheet title={`Deliver ${commodity} to ${contract.destinationKey}`} onClose={onClose}>
      {askEngine && (
        <div className="sheet__field">
          <span className="sheet__label">Which engine made the delivery?</span>
          <div className="sheet__options" role="radiogroup" aria-label="Delivering engine">
            {slots.map((s) => (
              <RadioOption key={s} name="deliveringEngine" checked={slot === s} onSelect={() => setSlot(s)}>
                <span className="engineLabel">
                  <EngineSlotIcon playerID={playerID} avatarColor={player.avatarColor} slot={s} />
                  {getEngineType(player.engines[s]!).name}
                </span>
              </RadioOption>
            ))}
          </div>
        </div>
      )}
      <div className="sheet__box receipt">
        <div className="sheet__row">
          <span>Contract value</span>
          <span>{formatMoney(receipt.value)}</span>
        </div>
        {receipt.engineBonus > 0 && engine && (
          <div className="sheet__row">
            <span>{getEngineType(engine).name} ×1⅓</span>
            <span>{formatMoneyChange(receipt.engineBonus)}</span>
          </div>
        )}
        {receipt.stationsBonus > 0 && (
          <div className="sheet__row">
            <span>Upgraded Stations</span>
            <span>{formatMoneyChange(receipt.stationsBonus)}</span>
          </div>
        )}
        {receipt.debtService > 0 && (
          <>
            <div className="sheet__row receipt__charge">
              <span>Debt service</span>
              <span>{formatMoneyChange(-receipt.debtService)}</span>
            </div>
            <p className="sheet__note">
              {receipt.debtServiceReason === "firstCentral" ? "First Central delivery: one-time" : "Due on every delivery now:"}{" "}
              {formatMoney(serviceOn(5000))} for every $5K of your {formatMoney(player.debt)} debt.
            </p>
          </>
        )}
        <div className="sheet__row receipt__total">
          <span>To your cash</span>
          <span>{formatMoneyChange(receipt.net)}</span>
        </div>
      </div>
      <div className="sheet__box">
        <BeforeAfter label="Cash" before={formatMoney(player.cash)} after={formatMoney(player.cash + receipt.net)} />
        <BeforeAfter label="Railroad ties" before={String(ties)} after={String(ties + contractTies)} />
      </div>
      <CommoditySources commodity={contract.commodity} />
      {receipt.affordable ? (
        <button
          type="button"
          className="button sheet__primary"
          onClick={() => {
            if (onDeliver(slot)) onClose();
          }}
        >
          {contract.type === "private" ? "Deliver and choose a new contract" : "Deliver"}
        </button>
      ) : (
        <p className="sheet__warning" role="alert">
          Debt service is more than this delivery pays plus your cash. Borrow first using Loans, then deliver.
        </p>
      )}
    </Sheet>
  );
}
