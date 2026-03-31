import { Schema, model } from "mongoose";

export interface ISmartOrder {
  _id: string;
  type: string; // 'twap' | 'vwap'
  exchange: string;
  pair: string;
  side: string; // 'buy' | 'sell'
  totalAmount: number;
  filledAmount: number;
  avgPrice: number | null;
  slicesTotal: number;
  slicesCompleted: number;
  durationMs: number;
  status: string; // 'active' | 'paused' | 'completed' | 'cancelled'
  config: Record<string, unknown>;
  rebalanceId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

const smartOrderSchema = new Schema<ISmartOrder>({
  _id: { type: String, required: true },
  type: { type: String, required: true },
  exchange: { type: String, required: true },
  pair: { type: String, required: true },
  side: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  filledAmount: { type: Number, default: 0 },
  avgPrice: { type: Number, default: null },
  slicesTotal: { type: Number, required: true },
  slicesCompleted: { type: Number, default: 0 },
  durationMs: { type: Number, required: true },
  status: { type: String, required: true },
  config: { type: Schema.Types.Mixed, required: true },
  rebalanceId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
});

export const SmartOrderModel = model<ISmartOrder>("SmartOrder", smartOrderSchema);
export type SmartOrder = ISmartOrder;
export type NewSmartOrder = Omit<
  ISmartOrder,
  "filledAmount" | "avgPrice" | "slicesCompleted" | "createdAt" | "completedAt"
> & {
  filledAmount?: number;
  avgPrice?: number | null;
  slicesCompleted?: number;
  createdAt?: Date;
  completedAt?: Date | null;
};
