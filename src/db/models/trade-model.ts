import { Schema, model } from 'mongoose'

export interface ITrade {
  exchange: string
  pair: string
  side: 'buy' | 'sell'
  amount: number
  price: number
  costUsd: number
  fee: number | null
  feeCurrency: string | null
  orderId: string | null
  rebalanceId: string | null
  isPaper: boolean
  executedAt: Date
}

const tradeSchema = new Schema<ITrade>({
  exchange: { type: String, required: true },
  pair: { type: String, required: true },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  amount: { type: Number, required: true },
  price: { type: Number, required: true },
  costUsd: { type: Number, required: true },
  fee: { type: Number, default: null },
  feeCurrency: { type: String, default: null },
  orderId: { type: String, default: null },
  rebalanceId: { type: String, default: null },
  isPaper: { type: Boolean, default: false },
  executedAt: { type: Date, default: Date.now },
})

tradeSchema.index({ rebalanceId: 1 })

export const TradeModel = model<ITrade>('Trade', tradeSchema)
export type Trade = ITrade & { _id: string }
export type NewTrade = Omit<ITrade, 'isPaper' | 'executedAt'> & { isPaper?: boolean; executedAt?: Date }
