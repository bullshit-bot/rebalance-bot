import { Schema, model } from "mongoose";

export interface IRebalance {
  _id: string;
  triggerType: "threshold" | "periodic" | "manual";
  status: "pending" | "executing" | "completed" | "failed";
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown> | null;
  totalTrades: number;
  totalFeesUsd: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

const rebalanceSchema = new Schema<IRebalance>({
  _id: { type: String, required: true },
  triggerType: { type: String, enum: ["threshold", "periodic", "manual"], required: true },
  status: { type: String, enum: ["pending", "executing", "completed", "failed"], required: true },
  beforeState: { type: Schema.Types.Mixed, required: true },
  afterState: { type: Schema.Types.Mixed, default: null },
  totalTrades: { type: Number, default: 0 },
  totalFeesUsd: { type: Number, default: 0 },
  errorMessage: { type: String, default: null },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
});

export const RebalanceModel = model<IRebalance>("Rebalance", rebalanceSchema);
export type Rebalance = IRebalance;
export type NewRebalance = Omit<
  IRebalance,
  "totalTrades" | "totalFeesUsd" | "startedAt" | "completedAt" | "afterState" | "errorMessage"
> & {
  totalTrades?: number;
  totalFeesUsd?: number;
  startedAt?: Date;
  completedAt?: Date | null;
  afterState?: Record<string, unknown> | null;
  errorMessage?: string | null;
};
