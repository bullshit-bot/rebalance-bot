import { Bot } from 'grammy'
import { env } from '@/config/app-config'
import { eventBus } from '@/events/event-bus'
import type { ExchangeName, RebalanceEvent, TradeResult } from '@/types/index'

// ─── TelegramNotifier ─────────────────────────────────────────────────────────

/**
 * Sends formatted Telegram notifications for key bot events.
 * Gracefully disabled when TELEGRAM_BOT_TOKEN is not configured.
 * Throttles repeated event types to avoid spam (5-minute cooldown per type).
 */
export class TelegramNotifier {
  private bot: Bot | null = null
  private chatId: string = ''
  /** eventType -> timestamp of last sent message */
  private throttle: Map<string, number> = new Map()
  private readonly THROTTLE_MS = 30 * 60 * 1000 // 30 minutes — avoid spamming chat
  /** Stored listener references for clean removal in stop() */
  private listeners: Array<{ event: string; fn: (...args: unknown[]) => void }> = []

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    const token = env.TELEGRAM_BOT_TOKEN
    const chatId = env.TELEGRAM_CHAT_ID

    if (!token) {
      console.warn('[TelegramNotifier] TELEGRAM_BOT_TOKEN not set — notifications disabled')
      return
    }

    if (!chatId) {
      console.warn('[TelegramNotifier] TELEGRAM_CHAT_ID not set — notifications disabled')
      return
    }

    try {
      this.bot = new Bot(token)
      this.chatId = chatId
      // Validate credentials by fetching bot info
      await this.bot.api.getMe()
      console.info('[TelegramNotifier] Initialized successfully')
    } catch (err) {
      console.error('[TelegramNotifier] Failed to initialize — notifications disabled:', err)
      this.bot = null
    }
  }

  async start(): Promise<void> {
    if (!this.bot) return

    // Only subscribe to actionable events — skip noise like exchange:connected/disconnected,
    // drift:warning (visible on dashboard), and bot startup (every deploy triggers it)
    const onTrade = (trade: TradeResult) => { void this.send('trade:executed', this.formatTradeExecuted(trade)) }
    const onRebalance = (event: RebalanceEvent) => { void this.send('rebalance:completed', this.formatRebalanceCompleted(event)) }
    const onTrailingStop = (data: { asset: string; exchange: ExchangeName; price: number; stopPrice: number }) => { void this.send('trailing-stop:triggered', this.formatTrailingStopTriggered(data)) }
    const onError = (err: Error) => { void this.send('error', this.formatAlert({ level: 'error', message: err.message })) }
    const onTrend = (data: { bullish: boolean; price: number; ma: number | null }) => { void this.send('trend:changed', this.formatTrendChanged(data)) }

    eventBus.on('trade:executed', onTrade)
    eventBus.on('rebalance:completed', onRebalance)
    eventBus.on('trailing-stop:triggered', onTrailingStop)
    eventBus.on('error', onError)
    eventBus.on('trend:changed', onTrend)

    this.listeners = [
      { event: 'trade:executed', fn: onTrade as (...args: unknown[]) => void },
      { event: 'rebalance:completed', fn: onRebalance as (...args: unknown[]) => void },
      { event: 'trailing-stop:triggered', fn: onTrailingStop as (...args: unknown[]) => void },
      { event: 'error', fn: onError as (...args: unknown[]) => void },
      { event: 'trend:changed', fn: onTrend as (...args: unknown[]) => void },
    ]

    console.info('[TelegramNotifier] Subscribed to event bus')
  }

  stop(): void {
    if (!this.bot) return
    for (const { event, fn } of this.listeners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(eventBus as any).off(event, fn)
    }
    this.listeners = []
    console.info('[TelegramNotifier] Stopped')
  }

  // ─── Throttled send ─────────────────────────────────────────────────────────

  /**
   * Sends a Telegram HTML message, skipping if the same eventType was sent
   * within the last THROTTLE_MS milliseconds.
   */
  private async send(eventType: string, message: string): Promise<void> {
    if (!this.bot) return

    const now = Date.now()
    const lastSent = this.throttle.get(eventType) ?? 0

    if (now - lastSent < this.THROTTLE_MS) return

    this.throttle.set(eventType, now)

    try {
      await this.bot.api.sendMessage(this.chatId, message, { parse_mode: 'HTML' })
    } catch (err) {
      console.error(`[TelegramNotifier] Failed to send message for event "${eventType}":`, err)
    }
  }

  /** Send a message directly (for external callers like cron scheduler) */
  async sendMessage(message: string): Promise<void> {
    await this.send('direct', message)
  }

  // ─── Formatters ─────────────────────────────────────────────────────────────

  private formatTradeExecuted(trade: TradeResult): string {
    const mode = trade.isPaper ? '📋 <i>Paper</i>' : '✅ <i>Live</i>'
    const side = trade.side === 'buy' ? '🟢 BUY' : '🔴 SELL'
    return [
      `💱 <b>Trade Executed</b> ${mode}`,
      `Pair: <code>${trade.pair}</code> on <code>${trade.exchange}</code>`,
      `Side: ${side}`,
      `Amount: <code>${trade.amount}</code>`,
      `Price: <code>$${trade.price.toFixed(2)}</code>`,
      `Cost: <code>$${trade.costUsd.toFixed(2)}</code>`,
      `Fee: <code>${trade.fee} ${trade.feeCurrency}</code>`,
    ].join('\n')
  }

  private formatRebalanceCompleted(event: RebalanceEvent): string {
    const totalFees = event.totalFeesUsd.toFixed(2)
    const duration =
      event.completedAt && event.startedAt
        ? `${Math.round((event.completedAt.getTime() - event.startedAt.getTime()) / 1000)}s`
        : 'N/A'
    return [
      `🔄 <b>Rebalance Complete</b>`,
      `Trigger: <code>${event.trigger}</code>`,
      `Trades: <code>${event.trades.length}</code>`,
      `Total fees: <code>$${totalFees}</code>`,
      `Duration: <code>${duration}</code>`,
    ].join('\n')
  }

  private formatAlert(data: { level: string; message: string }): string {
    const icon = data.level === 'error' ? '🚨' : data.level === 'warn' ? '⚠️' : 'ℹ️'
    return `${icon} <b>Alert [${data.level.toUpperCase()}]</b>\n${data.message}`
  }

  private formatTrendChanged(data: { bullish: boolean; price: number; ma: number | null }): string {
    const signal = data.bullish ? '🟢 BULL' : '🔴 BEAR'
    const maStr = data.ma !== null ? `$${data.ma.toFixed(2)}` : 'N/A'
    return [
      `📊 <b>Trend Signal: ${signal}</b>`,
      `BTC Price: <code>$${data.price.toFixed(2)}</code>`,
      `MA100: <code>${maStr}</code>`,
    ].join('\n')
  }

  private formatTrailingStopTriggered(data: {
    asset: string
    price: number
    stopPrice: number
  }): string {
    return [
      `🛑 <b>Trailing Stop Triggered</b>`,
      `Asset: <code>${data.asset}</code>`,
      `Trigger price: <code>$${data.price.toFixed(2)}</code>`,
      `Stop price: <code>$${data.stopPrice.toFixed(2)}</code>`,
    ].join('\n')
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const telegramNotifier = new TelegramNotifier()
