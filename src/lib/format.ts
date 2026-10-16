/** Rounds to at most three decimals and drops trailing zeros. */
export function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
