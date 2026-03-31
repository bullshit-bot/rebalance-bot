import { describe, expect, it } from "bun:test";
import {
  type IOrderExecutor,
  OrderExecutor,
  executionGuard,
  getExecutor,
  orderExecutor,
} from "./index";

describe("Executor Index", () => {
  describe("getExecutor function", () => {
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

    it("should always return OrderExecutor", () => {
      const executor = getExecutor();
      expect(executor).toBeInstanceOf(OrderExecutor);
    });

    it("should return the orderExecutor singleton", () => {
      const executor = getExecutor();
      expect(executor === orderExecutor).toBe(true);
    });

    it("should be consistent across calls", () => {
      const executor1 = getExecutor();
      const executor2 = getExecutor();
      expect(executor1 === executor2).toBe(true);
    });
  });

  describe("Exported classes", () => {
    it("should export OrderExecutor class", () => {
      expect(OrderExecutor).toBeDefined();
      expect(typeof OrderExecutor).toBe("function");
    });

    it("should export executionGuard singleton", () => {
      expect(executionGuard).toBeDefined();
      expect(typeof executionGuard).toBe("object");
    });
  });

  describe("Exported types", () => {
    it("should export IOrderExecutor type", () => {
      const mockExecutor: IOrderExecutor | undefined = undefined;
      expect(mockExecutor).toBeUndefined();
    });

    it("should maintain type safety with getExecutor", () => {
      const executor: IOrderExecutor = getExecutor();
      expect(executor).toBeDefined();
    });
  });

  describe("Module exports integrity", () => {
    it("should export all required items", () => {
      expect(getExecutor).not.toBeNull();
      expect(OrderExecutor).not.toBeNull();
      expect(executionGuard).not.toBeNull();
    });

    it("should have proper types", () => {
      expect(typeof getExecutor).toBe("function");
      expect(typeof OrderExecutor).toBe("function");
      expect(typeof executionGuard).toBe("object");
    });
  });

  describe("IOrderExecutor interface compliance", () => {
    it("should implement required executor interface", () => {
      const executor = getExecutor();
      expect(executor).toHaveProperty("execute");
      expect(executor).toHaveProperty("executeBatch");
    });

    it("should have callable execute method", () => {
      const executor = getExecutor();
      expect(typeof executor.execute).toBe("function");
    });

    it("should be assignable to IOrderExecutor type", () => {
      const executor = getExecutor();
      const typed: IOrderExecutor = executor;
      expect(typed).toBeDefined();
      expect(typeof typed.execute).toBe("function");
    });
  });

  describe("OrderExecutor can be instantiated", () => {
    it("should create a new instance with all methods", () => {
      const executor = new OrderExecutor();
      expect(executor).toBeDefined();
      expect(typeof executor.execute).toBe("function");
      expect(typeof executor.executeBatch).toBe("function");
    });
  });

  describe("orderExecutor singleton", () => {
    it("should export orderExecutor singleton", () => {
      expect(orderExecutor).toBeDefined();
      expect(typeof orderExecutor).toBe("object");
    });

    it("orderExecutor should have execute method", () => {
      expect(typeof orderExecutor.execute).toBe("function");
    });

    it("orderExecutor should have executeBatch method", () => {
      expect(typeof orderExecutor.executeBatch).toBe("function");
    });
  });

  describe("executionGuard singleton", () => {
    it("should have canExecute method", () => {
      expect(typeof executionGuard.canExecute).toBe("function");
    });

    it("should have recordLoss method", () => {
      expect(typeof executionGuard.recordLoss).toBe("function");
    });

    it("should maintain state across calls (singleton)", () => {
      const guard1 = executionGuard;
      const guard2 = executionGuard;
      expect(guard1 === guard2).toBe(true);
    });
  });
});
