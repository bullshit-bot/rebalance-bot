import type { ExchangeName } from "@/types/index";
import { db } from "@db/database";
import { gridOrders } from "@db/schema";
import { exchangeManager } from "@exchange/exchange-manager";
import { getExecutor } from "@executor/index";
import type { GridLevel } from "@grid/grid-calculator";
import { gridPnLTracker } from "@grid/grid-pnl-tracker";
import { eq } from "drizzle-orm";
import type { IOrderExecutor } from "@executor/order-executor";

// ─── Dependency injection interfaces ─────────────────────────────────────────

export interface IExchangeManagerDepGE {
  getEnabledExchanges(): Map<string, { fetchOrder(id: string): Promise<Record<string, unknown>>; cancelOrder(id: string): Promise<unknown> }>
}

export interface GridExecutorDeps {
  exchangeManager: IExchangeManagerDepGE
  /** Injectable executor factory — defaults to getExecutor(). */
  getExecutor: () => IOrderExecutor
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000;

// ─── GridExecutor ─────────────────────────────────────────────────────────────

/**
 * Places limit orders at each grid level and monitors for fills.
 *
 * On buy fill  → place sell order at the next level up.
 * On sell fill → place buy order at the next level down.
 *
 * Uses the IOrderExecutor abstraction so paper/live mode is transparent.
 */
class GridExecutor {
  /** Active polling timers keyed by botId */
  private readonly monitors: Map<string, ReturnType<typeof setInterval>> = new Map();
  private readonly deps: GridExecutorDeps;

  constructor(deps?: Partial<GridExecutorDeps>) {
    this.deps = {
      exchangeManager: deps?.exchangeManager ?? (exchangeManager as unknown as IExchangeManagerDepGE),
      getExecutor: deps?.getExecutor ?? getExecutor,
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Places initial limit orders for every grid level.
   * Buy levels get buy orders; sell levels get sell orders.
   * Skips levels with zero amount to avoid dust orders.
   */
  async placeGrid(
    botId: string,
    levels: GridLevel[],
    exchange: ExchangeName,
    pair: string
  ): Promise<void> {
    const executor = this.deps.getExecutor();

    for (const level of levels) {
      // Place buy order at this level if there is a buy amount
      if (level.buyAmount > 0) {
        await this.placeLevelOrder(botId, level, "buy", level.buyAmount, exchange, pair, executor);
      }
      // Place sell order at this level if there is a sell amount
      if (level.sellAmount > 0) {
        await this.placeLevelOrder(
          botId,
          level,
          "sell",
          level.sellAmount,
          exchange,
          pair,
          executor
        );
      }
    }
  }

  /**
   * Polls open grid orders every 10 s.
   * Detects fills and places the opposite-side counter order at the adjacent level.
   */
  async startMonitoring(botId: string): Promise<void> {
    if (this.monitors.has(botId)) return; // already monitoring

    const timer = setInterval(() => {
      this.pollFills(botId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[GridExecutor] Poll error for bot ${botId}: ${msg}`);

        // Stop monitoring on exchange auth failure — retrying is pointless and may spam logs
        const isAuthError =
          msg.toLowerCase().includes('apikey') ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('auth') ||
          msg.toLowerCase().includes('invalid key');

        if (isAuthError) {
          console.error(`[GridExecutor] Auth failure detected for bot ${botId} — stopping monitor`);
          this.stopMonitoring(botId);
        }
        // All other errors: log and continue — the interval stays active
      });
    }, POLL_INTERVAL_MS);

    this.monitors.set(botId, timer);
    console.log(`[GridExecutor] Monitoring started for bot ${botId}`);
  }

  /**
   * Cancels all open exchange orders for a bot and marks them cancelled in DB.
   */
  async cancelAll(botId: string): Promise<void> {
    // Stop polling first
    this.stopMonitoring(botId);

    const openOrders = await db.select().from(gridOrders).where(eq(gridOrders.gridBotId, botId));

    for (const order of openOrders) {
      if (order.status !== "open" || !order.exchangeOrderId) continue;

      try {
        // Resolve exchange from bot row via grid_orders — pair stored in bot; use exchangeOrderId
        // We need the exchange instance; look it up from the order context
        // Since we don't store exchange per order, we must have it passed or look it up via bot.
        // For simplicity, iterate all connected exchanges and try to cancel
        await this.tryCancelOnAnyExchange(order.exchangeOrderId, botId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[GridExecutor] Failed to cancel order ${order.exchangeOrderId}: ${msg}`);
      }

      await db.update(gridOrders).set({ status: "cancelled" }).where(eq(gridOrders.id, order.id));
    }

    console.log(`[GridExecutor] All orders cancelled for bot ${botId}`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private stopMonitoring(botId: string): void {
    const timer = this.monitors.get(botId);
    if (timer) {
      clearInterval(timer);
      this.monitors.delete(botId);
    }
  }

  private async placeLevelOrder(
    botId: string,
    level: GridLevel,
    side: "buy" | "sell",
    amount: number,
    exchange: ExchangeName,
    pair: string,
    executor: ReturnType<typeof getExecutor>
  ): Promise<void> {
    // Insert DB row first (open state)
    const [inserted] = await db
      .insert(gridOrders)
      .values({
        gridBotId: botId,
        level: level.level,
        price: level.price,
        amount,
        side,
        status: "open",
      })
      .returning({ id: gridOrders.id });

    try {
      const result = await executor.execute({
        exchange,
        pair,
        side,
        type: "limit",
        amount,
        price: level.price,
      });

      // Update with exchange order id
      await db
        .update(gridOrders)
        .set({ exchangeOrderId: result.orderId })
        .where(eq(gridOrders.id, inserted.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GridExecutor] Failed to place ${side} at level ${level.level}: ${msg}`);
      await db
        .update(gridOrders)
        .set({ status: "cancelled" })
        .where(eq(gridOrders.id, inserted.id));
    }
  }

  /**
   * Checks all open orders for a bot; on fill places the counter order.
   */
  private async pollFills(botId: string): Promise<void> {
    const openOrders = await db.select().from(gridOrders).where(eq(gridOrders.gridBotId, botId));

    const allLevels = openOrders.map((o) => o.level);
    const maxLevel = allLevels.length > 0 ? Math.max(...allLevels) : 0;

    for (const order of openOrders) {
      if (order.status !== "open" || !order.exchangeOrderId) continue;

      const isFilled = await this.checkOrderFilled(order.exchangeOrderId, botId);
      if (!isFilled) continue;

      const now = Math.floor(Date.now() / 1000);
      await db
        .update(gridOrders)
        .set({ status: "filled", filledAt: now })
        .where(eq(gridOrders.id, order.id));

      // Record PnL for completed buy→sell pair
      if (order.side === "sell") {
        // Find the matching buy level (one below)
        const buyLevel = openOrders.find(
          (o) => o.level === order.level - 1 && o.side === "buy" && o.status === "filled"
        );
        if (buyLevel) {
          gridPnLTracker.recordTrade(botId, buyLevel.price, order.price, order.amount);
        }
      }

      // Place counter order at adjacent level
      await this.placeCounterOrder(order, botId, maxLevel);
    }
  }

  /**
   * After a fill, places the counter order at the adjacent grid level.
   * Buy fill → sell at level + 1. Sell fill → buy at level - 1.
   */
  private async placeCounterOrder(
    filledOrder: { level: number; side: string; price: number; amount: number; gridBotId: string },
    botId: string,
    maxLevel: number
  ): Promise<void> {
    // Resolve exchange + pair from bot context — fetched via grid_orders siblings
    const siblings = await db.select().from(gridOrders).where(eq(gridOrders.gridBotId, botId));

    // We can't recover exchange/pair from grid_orders alone without joining gridBots.
    // Import gridBots schema to do so.
    const { gridBots } = await import("@db/schema");
    const botRows = await db
      .select({ exchange: gridBots.exchange, pair: gridBots.pair })
      .from(gridBots)
      .where(eq(gridBots.id, botId))
      .limit(1);

    if (botRows.length === 0) return;
    const { exchange, pair } = botRows[0];

    const executor = this.deps.getExecutor();
    const counterSide = filledOrder.side === "buy" ? "sell" : "buy";
    const targetLevel = filledOrder.side === "buy" ? filledOrder.level + 1 : filledOrder.level - 1;

    if (targetLevel < 0 || targetLevel > maxLevel) return;

    // Find a sibling order at the target level for its price
    const targetOrder = siblings.find((o) => o.level === targetLevel);
    if (!targetOrder) return;

    const counterLevel: GridLevel = {
      level: targetLevel,
      price: targetOrder.price,
      buyAmount: counterSide === "buy" ? filledOrder.amount : 0,
      sellAmount: counterSide === "sell" ? filledOrder.amount : 0,
    };

    await this.placeLevelOrder(
      botId,
      counterLevel,
      counterSide,
      filledOrder.amount,
      exchange as ExchangeName,
      pair,
      executor
    );
  }

  /**
   * Attempts to fetch order status from any connected exchange.
   * Returns true if the order is fully filled.
   */
  private async checkOrderFilled(exchangeOrderId: string, _botId: string): Promise<boolean> {
    for (const [, exchange] of this.deps.exchangeManager.getEnabledExchanges()) {
      try {
        // We don't have pair stored per order — fetchOrder needs symbol
        // Use a best-effort approach: some exchanges allow fetchOrder without symbol
        const order = (await (
          exchange as unknown as {
            fetchOrder: (id: string) => Promise<Record<string, unknown>>;
          }
        ).fetchOrder(exchangeOrderId)) as Record<string, unknown>;

        const status = String(order.status ?? "");
        return status === "closed" || status === "filled";
      } catch {
        // Try next exchange
      }
    }
    return false;
  }

  private async tryCancelOnAnyExchange(exchangeOrderId: string, _botId: string): Promise<void> {
    for (const [, exchange] of this.deps.exchangeManager.getEnabledExchanges()) {
      try {
        await exchange.cancelOrder(exchangeOrderId);
        return;
      } catch {
        // Try next
      }
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const gridExecutor = new GridExecutor();
export { GridExecutor };
