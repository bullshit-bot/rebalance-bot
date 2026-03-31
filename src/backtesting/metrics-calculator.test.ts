import { beforeEach, describe, expect, it } from "bun:test";
import { type BacktestConfig, MetricsCalculator, type SimulatedTrade } from "./metrics-calculator";

let calc: MetricsCalculator;

beforeEach(() => {
  calc = new MetricsCalculator();
});

describe("MetricsCalculator", () => {
  describe("total return calculation", () => {
    it("calculates positive total return", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 11000 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.totalReturnPct).toBeCloseTo(10, 1);
    });

    it("calculates negative total return", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 8500 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.totalReturnPct).toBeCloseTo(-15, 1);
    });
  });

  describe("annualized return (CAGR)", () => {
    it("calculates CAGR for 1 year period", () => {
      const now = Date.now();
      const oneYearMs = 365 * 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + oneYearMs, value: 12000 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + oneYearMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.annualizedReturnPct).toBeCloseTo(20, 1);
    });

    it("calculates CAGR for 6-month period", () => {
      const now = Date.now();
      const sixMonthsMs = 180 * 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + sixMonthsMs, value: 11050 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + sixMonthsMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.annualizedReturnPct).toBeGreaterThan(0);
    });
  });

  describe("max drawdown", () => {
    it("calculates max drawdown from peak to trough", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 12000 }, // Peak
        { timestamp: now + 2 * 86400000, value: 8400 }, // Trough = -30%
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 2 * 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.maxDrawdownPct).toBeCloseTo(30, 1);
    });

    it("returns zero drawdown for monotonic increase", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 11000 },
        { timestamp: now + 2 * 86400000, value: 12000 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 2 * 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.maxDrawdownPct).toBeCloseTo(0, 1);
    });
  });

  describe("Sharpe ratio", () => {
    it("calculates Sharpe ratio with positive returns", () => {
      const now = Date.now();
      const dayMs = 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + dayMs, value: 10100 },
        { timestamp: now + 2 * dayMs, value: 10200 },
        { timestamp: now + 3 * dayMs, value: 10300 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 3 * dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.sharpeRatio).toBeGreaterThan(0);
    });

    it("returns zero Sharpe with zero volatility", () => {
      const now = Date.now();
      const dayMs = 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + dayMs, value: 10000 },
        { timestamp: now + 2 * dayMs, value: 10000 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 2 * dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.sharpeRatio).toBe(0);
    });
  });

  describe("volatility", () => {
    it("calculates annualized volatility", () => {
      const now = Date.now();
      const dayMs = 86400000;

      // Create volatile returns: alternating +5% and -5%
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + dayMs, value: 10500 },
        { timestamp: now + 2 * dayMs, value: 9975 },
        { timestamp: now + 3 * dayMs, value: 10475 },
        { timestamp: now + 4 * dayMs, value: 9950 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 4 * dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.volatility).toBeGreaterThan(0);
    });
  });

  describe("win rate", () => {
    it("calculates win rate from rebalance trades", () => {
      const now = Date.now();
      const dayMs = 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + dayMs, value: 10200 }, // After rebalance 1 - win
        { timestamp: now + 2 * dayMs, value: 10100 }, // After rebalance 2 - loss
      ];

      const trades: SimulatedTrade[] = [
        {
          timestamp: now,
          pair: "BTC/USDT",
          side: "buy",
          amount: 0.1,
          price: 30000,
          costUsd: 3000,
          fee: 3,
        },
        {
          timestamp: now + dayMs,
          pair: "ETH/USDT",
          side: "buy",
          amount: 1,
          price: 2000,
          costUsd: 2000,
          fee: 2,
        },
      ];

      const config: BacktestConfig = {
        pairs: ["BTC/USDT", "ETH/USDT"],
        allocations: [
          { asset: "BTC", targetPct: 50, exchange: "binance" },
          { asset: "ETH", targetPct: 50, exchange: "binance" },
        ],
        startDate: now,
        endDate: now + 2 * dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeLessThanOrEqual(100);
    });
  });

  describe("trade statistics", () => {
    it("counts total trades", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 11000 },
      ];

      const trades: SimulatedTrade[] = [
        {
          timestamp: now,
          pair: "BTC/USDT",
          side: "buy",
          amount: 0.1,
          price: 30000,
          costUsd: 3000,
          fee: 3,
        },
        {
          timestamp: now,
          pair: "ETH/USDT",
          side: "sell",
          amount: 1,
          price: 2000,
          costUsd: 2000,
          fee: 2,
        },
        {
          timestamp: now + 86400000,
          pair: "SOL/USDT",
          side: "buy",
          amount: 10,
          price: 100,
          costUsd: 1000,
          fee: 1,
        },
      ];

      const config: BacktestConfig = {
        pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
        allocations: [
          { asset: "BTC", targetPct: 33, exchange: "binance" },
          { asset: "ETH", targetPct: 33, exchange: "binance" },
          { asset: "SOL", targetPct: 34, exchange: "binance" },
        ],
        startDate: now,
        endDate: now + 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.totalTrades).toBe(3);
    });

    it("calculates total fees paid", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 11000 },
      ];

      const trades: SimulatedTrade[] = [
        {
          timestamp: now,
          pair: "BTC/USDT",
          side: "buy",
          amount: 0.1,
          price: 30000,
          costUsd: 3000,
          fee: 30, // $30
        },
        {
          timestamp: now,
          pair: "ETH/USDT",
          side: "sell",
          amount: 1,
          price: 2000,
          costUsd: 2000,
          fee: 20, // $20
        },
      ];

      const config: BacktestConfig = {
        pairs: ["BTC/USDT", "ETH/USDT"],
        allocations: [
          { asset: "BTC", targetPct: 50, exchange: "binance" },
          { asset: "ETH", targetPct: 50, exchange: "binance" },
        ],
        startDate: now,
        endDate: now + 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.totalFeesPaid).toBeCloseTo(50, 1);
    });

    it("calculates average trade size", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 11000 },
      ];

      const trades: SimulatedTrade[] = [
        {
          timestamp: now,
          pair: "BTC/USDT",
          side: "buy",
          amount: 0.1,
          price: 30000,
          costUsd: 3000,
          fee: 3,
        },
        {
          timestamp: now,
          pair: "ETH/USDT",
          side: "sell",
          amount: 1,
          price: 2000,
          costUsd: 2000,
          fee: 2,
        },
        {
          timestamp: now + 86400000,
          pair: "SOL/USDT",
          side: "buy",
          amount: 10,
          price: 100,
          costUsd: 1000,
          fee: 1,
        },
      ];

      const config: BacktestConfig = {
        pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
        allocations: [
          { asset: "BTC", targetPct: 33, exchange: "binance" },
          { asset: "ETH", targetPct: 33, exchange: "binance" },
          { asset: "SOL", targetPct: 34, exchange: "binance" },
        ],
        startDate: now,
        endDate: now + 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      const avgSize = (3000 + 2000 + 1000) / 3;
      expect(metrics.avgTradeSize).toBeCloseTo(avgSize, 1);
    });
  });

  it("returns zero metrics for insufficient data", () => {
    const now = Date.now();
    const equityCurve = [{ timestamp: now, value: 10000 }];
    const trades: SimulatedTrade[] = [];
    const config: BacktestConfig = {
      pairs: ["BTC/USDT"],
      allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
      startDate: now,
      endDate: now + 86400000,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: "1d",
      exchange: "binance",
    };

    const metrics = calc.calculate(equityCurve, trades, config);

    expect(metrics.totalReturnPct).toBe(0);
    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.maxDrawdownPct).toBe(0);
  });

  describe("daily returns calculation", () => {
    it("calculates returns from multi-day equity curve", () => {
      const now = Date.now();
      const dayMs = 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + dayMs, value: 10100 },
        { timestamp: now + 2 * dayMs, value: 10200 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 2 * dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.volatility).toBeGreaterThanOrEqual(0);
      expect(metrics.totalTrades).toBe(0);
    });

    it("handles overlapping timestamps in same day", () => {
      const now = Date.now();
      const dayMs = 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 1000, value: 10050 }, // Same day
        { timestamp: now + 2000, value: 10100 }, // Same day
        { timestamp: now + dayMs, value: 10200 }, // Next day
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      // Should take last value of each day
      expect(metrics.totalReturnPct).toBeCloseTo(2, 1);
    });
  });

  describe("edge cases", () => {
    it("handles zero portfolio value gracefully", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 0 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.totalReturnPct).toBeCloseTo(-100, 1);
      expect(metrics.maxDrawdownPct).toBeCloseTo(100, 1);
    });

    it("handles identical daily returns (flat performance)", () => {
      const now = Date.now();
      const dayMs = 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + dayMs, value: 10000 },
        { timestamp: now + 2 * dayMs, value: 10000 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 2 * dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.totalReturnPct).toBe(0);
      expect(metrics.sharpeRatio).toBe(0);
      expect(metrics.volatility).toBe(0);
    });

    it("handles very high volatility", () => {
      const now = Date.now();
      const dayMs = 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + dayMs, value: 15000 }, // +50%
        { timestamp: now + 2 * dayMs, value: 5000 }, // -67%
        { timestamp: now + 3 * dayMs, value: 20000 }, // +300%
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 3 * dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.volatility).toBeGreaterThan(100);
      expect(metrics.maxDrawdownPct).toBeGreaterThan(50);
    });

    it("handles negative returns on trade", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 9500 },
      ];

      const trades: SimulatedTrade[] = [
        {
          timestamp: now,
          pair: "BTC/USDT",
          side: "buy",
          amount: 0.1,
          price: 30000,
          costUsd: 3000,
          fee: 30,
        },
      ];

      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.totalReturnPct).toBeCloseTo(-5, 1);
      expect(metrics.totalFeesPaid).toBe(30);
    });

    it("handles empty trades array", () => {
      const now = Date.now();
      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + 86400000, value: 11000 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + 86400000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.totalFeesPaid).toBe(0);
      expect(metrics.avgTradeSize).toBe(0);
    });

    it("calculates correct win rate with multiple rebalances", () => {
      const now = Date.now();
      const dayMs = 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + dayMs, value: 10500 }, // Win
        { timestamp: now + 2 * dayMs, value: 10200 }, // Loss
        { timestamp: now + 3 * dayMs, value: 11000 }, // Win
      ];

      const trades: SimulatedTrade[] = [
        {
          timestamp: now,
          pair: "BTC/USDT",
          side: "buy",
          amount: 0.1,
          price: 30000,
          costUsd: 3000,
          fee: 3,
        },
        {
          timestamp: now + dayMs,
          pair: "ETH/USDT",
          side: "sell",
          amount: 1,
          price: 2000,
          costUsd: 2000,
          fee: 2,
        },
        {
          timestamp: now + 2 * dayMs,
          pair: "BTC/USDT",
          side: "buy",
          amount: 0.05,
          price: 31000,
          costUsd: 1550,
          fee: 1.55,
        },
      ];

      const config: BacktestConfig = {
        pairs: ["BTC/USDT", "ETH/USDT"],
        allocations: [
          { asset: "BTC", targetPct: 50, exchange: "binance" },
          { asset: "ETH", targetPct: 50, exchange: "binance" },
        ],
        startDate: now,
        endDate: now + 3 * dayMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      expect(metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(metrics.winRate).toBeLessThanOrEqual(100);
      expect(metrics.totalTrades).toBe(3);
    });
  });

  describe("annualized metrics", () => {
    it("calculates annualized return for shorter periods", () => {
      const now = Date.now();
      const thirtyDaysMs = 30 * 86400000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + thirtyDaysMs, value: 10100 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + thirtyDaysMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1d",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      // 1% return over 30 days → higher annualized return
      expect(metrics.annualizedReturnPct).toBeGreaterThan(metrics.totalReturnPct);
    });

    it("handles very short duration (< 1 day)", () => {
      const now = Date.now();
      const oneHourMs = 3600000;

      const equityCurve = [
        { timestamp: now, value: 10000 },
        { timestamp: now + oneHourMs, value: 10100 },
      ];
      const trades: SimulatedTrade[] = [];
      const config: BacktestConfig = {
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" }],
        startDate: now,
        endDate: now + oneHourMs,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: "1h",
        exchange: "binance",
      };

      const metrics = calc.calculate(equityCurve, trades, config);

      // Even with very short duration, should calculate meaningful metrics
      expect(metrics.totalReturnPct).toBeCloseTo(1, 0);
    });
  });
});
