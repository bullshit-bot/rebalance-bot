import { db } from "@db/database";
import { gridBots } from "@db/schema";
import { eq, sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotPnL {
  realized: number;
  tradeCount: number;
}

interface PnLSummary {
  realized: number;
  unrealized: number;
  total: number;
  tradeCount: number;
}

// ─── GridPnLTracker ───────────────────────────────────────────────────────────

/**
 * Tracks realized PnL per grid bot.
 * Persists totalProfit and totalTrades to grid_bots table after each trade.
 * Unrealized PnL is not tracked here (requires live price feed).
 */
class GridPnLTracker {
  /** In-memory accumulator — synced to DB on each recordTrade call */
  private readonly state: Map<string, BotPnL> = new Map();

  /**
   * Record a completed buy→sell grid cycle.
   * Profit = (sellPrice - buyPrice) * amount.
   * Persists updated totals to grid_bots row.
   */
  recordTrade(botId: string, buyPrice: number, sellPrice: number, amount: number): void {
    const profit = (sellPrice - buyPrice) * amount;
    const current = this.state.get(botId) ?? { realized: 0, tradeCount: 0 };

    const updated: BotPnL = {
      realized: current.realized + profit,
      tradeCount: current.tradeCount + 1,
    };
    this.state.set(botId, updated);

    // Persist asynchronously — do not await to keep caller non-blocking
    this.persistToDb(botId, updated).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GridPnLTracker] Failed to persist PnL for bot ${botId}: ${msg}`);
    });
  }

  /**
   * Returns current PnL snapshot for a bot.
   * Unrealized is always 0 — grid strategy PnL is only meaningful when realized.
   */
  getPnL(botId: string): PnLSummary {
    const entry = this.state.get(botId) ?? { realized: 0, tradeCount: 0 };
    return {
      realized: entry.realized,
      unrealized: 0,
      total: entry.realized,
      tradeCount: entry.tradeCount,
    };
  }

  /**
   * Load existing PnL from DB into memory (call on bot restore / manager init).
   */
  async loadFromDb(botId: string): Promise<void> {
    try {
      const rows = await db
        .select({ totalProfit: gridBots.totalProfit, totalTrades: gridBots.totalTrades })
        .from(gridBots)
        .where(eq(gridBots.id, botId))
        .limit(1);

      if (rows.length > 0) {
        this.state.set(botId, {
          realized: rows[0].totalProfit ?? 0,
          tradeCount: rows[0].totalTrades ?? 0,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GridPnLTracker] Failed to load PnL for bot ${botId}: ${msg}`);
    }
  }

  /** Remove in-memory state for a stopped bot. */
  clear(botId: string): void {
    this.state.delete(botId);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async persistToDb(botId: string, pnl: BotPnL): Promise<void> {
    await db
      .update(gridBots)
      .set({
        totalProfit: sql`${pnl.realized}`,
        totalTrades: sql`${pnl.tradeCount}`,
      })
      .where(eq(gridBots.id, botId));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const gridPnLTracker = new GridPnLTracker();
export { GridPnLTracker };
export type { PnLSummary };
