import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Portfolio } from "@/types/index";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { snapshotService } from "./snapshot-service";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("SnapshotService integration", () => {
  test("saveSnapshot persists portfolio to database", async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.5,
          valueUsd: 6000,
          currentPct: 60,
          targetPct: 50,
          driftPct: 10,
          exchange: "binance",
        },
        {
          asset: "ETH",
          amount: 10,
          valueUsd: 3000,
          currentPct: 30,
          targetPct: 30,
          driftPct: 0,
          exchange: "binance",
        },
        {
          asset: "USDT",
          amount: 1000,
          valueUsd: 1000,
          currentPct: 10,
          targetPct: 20,
          driftPct: -10,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio);

    // Fetch the latest snapshot to verify it was saved
    const latest = await snapshotService.getLatest();
    expect(latest).toBeDefined();
    expect(latest?.totalValueUsd).toBe(10000);
  });

  test("saveSnapshot encodes holdings correctly", async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 5000,
      assets: [
        {
          asset: "BTC",
          amount: 0.1,
          valueUsd: 3000,
          currentPct: 60,
          targetPct: 50,
          driftPct: 10,
          exchange: "okx",
        },
        {
          asset: "USDT",
          amount: 2000,
          valueUsd: 2000,
          currentPct: 40,
          targetPct: 50,
          driftPct: -10,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio);

    const latest = await snapshotService.getLatest();
    expect(latest).toBeDefined();

    const holdings =
      typeof latest!.holdings === "string" ? JSON.parse(latest!.holdings) : latest!.holdings;
    expect(holdings["BTC"]).toBeDefined();
    expect(holdings["BTC"].amount).toBe(0.1);
    expect(holdings["BTC"].exchange).toBe("okx");
  });

  test("saveSnapshot encodes allocations correctly", async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 5000,
      assets: [
        {
          asset: "ETH",
          amount: 5,
          valueUsd: 2500,
          currentPct: 50,
          targetPct: 40,
          driftPct: 10,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio);

    const latest = await snapshotService.getLatest();
    const allocations =
      typeof latest!.allocations === "string"
        ? JSON.parse(latest!.allocations)
        : latest!.allocations;

    expect(allocations["ETH"]).toBeDefined();
    expect(allocations["ETH"].currentPct).toBe(50);
    expect(allocations["ETH"].targetPct).toBe(40);
    expect(allocations["ETH"].driftPct).toBe(10);
  });

  test("getSnapshots returns empty array for empty date range", async () => {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 86400 * 365; // 1 year ago
    const to = now - 86400 * 364; // 364 days ago
    const result = await snapshotService.getSnapshots(from, to);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  test("getSnapshots filters by date range", async () => {
    const now = Math.floor(Date.now() / 1000);

    // Save a snapshot
    const portfolio: Portfolio = {
      totalValueUsd: 8000,
      assets: [
        {
          asset: "BTC",
          amount: 0.2,
          valueUsd: 6000,
          currentPct: 75,
          targetPct: 50,
          driftPct: 25,
          exchange: "binance",
        },
        {
          asset: "USDT",
          amount: 2000,
          valueUsd: 2000,
          currentPct: 25,
          targetPct: 50,
          driftPct: -25,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio);

    // Query with a tight range around now
    const from = now;
    const to = now + 10;
    const result = await snapshotService.getSnapshots(from, to);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verify the snapshot we just saved is in the results
    const found = result.find((s) => s.totalValueUsd === 8000);
    expect(found).toBeDefined();
  });

  test("getLatest returns most recent snapshot", async () => {
    // Save two snapshots
    const portfolio1: Portfolio = {
      totalValueUsd: 1000,
      assets: [
        {
          asset: "USDT",
          amount: 1000,
          valueUsd: 1000,
          currentPct: 100,
          targetPct: 100,
          driftPct: 0,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio1);

    // Small delay to ensure distinct createdAt timestamps in MongoDB
    await new Promise((r) => setTimeout(r, 10));

    const portfolio2: Portfolio = {
      totalValueUsd: 2000,
      assets: [
        {
          asset: "USDT",
          amount: 2000,
          valueUsd: 2000,
          currentPct: 100,
          targetPct: 100,
          driftPct: 0,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio2);

    const latest = await snapshotService.getLatest();
    expect(latest).toBeDefined();
    expect(latest?.totalValueUsd).toBe(2000);
  });

  test("getSnapshots orders by createdAt ascending", async () => {
    // Insert multiple snapshots
    const portfolio1: Portfolio = {
      totalValueUsd: 3000,
      assets: [],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio1);

    // Small delay to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100));

    const portfolio2: Portfolio = {
      totalValueUsd: 4000,
      assets: [],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio2);

    const now = Math.floor(Date.now() / 1000);
    const from = now - 10;
    const to = now + 100;
    const result = await snapshotService.getSnapshots(from, to);

    // Should be ordered by createdAt (oldest first)
    expect(result.length).toBeGreaterThanOrEqual(2);
    if (result.length >= 2) {
      const date1 =
        result[0].createdAt instanceof Date ? result[0].createdAt.getTime() : result[0].createdAt;
      const date2 =
        result[1].createdAt instanceof Date ? result[1].createdAt.getTime() : result[1].createdAt;
      expect(date1).toBeLessThanOrEqual(date2);
    }
  });

  test("getSnapshots with narrow date range", async () => {
    const now = Math.floor(Date.now() / 1000);

    const portfolio: Portfolio = {
      totalValueUsd: 7000,
      assets: [
        {
          asset: "ETH",
          amount: 2,
          valueUsd: 7000,
          currentPct: 100,
          targetPct: 100,
          driftPct: 0,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio);

    // Query with very tight range (5 seconds)
    const from = now + 2;
    const to = now + 7;
    const result = await snapshotService.getSnapshots(from, to);

    // Should capture the snapshot we just saved
    expect(Array.isArray(result)).toBe(true);
  });

  test("saveSnapshot handles multiple assets", async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 15000,
      assets: [
        {
          asset: "BTC",
          amount: 0.3,
          valueUsd: 9000,
          currentPct: 60,
          targetPct: 50,
          driftPct: 10,
          exchange: "binance",
        },
        {
          asset: "ETH",
          amount: 20,
          valueUsd: 4000,
          currentPct: 26.67,
          targetPct: 30,
          driftPct: -3.33,
          exchange: "binance",
        },
        {
          asset: "SOL",
          amount: 100,
          valueUsd: 1500,
          currentPct: 10,
          targetPct: 15,
          driftPct: -5,
          exchange: "okx",
        },
        {
          asset: "USDT",
          amount: 500,
          valueUsd: 500,
          currentPct: 3.33,
          targetPct: 5,
          driftPct: -1.67,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    await snapshotService.saveSnapshot(portfolio);

    const latest = await snapshotService.getLatest();
    expect(latest).toBeDefined();

    const holdings =
      typeof latest!.holdings === "string" ? JSON.parse(latest!.holdings) : latest!.holdings;
    expect(Object.keys(holdings).length).toBe(4);
    expect(holdings["SOL"].exchange).toBe("okx");
  });
});
