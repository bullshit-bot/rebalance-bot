import { Hono } from 'hono'
import { aiSuggestionHandler } from '@/ai/ai-suggestion-handler'
import { aiConfig } from '@/ai/ai-config'
import { marketSummaryService } from '@/ai/market-summary-service'

const aiRoutes = new Hono()

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/suggestion
 * Receive a new allocation suggestion from OpenClaw.
 * Body: { allocations: [{asset, targetPct}], reasoning: string, sentimentData?: {} }
 */
aiRoutes.post('/ai/suggestion', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const b = body as Record<string, unknown>

  if (!Array.isArray(b['allocations']) || b['allocations'].length === 0) {
    return c.json({ error: 'allocations must be a non-empty array' }, 400)
  }
  if (typeof b['reasoning'] !== 'string' || b['reasoning'].length === 0) {
    return c.json({ error: 'reasoning must be a non-empty string' }, 400)
  }

  try {
    const sentiment = b['sentimentData'] as Record<string, unknown> | undefined
    const input: Parameters<typeof aiSuggestionHandler.handleSuggestion>[0] = {
      allocations: b['allocations'] as { asset: string; targetPct: number }[],
      reasoning: b['reasoning'] as string,
    }
    if (sentiment !== undefined) {
      input.sentimentData = sentiment
    }
    const result = await aiSuggestionHandler.handleSuggestion(input)
    return c.json(result, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 422)
  }
})

/**
 * GET /api/ai/suggestions?status=pending&limit=20
 * List suggestions. Defaults to all suggestions, limit 50.
 */
aiRoutes.get('/ai/suggestions', async (c) => {
  const status = c.req.query('status')
  const limit = parseInt(c.req.query('limit') ?? '50', 10)

  try {
    const rows =
      status === 'pending'
        ? await aiSuggestionHandler.getPending()
        : await aiSuggestionHandler.getAll(limit)
    return c.json(rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/ai/suggestion/:id/approve
 * Approve a pending suggestion and apply its allocations.
 */
aiRoutes.put('/ai/suggestion/:id/approve', async (c) => {
  const id = c.req.param('id')
  try {
    await aiSuggestionHandler.approve(id)
    return c.json({ ok: true, id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 422)
  }
})

/**
 * PUT /api/ai/suggestion/:id/reject
 * Reject a pending suggestion without applying it.
 */
aiRoutes.put('/ai/suggestion/:id/reject', async (c) => {
  const id = c.req.param('id')
  try {
    await aiSuggestionHandler.reject(id)
    return c.json({ ok: true, id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 422)
  }
})

/**
 * PUT /api/ai/config
 * Update mutable AI config fields: autoApprove, maxShiftPct.
 */
aiRoutes.put('/ai/config', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const b = body as Record<string, unknown>

  if (b['autoApprove'] !== undefined) {
    if (typeof b['autoApprove'] !== 'boolean') {
      return c.json({ error: 'autoApprove must be a boolean' }, 400)
    }
    ;(aiConfig as { autoApprove: boolean }).autoApprove = b['autoApprove']
  }

  if (b['maxShiftPct'] !== undefined) {
    const v = Number(b['maxShiftPct'])
    if (!Number.isFinite(v) || v <= 0) {
      return c.json({ error: 'maxShiftPct must be a positive number' }, 400)
    }
    ;(aiConfig as { maxAllocationShiftPct: number }).maxAllocationShiftPct = v
  }

  return c.json({
    autoApprove: aiConfig.autoApprove,
    maxAllocationShiftPct: aiConfig.maxAllocationShiftPct,
    enabled: aiConfig.enabled,
  })
})

/**
 * GET /api/ai/summary
 * Generate and return the latest market summary.
 */
aiRoutes.get('/ai/summary', async (c) => {
  try {
    const summary = await marketSummaryService.generateSummary()
    return c.json({ summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { aiRoutes }
