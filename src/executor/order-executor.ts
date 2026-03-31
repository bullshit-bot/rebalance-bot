import { randomUUID } from "node:crypto";
import type { TradeOrder, TradeResult } from "@/types/index";
import { env } from "@config/app-config";
import { TradeModel } from "@db/database";
import { eventBus } from "@events/event-bus";
import { exchangeManager } from "@exchange/exchange-manager";
import { executionGuard } from "@executor/execution-guard";
import { priceCache } from "@price/price-cache";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IOrderExecutor {
  execute(order: TradeOrder): Promise<TradeResult>;
  executeBatch(orders: TradeOrder[]): Promise<TradeResult[]>;
}

// ─── Dependency injection interfaces ──────────────────────────────────────────

export interface IExchangeManagerDep {
  getExchange(name: string):
    | {
        createOrder: Function;
        cancelOrder: Function;
        fetchOrder: Function;
        fetchBalance: Function;
        fetchOpenOrders?: Function;
      }
    | undefined;
}

export interface IPriceCacheDep {
  getBestPrice(pair: string): number | undefined;
}

export interface IExecutionGuardDep {
  canExecute(
    order: TradeOrder,
    price: number,
    portfolioValue: number
  ): { allowed: boolean; reason?: string };
  recordTrade(result: TradeResult): void;
}

export interface IEventBusDep {
  emit(event: string, data?: unknown): void;
}

export interface OrderExecutorDeps {
  exchangeManager: IExchangeManagerDep;
  priceCache: IPriceCacheDep;
  executionGuard: IExecutionGuardDep;
  eventBus: IEventBusDep;
}

// ─── OrderExecutor ────────────────────────────────────────────────────────────

/**
 * Executes real orders against configured exchanges via CCXT.
 *
 * Strategy per order:
 *  1. Check safety limits via ExecutionGuard
 *  2. Place a limit order at current market price
 *  3. Poll for fill for up to 30 seconds
 *  4. If unfilled → cancel and place a market order
 *  5. Retry up to 3 times with exponential back-off on transient errors
 *  6. Persist trade to DB and emit trade:executed
 *
 * Accepts optional deps for dependency injection in tests.
 */
export class OrderExecutor implements IOrderExecutor {
  private readonly deps: OrderExecutorDeps;

  constructor(deps?: Partial<OrderExecutorDeps>) {
    this.deps = {
      exchangeManager: deps?.exchangeManager ?? (exchangeManager as unknown as IExchangeManagerDep),
      priceCache: deps?.priceCache ?? priceCache,
      executionGuard: deps?.executionGuard ?? (executionGuard as unknown as IExecutionGuardDep),
      eventBus: deps?.eventBus ?? (eventBus as unknown as IEventBusDep),
    };
  }

  async execute(order: TradeOrder): Promise<TradeResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = Math.pow(2, attempt) * 1_000;
          await sleep(backoffMs);
        }

        return await this.executeOnce(order);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[OrderExecutor] Attempt ${attempt + 1}/${MAX_RETRIES} failed for ${order.pair}: ${lastError.message}`
        );
      }
    }

    throw (
      lastError ??
      new Error(`[OrderExecutor] Failed to execute order after ${MAX_RETRIES} attempts`)
    );
  }

  async executeBatch(orders: TradeOrder[]): Promise<TradeResult[]> {
    const results: TradeResult[] = [];

    for (const order of orders) {
      try {
        const result = await this.execute(order);
        results.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[OrderExecutor] Batch order failed for ${order.pair}: ${message}`);
      }
    }

    return results;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async executeOnce(order: TradeOrder): Promise<TradeResult> {
    const exchange = this.deps.exchangeManager.getExchange(order.exchange);
    if (!exchange) {
      throw new Error(`[OrderExecutor] Exchange ${order.exchange} not connected`);
    }

    // Resolve current market price
    const currentPrice = this.deps.priceCache.getBestPrice(order.pair) ?? order.price;
    if (currentPrice === undefined) {
      throw new Error(`[OrderExecutor] No price available for ${order.pair}`);
    }

    // Safety check
    const portfolioValueUsd = await this.estimatePortfolioValueUsd(
      order.exchange,
      currentPrice,
      order.pair
    );
    const guard = this.deps.executionGuard.canExecute(order, currentPrice, portfolioValueUsd);
    if (!guard.allowed) {
      throw new Error(`[OrderExecutor] Blocked by execution guard: ${guard.reason}`);
    }

    // Place market order directly (faster, avoids limit order lock issues on testnet)
    let ccxtOrder: Record<string, unknown>;

    try {
      console.log(`[OrderExecutor] Placing market ${order.side} ${order.amount} ${order.pair}`);
      ccxtOrder = (await exchange.createOrder(
        order.pair,
        "market",
        order.side,
        order.amount
      )) as unknown as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isNetworkError = this.isNetworkError(error);

      if (isNetworkError) {
        console.log(`[OrderExecutor] Network error for ${order.pair}: ${message}`);
        const maybeOpen = await this.findPossiblyPlacedOrder(exchange as any, order);
        if (maybeOpen) {
          console.log(`[OrderExecutor] Found existing order ${String(maybeOpen["id"])}`);
          ccxtOrder = maybeOpen;
        } else {
          throw error;
        }
      } else {
        throw new Error(`[OrderExecutor] Market order failed for ${order.pair}: ${message}`);
      }
    }

    const result = this.mapCcxtOrderToResult(ccxtOrder, order);
    await this.persistAndEmit(result);
    return result;
  }

  /**
   * Maps a raw CCXT order object to our internal TradeResult.
   */
  private mapCcxtOrderToResult(
    ccxtOrder: Record<string, unknown>,
    original: TradeOrder
  ): TradeResult {
    const filledPrice =
      toNumber(ccxtOrder["average"] ?? ccxtOrder["price"]) ?? toNumber(original.price) ?? 0;
    const filledAmount = toNumber(ccxtOrder["filled"] ?? ccxtOrder["amount"]) ?? original.amount;
    const costUsd = toNumber(ccxtOrder["cost"]) ?? filledAmount * filledPrice;

    const feeInfo = ccxtOrder["fee"] as Record<string, unknown> | undefined;
    const fee = toNumber(feeInfo?.["cost"]) ?? 0;
    const feeCurrency = String(feeInfo?.["currency"] ?? "USDT");

    return {
      id: randomUUID(),
      exchange: original.exchange,
      pair: original.pair,
      side: original.side,
      amount: filledAmount,
      price: filledPrice,
      costUsd,
      fee,
      feeCurrency,
      orderId: String(ccxtOrder["id"] ?? ""),
      executedAt: new Date(),
    };
  }

  /**
   * Returns true if the error is a transient network/connection issue.
   * These errors may have resulted in an order being placed despite the failure.
   */
  private isNetworkError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message.toLowerCase() : "";
    return (
      msg.includes("network") ||
      msg.includes("connection") ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("socket") ||
      msg.includes("enotfound")
    );
  }

  /**
   * After a network error during order placement, checks open orders to see if
   * the order was actually submitted. Returns the matching order if found, null otherwise.
   * This prevents duplicate orders on retry.
   */
  private async findPossiblyPlacedOrder(
    exchange: { fetchOpenOrders?: ((symbol: string) => Promise<unknown[]>) | undefined },
    order: TradeOrder
  ): Promise<Record<string, unknown> | null> {
    if (typeof exchange.fetchOpenOrders !== "function") return null;

    try {
      const openOrders = (await exchange.fetchOpenOrders(order.pair)) as Record<string, unknown>[];
      // Match by side and amount (within 1% tolerance)
      for (const o of openOrders) {
        const oSide = String(o["side"] ?? "");
        const oAmount = Number(o["amount"] ?? 0);
        if (oSide === order.side && Math.abs(oAmount - order.amount) / order.amount < 0.01) {
          return o;
        }
      }
    } catch {
      // Best-effort — if we can't check, fall back to rethrowing
    }

    return null;
  }

  /**
   * Rough portfolio value estimate: fetches USDT balance for the given exchange.
   * Used only for daily loss limit % calculation — not a precise valuation.
   */
  private async estimatePortfolioValueUsd(
    exchangeName: string,
    _currentPrice: number,
    _pair: string
  ): Promise<number> {
    try {
      const exchange = this.deps.exchangeManager.getExchange(exchangeName);
      if (!exchange) return 0;

      const balances = (await exchange.fetchBalance()) as Record<string, unknown>;
      const total = balances["total"] as Record<string, number> | undefined;
      return total?.["USDT"] ?? 0;
    } catch {
      return 0;
    }
  }

  private async persistAndEmit(result: TradeResult): Promise<void> {
    try {
      await TradeModel.create({
        exchange: result.exchange,
        pair: result.pair,
        side: result.side,
        amount: result.amount,
        price: result.price,
        costUsd: result.costUsd,
        fee: result.fee,
        feeCurrency: result.feeCurrency,
        orderId: result.orderId ?? null,
        rebalanceId: result.rebalanceId ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[OrderExecutor] Failed to persist trade to DB: ${message}`);
    }

    this.deps.executionGuard.recordTrade(result);
    this.deps.eventBus.emit("trade:executed", result);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: unknown): number | undefined {
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const orderExecutor = new OrderExecutor();

// Re-export env for use in paper engine factory
export { env };
