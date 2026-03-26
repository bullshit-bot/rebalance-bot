import { Schema, model } from 'mongoose'

export interface IOhlcvCandle {
  exchange: string
  pair: string
  timeframe: string
  timestamp: number // unix ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const ohlcvCandleSchema = new Schema<IOhlcvCandle>({
  exchange: { type: String, required: true },
  pair: { type: String, required: true },
  timeframe: { type: String, required: true },
  timestamp: { type: Number, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, required: true },
})

ohlcvCandleSchema.index({ exchange: 1, pair: 1, timeframe: 1, timestamp: 1 }, { unique: true })

export const OhlcvCandleModel = model<IOhlcvCandle>('OhlcvCandle', ohlcvCandleSchema)
export type OhlcvCandle = IOhlcvCandle & { _id: string }
export type NewOhlcvCandle = IOhlcvCandle
