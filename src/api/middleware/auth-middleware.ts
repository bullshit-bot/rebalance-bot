import { timingSafeEqual } from 'node:crypto'
import type { Context, Next } from 'hono'
import { env } from '@config/app-config'

/**
 * API key authentication middleware.
 * Validates the X-API-Key header against the configured API_KEY env var.
 * Uses timingSafeEqual to prevent timing-based side-channel attacks.
 * Returns 401 for missing or invalid keys.
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const apiKey = c.req.header('X-API-Key')

  if (!apiKey || !isApiKeyValid(apiKey)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}

/**
 * Compares the provided key against the configured API_KEY using a constant-time
 * comparison to prevent timing attacks. Returns false if lengths differ or keys mismatch.
 */
function isApiKeyValid(provided: string): boolean {
  try {
    const expected = Buffer.from(env.API_KEY, 'utf8')
    const actual = Buffer.from(provided, 'utf8')
    // timingSafeEqual throws if buffer lengths differ — treat that as mismatch
    if (expected.length !== actual.length) return false
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
