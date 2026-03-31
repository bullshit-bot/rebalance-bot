import { Schema, model } from "mongoose";

export interface IAllocation {
  asset: string;
  targetPct: number;
  exchange: string | null;
  minTradeUsd: number;
  updatedAt: Date;
}

const allocationSchema = new Schema<IAllocation>({
  asset: { type: String, required: true },
  targetPct: { type: Number, required: true },
  exchange: { type: String, default: null },
  minTradeUsd: { type: Number, default: 10 },
  updatedAt: { type: Date, default: Date.now },
});

allocationSchema.index({ asset: 1, exchange: 1 }, { unique: true });

export const AllocationModel = model<IAllocation>("Allocation", allocationSchema);
export type Allocation = IAllocation & { _id: string };
export type NewAllocation = Omit<IAllocation, "updatedAt"> & { updatedAt?: Date };
