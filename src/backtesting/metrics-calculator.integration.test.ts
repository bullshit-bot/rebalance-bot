import { describe, expect, it } from "bun:test";
import { metricsCalculator } from "./metrics-calculator";
import type { BacktestConfig, SimulatedTrade } from "./metrics-calculator";

describe("metrics-calculator", () => {
  const baseConfig: BacktestConfig = {
    pairs: ["BTC/USDT", "ETH/USDT"],
    allocations: [
      { asset: "BTC", targetPct: 60, exchange: "binance" },
      { asset: "ETH", targetPct: 40, exchange: "binance" },
    ],
    startDate: 1000000,
    endDate: 2000000,
    initialBalance: 10000,
    threshold: 5,
    feePct: 0.001,
    timeframe: "1d",
    exchange: "binance",
  };

  describe("calculate with basic equity curve", () => {
    it("should calculate metrics from a simple growing equity curve", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1086400000, value: 10500 },
        { timestamp: 2000000, value: 11000 },
      ];
      const trades: SimulatedTrade[] = [];

      const metrics = metricsCalculator.calculate(equityCurve, trades, baseConfig);

      expect(metrics.totalReturnPct).toBeGreaterThan(0);
      expect(metrics.annualizedReturnPct).toBeGreaterThan(0);
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.totalFeesPaid).toBe(0);
      expect(metrics.avgTradeSize).toBe(0);
      expect(metrics.volatility).toBeGreaterThanOrEqual(0);
    });

    it("should handle zero-length equity curve", () => {
      const equityCurve: { timestamp: number; value: number }[] = [];
      const trades: SimulatedTrade[] = [];

      const metrics = metricsCalculator.calculate(equityCurve, trades, baseConfig);

      expect(metrics.totalReturnPct).toBe(0);
      expect(metrics.annualizedReturnPct).toBe(0);
      expect(metrics.sharpeRatio).toBe(0);
      expect(metrics.maxDrawdownPct).toBe(0);
      expect(metrics.volatility).toBe(0);
    });

    it("should handle single-point equity curve", () => {
      const equityCurve = [{ timestamp: 1000000, value: 10000 }];
      const trades: SimulatedTrade[] = [];

      const metrics = metricsCalculator.calculate(equityCurve, trades, baseConfig);

      expect(metrics.totalReturnPct).toBe(0);
      expect(metrics.volatility).toBe(0);
    });
  });

  describe("calculate returns", () => {
    it("should calculate positive returns", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 12000 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.totalReturnPct).toBe(20);
    });

    it("should calculate negative returns", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 8000 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.totalReturnPct).toBe(-20);
    });

    it("should calculate zero returns when flat", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 10000 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.totalReturnPct).toBe(0);
    });
  });

  describe("calculate max drawdown", () => {
    it("should calculate max drawdown correctly", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1086400000, value: 12000 }, // peak
        { timestamp: 2000000, value: 9000 }, // 25% drawdown
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.maxDrawdownPct).toBeCloseTo(25, 1);
    });

    it("should handle no drawdown (only upside)", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1086400000, value: 11000 },
        { timestamp: 2000000, value: 12000 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.maxDrawdownPct).toBe(0);
    });

    it("should handle total loss", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 0 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.maxDrawdownPct).toBe(100);
    });
  });

  describe("calculate sharpe ratio", () => {
    it("should calculate positive sharpe ratio for consistent growth", () => {
      // Simulate daily consistent growth
      const equityCurve = [];
      let value = 10000;
      for (let i = 0; i < 100; i++) {
        equityCurve.push({
          timestamp: 1000000 + i * 86400000,
          value: value,
        });
        value *= 1.001; // consistent 0.1% daily growth
      }
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.sharpeRatio).toBeGreaterThan(0);
    });

    it("should calculate zero sharpe ratio for flat returns", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1086400000, value: 10000 },
        { timestamp: 2000000, value: 10000 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.sharpeRatio).toBe(0);
    });
  });

  describe("calculate volatility", () => {
    it("should calculate volatility from equity curve", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1086400000, value: 10100 },
        { timestamp: 1172800000, value: 10050 },
        { timestamp: 1259200000, value: 10150 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.volatility).toBeGreaterThanOrEqual(0);
    });

    it("should be zero for flat equity curve", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1086400000, value: 10000 },
        { timestamp: 2000000, value: 10000 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.volatility).toBe(0);
    });
  });

  describe("calculate with trades", () => {
    it("should include trade count in metrics", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 11000 },
      ];
      const trades: SimulatedTrade[] = [
        {
          timestamp: 1000000,
          pair: "BTC/USDT",
          side: "buy",
          amount: 1,
          price: 30000,
          costUsd: 30000,
          fee: 10,
        },
        {
          timestamp: 1500000,
          pair: "BTC/USDT",
          side: "sell",
          amount: 1,
          price: 31000,
          costUsd: 31000,
          fee: 10,
        },
      ];

      const metrics = metricsCalculator.calculate(equityCurve, trades, baseConfig);

      expect(metrics.totalTrades).toBe(2);
      expect(metrics.totalFeesPaid).toBe(20);
      expect(metrics.avgTradeSize).toBe(30500);
    });

    it("should calculate win rate from trades", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1100000, value: 10100 }, // trade executed, equity increased
        { timestamp: 2000000, value: 10200 },
      ];
      const trades: SimulatedTrade[] = [
        {
          timestamp: 1100000,
          pair: "BTC/USDT",
          side: "buy",
          amount: 1,
          price: 30000,
          costUsd: 30000,
          fee: 10,
        },
      ];

      const metrics = metricsCalculator.calculate(equityCurve, trades, baseConfig);

      expect(metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeLessThanOrEqual(100);
    });

    it("should handle empty trades array", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 11000 },
      ];

      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.totalFeesPaid).toBe(0);
      expect(metrics.avgTradeSize).toBe(0);
      expect(metrics.winRate).toBe(0);
    });
  });

  describe("annualized return calculation", () => {
    it("should calculate annualized return over 1 year", () => {
      const oneYearMs = 365 * 86400000;
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1000000 + oneYearMs, value: 12000 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      // 20% over 1 year = 20% annualized
      expect(metrics.annualizedReturnPct).toBeCloseTo(20, 0);
    });

    it("should annualize correctly over short period", () => {
      const sixMonthsMs = 6 * 30 * 86400000;
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1000000 + sixMonthsMs, value: 10500 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      // 5% over 6 months should annualize to ~10%
      expect(metrics.annualizedReturnPct).toBeGreaterThan(5);
      expect(metrics.annualizedReturnPct).toBeLessThan(20);
    });
  });

  describe("edge cases", () => {
    it("should handle very small equity values", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 0.01 },
        { timestamp: 2000000, value: 0.02 },
      ];
      const smallConfig = { ...baseConfig, initialBalance: 0.01 };
      const metrics = metricsCalculator.calculate(equityCurve, [], smallConfig);

      expect(metrics.totalReturnPct).toBe(100);
      expect(isFinite(metrics.volatility)).toBe(true);
    });

    it("should handle large equity values", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 1000000000 },
        { timestamp: 2000000, value: 1200000000 },
      ];
      const largeConfig = { ...baseConfig, initialBalance: 1000000000 };
      const metrics = metricsCalculator.calculate(equityCurve, [], largeConfig);

      expect(metrics.totalReturnPct).toBe(20);
      expect(isFinite(metrics.volatility)).toBe(true);
    });

    it("should handle negative equity values gracefully", () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: -1000 },
      ];
      const metrics = metricsCalculator.calculate(equityCurve, [], baseConfig);

      // Should still calculate, even if mathematically unsound
      expect(metrics.totalReturnPct).toBeCloseTo(-110, 0);
      expect(isFinite(metrics.sharpeRatio)).toBe(true);
    });
  });
});
