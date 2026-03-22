/**
 * Fetches and validates portfolio allocation data from a remote URL source.
 * Expects JSON shaped as { allocations: [{ asset, targetPct }] } or a bare array.
 * Validates that targetPct values sum to ~100% (±2%) and assets are non-empty strings.
 */

const FETCH_TIMEOUT_MS = 10_000

export interface SourceAllocation {
  asset: string
  targetPct: number
}

// Shape variants the remote source might return
interface WrappedResponse {
  allocations: unknown[]
}

function isWrapped(data: unknown): data is WrappedResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'allocations' in data &&
    Array.isArray((data as WrappedResponse).allocations)
  )
}

function parseAllocations(raw: unknown[]): SourceAllocation[] {
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item at index ${i} is not an object`)
    }
    const obj = item as Record<string, unknown>
    if (typeof obj['asset'] !== 'string' || obj['asset'].trim() === '') {
      throw new Error(`Item at index ${i} missing valid "asset" string`)
    }
    const pct = Number(obj['targetPct'])
    if (!Number.isFinite(pct) || pct < 0) {
      throw new Error(`Item at index ${i} has invalid "targetPct": ${obj['targetPct']}`)
    }
    return { asset: obj['asset'].trim().toUpperCase(), targetPct: pct }
  })
}

function validateSum(allocations: SourceAllocation[]): void {
  const total = allocations.reduce((sum, a) => sum + a.targetPct, 0)
  if (Math.abs(total - 100) > 2) {
    throw new Error(`Allocation percentages sum to ${total.toFixed(2)}%, expected ~100%`)
  }
}

class PortfolioSourceFetcher {
  /**
   * Fetches allocation data from a URL source.
   * Returns validated list of { asset, targetPct }.
   * Throws on network error, timeout, or validation failure.
   */
  async fetch(url: string): Promise<SourceAllocation[]> {
    let response: Response
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        response = await fetch(url, { signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Failed to fetch source URL "${url}": ${msg}`)
    }

    if (!response.ok) {
      throw new Error(`Source URL returned HTTP ${response.status} for "${url}"`)
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new Error(`Source URL "${url}" did not return valid JSON`)
    }

    // Accept { allocations: [...] } or a bare array
    const rawArray: unknown[] = isWrapped(data)
      ? data.allocations
      : Array.isArray(data)
        ? data
        : (() => { throw new Error(`Unexpected response shape from "${url}"`) })()

    if (rawArray.length === 0) {
      throw new Error(`Source "${url}" returned empty allocations array`)
    }

    const allocations = parseAllocations(rawArray)
    validateSum(allocations)

    return allocations
  }
}

export const portfolioSourceFetcher = new PortfolioSourceFetcher()
