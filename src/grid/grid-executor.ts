import type { ExchangeName } from "@/types/index";
import { GridBotModel, GridOrderModel } from "@db/database";
import { exchangeManager } from "@exchange/exchange-manager";
import { getExecutor } from "@executor/index";
import type { IOrderExecutor } from "@executor/order-executor";
import type { GridLevel } from "@grid/grid-calculator";
import { gridPnLTracker } from "@grid/grid-pnl-tracker";

// ─── Dependency injection interfaces ─────────────────────────────────────────

export interface IExchangeManagerDepGE {
  getEnabledExchanges(): Map<
    string,
    {
      fetchOrder(id: string): Promise<Record<string, unknown>>;
      cancelOrder(id: string): Promise<unknown>;
    }
  >;
}

export interface GridExecutorDeps {
  exchangeManager: IExchangeManagerDepGE;
  /** Injectable executor factory — defaults to getExecutor(). */
  getExecutor: () => IOrderExecutor;
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
      exchangeManager:
        deps?.exchangeManager ?? (exchangeManager as unknown as IExchangeManagerDepGE),
      getExecutor: deps?.getExecutor ?? getExecutor,
    };
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
          msg.toLowerCase().includes("apikey") ||
          msg.toLowerCase().includes("unauthorized") ||
          msg.toLowerCase().includes("auth") ||
          msg.toLowerCase().includes("invalid key");

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

    const openOrders = await GridOrderModel.find({ gridBotId: botId }).lean();

    for (const order of openOrders) {
      if (order.status !== "open" || !order.exchangeOrderId) continue;

      try {
        await this.tryCancelOnAnyExchange(order.exchangeOrderId, botId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[GridExecutor] Failed to cancel order ${order.exchangeOrderId}: ${msg}`);
      }

      await GridOrderModel.updateOne({ _id: order._id }, { status: "cancelled" });
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
    const inserted = await GridOrderModel.create({
      gridBotId: botId,
      level: level.level,
      price: level.price,
      amount,
      side,
      status: "open",
    });

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
      await GridOrderModel.updateOne({ _id: inserted._id }, { exchangeOrderId: result.orderId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[GridExecutor] Failed to place ${side} at level ${level.level}: ${msg}`);
      await GridOrderModel.updateOne({ _id: inserted._id }, { status: "cancelled" });
    }
  }

  /**
   * Checks all open orders for a bot; on fill places the counter order.
   */
  private async pollFills(botId: string): Promise<void> {
    const openOrders = await GridOrderModel.find({ gridBotId: botId }).lean();

    const allLevels = openOrders.map((o) => o.level);
    const maxLevel = allLevels.length > 0 ? Math.max(...allLevels) : 0;

    for (const order of openOrders) {
      if (order.status !== "open" || !order.exchangeOrderId) continue;

      const isFilled = await this.checkOrderFilled(order.exchangeOrderId, botId);
      if (!isFilled) continue;

      await GridOrderModel.updateOne(
        { _id: order._id },
        { status: "filled", filledAt: new Date() }
      );

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
    // Resolve exchange + pair from the bot document
    const bot = await GridBotModel.findById(botId).lean();
    if (!bot) return;

    const { exchange, pair } = bot;
    const siblings = await GridOrderModel.find({ gridBotId: botId }).lean();

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
