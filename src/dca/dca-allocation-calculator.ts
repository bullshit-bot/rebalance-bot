import type { Allocation, ExchangeName, Portfolio, TradeOrder } from "@/types/index";
import { priceCache } from "@price/price-cache";
import { STABLECOINS } from "@rebalancer/trade-calculator";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeficitEntry = {
  asset: string;
  deficitPct: number;
  exchange: ExchangeName;
};

// ─── Proportional DCA allocation ─────────────────────────────────────────────

/**
 * Proportionally allocates a deposit across underweight assets.
 * Each asset's share is proportional to its deficit (targetPct - currentPct).
 * Assets below minTradeUsd are skipped.
 */
export function calcProportionalDCA(
  depositAmount: number,
  portfolio: Portfolio,
  targets: Allocation[],
  minTradeUsd: number
): TradeOrder[] {
  const targetMap = new Map<string, { targetPct: number; exchange?: ExchangeName }>();
  for (const t of targets) {
    const entry: { targetPct: number; exchange?: ExchangeName } = { targetPct: t.targetPct };
    if (t.exchange !== undefined) entry.exchange = t.exchange;
    targetMap.set(t.asset, entry);
  }

  // Calculate current % relative to crypto portion only (exclude stablecoins)
  const cryptoValue = portfolio.assets
    .filter((a) => !STABLECOINS.has(a.asset))
    .reduce((sum, a) => sum + a.valueUsd, 0);

  const underweight: DeficitEntry[] = [];
  for (const [asset, target] of targetMap) {
    const portfolioAsset = portfolio.assets.find((a) => a.asset === asset);
    // When crypto holdings are negligible (dust), ignore current % and use pure target %
    const currentPct =
      cryptoValue >= depositAmount && portfolioAsset
        ? (portfolioAsset.valueUsd / cryptoValue) * 100
        : 0;
    const deficit = target.targetPct - currentPct;
    if (deficit > 0) {
      underweight.push({
        asset,
        deficitPct: deficit,
        exchange: target.exchange ?? portfolioAsset?.exchange ?? "binance",
      });
    }
  }

  if (underweight.length === 0) return [];

  underweight.sort((a, b) => b.deficitPct - a.deficitPct);
  const totalDeficit = underweight.reduce((sum, e) => sum + e.deficitPct, 0);
  const orders: TradeOrder[] = [];

  for (const entry of underweight) {
    const allocationUsd = (entry.deficitPct / totalDeficit) * depositAmount;
    if (allocationUsd < minTradeUsd) continue;

    const portfolioAsset = portfolio.assets.find((a) => a.asset === entry.asset);
    let priceUsd: number | undefined;
    if (portfolioAsset && portfolioAsset.amount > 0 && portfolioAsset.valueUsd > 0) {
      priceUsd = portfolioAsset.valueUsd / portfolioAsset.amount;
    } else {
      priceUsd = priceCache.getBestPrice(`${entry.asset}/USDT`) ?? undefined;
    }
    if (!priceUsd) continue;
    orders.push({
      exchange: entry.exchange,
      pair: `${entry.asset}/USDT`,
      side: "buy",
      type: "market",
      amount: allocationUsd / priceUsd,
    });
  }

  return orders;
}

// ─── Single-target DCA (rebalance routing mode) ───────────────────────────────

/**
 * Concentrates the full deposit into one target asset.
 * Returns [] if deposit < minTradeUsd or asset has no price in portfolio.
 */
export function calcSingleTargetDCA(
  asset: string,
  depositAmount: number,
  portfolio: Portfolio,
  targets: Allocation[],
  minTradeUsd: number
): TradeOrder[] {
  if (depositAmount < minTradeUsd) {
    console.log(
      `[DCAAlloc] Target=${asset} deposit $${depositAmount.toFixed(2)} < min $${minTradeUsd}`
    );
    return [];
  }

  const alloc = targets.find((t) => t.asset === asset);
  const portfolioAsset = portfolio.assets.find((a) => a.asset === asset);

  // Get price from portfolio (if asset held) or price cache (if 0 balance)
  let priceUsd: number | undefined;
  if (portfolioAsset && portfolioAsset.amount > 0 && portfolioAsset.valueUsd > 0) {
    priceUsd = portfolioAsset.valueUsd / portfolioAsset.amount;
  } else {
    const pair = `${asset}/USDT`;
    priceUsd = priceCache.getBestPrice(pair) ?? undefined;
  }

  if (!priceUsd) {
    console.log(`[DCAAlloc] Target=${asset} has no price available, skipping`);
    return [];
  }

  const exchange: ExchangeName = alloc?.exchange ?? portfolioAsset?.exchange ?? "binance";
  console.log(
    `[DCAAlloc] DCA routing: full $${depositAmount.toFixed(2)} → ${asset} (most underweight)`
  );

  return [
    {
      exchange,
      pair: `${asset}/USDT`,
      side: "buy",
      type: "market",
      amount: depositAmount / priceUsd,
    },
  ];
}
