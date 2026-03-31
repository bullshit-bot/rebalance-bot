import { beforeEach, describe, expect, it } from "bun:test";
import { ExecutionTracker } from "./execution-tracker";

describe("ExecutionTracker", () => {
  let tracker: ExecutionTracker;

  beforeEach(() => {
    tracker = new ExecutionTracker();
  });

  describe("register", () => {
    it("should register a new order", () => {
      const now = Date.now();
      tracker.register("order-123", "twap", 100, 5, 10000);

      const progress = tracker.getProgress("order-123");
      expect(progress).toBeTruthy();
      expect(progress?.id).toBe("order-123");
      expect(progress?.status).toBe("active");
      expect(progress?.totalAmount).toBe(100);
      expect(progress?.slicesTotal).toBe(5);
    });

    it("should initialize progress at zero", () => {
      tracker.register("order-456", "vwap", 50, 4, 8000);

      const progress = tracker.getProgress("order-456");
      expect(progress?.filledAmount).toBe(0);
      expect(progress?.filledPct).toBe(0);
      expect(progress?.avgPrice).toBe(0);
      expect(progress?.slicesCompleted).toBe(0);
    });

    it("should calculate estimated completion", () => {
      const durationMs = 10000;
      const now = Date.now();
      tracker.register("order-789", "twap", 100, 5, durationMs);

      const progress = tracker.getProgress("order-789");
      expect(progress?.estimatedCompletion).toBeGreaterThanOrEqual(now + durationMs - 100);
      expect(progress?.estimatedCompletion).toBeLessThanOrEqual(now + durationMs + 100);
    });
  });

  describe("updateSlice", () => {
    beforeEach(() => {
      tracker.register("order-123", "twap", 100, 5, 10000);
    });

    it("should update filled amount", () => {
      tracker.updateSlice("order-123", 20, 50000);

      const progress = tracker.getProgress("order-123");
      expect(progress?.filledAmount).toBe(20);
    });

    it("should calculate weighted average price", () => {
      tracker.updateSlice("order-123", 10, 50000);
      tracker.updateSlice("order-123", 20, 51000);

      const progress = tracker.getProgress("order-123");
      const expectedAvg = (10 * 50000 + 20 * 51000) / 30;
      expect(progress?.avgPrice).toBeCloseTo(expectedAvg);
    });

    it("should increment slicesCompleted", () => {
      tracker.updateSlice("order-123", 20, 50000);
      expect(tracker.getProgress("order-123")?.slicesCompleted).toBe(1);

      tracker.updateSlice("order-123", 20, 50500);
      expect(tracker.getProgress("order-123")?.slicesCompleted).toBe(2);
    });

    it("should calculate filledPct correctly", () => {
      tracker.updateSlice("order-123", 25, 50000);

      const progress = tracker.getProgress("order-123");
      expect(progress?.filledPct).toBe(25);
    });

    it("should handle unknown orderId gracefully", () => {
      tracker.updateSlice("unknown-order", 10, 50000);
      const progress = tracker.getProgress("unknown-order");
      expect(progress).toBeUndefined();
    });

    it("should handle multiple updates correctly", () => {
      tracker.updateSlice("order-123", 10, 49000);
      tracker.updateSlice("order-123", 10, 50000);
      tracker.updateSlice("order-123", 10, 51000);

      const progress = tracker.getProgress("order-123");
      expect(progress?.filledAmount).toBe(30);
      expect(progress?.slicesCompleted).toBe(3);
      const expectedAvg = (10 * 49000 + 10 * 50000 + 10 * 51000) / 30;
      expect(progress?.avgPrice).toBeCloseTo(expectedAvg);
    });
  });

  describe("complete", () => {
    beforeEach(() => {
      tracker.register("order-123", "twap", 100, 5, 10000);
    });

    it("should mark order as completed", () => {
      tracker.updateSlice("order-123", 100, 50000);
      tracker.complete("order-123");

      const progress = tracker.getProgress("order-123");
      expect(progress?.status).toBe("completed");
    });

    it("should preserve filled amount on completion", () => {
      tracker.updateSlice("order-123", 75, 50000);
      tracker.complete("order-123");

      const progress = tracker.getProgress("order-123");
      expect(progress?.filledAmount).toBe(75);
    });

    it("should handle complete on unknown order silently", () => {
      tracker.complete("unknown-order");
      expect(true).toBe(true);
    });
  });

  describe("cancel", () => {
    beforeEach(() => {
      tracker.register("order-123", "twap", 100, 5, 10000);
    });

    it("should mark order as cancelled", () => {
      tracker.updateSlice("order-123", 50, 50000);
      tracker.cancel("order-123");

      const progress = tracker.getProgress("order-123");
      expect(progress?.status).toBe("cancelled");
    });

    it("should preserve partial fills on cancel", () => {
      tracker.updateSlice("order-123", 30, 50000);
      tracker.cancel("order-123");

      const progress = tracker.getProgress("order-123");
      expect(progress?.filledAmount).toBe(30);
    });

    it("should handle cancel on unknown order silently", () => {
      tracker.cancel("unknown-order");
      expect(true).toBe(true);
    });
  });

  describe("getProgress", () => {
    it("should return undefined for unknown order", () => {
      const progress = tracker.getProgress("non-existent");
      expect(progress).toBeUndefined();
    });

    it("should return accurate snapshot", () => {
      tracker.register("order-456", "vwap", 200, 8, 16000);
      tracker.updateSlice("order-456", 50, 60000);

      const progress = tracker.getProgress("order-456");
      expect(progress?.id).toBe("order-456");
      expect(progress?.type).toBe("vwap");
      expect(progress?.filledAmount).toBe(50);
      expect(progress?.filledPct).toBe(25);
    });
  });
});
