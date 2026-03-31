import { beforeEach, describe, expect, it } from "bun:test";
import { GridCalculator } from "./grid-calculator";

describe("GridCalculator", () => {
  let calculator: GridCalculator;

  beforeEach(() => {
    calculator = new GridCalculator();
  });

  describe("calculate", () => {
    it("should generate arithmetic price levels", () => {
      const levels = calculator.calculate({
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 4,
        investment: 1000,
        currentPrice: 45000,
        gridType: "normal",
      });

      expect(levels).toHaveLength(5); // gridLevels + 1
      expect(levels[0].price).toBe(40000);
      expect(levels[levels.length - 1].price).toBe(50000);
    });

    it("should allocate investment only to buy side", () => {
      const levels = calculator.calculate({
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 4,
        investment: 1000,
        currentPrice: 45000,
        gridType: "normal",
      });

      const buyLevels = levels.filter((l) => l.buyAmount > 0);
      expect(buyLevels.length).toBeGreaterThan(0);
    });

    it("should not allocate to sell side below current price in normal grid", () => {
      const levels = calculator.calculate({
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 4,
        investment: 1000,
        currentPrice: 45000,
        gridType: "normal",
      });

      const belowCurrent = levels.filter((l) => l.price < 45000);
      for (const level of belowCurrent) {
        expect(level.sellAmount).toBe(0);
      }
    });

    it("should split investment evenly across buy levels", () => {
      const levels = calculator.calculate({
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 4,
        investment: 1000,
        currentPrice: 45000,
        gridType: "normal",
      });

      const buyLevels = levels.filter((l) => l.buyAmount > 0);
      const investmentPerLevel = buyLevels.map((l) => l.buyAmount * l.price);

      const expected = 1000 / buyLevels.length;
      for (const inv of investmentPerLevel) {
        expect(inv).toBeCloseTo(expected, 1);
      }
    });

    it("should support reverse grid type", () => {
      const levels = calculator.calculate({
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 4,
        investment: 1000,
        currentPrice: 45000,
        gridType: "reverse",
      });

      const buyLevels = levels.filter((l) => l.buyAmount > 0);
      const allAboveCurrent = buyLevels.every((l) => l.price > 45000);
      expect(allAboveCurrent).toBe(true);
    });

    it("should reject invalid price range", () => {
      expect(() => {
        calculator.calculate({
          priceLower: 50000,
          priceUpper: 40000, // inverted
          gridLevels: 4,
          investment: 1000,
          currentPrice: 45000,
          gridType: "normal",
        });
      }).toThrow("[GridCalculator] priceLower must be less than priceUpper");
    });

    it("should reject insufficient grid levels", () => {
      expect(() => {
        calculator.calculate({
          priceLower: 40000,
          priceUpper: 50000,
          gridLevels: 1,
          investment: 1000,
          currentPrice: 45000,
          gridType: "normal",
        });
      }).toThrow("[GridCalculator] gridLevels must be >= 2");
    });

    it("should handle zero investment", () => {
      const levels = calculator.calculate({
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 4,
        investment: 0,
        currentPrice: 45000,
        gridType: "normal",
      });

      expect(levels).toHaveLength(5);
      for (const level of levels) {
        expect(level.buyAmount).toBe(0);
        expect(level.sellAmount).toBe(0);
      }
    });

    it("should handle current price at boundaries", () => {
      const levelsAtLower = calculator.calculate({
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 4,
        investment: 1000,
        currentPrice: 40000,
        gridType: "normal",
      });

      expect(levelsAtLower).toHaveLength(5);

      const levelsAtUpper = calculator.calculate({
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 4,
        investment: 1000,
        currentPrice: 50000,
        gridType: "normal",
      });

      expect(levelsAtUpper).toHaveLength(5);
    });

    it("should use consistent spacing", () => {
      const levels = calculator.calculate({
        priceLower: 100,
        priceUpper: 200,
        gridLevels: 10,
        investment: 1000,
        currentPrice: 150,
        gridType: "normal",
      });

      const step = 10; // (200 - 100) / 10
      for (let i = 0; i < levels.length - 1; i++) {
        const diff = levels[i + 1].price - levels[i].price;
        expect(diff).toBeCloseTo(step, 1);
      }
    });
  });
});
