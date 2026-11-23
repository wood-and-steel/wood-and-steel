/** Money display for the player app. Amounts are whole dollars; the game counts in $1,000s. */

/** 14000 -> "$14K", 0 -> "$0K", -2000 -> "-$2K". */
export function formatMoney(amount: number): string {
  const k = Math.abs(amount) / 1000;
  return `${amount < 0 && k > 0 ? '-' : ''}$${k}K`;
}

/** 5000 -> "+$5K", -3000 -> "-$3K": for money-log and receipt lines. */
export function formatMoneyChange(amount: number): string {
  return amount > 0 ? `+${formatMoney(amount)}` : formatMoney(amount);
}
