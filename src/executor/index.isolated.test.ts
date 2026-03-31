import { describe, expect, it, mock } from "bun:test";

const mockExecutor = {
  execute: async (order: any) => {
    return { id: "order-" + Date.now(), filled: 0.5, status: "filled" };
  },
  executeBatch: async (orders: any[]) => {
    return orders.map((o) => ({ id: "batch-" + Date.now(), order: o }));
  },
};

const mockGuard = {
  canExecute: () => ({ allowed: true, reason: "normal" }),
  recordTrade: (result: any) => {},
  recordLoss: (loss: any) => {},
};

mock.module("@executor/order-executor", () => ({
  OrderExecutor: class {
    async execute(order: any) {
      return { id: "test", filled: 0.5 };
    }
    async executeBatch(orders: any[]) {
      return [];
    }
  },
  orderExecutor: mockExecutor,
}));

mock.module("@executor/execution-guard", () => ({
  executionGuard: mockGuard,
}));

import { OrderExecutor, executionGuard, getExecutor, orderExecutor } from "@executor/index";
import type { IOrderExecutor } from "@executor/index";

describe("Executor Index (isolated)", () => {
  describe("getExecutor() function", () => {
    it("should be defined", () => {
      expect(getExecutor).toBeDefined();
    });

    it("should be a function", () => {
      expect(typeof getExecutor).toBe("function");
    });

    it("should return an executor object", () => {
      const executor = getExecutor();
      expect(executor).toBeDefined();
      expect(typeof executor).toBe("object");
    });

    it("should return orderExecutor singleton", () => {
      const executor = getExecutor();
      expect(executor === orderExecutor).toBe(true);
    });

    it("should always return same instance (singleton)", () => {
      const exec1 = getExecutor();
      const exec2 = getExecutor();
      expect(exec1 === exec2).toBe(true);
    });

    it("should return object with OrderExecutor interface", () => {
      const executor = getExecutor();
      expect(executor).toBeDefined();
      expect(typeof executor.execute).toBe("function");
      expect(typeof executor.executeBatch).toBe("function");
    });
  });

  describe("OrderExecutor class", () => {
    it("should be defined", () => {
      expect(OrderExecutor).toBeDefined();
    });

    it("should be instantiable", () => {
      const instance = new OrderExecutor();
      expect(instance).toBeDefined();
    });

    it("should have execute method", () => {
      const instance = new OrderExecutor();
      expect(typeof instance.execute).toBe("function");
    });

    it("should have executeBatch method", () => {
      const instance = new OrderExecutor();
      expect(typeof instance.executeBatch).toBe("function");
    });

    it("should implement IOrderExecutor interface", () => {
      const instance = new OrderExecutor();
      const typed: IOrderExecutor = instance;
      expect(typed).toBeDefined();
    });
  });

  describe("executionGuard singleton", () => {
    it("should be defined", () => {
      expect(executionGuard).toBeDefined();
    });

    it("should be an object", () => {
      expect(typeof executionGuard).toBe("object");
    });

    it("should have canExecute method", () => {
      expect(typeof executionGuard.canExecute).toBe("function");
    });

    it("should have recordTrade method", () => {
      expect(typeof executionGuard.recordTrade).toBe("function");
    });

    it("should have recordLoss method", () => {
      expect(typeof executionGuard.recordLoss).toBe("function");
    });

    it("should maintain singleton pattern", () => {
      const guard1 = executionGuard;
      const guard2 = executionGuard;
      expect(guard1 === guard2).toBe(true);
    });

    it("canExecute should return allowed status", () => {
      const result = executionGuard.canExecute();
      expect(result).toHaveProperty("allowed");
      expect(typeof result.allowed).toBe("boolean");
    });
  });

  describe("orderExecutor singleton", () => {
    it("should be defined", () => {
      expect(orderExecutor).toBeDefined();
    });

    it("should be an object", () => {
      expect(typeof orderExecutor).toBe("object");
    });

    it("should have execute method", () => {
      expect(typeof orderExecutor.execute).toBe("function");
    });

    it("should have executeBatch method", () => {
      expect(typeof orderExecutor.executeBatch).toBe("function");
    });

    it("should be the same instance returned by getExecutor", () => {
      expect(getExecutor() === orderExecutor).toBe(true);
    });
  });

  describe("IOrderExecutor interface compliance", () => {
    it("should have proper interface methods", () => {
      const executor: IOrderExecutor = getExecutor();
      expect(typeof executor.execute).toBe("function");
      expect(typeof executor.executeBatch).toBe("function");
    });

    it("execute should be callable", async () => {
      const executor = getExecutor();
      const order = {
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy" as const,
        amount: 0.5,
        price: 50000,
        type: "market" as const,
      };
      const result = await executor.execute(order);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it("executeBatch should be callable", async () => {
      const executor = getExecutor();
      const orders = [
        {
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy" as const,
          amount: 0.5,
          price: 50000,
          type: "market" as const,
        },
      ];
      const result = await executor.executeBatch(orders);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Export consistency", () => {
    it("should export all required items", () => {
      expect(getExecutor).not.toBeNull();
      expect(OrderExecutor).not.toBeNull();
      expect(executionGuard).not.toBeNull();
      expect(orderExecutor).not.toBeNull();
    });

    it("should export correct types", () => {
      expect(typeof getExecutor).toBe("function");
      expect(typeof OrderExecutor).toBe("function");
      expect(typeof executionGuard).toBe("object");
      expect(typeof orderExecutor).toBe("object");
    });

    it("should maintain singleton pattern", () => {
      expect(getExecutor() === orderExecutor).toBe(true);
    });

    it("orderExecutor should implement IOrderExecutor interface", () => {
      const executor: IOrderExecutor = orderExecutor;
      expect(typeof executor.execute).toBe("function");
      expect(typeof executor.executeBatch).toBe("function");
    });
  });

  describe("Real execution note", () => {
    it("should always use real execution (not sandbox)", () => {
      // getExecutor always returns orderExecutor, never a mock
      const executor = getExecutor();
      // In production, testnet/sandbox distinction is controlled by BINANCE_SANDBOX env var
      // not by this layer
      expect(executor).toBe(orderExecutor);
    });
  });
});
