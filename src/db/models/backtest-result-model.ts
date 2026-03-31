import { Schema, model } from "mongoose";

export interface IBacktestResult {
  _id: string;
  config: Record<string, unknown>;
  metrics: Record<string, unknown>;
  trades: Record<string, unknown>[];
  benchmark: Record<string, unknown>;
  createdAt: Date;
}

const backtestResultSchema = new Schema<IBacktestResult>({
  _id: { type: String, required: true },
  config: { type: Schema.Types.Mixed, required: true },
  metrics: { type: Schema.Types.Mixed, required: true },
  trades: { type: Schema.Types.Mixed, required: true },
  benchmark: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const BacktestResultModel = model<IBacktestResult>("BacktestResult", backtestResultSchema);
export type BacktestResult = IBacktestResult;
export type NewBacktestResult = Omit<IBacktestResult, "createdAt"> & { createdAt?: Date };
