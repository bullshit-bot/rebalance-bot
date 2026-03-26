import { Schema, model } from 'mongoose'

export interface IAISuggestion {
  _id: string
  source: string
  suggestedAllocations: Record<string, unknown>
  reasoning: string
  sentimentData: Record<string, unknown> | null
  status: string // 'pending' | 'approved' | 'rejected' | 'auto-applied'
  approvedAt: Date | null
  createdAt: Date
}

const aiSuggestionSchema = new Schema<IAISuggestion>({
  _id: { type: String, required: true },
  source: { type: String, required: true, default: 'openclaw' },
  suggestedAllocations: { type: Schema.Types.Mixed, required: true },
  reasoning: { type: String, required: true },
  sentimentData: { type: Schema.Types.Mixed, default: null },
  status: { type: String, required: true },
  approvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
})

export const AISuggestionModel = model<IAISuggestion>('AISuggestion', aiSuggestionSchema)
export type AISuggestion = IAISuggestion
export type NewAISuggestion = Omit<IAISuggestion, 'approvedAt' | 'createdAt'> & {
  approvedAt?: Date | null; createdAt?: Date
}
