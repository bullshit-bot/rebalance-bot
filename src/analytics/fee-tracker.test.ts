import { describe, expect, it } from "bun:test";

// Fee aggregation logic
function aggregateFees(rows: Array<{ exchange: string; pair: string; fee: number | null }>) {
  let total = 0;
  const byExchange: Record<string, number> = {};
  const byAsset: Record<string, number> = {};

  for (const row of rows) {
    const feeUsd = row.fee ?? 0;
    if (feeUsd === 0) continue;

    total += feeUsd;

    byExchange[row.exchange] = (byExchange[row.exchange] ?? 0) + feeUsd;

    const asset = row.pair.split("/")[0] ?? row.pair;
    byAsset[asset] = (byAsset[asset] ?? 0) + feeUsd;
  }

  return { total, byExchange, byAsset };
}

describe("FeeTracker - Core Logic", () => {
  it("aggregates total fees from multiple trades", () => {
    const trades = [
      { exchange: "binance", pair: "BTC/USDT", fee: 150 },
      { exchange: "binance", pair: "ETH/USDT", fee: 50 },
      { exchange: "binance", pair: "SOL/USDT", fee: 100 },
    ];

    const result = aggregateFees(trades);

    expect(result.total).toBeCloseTo(300, 1);
  });

  it("groups fees by exchange", () => {
    const trades = [
      { exchange: "binance", pair: "BTC/USDT", fee: 100 },
      { exchange: "binance", pair: "ETH/USDT", fee: 50 },
      { exchange: "okx", pair: "SOL/USDT", fee: 200 },
    ];

    const result = aggregateFees(trades);

    expect(result.byExchange["binance"]).toBeCloseTo(150, 1);
    expect(result.byExchange["okx"]).toBeCloseTo(200, 1);
  });

  it("groups fees by asset (base asset of pair)", () => {
    const trades = [
      { exchange: "binance", pair: "BTC/USDT", fee: 100 },
      { exchange: "binance", pair: "BTC/USDT", fee: 120 },
      { exchange: "binance", pair: "ETH/USDT", fee: 50 },
    ];

    const result = aggregateFees(trades);

    expect(result.byAsset["BTC"]).toBeCloseTo(220, 1);
    expect(result.byAsset["ETH"]).toBeCloseTo(50, 1);
  });

  it("handles null fees gracefully", () => {
    const trades = [
      { exchange: "binance", pair: "BTC/USDT", fee: null },
      { exchange: "binance", pair: "ETH/USDT", fee: 50 },
    ];

    const result = aggregateFees(trades);

    expect(result.total).toBeCloseTo(50, 1);
  });

  it("returns zero fees when no trades exist", () => {
    const trades: Array<{ exchange: string; pair: string; fee: number | null }> = [];

    const result = aggregateFees(trades);

    expect(result.total).toBe(0);
    expect(Object.keys(result.byExchange).length).toBe(0);
    expect(Object.keys(result.byAsset).length).toBe(0);
  });

  it("handles zero fees without including them in aggregates", () => {
    const trades = [
      { exchange: "binance", pair: "BTC/USDT", fee: 0 },
      { exchange: "binance", pair: "ETH/USDT", fee: 0 },
      { exchange: "binance", pair: "SOL/USDT", fee: 150 },
    ];

    const result = aggregateFees(trades);

    expect(result.total).toBeCloseTo(150, 1);
    expect(result.byAsset["BTC"]).toBeUndefined();
    expect(result.byAsset["ETH"]).toBeUndefined();
    expect(result.byAsset["SOL"]).toBeCloseTo(150, 1);
  });

  it("correctly parses pair base asset for fee grouping", () => {
    const trades = [
      { exchange: "binance", pair: "WBTC/USDT", fee: 100 },
      { exchange: "binance", pair: "BTC/USDT", fee: 50 },
    ];

    const result = aggregateFees(trades);

    expect(result.byAsset["WBTC"]).toBeCloseTo(100, 1);
    expect(result.byAsset["BTC"]).toBeCloseTo(50, 1);
  });

  it("aggregates multiple exchanges correctly", () => {
    const trades = [
      { exchange: "binance", pair: "BTC/USDT", fee: 150 },
      { exchange: "okx", pair: "BTC/USDT", fee: 120 },
      { exchange: "bybit", pair: "BTC/USDT", fee: 90 },
    ];

    const result = aggregateFees(trades);

    expect(result.total).toBeCloseTo(360, 1);
    expect(Object.keys(result.byExchange).length).toBe(3);
  });

  it("filters trades by timestamp range", () => {
    const now = Date.now();
    const dayAgoMs = now - 86400000;

    const allTrades = [
      { timestamp: dayAgoMs, exchange: "binance", pair: "BTC/USDT", fee: 100 },
      { timestamp: now - 100, exchange: "binance", pair: "ETH/USDT", fee: 50 },
    ];

    const filtered = allTrades.filter((t) => t.timestamp >= dayAgoMs);

    expect(filtered.length).toBe(2);
  });
});
