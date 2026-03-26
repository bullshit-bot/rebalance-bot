import { Schema, model } from 'mongoose'

export interface IGridBot {
  _id: string
  exchange: string
  pair: string
  gridType: string // 'normal' | 'reverse'
  priceLower: number
  priceUpper: number
  gridLevels: number
  investment: number
  status: string // 'active' | 'stopped'
  totalProfit: number
  totalTrades: number
  config: Record<string, unknown>
  createdAt: Date
  stoppedAt: Date | null
}

const gridBotSchema = new Schema<IGridBot>({
  _id: { type: String, required: true },
  exchange: { type: String, required: true },
  pair: { type: String, required: true },
  gridType: { type: String, required: true },
  priceLower: { type: Number, required: true },
  priceUpper: { type: Number, required: true },
  gridLevels: { type: Number, required: true },
  investment: { type: Number, required: true },
  status: { type: String, required: true },
  totalProfit: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },
  config: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  stoppedAt: { type: Date, default: null },
})

export const GridBotModel = model<IGridBot>('GridBot', gridBotSchema)
export type GridBot = IGridBot
export type NewGridBot = Omit<IGridBot, 'totalProfit' | 'totalTrades' | 'createdAt' | 'stoppedAt'> & {
  totalProfit?: number; totalTrades?: number; createdAt?: Date; stoppedAt?: Date | null
}
