import React from "react";
import type { PlayerProps } from "../stores/gameStore";
import { repayOptions, serviceOn } from "../rules/finance";
import { BORROW_STEP, DEBT_FLOOR } from "../rules/rulesData";
import { formatMoney } from "../utils/money";
import { BeforeAfter, RadioOption, Sheet } from "./Sheet";

export interface LoansSheetProps {
  player: PlayerProps;
  /** Borrowing and repaying are turn actions: only on the player's own turn. */
  isMyTurn: boolean;
  onBorrow: (amount: number) => boolean;
  onRepay: (amount: number) => boolean;
  onClose: () => void;
}

type Tab = "borrow" | "repay";

/** When debt service is due, given where the player has delivered so far. */
function DebtServiceProgress({ player }: { player: PlayerProps }): React.ReactElement {
  return (
    <div className="loans__progress" aria-label="When debt service is due">
      <div className="sheet__subhead">When debt service is due</div>
      <div className="sheet__row">
        <span>East</span>
        <span className="sheet__label">never</span>
      </div>
      <div className="sheet__row">
        <span className={player.centralDebtServicePaid ? "" : "loans__next"}>Central</span>
        <span className="sheet__label">
          {player.centralDebtServicePaid ? "paid" : "once, on your first delivery there"}
        </span>
      </div>
      <div className="sheet__row">
        <span className={player.westernDeliveryMade ? "loans__next" : ""}>West</span>
        <span className="sheet__label">
          {player.westernDeliveryMade ? "on every delivery now" : "every delivery after your first there"}
        </span>
      </div>
    </div>
  );
}

/** Borrow in $5,000 steps, or repay what the rules allow. Reached from the Loans button on every screen. */
export function LoansSheet({ player, isMyTurn, onBorrow, onRepay, onClose }: LoansSheetProps): React.ReactElement {
  const [tab, setTab] = React.useState<Tab>("borrow");
  const panelId = React.useId();
  const [amount, setAmount] = React.useState(BORROW_STEP);
  const repays = repayOptions(player);
  const [repayAmount, setRepayAmount] = React.useState<number | null>(repays[0] ?? null);

  /** A tab's panel. The hidden one keeps its space but can't be reached (inert: React 18 has no prop for it). */
  const panelProps = (t: Tab) => ({
    className: `loans__panel${tab === t ? "" : " loans__panel--hidden"}`,
    role: "tabpanel",
    id: `${panelId}-${t}`,
    "aria-labelledby": `${panelId}-${t}-tab`,
    ...(tab === t ? {} : { "aria-hidden": true, inert: "" }),
  });

  const act = (done: boolean) => {
    if (done) onClose();
  };

  return (
    <Sheet title="Loans" onClose={onClose}>
      <div className="sheet__tabs" role="tablist">
        {(["borrow", "repay"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${panelId}-${t}-tab`}
            aria-controls={`${panelId}-${t}`}
            aria-selected={tab === t}
            className={`sheet__tab${tab === t ? " sheet__tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "borrow" ? "Borrow" : "Repay"}
          </button>
        ))}
      </div>

      {/* Both panels share one grid cell, so the sheet keeps the taller one's height and the tabs stay put. */}
      <div className="loans__panels">
        <div {...panelProps("borrow")}>
          <div className="loans__stepper">
            <button
              type="button"
              className="button"
              aria-label="Borrow $5K less"
              onClick={() => setAmount((a: number) => Math.max(BORROW_STEP, a - BORROW_STEP))}
            >
              −
            </button>
            <span className="loans__amount">{formatMoney(amount)}</span>
            <button
              type="button"
              className="button"
              aria-label="Borrow $5K more"
              onClick={() => setAmount((a: number) => a + BORROW_STEP)}
            >
              +
            </button>
          </div>
          <p className="sheet__note">In $5K steps, with no limit.</p>
          <div className="sheet__box">
            <BeforeAfter label="Cash" before={formatMoney(player.cash)} after={formatMoney(player.cash + amount)} />
            <BeforeAfter label="Debt" before={formatMoney(player.debt)} after={formatMoney(player.debt + amount)} />
            <BeforeAfter
              label="Debt service"
              before={formatMoney(serviceOn(player.debt))}
              after={formatMoney(serviceOn(player.debt + amount))}
            />
          </div>
          <DebtServiceProgress player={player} />
          {isMyTurn ? (
            <button type="button" className="button sheet__primary" onClick={() => act(onBorrow(amount))}>
              Borrow {formatMoney(amount)}
            </button>
          ) : (
            <p className="sheet__note">You can borrow on your turn.</p>
          )}
        </div>
        <div {...panelProps("repay")}>
          {repays.length === 0 ? (
            <p className="sheet__note">
              {player.debt < DEBT_FLOOR + BORROW_STEP
                ? `Repaying opens once your debt reaches ${formatMoney(DEBT_FLOOR + BORROW_STEP)}.`
                : `You need at least ${formatMoney(BORROW_STEP)} in cash to repay.`}
            </p>
          ) : (
            <>
              <div className="sheet__options" role="radiogroup" aria-label="Amount to repay">
                {repays.map((r) => (
                  <RadioOption key={r} name="repayAmount" checked={repayAmount === r} onSelect={() => setRepayAmount(r)}>
                    <strong>Repay {formatMoney(r)}</strong>
                    <span className="sheet__label">
                      Debt to {formatMoney(player.debt - r)}, service {formatMoney(serviceOn(player.debt - r))}
                    </span>
                  </RadioOption>
                ))}
              </div>
              <p className="sheet__note">
                You can repay while your debt is {formatMoney(DEBT_FLOOR + BORROW_STEP)} or more, but not below{" "}
                {formatMoney(DEBT_FLOOR)}.
              </p>
              {repayAmount !== null && (
                <div className="sheet__box">
                  <BeforeAfter label="Cash" before={formatMoney(player.cash)} after={formatMoney(player.cash - repayAmount)} />
                </div>
              )}
              {isMyTurn ? (
                repayAmount !== null && (
                  <button type="button" className="button sheet__primary" onClick={() => act(onRepay(repayAmount))}>
                    Repay {formatMoney(repayAmount)}
                  </button>
                )
              ) : (
                <p className="sheet__note">You can repay on your turn.</p>
              )}
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
