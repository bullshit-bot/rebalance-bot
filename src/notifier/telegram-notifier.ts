import { eventBus } from '@/events/event-bus'
import { goClawClient } from '@/ai/goclaw-client'
import type { ExchangeName, RebalanceEvent, TradeResult } from '@/types/index'

// ─── TelegramNotifier ─────────────────────────────────────────────────────────

/**
 * Routes bot events to GoClaw AI agent for Telegram delivery.
 * GoClaw handles all Telegram communication — backend just sends event context.
 * Throttles repeated event types to avoid spam (30-minute cooldown per type).
 */
export class TelegramNotifier {
  /** eventType -> timestamp of last sent message */
  private throttle: Map<string, number> = new Map()
  private readonly THROTTLE_MS = 30 * 60 * 1000 // 30 minutes
  /** Stored listener references for clean removal in stop() */
  private listeners: Array<{ event: string; fn: (...args: unknown[]) => void }> = []

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    const available = await goClawClient.isAvailable()
    if (available) {
      console.info('[TelegramNotifier] GoClaw connected — notifications via AI agent')
    } else {
      console.warn('[TelegramNotifier] GoClaw unavailable — notifications disabled')
    }
  }

  async start(): Promise<void> {
    // Only subscribe to actionable events — GoClaw formats and sends via Telegram
    const onTrade = (trade: TradeResult) => {
      void this.sendViaGoClaw('trade:executed', this.describeTradeEvent(trade))
    }
    const onRebalance = (event: RebalanceEvent) => {
      void this.sendViaGoClaw('rebalance:completed', this.describeRebalanceEvent(event))
    }
    const onTrailingStop = (data: { asset: string; exchange: ExchangeName; price: number; stopPrice: number }) => {
      void this.sendViaGoClaw('trailing-stop:triggered', this.describeTrailingStop(data))
    }
    const onError = (err: Error) => {
      void this.sendViaGoClaw('error', `Lỗi hệ thống: ${err.message}`)
    }
    const onTrend = (data: { bullish: boolean; price: number; ma: number | null }) => {
      void this.sendViaGoClaw('trend:changed', this.describeTrendChange(data))
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

    console.info('[TelegramNotifier] Subscribed to event bus → GoClaw')
  }

  stop(): void {
    for (const { event, fn } of this.listeners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(eventBus as any).off(event, fn)
    }
    this.listeners = []
    console.info('[TelegramNotifier] Stopped')
  }

  // ─── GoClaw delivery ──────────────────────────────────────────────────────

  /**
   * Send event context to GoClaw for Telegram delivery.
   * GoClaw formats the message in Vietnamese and sends via its Telegram channel.
   */
  private async sendViaGoClaw(eventType: string, context: string): Promise<void> {
    const now = Date.now()
    const lastSent = this.throttle.get(eventType) ?? 0
    if (now - lastSent < this.THROTTLE_MS) return

    this.throttle.set(eventType, now)

    const prompt = [
      `Bạn là bot quản lý portfolio crypto. Hãy gửi thông báo ngắn gọn bằng tiếng Việt cho chủ sở hữu về sự kiện sau:`,
      ``,
      `Sự kiện: ${eventType}`,
      context,
      ``,
      `Yêu cầu: Viết ngắn gọn, dùng emoji phù hợp, tập trung vào thông tin quan trọng. Không giải thích dài dòng.`,
    ].join('\n')

    const response = await goClawClient.chat(prompt, 300)
    if (!response) {
      console.error(`[TelegramNotifier] GoClaw failed for event "${eventType}"`)
    }
  }

  /** Send a direct message via GoClaw (for cron scheduler reports) */
  async sendMessage(message: string): Promise<void> {
    const now = Date.now()
    const lastSent = this.throttle.get('direct') ?? 0
    if (now - lastSent < this.THROTTLE_MS) return
    this.throttle.set('direct', now)

    const prompt = [
      `Bạn là bot quản lý portfolio crypto. Hãy gửi báo cáo sau cho chủ sở hữu qua Telegram. Giữ nguyên format, chỉ thêm emoji và nhận xét ngắn cuối báo cáo nếu cần:`,
      ``,
      message,
    ].join('\n')

    await goClawClient.chat(prompt, 500)
  }

  // ─── Event descriptions (plain text for GoClaw to format) ─────────────────

  private describeTradeEvent(trade: TradeResult): string {
    return [
      `Loại: ${trade.side === 'buy' ? 'MUA' : 'BÁN'}`,
      `Cặp: ${trade.pair} trên ${trade.exchange}`,
      `Số lượng: ${trade.amount}`,
      `Giá: $${trade.price.toFixed(2)}`,
      `Giá trị: $${trade.costUsd.toFixed(2)}`,
      `Phí: ${trade.fee} ${trade.feeCurrency}`,
      `Chế độ: ${trade.isPaper ? 'Paper Trading' : 'Live Trading'}`,
    ].join('\n')
  }

  private describeRebalanceEvent(event: RebalanceEvent): string {
    const duration = event.completedAt && event.startedAt
      ? `${Math.round((event.completedAt.getTime() - event.startedAt.getTime()) / 1000)}s`
      : 'N/A'
    return [
      `Trigger: ${event.trigger}`,
      `Số lệnh: ${event.trades.length}`,
      `Tổng phí: $${event.totalFeesUsd.toFixed(2)}`,
      `Thời gian: ${duration}`,
    ].join('\n')
  }

  private describeTrailingStop(data: { asset: string; price: number; stopPrice: number }): string {
    return [
      `Tài sản: ${data.asset}`,
      `Giá kích hoạt: $${data.price.toFixed(2)}`,
      `Giá stop: $${data.stopPrice.toFixed(2)}`,
    ].join('\n')
  }

  private describeTrendChange(data: { bullish: boolean; price: number; ma: number | null }): string {
    const signal = data.bullish ? 'BULL (tăng)' : 'BEAR (giảm)'
    const ma = data.ma !== null ? `$${data.ma.toFixed(2)}` : 'N/A'
    return [
      `Tín hiệu: ${signal}`,
      `Giá BTC: $${data.price.toFixed(2)}`,
      `MA100: ${ma}`,
    ].join('\n')
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const telegramNotifier = new TelegramNotifier()
