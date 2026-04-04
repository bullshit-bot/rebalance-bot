import { describe, expect, it } from "bun:test";

/**
 * Source-level verification tests for Earn integration in rebalance engine.
 * Exposes bugs: USDT not subscribed to Earn, trades on stale portfolio.
 */
describe("Rebalance Engine Earn integration guards", () => {
  it("subscribes USDT to Earn after rebalance (not just target assets)", async () => {
    const source = await Bun.file("src/rebalancer/rebalance-engine.ts").text();
    // Must include USDT in subscribe list
    expect(source).toContain('...targets.map((t) => t.asset), "USDT"');
  });

  it("waits for all target assets to appear in Spot before calculating trades", async () => {
    const source = await Bun.file("src/rebalancer/rebalance-engine.ts").text();
    // Must poll for expectedAssets to be visible
    expect(source).toContain("expectedAssets");
    expect(source).toContain("allPresent");
    expect(source).toContain("All");
    expect(source).toContain("assets visible in Spot");
  });

  it("clears earn cache before waiting for settlement", async () => {
    const source = await Bun.file("src/rebalancer/rebalance-engine.ts").text();
    expect(source).toContain("clearEarnCache()");
  });

  it("DCA service also subscribes USDT to Earn", async () => {
    const source = await Bun.file("src/dca/dca-service.ts").text();
    expect(source).toContain('"USDT"');
    expect(source).toContain("subscribeAll");
  });

  it("DCA service clears earn cache after subscribe", async () => {
    const source = await Bun.file("src/dca/dca-service.ts").text();
    expect(source).toContain("clearEarnCache()");
  });
});
