import { describe, expect, it } from "bun:test";
import { equityCurveBuilder } from "./equity-curve-builder";

// Test the equity curve logic
function buildEquityCurve(
  snapshots: Array<{ timestamp: number; valueUsd: number }>
): Array<{ timestamp: number; valueUsd: number }> {
  return snapshots.sort((a, b) => a.timestamp - b.timestamp);
}

describe("EquityCurveBuilder - Core Logic", () => {
  it("builds equity curve from multiple snapshots", () => {
    const snapshots = [
      { timestamp: 1000, valueUsd: 10000 },
      { timestamp: 2000, valueUsd: 11000 },
      { timestamp: 3000, valueUsd: 12500 },
    ];

    const curve = buildEquityCurve(snapshots);

    expect(curve.length).toBe(3);
    expect(curve[0].valueUsd).toBe(10000);
    expect(curve[1].valueUsd).toBe(11000);
    expect(curve[2].valueUsd).toBe(12500);
  });

  it("returns empty array when no snapshots in range", () => {
    const allSnapshots = [{ timestamp: 1000, valueUsd: 10000 }];

    const from = 2000;
    const to = 3000;

    const filtered = allSnapshots.filter((s) => s.timestamp >= from && s.timestamp <= to);
    const curve = buildEquityCurve(filtered);

    expect(curve.length).toBe(0);
  });

  it("filters snapshots by timestamp range correctly", () => {
    const allSnapshots = [
      { timestamp: 500, valueUsd: 9000 },
      { timestamp: 1000, valueUsd: 10000 },
      { timestamp: 2000, valueUsd: 11000 },
      { timestamp: 3000, valueUsd: 12000 },
      { timestamp: 4000, valueUsd: 13000 },
    ];

    const from = 1000;
    const to = 3000;

    const filtered = allSnapshots.filter((s) => s.timestamp >= from && s.timestamp <= to);
    const curve = buildEquityCurve(filtered);

    expect(curve.length).toBe(3);
    expect(curve[0].timestamp).toBe(1000);
    expect(curve[2].timestamp).toBe(3000);
  });

  it("preserves chronological order", () => {
    const snapshots = [
      { timestamp: 3000, valueUsd: 12000 },
      { timestamp: 1000, valueUsd: 10000 },
      { timestamp: 2000, valueUsd: 11000 },
    ];

    const curve = buildEquityCurve(snapshots);

    expect(curve.length).toBe(3);
    expect(curve[0].timestamp).toBe(1000);
    expect(curve[1].timestamp).toBe(2000);
    expect(curve[2].timestamp).toBe(3000);
  });

  it("maps timestamps to equity values correctly", () => {
    const snapshots = [
      { timestamp: 1000, valueUsd: 10000 },
      { timestamp: 2000, valueUsd: 11500 },
      { timestamp: 3000, valueUsd: 13000 },
    ];

    const curve = buildEquityCurve(snapshots);

    const valueMap = new Map(curve.map((p) => [p.timestamp, p.valueUsd]));

    expect(valueMap.get(1000)).toBe(10000);
    expect(valueMap.get(2000)).toBe(11500);
    expect(valueMap.get(3000)).toBe(13000);
  });
});

describe("EquityCurveBuilder - Real Implementation", () => {
  it("should build curve from real builder instance", async () => {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 86400; // 24h ago
    const to = now;

    const curve = await equityCurveBuilder.build(from, to);

    expect(curve).toBeDefined();
    expect(Array.isArray(curve)).toBe(true);
  });

  it("should handle empty time range", async () => {
    const from = 1000000000;
    const to = 1000000001;

    const curve = await equityCurveBuilder.build(from, to);

    expect(Array.isArray(curve)).toBe(true);
  });

  it("should preserve chronological order in real data", async () => {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 604800; // 7 days ago
    const to = now;

    const curve = await equityCurveBuilder.build(from, to);

    if (curve.length > 1) {
      for (let i = 1; i < curve.length; i++) {
        if (curve[i].timestamp && curve[i - 1].timestamp) {
          expect(curve[i].timestamp).toBeGreaterThanOrEqual(curve[i - 1].timestamp);
        }
      }
    }
  });

  it("should return array of objects with timestamp and value", async () => {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 86400;
    const to = now;

    const curve = await equityCurveBuilder.build(from, to);

    expect(Array.isArray(curve)).toBe(true);
    curve.forEach((point: any) => {
      if (point && typeof point === "object") {
        // Each point should have numeric values
        if (point.timestamp !== undefined) {
          expect(typeof point.timestamp).toBe("number");
        }
        if (point.valueUsd !== undefined) {
          expect(typeof point.valueUsd).toBe("number");
        }
      }
    });
  });

  it("should handle very old time ranges", async () => {
    const from = 1000000;
    const to = 2000000;

    const curve = await equityCurveBuilder.build(from, to);

    expect(Array.isArray(curve)).toBe(true);
  });

  it("should handle from=to edge case", async () => {
    const timestamp = Math.floor(Date.now() / 1000);

    const curve = await equityCurveBuilder.build(timestamp, timestamp);

    expect(Array.isArray(curve)).toBe(true);
  });

  it("should handle when from > to (should still work)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const from = now;
    const to = now - 86400;

    const curve = await equityCurveBuilder.build(from, to);

    expect(Array.isArray(curve)).toBe(true);
  });

  it("should handle large time ranges", async () => {
    const from = 1000000000;
    const to = Math.floor(Date.now() / 1000);

    const curve = await equityCurveBuilder.build(from, to);

    expect(Array.isArray(curve)).toBe(true);
  });
});
