import React from "react";
import type { PlayerProps } from "../stores/gameStore";
import { getPlayerAvatarColor } from "../utils/playerAvatar";
import { formatMoney } from "../utils/money";
import { PlayerAvatar } from "./PlayerAvatar";

export interface MoneyStripProps {
  player: PlayerProps;
  playerID: string;
  isCurrentTurn: boolean;
  /** Cash, debt and Loans show in play; in setup, before there's money, the player's name instead. */
  showMoney: boolean;
  onOpenLoans: () => void;
}

/**
 * The player's money, always in view: fixed to the top of the screen on phones and tablets, and
 * at the right end of the nav row on desktop. It sits above sheet scrims, and sheets open below
 * it, so cash and debt stay visible while a sheet changes them.
 */
export function MoneyStrip({ player, playerID, isCurrentTurn, showMoney, onOpenLoans }: MoneyStripProps): React.ReactElement {
  const { name, avatarColor, cash, debt } = player;
  return (
    <div className="moneyStrip" role="group" aria-label="Your money">
      <PlayerAvatar name={name} avatarColor={getPlayerAvatarColor(playerID, avatarColor)} isCurrentTurn={isCurrentTurn} />
      {showMoney ? (
        <>
          <span className="moneyStrip__cash" aria-label={`Cash ${formatMoney(cash)}`}>
            {formatMoney(cash)}
          </span>
          <span
            className={`moneyStrip__debt${debt > 0 ? "" : " moneyStrip__debt--none"}`}
            aria-label={`Debt ${formatMoney(debt)}`}
          >
            {formatMoney(debt)} debt
          </span>
          <button type="button" className="button moneyStrip__loans" onClick={onOpenLoans}>
            Loans
          </button>
        </>
      ) : (
        <span className="moneyStrip__name">{name}</span>
      )}
    </div>
  );
}
