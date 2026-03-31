import { describe, expect, it } from "bun:test";
import { env } from "./app-config";

describe("app-config", () => {
  describe("env configuration object", () => {
    it("should be defined", () => {
      expect(env).toBeDefined();
    });

    it("should have API_PORT property", () => {
      expect(env).toHaveProperty("API_PORT");
      // API_PORT could be string or number depending on validation mode
      const apiPort = env.API_PORT;
      expect(apiPort !== undefined && apiPort !== null).toBe(true);
    });

    it("should have API_KEY property", () => {
      expect(env).toHaveProperty("API_KEY");
      expect(env.API_KEY !== undefined).toBe(true);
    });

    it("should have ENCRYPTION_KEY property", () => {
      expect(env).toHaveProperty("ENCRYPTION_KEY");
      if (env.ENCRYPTION_KEY) {
        expect(env.ENCRYPTION_KEY.length).toBe(32);
      }
    });
  });

  describe("Rebalance configuration", () => {
    it("REBALANCE_THRESHOLD property should exist", () => {
      expect(env).toHaveProperty("REBALANCE_THRESHOLD");
      const threshold = env.REBALANCE_THRESHOLD;
      expect(threshold !== undefined && threshold !== null).toBe(true);
    });

    it("REBALANCE_COOLDOWN_HOURS property should exist", () => {
      expect(env).toHaveProperty("REBALANCE_COOLDOWN_HOURS");
      const cooldown = env.REBALANCE_COOLDOWN_HOURS;
      expect(cooldown !== undefined && cooldown !== null).toBe(true);
    });

    it("MIN_TRADE_USD and MAX_TRADE_USD should exist", () => {
      expect(env).toHaveProperty("MIN_TRADE_USD");
      expect(env).toHaveProperty("MAX_TRADE_USD");
      expect(env.MIN_TRADE_USD !== undefined).toBe(true);
      expect(env.MAX_TRADE_USD !== undefined).toBe(true);
    });

    it("DAILY_LOSS_LIMIT_PCT property should exist", () => {
      expect(env).toHaveProperty("DAILY_LOSS_LIMIT_PCT");
      expect(env.DAILY_LOSS_LIMIT_PCT !== undefined).toBe(true);
    });
  });

  describe("Strategy configuration", () => {
    it("STRATEGY_MODE should exist when defined", () => {
      expect(env).toHaveProperty("STRATEGY_MODE");
      if (env.STRATEGY_MODE !== undefined) {
        const validModes = ["threshold", "equal-weight", "momentum-tilt", "vol-adjusted"];
        expect(validModes).toContain(env.STRATEGY_MODE);
      }
    });

    it("MOMENTUM_WINDOW_DAYS should exist when defined", () => {
      expect(env).toHaveProperty("MOMENTUM_WINDOW_DAYS");
      if (env.MOMENTUM_WINDOW_DAYS !== undefined) {
        expect(env.MOMENTUM_WINDOW_DAYS !== null).toBe(true);
      }
    });

    it("VOLATILITY_THRESHOLD should exist when defined", () => {
      expect(env).toHaveProperty("VOLATILITY_THRESHOLD");
      if (env.VOLATILITY_THRESHOLD !== undefined) {
        expect(env.VOLATILITY_THRESHOLD !== null).toBe(true);
      }
    });

    it("DYNAMIC_THRESHOLD_LOW and HIGH should exist when defined", () => {
      expect(env).toHaveProperty("DYNAMIC_THRESHOLD_LOW");
      expect(env).toHaveProperty("DYNAMIC_THRESHOLD_HIGH");
      if (env.DYNAMIC_THRESHOLD_LOW !== undefined && env.DYNAMIC_THRESHOLD_HIGH !== undefined) {
        expect(env.DYNAMIC_THRESHOLD_LOW !== null).toBe(true);
        expect(env.DYNAMIC_THRESHOLD_HIGH !== null).toBe(true);
      }
    });
  });

  describe("Exchange credentials (optional)", () => {
    it("should have optional exchange credential keys", () => {
      // These are optional, so they might not exist in all environments
      // Just verify the env object is structured correctly
      expect(typeof env).toBe("object");
      expect(env !== null).toBe(true);
    });

    it("should have standard env structure", () => {
      // Verify critical config keys exist
      const criticalKeys = ["API_PORT", "API_KEY", "ENCRYPTION_KEY"];
      criticalKeys.forEach((key) => {
        expect(env).toHaveProperty(key);
      });
    });
  });

  describe("Notification configuration (optional)", () => {
    it("should be structured as config object", () => {
      expect(typeof env).toBe("object");
      // Just verify it's an object, optional fields may not exist
      expect(Object.keys(env).length).toBeGreaterThan(0);
    });
  });

  describe("configuration structure", () => {
    it("should have required properties defined", () => {
      const requiredKeys = [
        "API_PORT",
        "API_KEY",
        "ENCRYPTION_KEY",
        "REBALANCE_THRESHOLD",
        "REBALANCE_COOLDOWN_HOURS",
        "MIN_TRADE_USD",
        "MAX_TRADE_USD",
        "DAILY_LOSS_LIMIT_PCT",
      ];
      requiredKeys.forEach((key) => {
        expect(env).toHaveProperty(key);
      });
    });

    it("should be a valid configuration object", () => {
      expect(typeof env).toBe("object");
      expect(env !== null).toBe(true);
      expect(Object.keys(env).length).toBeGreaterThan(5);
    });
  });
});
