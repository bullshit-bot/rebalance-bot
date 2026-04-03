import { describe, expect, it, spyOn } from "bun:test";
import { backtestSimulator } from "./backtest-simulator";
import { strategyOptimizer } from "./strategy-optimizer";

describe("StrategyOptimizer", () => {
  it("runs optimization with mocked simulator", async () => {
    const mockRun = spyOn(backtestSimulator, "run").mockResolvedValue({
      metrics: {
        totalReturnPct: 25,
        sharpeRatio: 1.5,
        maxDrawdownPct: -10,
        totalTrades: 50,
        annualizedReturnPct: 20,
        volatilityPct: 15,
        winRate: 60,
        profitFactor: 1.8,
        avgTradeReturnPct: 0.5,
        calmarRatio: 2.0,
        sortinoRatio: 1.8,
      },
      equityCurve: [],
      trades: [],
      finalPortfolio: {},
    } as any);

    try {
      const result = await strategyOptimizer.optimize({
        exchange: "binance",
        pairs: ["BTC/USDT"],
        startDate: "2024-01-01",
        endDate: "2024-06-01",
        initialCapital: 10000,
        allocations: [{ asset: "BTC", targetPct: 100 }],
        strategyTypes: ["threshold"],
        topN: 3,
      });

      expect(result.totalCombinations).toBe(6); // 6 threshold combos
      expect(result.ranCombinations).toBe(6);
      expect(result.skippedCombinations).toBe(0);
      expect(result.results.length).toBe(3); // topN = 3
      expect(result.bestStrategy).toBeDefined();
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);

      // Verify ranks are 1-based and sorted
      for (let i = 0; i < result.results.length; i++) {
        expect(result.results[i].rank).toBe(i + 1);
      }

      // Verify composite score is computed
      for (const r of result.results) {
        expect(typeof r.compositeScore).toBe("number");
        expect(r.compositeScore).toBeGreaterThan(0);
      }
    } finally {
      mockRun.mockRestore();
    }
  });

  it("handles simulator failures gracefully (skipped combos)", async () => {
    let callCount = 0;
    const mockRun = spyOn(backtestSimulator, "run").mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 0) throw new Error("Simulated failure");
      return {
        metrics: {
          totalReturnPct: 10,
          sharpeRatio: 1.0,
          maxDrawdownPct: -5,
          totalTrades: 20,
          annualizedReturnPct: 8,
          volatilityPct: 10,
          winRate: 55,
          profitFactor: 1.5,
          avgTradeReturnPct: 0.3,
          calmarRatio: 1.6,
          sortinoRatio: 1.2,
        },
        equityCurve: [],
        trades: [],
        finalPortfolio: {},
      } as any;
    });

    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    try {
      const result = await strategyOptimizer.optimize({
        exchange: "binance",
        pairs: ["BTC/USDT"],
        startDate: "2024-01-01",
        endDate: "2024-06-01",
        initialCapital: 10000,
        allocations: [{ asset: "BTC", targetPct: 100 }],
        strategyTypes: ["threshold"],
        topN: 10,
      });

      expect(result.skippedCombinations).toBeGreaterThan(0);
      expect(result.ranCombinations).toBeLessThan(result.totalCombinations);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      mockRun.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("calls onProgress callback", async () => {
    const mockRun = spyOn(backtestSimulator, "run").mockResolvedValue({
      metrics: {
        totalReturnPct: 5, sharpeRatio: 0.8, maxDrawdownPct: -3,
        totalTrades: 10, annualizedReturnPct: 4, volatilityPct: 8,
        winRate: 50, profitFactor: 1.2, avgTradeReturnPct: 0.2,
        calmarRatio: 1.3, sortinoRatio: 0.9,
      },
      equityCurve: [], trades: [], finalPortfolio: {},
    } as any);

    const progressCalls: [number, number][] = [];

    try {
      await strategyOptimizer.optimize(
        {
          exchange: "binance",
          pairs: ["BTC/USDT"],
          startDate: "2024-01-01",
          endDate: "2024-06-01",
          initialCapital: 10000,
          allocations: [{ asset: "BTC", targetPct: 100 }],
          strategyTypes: ["threshold"],
          topN: 3,
        },
        (completed, total) => progressCalls.push([completed, total])
      );

      // Should call progress for each combo + final
      expect(progressCalls.length).toBe(7); // 6 combos + final (6, 6)
      expect(progressCalls[0][0]).toBe(0); // first call starts at 0
      expect(progressCalls[progressCalls.length - 1][0]).toBe(6); // final = total
    } finally {
      mockRun.mockRestore();
    }
  });

  it("includes cash scenarios when includeCashScenarios is true", async () => {
    const mockRun = spyOn(backtestSimulator, "run").mockResolvedValue({
      metrics: {
        totalReturnPct: 15, sharpeRatio: 1.2, maxDrawdownPct: -8,
        totalTrades: 30, annualizedReturnPct: 12, volatilityPct: 12,
        winRate: 58, profitFactor: 1.6, avgTradeReturnPct: 0.4,
        calmarRatio: 1.5, sortinoRatio: 1.4,
      },
      equityCurve: [], trades: [], finalPortfolio: {},
    } as any);

    try {
      const result = await strategyOptimizer.optimize({
        exchange: "binance",
        pairs: ["BTC/USDT"],
        startDate: "2024-01-01",
        endDate: "2024-06-01",
        initialCapital: 10000,
        allocations: [{ asset: "BTC", targetPct: 100 }],
        strategyTypes: ["threshold"],
        topN: 50,
        includeCashScenarios: true,
      });

      // Should include both regular threshold combos (6) + cash/DCA combos for threshold
      expect(result.totalCombinations).toBeGreaterThan(6);
      // Some results should have cashReservePct
      const withCash = result.results.filter((r) => r.cashReservePct && r.cashReservePct > 0);
      expect(withCash.length).toBeGreaterThan(0);
    } finally {
      mockRun.mockRestore();
    }
  });

  it("returns 'none' as bestStrategy when all combos fail", async () => {
    const mockRun = spyOn(backtestSimulator, "run").mockRejectedValue(new Error("all fail"));
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    try {
      const result = await strategyOptimizer.optimize({
        exchange: "binance",
        pairs: ["BTC/USDT"],
        startDate: "2024-01-01",
        endDate: "2024-06-01",
        initialCapital: 10000,
        allocations: [{ asset: "BTC", targetPct: 100 }],
        strategyTypes: ["threshold"],
        topN: 5,
      });

      expect(result.bestStrategy).toBe("none");
      expect(result.ranCombinations).toBe(0);
      expect(result.skippedCombinations).toBe(6);
    } finally {
      mockRun.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("ranks results by composite score descending", async () => {
    let callIdx = 0;
    const returns = [10, 30, 5, 50, 20, 15];
    const mockRun = spyOn(backtestSimulator, "run").mockImplementation(async () => {
      const ret = returns[callIdx++ % returns.length];
      return {
        metrics: {
          totalReturnPct: ret, sharpeRatio: ret / 10, maxDrawdownPct: -ret / 5,
          totalTrades: 10, annualizedReturnPct: ret * 0.8, volatilityPct: 10,
          winRate: 50, profitFactor: 1.5, avgTradeReturnPct: 0.3,
          calmarRatio: 1.0, sortinoRatio: 1.0,
        },
        equityCurve: [], trades: [], finalPortfolio: {},
      } as any;
    });

    try {
      const result = await strategyOptimizer.optimize({
        exchange: "binance",
        pairs: ["BTC/USDT"],
        startDate: "2024-01-01",
        endDate: "2024-06-01",
        initialCapital: 10000,
        allocations: [{ asset: "BTC", targetPct: 100 }],
        strategyTypes: ["threshold"],
        topN: 6,
      });

      // Verify descending order
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].compositeScore).toBeGreaterThanOrEqual(
          result.results[i].compositeScore
        );
      }
    } finally {
      mockRun.mockRestore();
    }
  });
});
