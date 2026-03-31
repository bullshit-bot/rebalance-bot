import { Schema, model } from "mongoose";

export interface ISnapshot {
  totalValueUsd: number;
  holdings: Record<string, unknown>;
  allocations: Record<string, unknown>;
  createdAt: Date;
}

const snapshotSchema = new Schema<ISnapshot>({
  totalValueUsd: { type: Number, required: true },
  holdings: { type: Schema.Types.Mixed, required: true },
  allocations: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});

snapshotSchema.index({ createdAt: -1 });

export const SnapshotModel = model<ISnapshot>("Snapshot", snapshotSchema);
export type Snapshot = ISnapshot & { _id: string };
export type NewSnapshot = Omit<ISnapshot, "createdAt"> & { createdAt?: Date };
