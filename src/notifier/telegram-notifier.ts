import { eventBus } from '@/events/event-bus'
import type { ExchangeName, RebalanceEvent, TradeResult } from '@/types/index'

// ─── Telegram Bot API (direct fetch, no Grammy) ─────────────────────────────

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? ''

/** Send a message directly via Telegram Bot API */
async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('[TelegramNotifier] Send failed:', err instanceof Error ? err.message : err)
  }
}

// ─── TelegramNotifier ─────────────────────────────────────────────────────────

/**
 * Sends Telegram notifications for bot events and scheduled reports.
 * Uses direct Telegram Bot API fetch (no Grammy dependency).
 * GoClaw handles interactive Telegram chat separately.
 */
export class TelegramNotifier {
  private throttle: Map<string, number> = new Map()
  private readonly THROTTLE_MS = 30 * 60 * 1000 // 30 minutes
  private listeners: Array<{ event: string; fn: (...args: unknown[]) => void }> = []

  async initialize(): Promise<void> {
    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      console.info('[TelegramNotifier] Telegram Bot API ready')
    } else {
      console.warn('[TelegramNotifier] TELEGRAM_BOT_TOKEN or CHAT_ID not set — disabled')
    }
  }

  async start(): Promise<void> {
    const onTrade = (trade: TradeResult) => {
      const mode = trade.isPaper ? '📋 Paper' : '✅ Live'
      const side = trade.side === 'buy' ? '🟢 MUA' : '🔴 BÁN'
      void this.send('trade:executed', [
        `💱 <b>Giao Dịch</b> ${mode}`,
        `${side} <code>${trade.amount}</code> ${trade.pair}`,
        `Giá: <code>$${trade.price.toFixed(2)}</code> | Phí: <code>${trade.fee} ${trade.feeCurrency}</code>`,
      ].join('\n'))
    }
    const onRebalance = (event: RebalanceEvent) => {
      void this.send('rebalance:completed', [
        `🔄 <b>Rebalance Hoàn Thành</b>`,
        `Trigger: <code>${event.trigger}</code>`,
        `Lệnh: <code>${event.trades?.length ?? 0}</code> | Phí: <code>$${(event.totalFeesUsd ?? 0).toFixed(2)}</code>`,
      ].join('\n'))
    }
    const onTrailingStop = (data: { asset: string; exchange: ExchangeName; price: number; stopPrice: number }) => {
      void this.send('trailing-stop:triggered', [
        `🛑 <b>Trailing Stop</b>`,
        `${data.asset}: <code>$${data.price.toFixed(2)}</code> → stop <code>$${data.stopPrice.toFixed(2)}</code>`,
      ].join('\n'))
    }
    const onError = (err: Error) => {
      void this.send('error', `🚨 <b>Lỗi</b>: ${err.message}`)
    }
    const onTrend = (data: { bullish: boolean; price: number; ma: number | null }) => {
      const signal = data.bullish ? '🟢 BULL' : '🔴 BEAR'
      const ma = data.ma !== null ? `$${data.ma.toFixed(0)}` : 'N/A'
      void this.send('trend:changed', [
        `📊 <b>Trend: ${signal}</b>`,
        `BTC: <code>$${data.price.toFixed(0)}</code> | MA: <code>${ma}</code>`,
      ].join('\n'))
    }

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
    for (const { event, fn } of this.listeners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(eventBus as any).off(event, fn)
    }
    this.listeners = []
  }

  /** Send scheduled report or direct message via Telegram */
  async sendMessage(message: string): Promise<void> {
    await sendTelegram(message)
  }

  /** Throttled send for event-driven notifications */
  private async send(eventType: string, message: string): Promise<void> {
    const now = Date.now()
    const lastSent = this.throttle.get(eventType) ?? 0
    if (now - lastSent < this.THROTTLE_MS) return
    this.throttle.set(eventType, now)
    await sendTelegram(message)
  }
}

export const telegramNotifier = new TelegramNotifier()
