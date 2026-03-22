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
class TelegramNotifier {
  private bot: Bot | null = null
  private chatId: string = ''
  /** eventType -> timestamp of last sent message */
  private throttle: Map<string, number> = new Map()
  private readonly THROTTLE_MS = 5 * 60 * 1000 // 5 minutes

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

    eventBus.on('trade:executed', (trade) => {
      void this.send('trade:executed', this.formatTradeExecuted(trade))
    })

    eventBus.on('rebalance:completed', (event) => {
      void this.send('rebalance:completed', this.formatRebalanceCompleted(event))
    })

    eventBus.on('drift:warning', (data) => {
      void this.send('drift:warning', this.formatDriftWarning(data))
    })

    eventBus.on('trailing-stop:triggered', (data) => {
      void this.send('trailing-stop:triggered', this.formatTrailingStopTriggered(data))
    })

    eventBus.on('exchange:disconnected', (exchange) => {
      void this.send(`exchange:disconnected:${exchange}`, this.formatExchangeStatus(exchange, 'disconnected'))
    })

    eventBus.on('exchange:connected', (exchange) => {
      void this.send(`exchange:connected:${exchange}`, this.formatExchangeStatus(exchange, 'connected'))
    })

    eventBus.on('error', (err) => {
      void this.send('error', this.formatAlert({ level: 'error', message: err.message }))
    })

    console.info('[TelegramNotifier] Subscribed to event bus')
  }

  stop(): void {
    if (!this.bot) return
    eventBus.removeAllListeners('trade:executed')
    eventBus.removeAllListeners('rebalance:completed')
    eventBus.removeAllListeners('drift:warning')
    eventBus.removeAllListeners('trailing-stop:triggered')
    eventBus.removeAllListeners('exchange:disconnected')
    eventBus.removeAllListeners('exchange:connected')
    eventBus.removeAllListeners('error')
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

  private formatDriftWarning(data: {
    asset: string
    currentPct: number
    targetPct: number
    driftPct: number
  }): string {
    const direction = data.driftPct > 0 ? '▲' : '▼'
    return [
      `⚠️ <b>Drift Warning</b>`,
      `Asset: <code>${data.asset}</code>`,
      `Current: <code>${data.currentPct.toFixed(2)}%</code>`,
      `Target: <code>${data.targetPct.toFixed(2)}%</code>`,
      `Drift: <code>${direction} ${Math.abs(data.driftPct).toFixed(2)}%</code>`,
    ].join('\n')
  }

  private formatAlert(data: { level: string; message: string }): string {
    const icon = data.level === 'error' ? '🚨' : data.level === 'warn' ? '⚠️' : 'ℹ️'
    return `${icon} <b>Alert [${data.level.toUpperCase()}]</b>\n${data.message}`
  }

  private formatExchangeStatus(exchange: ExchangeName, status: string): string {
    const icon = status === 'connected' ? '🟢' : '🔴'
    const label = status === 'connected' ? 'Connected' : 'Disconnected'
    return `${icon} <b>Exchange ${label}</b>\nExchange: <code>${exchange}</code>`
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
