import type { Allocation, Portfolio } from '@/types/index'

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
export function getDCATarget(
  portfolio: Portfolio,
  allocations: Allocation[],
): string | null {
  const totalValue = portfolio.totalValueUsd
  if (totalValue <= 0) return null

  let maxDrift = 0
  let target: string | null = null

  for (const alloc of allocations) {
    const held = portfolio.assets.find((a) => a.asset === alloc.asset)
    const currentPct = held ? (held.valueUsd / totalValue) * 100 : 0
    const drift = alloc.targetPct - currentPct
    if (drift > maxDrift) {
      maxDrift = drift
      target = alloc.asset
    }
  }

  return target
}
