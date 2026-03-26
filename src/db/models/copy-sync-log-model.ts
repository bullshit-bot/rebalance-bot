import { Schema, model } from 'mongoose'

export interface ICopySyncLog {
  sourceId: string
  beforeAllocations: Record<string, unknown>[]
  afterAllocations: Record<string, unknown>[]
  changesApplied: number
  syncedAt: Date
}

const copySyncLogSchema = new Schema<ICopySyncLog>({
  sourceId: { type: String, required: true },
  beforeAllocations: { type: Schema.Types.Mixed, required: true },
  afterAllocations: { type: Schema.Types.Mixed, required: true },
  changesApplied: { type: Number, default: 0 },
  syncedAt: { type: Date, default: Date.now },
})

copySyncLogSchema.index({ sourceId: 1 })

export const CopySyncLogModel = model<ICopySyncLog>('CopySyncLog', copySyncLogSchema)
export type CopySyncLog = ICopySyncLog & { _id: string }
export type NewCopySyncLog = Omit<ICopySyncLog, 'changesApplied' | 'syncedAt'> & {
  changesApplied?: number; syncedAt?: Date
}
