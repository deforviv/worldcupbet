/**
 * Combined odds calculations aligned with backend (bets.service.js placeCoupon).
 * Product of decimal odds, rounded to 4 dp; potential win rounded to 2 dp.
 */

export function computeCombinedOdds(bets) {
  if (!Array.isArray(bets) || bets.length === 0) return 0;

  const product = bets.reduce((acc, bet) => {
    const odds = Number(bet.odds);
    return acc * (Number.isFinite(odds) && odds > 0 ? odds : 1);
  }, 1);

  return Math.round(product * 10000) / 10000;
}

export function computePotentialWin(stake, combinedOdds) {
  const amount = Number(stake);
  const odds = Number(combinedOdds);
  if (!Number.isFinite(amount) || !Number.isFinite(odds) || amount <= 0 || odds <= 0) {
    return 0;
  }
  return Math.round(amount * odds * 100) / 100;
}

export function isCouponMode(bets) {
  return Array.isArray(bets) && bets.length > 1;
}
