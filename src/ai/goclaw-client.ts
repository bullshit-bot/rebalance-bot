import { env } from '@config/app-config'

// ─── GoClaw Client ───────────────────────────────────────────────────────────

/**
 * HTTP client for GoClaw AI agent API.
 * Uses OpenAI-compatible /v1/chat/completions endpoint.
 * GoClaw handles Telegram delivery — backend just sends prompts.
 */
class GoClawClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly enabled: boolean

  constructor() {
    this.baseUrl = env.GOCLAW_URL ?? 'http://goclaw:18790'
    this.token = env.GOCLAW_GATEWAY_TOKEN ?? ''
    this.enabled = !!this.token
  }

  /**
   * Send a prompt to GoClaw and get AI response.
   * GoClaw uses its MCP tools and skills to analyze, then responds.
   * Returns null if GoClaw is unavailable or disabled.
   */
  async chat(prompt: string, maxTokens = 1000): Promise<string | null> {
    if (!this.enabled) {
      console.warn('[GoClawClient] Disabled — GOCLAW_GATEWAY_TOKEN not set')
      return null
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-GoClaw-User-Id': 'scheduler-bot',
        },
        body: JSON.stringify({
          model: 'goclaw:fox-spirit',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(60_000), // 60s timeout — GoClaw may call MCP tools
      })

      if (!response.ok) {
        console.error(`[GoClawClient] HTTP ${response.status}: ${await response.text()}`)
        return null
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>
      }

      return data.choices?.[0]?.message?.content ?? null
    } catch (err) {
      console.error('[GoClawClient] Request failed:', err instanceof Error ? err.message : err)
      return null
    }
  }

  /** Check if GoClaw is reachable */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return false
    try {
      const res = await fetch(`${this.baseUrl}/v1/agents`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
        signal: AbortSignal.timeout(5_000),
      })
      return res.ok
    } catch {
      return false
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const goClawClient = new GoClawClient()
