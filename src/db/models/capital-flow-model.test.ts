import { beforeEach, afterEach, describe, expect, it } from "bun:test";
import { CapitalFlowModel, type ICapitalFlow } from "./capital-flow-model";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";

describe("CapitalFlowModel", () => {
  beforeEach(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  describe("deposit record creation", () => {
    it("should create a deposit record with required fields", async () => {
      const flow = await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
      });

      expect(flow).toBeDefined();
      expect(flow.type).toBe("deposit");
      expect(flow.amountUsd).toBe(1000);
      expect(flow.createdAt).toBeInstanceOf(Date);
      expect(flow._id).toBeDefined();
    });

    it("should create a deposit record with optional note", async () => {
      const flow = await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 500,
        note: "Manual deposit to spot wallet",
      });

      expect(flow.type).toBe("deposit");
      expect(flow.amountUsd).toBe(500);
      expect(flow.note).toBe("Manual deposit to spot wallet");
    });

    it("should use current timestamp for createdAt by default", async () => {
      const beforeCreate = Date.now();
      const flow = await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 250,
      });
      const afterCreate = Date.now();

      expect(flow.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(flow.createdAt.getTime()).toBeLessThanOrEqual(afterCreate);
    });

    it("should allow custom createdAt timestamp", async () => {
      const customDate = new Date("2026-01-01T00:00:00Z");
      const flow = await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 300,
        createdAt: customDate,
      });

      expect(flow.createdAt.getTime()).toBe(customDate.getTime());
    });

    it("should not allow invalid type for deposit", async () => {
      try {
        await CapitalFlowModel.create({
          type: "withdrawal" as any,
          amountUsd: 100,
        });
        expect(false).toBe(true); // Should not reach here
      } catch (err) {
        expect(err).toBeDefined();
      }
    });
  });

  describe("DCA record creation", () => {
    it("should create a DCA record with required fields", async () => {
      const flow = await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50.25,
      });

      expect(flow.type).toBe("dca");
      expect(flow.amountUsd).toBe(50.25);
      expect(flow.createdAt).toBeInstanceOf(Date);
    });

    it("should create a DCA record with execution note", async () => {
      const flow = await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 45.5,
        note: "DCA 3 orders",
      });

      expect(flow.type).toBe("dca");
      expect(flow.amountUsd).toBe(45.5);
      expect(flow.note).toBe("DCA 3 orders");
    });

    it("should handle DCA with fractional amounts", async () => {
      const flow = await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 123.456789,
      });

      expect(flow.amountUsd).toBe(123.456789);
    });
  });

  describe("record aggregation", () => {
    it("should return totalInvested sum for empty collection", async () => {
      const [result] = await CapitalFlowModel.aggregate([
        { $group: { _id: null, total: { $sum: "$amountUsd" } } },
      ]);

      expect(result).toBeUndefined();
    });

    it("should calculate totalInvested for single deposit", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
      });

      const [result] = await CapitalFlowModel.aggregate([
        { $group: { _id: null, total: { $sum: "$amountUsd" } } },
      ]);

      expect(result?.total).toBe(1000);
    });

    it("should calculate totalInvested for single DCA", async () => {
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50.25,
      });

      const [result] = await CapitalFlowModel.aggregate([
        { $group: { _id: null, total: { $sum: "$amountUsd" } } },
      ]);

      expect(result?.total).toBe(50.25);
    });

    it("should correctly sum mixed deposits and DCA records", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50.25,
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 500,
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 30.75,
      });

      const [result] = await CapitalFlowModel.aggregate([
        { $group: { _id: null, total: { $sum: "$amountUsd" } } },
      ]);

      expect(result?.total).toBe(1581); // 1000 + 50.25 + 500 + 30.75
    });

    it("should handle multiple deposits with totalInvested", async () => {
      const deposits = [
        { type: "deposit" as const, amountUsd: 1000 },
        { type: "deposit" as const, amountUsd: 2000 },
        { type: "deposit" as const, amountUsd: 1500 },
      ];

      for (const dep of deposits) {
        await CapitalFlowModel.create(dep);
      }

      const [result] = await CapitalFlowModel.aggregate([
        { $group: { _id: null, total: { $sum: "$amountUsd" } } },
      ]);

      expect(result?.total).toBe(4500);
    });

    it("should handle multiple DCA records with totalInvested", async () => {
      const dcas = [
        { type: "dca" as const, amountUsd: 50 },
        { type: "dca" as const, amountUsd: 50 },
        { type: "dca" as const, amountUsd: 50 },
      ];

      for (const dca of dcas) {
        await CapitalFlowModel.create(dca);
      }

      const [result] = await CapitalFlowModel.aggregate([
        { $group: { _id: null, total: { $sum: "$amountUsd" } } },
      ]);

      expect(result?.total).toBe(150);
    });

    it("should use aggregation pipeline like API endpoint", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1500,
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 100.5,
      });

      const [flowAgg] = await CapitalFlowModel.aggregate([
        { $group: { _id: null, total: { $sum: "$amountUsd" } } },
      ]);
      const totalInvested: number = flowAgg?.total ?? 0;

      expect(totalInvested).toBe(1600.5);
    });
  });

  describe("database persistence", () => {
    it("should persist records across queries", async () => {
      const created = await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 999,
        note: "persistence test",
      });

      const found = await CapitalFlowModel.findById(created._id);

      expect(found).toBeDefined();
      expect(found?.type).toBe("deposit");
      expect(found?.amountUsd).toBe(999);
      expect(found?.note).toBe("persistence test");
    });

    it("should retrieve records with find()", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50,
      });

      const flows = await CapitalFlowModel.find();

      expect(flows.length).toBe(2);
      expect(flows.some((f) => f.type === "deposit")).toBe(true);
      expect(flows.some((f) => f.type === "dca")).toBe(true);
    });

    it("should retrieve records sorted by createdAt descending", async () => {
      const date1 = new Date("2026-01-01");
      const date2 = new Date("2026-01-02");
      const date3 = new Date("2026-01-03");

      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
        createdAt: date1,
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 2000,
        createdAt: date3,
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1500,
        createdAt: date2,
      });

      const flows = await CapitalFlowModel.find().sort({ createdAt: -1 });

      expect(flows.length).toBe(3);
      expect(flows[0].amountUsd).toBe(2000); // Most recent
      expect(flows[1].amountUsd).toBe(1500); // Middle
      expect(flows[2].amountUsd).toBe(1000); // Oldest
    });
  });

  describe("index performance", () => {
    it("should have index on createdAt field", async () => {
      const indexes = await CapitalFlowModel.collection.getIndexes();
      // Indexes are stored as [["fieldName", direction], ...]
      const hasCreatedAtIndex = Object.values(indexes).some((idx: any) => {
        return Array.isArray(idx) && idx.some((pair: any) => pair[0] === "createdAt");
      });
      expect(hasCreatedAtIndex).toBe(true);
    });

    it("should have index on type field", async () => {
      const indexes = await CapitalFlowModel.collection.getIndexes();
      // Indexes are stored as [["fieldName", direction], ...]
      const hasTypeIndex = Object.values(indexes).some((idx: any) => {
        return Array.isArray(idx) && idx.some((pair: any) => pair[0] === "type");
      });
      expect(hasTypeIndex).toBe(true);
    });
  });

  describe("validation", () => {
    it("should require type field", async () => {
      try {
        await CapitalFlowModel.create({
          amountUsd: 100,
        } as any);
        expect(false).toBe(true); // Should not reach here
      } catch (err) {
        expect(err).toBeDefined();
      }
    });

    it("should require amountUsd field", async () => {
      try {
        await CapitalFlowModel.create({
          type: "deposit",
        } as any);
        expect(false).toBe(true); // Should not reach here
      } catch (err) {
        expect(err).toBeDefined();
      }
    });

    it("should accept zero amount", async () => {
      const flow = await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 0,
      });

      expect(flow.amountUsd).toBe(0);
    });

    it("should accept negative amount (for test edge case)", async () => {
      const flow = await CapitalFlowModel.create({
        type: "dca",
        amountUsd: -10,
      });

      expect(flow.amountUsd).toBe(-10);
    });
  });
});
