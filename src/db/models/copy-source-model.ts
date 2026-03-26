import { Schema, model } from 'mongoose'

export interface ICopySource {
  _id: string
  name: string
  sourceType: string // 'url' | 'manual'
  sourceUrl: string | null
  allocations: Record<string, unknown>[]
  weight: number
  syncInterval: string
  enabled: boolean
  lastSyncedAt: Date | null
  createdAt: Date
}

const copySourceSchema = new Schema<ICopySource>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  sourceType: { type: String, required: true },
  sourceUrl: { type: String, default: null },
  allocations: { type: Schema.Types.Mixed, required: true },
  weight: { type: Number, default: 1.0 },
  syncInterval: { type: String, default: '4h' },
  enabled: { type: Boolean, default: true },
  lastSyncedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
})

export const CopySourceModel = model<ICopySource>('CopySource', copySourceSchema)
export type CopySource = ICopySource
export type NewCopySource = Omit<ICopySource, 'weight' | 'syncInterval' | 'enabled' | 'lastSyncedAt' | 'createdAt'> & {
  weight?: number; syncInterval?: string; enabled?: boolean; lastSyncedAt?: Date | null; createdAt?: Date
}
