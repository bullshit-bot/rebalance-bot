import type { Allocation, Portfolio } from "@/types/index";
import { STABLECOINS } from "@rebalancer/trade-calculator";

// ─── getDCATarget ─────────────────────────────────────────────────────────────

/**
 * Finds the single asset that DCA should concentrate on next.
 *
 * Used when dcaRebalanceEnabled=true in the active strategy config.
 * Returns the asset with the largest positive drift (most underweight), or
 * null if all assets are at/above target (deposit goes to cash reserve).
 *
 * @param portfolio   - Current portfolio snapshot
 * @param allocations - Target allocations from active strategy
 * @returns Asset symbol or null
 */
export function getDCATarget(portfolio: Portfolio, allocations: Allocation[]): string | null {
  // Calculate total crypto value (exclude stablecoins like USDT)
  // Target %s are relative to the crypto portion, not the full portfolio
  const cryptoValue = portfolio.assets
    .filter((a) => !STABLECOINS.has(a.asset))
    .reduce((sum, a) => sum + a.valueUsd, 0);

  // If crypto value negligible (dust), pick the asset with highest target
  if (cryptoValue < 10) {
    let maxTarget = 0;
    let target: string | null = null;
    for (const alloc of allocations) {
      if (alloc.targetPct > maxTarget) {
        maxTarget = alloc.targetPct;
        target = alloc.asset;
      }
    }
    return target;
  }

  let maxDrift = 0;
  let target: string | null = null;

  for (const alloc of allocations) {
    const held = portfolio.assets.find((a) => a.asset === alloc.asset);
    const currentPct = held ? (held.valueUsd / cryptoValue) * 100 : 0;
    const drift = alloc.targetPct - currentPct;
    if (drift > maxDrift) {
      maxDrift = drift;
      target = alloc.asset;
    }
  }

  return target;
}
