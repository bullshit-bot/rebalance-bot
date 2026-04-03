import { Schema, model } from "mongoose";

/**
 * Tracks capital inflows: deposits and DCA executions.
 * Used to compute PnL = portfolio value - totalInvested.
 */
export interface ICapitalFlow {
  type: "deposit" | "dca";
  amountUsd: number;
  note?: string;
  createdAt: Date;
}

const capitalFlowSchema = new Schema<ICapitalFlow>({
  type: { type: String, enum: ["deposit", "dca"], required: true },
  amountUsd: { type: Number, required: true },
  note: { type: String },
  createdAt: { type: Date, default: Date.now },
});

capitalFlowSchema.index({ createdAt: -1 });
capitalFlowSchema.index({ type: 1 });

export const CapitalFlowModel = model<ICapitalFlow>("CapitalFlow", capitalFlowSchema);
export type CapitalFlow = ICapitalFlow & { _id: string };
