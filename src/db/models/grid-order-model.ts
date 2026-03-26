import { Schema, model } from 'mongoose'

export interface IGridOrder {
  gridBotId: string
  level: number
  price: number
  amount: number
  side: string
  status: string // 'open' | 'filled' | 'cancelled'
  exchangeOrderId: string | null
  filledAt: Date | null
}

const gridOrderSchema = new Schema<IGridOrder>({
  gridBotId: { type: String, required: true },
  level: { type: Number, required: true },
  price: { type: Number, required: true },
  amount: { type: Number, required: true },
  side: { type: String, required: true },
  status: { type: String, required: true },
  exchangeOrderId: { type: String, default: null },
  filledAt: { type: Date, default: null },
})

gridOrderSchema.index({ gridBotId: 1 })

export const GridOrderModel = model<IGridOrder>('GridOrder', gridOrderSchema)
export type GridOrder = IGridOrder & { _id: string }
export type NewGridOrder = IGridOrder
