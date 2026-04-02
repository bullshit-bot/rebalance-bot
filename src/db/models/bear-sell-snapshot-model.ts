import mongoose from "mongoose";

export interface IBearSellSnapshot {
  amountUsd: number;
  createdAt: Date;
  used: boolean;
}

const bearSellSnapshotSchema = new mongoose.Schema<IBearSellSnapshot>({
  amountUsd: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  used: { type: Boolean, default: false },
});

export const BearSellSnapshotModel = mongoose.model<IBearSellSnapshot>(
  "BearSellSnapshot",
  bearSellSnapshotSchema,
  "bear_sell_snapshots"
);
