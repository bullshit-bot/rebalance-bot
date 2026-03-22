// ─── Types ────────────────────────────────────────────────────────────────────

export interface GridLevel {
  level: number;
  price: number;
  /** Amount of base asset to buy at this level (0 if above current price) */
  buyAmount: number;
  /** Amount of base asset to sell at this level (0 if below current price) */
  sellAmount: number;
}

export interface GridCalcParams {
  priceLower: number;
  priceUpper: number;
  /** Number of price intervals — produces (gridLevels + 1) price points */
  gridLevels: number;
  /** Total USDT/quote investment budget */
  investment: number;
  currentPrice: number;
  gridType: "normal" | "reverse";
}

// ─── GridCalculator ───────────────────────────────────────────────────────────

/**
 * Computes arithmetic grid price levels and per-level order amounts.
 *
 * Normal grid: buy orders below current price, sell orders above.
 * Reverse grid: sell orders below current price, buy orders above.
 *
 * Investment is split evenly across all relevant buy-side levels so
 * each level receives an equal quote amount.
 */
class GridCalculator {
  /**
   * Returns one GridLevel per price point in the grid.
   * Prices are spaced arithmetically: step = (upper - lower) / gridLevels.
   */
  calculate(params: GridCalcParams): GridLevel[] {
    const { priceLower, priceUpper, gridLevels, investment, currentPrice, gridType } = params;

    if (priceLower >= priceUpper) {
      throw new Error("[GridCalculator] priceLower must be less than priceUpper");
    }
    if (gridLevels < 2) {
      throw new Error("[GridCalculator] gridLevels must be >= 2");
    }

    const step = (priceUpper - priceLower) / gridLevels;
    // Generate gridLevels + 1 price points
    const prices: number[] = [];
    for (let i = 0; i <= gridLevels; i++) {
      prices.push(+(priceLower + i * step).toFixed(8));
    }

    // Determine which price points are "buy side" for investment allocation
    const isBuySide = (price: number): boolean =>
      gridType === "normal" ? price < currentPrice : price > currentPrice;

    const buySidePrices = prices.filter(isBuySide);
    // Per-level investment in quote currency; fallback to zero if no buy levels
    const perLevelQuote = buySidePrices.length > 0 ? investment / buySidePrices.length : 0;

    return prices.map((price, index) => {
      const onBuySide = isBuySide(price);

      if (gridType === "normal") {
        // Normal: buy below, sell above
        const buyAmount = onBuySide && perLevelQuote > 0 ? +(perLevelQuote / price).toFixed(8) : 0;
        const sellAmount =
          !onBuySide && price > currentPrice && perLevelQuote > 0
            ? // Sell amount mirrors expected buy from level below
              +(perLevelQuote / price).toFixed(8)
            : 0;
        return { level: index, price, buyAmount, sellAmount };
      }
      // Reverse: sell below, buy above
      const sellAmount =
        !onBuySide && price < currentPrice && perLevelQuote > 0
          ? +(perLevelQuote / price).toFixed(8)
          : 0;
      const buyAmount = onBuySide && perLevelQuote > 0 ? +(perLevelQuote / price).toFixed(8) : 0;
      return { level: index, price, buyAmount, sellAmount };
    });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const gridCalculator = new GridCalculator();
export { GridCalculator };
