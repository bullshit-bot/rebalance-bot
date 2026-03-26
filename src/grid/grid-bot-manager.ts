import { randomUUID } from "node:crypto";
import type { ExchangeName } from "@/types/index";
import { GridBotModel } from "@db/database";
import type { IGridBot } from "@db/database";
import { gridCalculator } from "@grid/grid-calculator";
import { gridExecutor } from "@grid/grid-executor";
import { gridPnLTracker } from "@grid/grid-pnl-tracker";
import { priceCache } from "@price/price-cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateGridBotParams {
  exchange: ExchangeName;
  pair: string;
  priceLower: number;
  priceUpper: number;
  gridLevels: number;
  investment: number;
  gridType: "normal" | "reverse";
}

export interface StopResult {
  totalProfit: number;
  totalTrades: number;
}

// ─── GridBotManager ───────────────────────────────────────────────────────────

/**
 * Orchestrates the full lifecycle of grid bots:
 *  create → calculate levels → place orders → start monitoring
 *  stop   → cancel all orders → report PnL
 */
class GridBotManager {
  /**
   * Creates a new grid bot, calculates levels at current price,
   * places initial limit orders and starts the fill monitor.
   * Returns the new bot ID.
   */
  async create(params: CreateGridBotParams): Promise<string> {
    const { exchange, pair, priceLower, priceUpper, gridLevels, investment, gridType } = params;

    // Resolve current price from cache
    const currentPrice = priceCache.getBestPrice(pair);
    if (currentPrice === undefined) {
      throw new Error(
        `[GridBotManager] No price cached for ${pair} — ensure price feed is running`
      );
    }

    // Validate price range
    if (currentPrice < priceLower || currentPrice > priceUpper) {
      throw new Error(
        `[GridBotManager] Current price ${currentPrice} is outside grid range [${priceLower}, ${priceUpper}]`
      );
    }

    const botId = randomUUID();

    // Persist bot row
    await GridBotModel.create({
      _id: botId,
      exchange,
      pair,
      gridType,
      priceLower,
      priceUpper,
      gridLevels,
      investment,
      status: "active",
      totalProfit: 0,
      totalTrades: 0,
      config: { gridType, priceLower, priceUpper, gridLevels, investment },
    });

    console.log(`[GridBotManager] Created bot ${botId} for ${pair} on ${exchange}`);

    // Calculate grid levels
    const levels = gridCalculator.calculate({
      priceLower,
      priceUpper,
      gridLevels,
      investment,
      currentPrice,
      gridType,
    });

    // Place initial orders
    await gridExecutor.placeGrid(botId, levels, exchange, pair);

    // Start fill monitoring
    await gridExecutor.startMonitoring(botId);

    console.log(`[GridBotManager] Bot ${botId} is active with ${levels.length} grid levels`);
    return botId;
  }

  /**
   * Stops a running bot: cancels all open orders, marks as stopped,
   * loads final PnL from DB and returns it.
   */
  async stop(botId: string): Promise<StopResult> {
    const bot = await this.getBot(botId);
    if (!bot) throw new Error(`[GridBotManager] Bot ${botId} not found`);
    if (bot.status === "stopped")
      throw new Error(`[GridBotManager] Bot ${botId} is already stopped`);

    // Cancel all orders and stop polling
    await gridExecutor.cancelAll(botId);

    // Mark stopped in DB
    await GridBotModel.updateOne({ _id: botId }, { status: "stopped", stoppedAt: new Date() });

    // Load final PnL
    await gridPnLTracker.loadFromDb(botId);
    const pnl = gridPnLTracker.getPnL(botId);
    gridPnLTracker.clear(botId);

    console.log(
      `[GridBotManager] Bot ${botId} stopped — profit: ${pnl.realized.toFixed(4)} USDT over ${pnl.tradeCount} trades`
    );

    return { totalProfit: pnl.realized, totalTrades: pnl.tradeCount };
  }

  /** Fetch a single bot row or null if not found. */
  async getBot(botId: string): Promise<IGridBot | null> {
    return GridBotModel.findById(botId).lean();
  }

  /** List all grid bots (active and stopped). */
  async listBots(): Promise<IGridBot[]> {
    return GridBotModel.find().lean();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const gridBotManager = new GridBotManager();
export { GridBotManager };
