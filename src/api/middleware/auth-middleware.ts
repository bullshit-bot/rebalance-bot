import type { Context, Next } from 'hono'
import { env } from '@config/app-config'

/**
 * API key authentication middleware.
 * Validates the X-API-Key header against the configured API_KEY env var.
 * Returns 401 for missing or invalid keys.
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const apiKey = c.req.header('X-API-Key')

  if (!apiKey || apiKey !== env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}
