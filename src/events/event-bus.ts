import { EventEmitter } from 'events'
import type {
  ExchangeName,
  Portfolio,
  PriceData,
  RebalanceEvent,
  RebalanceTrigger,
  TradeResult,
} from '@/types/index'

// ─── Typed event map ──────────────────────────────────────────────────────────

/**
 * Maps every event name to its payload type.
 * Adding a new event: add it here — TypeScript enforces usage everywhere.
 */
interface EventMap {
  'price:update': PriceData
  'portfolio:update': Portfolio
  'balance:update': { exchange: ExchangeName; balances: Record<string, number> }
  'drift:warning': { asset: string; currentPct: number; targetPct: number; driftPct: number }
  'rebalance:trigger': { trigger: RebalanceTrigger }
  'rebalance:started': RebalanceEvent
  'rebalance:completed': RebalanceEvent
  'rebalance:failed': { id: string; error: string }
  'trade:executed': TradeResult
  'trailing-stop:triggered': { asset: string; exchange: ExchangeName; price: number; stopPrice: number }
  'exchange:connected': ExchangeName
  'exchange:disconnected': ExchangeName
  'exchange:error': { exchange: ExchangeName; error: string }
  error: Error
}

type EventKey = keyof EventMap
type Listener<K extends EventKey> = (payload: EventMap[K]) => void

// ─── TypedEventEmitter ────────────────────────────────────────────────────────

/**
 * Thin type-safe wrapper around Node/Bun's EventEmitter.
 * All emit/on/off/once calls are fully typed — wrong payload shape = compile error.
 */
class TypedEventEmitter {
  private readonly emitter: EventEmitter

  constructor() {
    this.emitter = new EventEmitter()
    // Raise the default limit slightly for a bot that may have many concurrent listeners
    this.emitter.setMaxListeners(50)
  }

  /** Subscribe to an event. Returns `this` for chaining. */
  on<K extends EventKey>(event: K, listener: Listener<K>): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
    return this
  }

  /** Subscribe to an event exactly once. Returns `this` for chaining. */
  once<K extends EventKey>(event: K, listener: Listener<K>): this {
    this.emitter.once(event, listener as (...args: unknown[]) => void)
    return this
  }

  /** Unsubscribe a previously registered listener. Returns `this` for chaining. */
  off<K extends EventKey>(event: K, listener: Listener<K>): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void)
    return this
  }

  /** Remove ALL listeners for a given event (or all events if omitted). */
  removeAllListeners(event?: EventKey): this {
    this.emitter.removeAllListeners(event)
    return this
  }

  /** Emit an event synchronously to all registered listeners. */
  emit<K extends EventKey>(event: K, payload: EventMap[K]): boolean {
    return this.emitter.emit(event, payload)
  }

  /** Return the number of listeners registered for an event. */
  listenerCount(event: EventKey): number {
    return this.emitter.listenerCount(event)
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Application-wide event bus singleton.
 * Import this everywhere — never instantiate TypedEventEmitter directly.
 *
 * @example
 * import { eventBus } from '@events/event-bus'
 * eventBus.on('price:update', (data) => console.log(data.price))
 * eventBus.emit('price:update', priceData)
 */
export const eventBus = new TypedEventEmitter()

export type { EventMap, EventKey, Listener }
