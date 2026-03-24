import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { portfolioSourceFetcher } from './portfolio-source-fetcher'

// Store original fetch
const originalFetch = globalThis.fetch

describe('PortfolioSourceFetcher', () => {
  describe('fetch', () => {
    afterEach(() => {
      // Restore original fetch after each test
      globalThis.fetch = originalFetch
    })

    it('should reject HTTP URLs', async () => {
      await expect(portfolioSourceFetcher.fetch('http://example.com/portfolio.json')).rejects.toThrow('Only HTTPS URLs are allowed')
    })

    it('should reject localhost', async () => {
      await expect(portfolioSourceFetcher.fetch('https://localhost:8080/portfolio.json')).rejects.toThrow()
    })

    it('should reject 127.0.0.1', async () => {
      await expect(portfolioSourceFetcher.fetch('https://127.0.0.1:8080/portfolio.json')).rejects.toThrow()
    })

    it('should reject private IP 10.x.x.x', async () => {
      await expect(portfolioSourceFetcher.fetch('https://10.0.0.1/portfolio.json')).rejects.toThrow()
    })

    it('should reject private IP 192.168.x.x', async () => {
      await expect(portfolioSourceFetcher.fetch('https://192.168.1.1/portfolio.json')).rejects.toThrow()
    })

    it('should reject private IP 172.16-31.x.x', async () => {
      await expect(portfolioSourceFetcher.fetch('https://172.16.0.1/portfolio.json')).rejects.toThrow()
    })

    it('should reject 0.0.0.0', async () => {
      await expect(portfolioSourceFetcher.fetch('https://0.0.0.0/portfolio.json')).rejects.toThrow()
    })

    it('should reject invalid URL format', async () => {
      await expect(portfolioSourceFetcher.fetch('not-a-url')).rejects.toThrow('Invalid URL')
    })

    it('should reject 172.17.x.x (private IP)', async () => {
      await expect(portfolioSourceFetcher.fetch('https://172.17.0.1/portfolio.json')).rejects.toThrow()
    })

    it('should reject 172.31.x.x (private IP)', async () => {
      await expect(portfolioSourceFetcher.fetch('https://172.31.255.1/portfolio.json')).rejects.toThrow()
    })

    it('should reject 0.x.x.x range', async () => {
      await expect(portfolioSourceFetcher.fetch('https://0.1.1.1/portfolio.json')).rejects.toThrow()
    })

    it('should parse bare array response', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ]), { status: 200 })

      const result = await portfolioSourceFetcher.fetch('https://example.com/data.json')
      expect(result.length).toBe(2)
      expect(result[0].asset).toBe('BTC')
    })

    it('should parse wrapped response with allocations key', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({
          allocations: [
            { asset: 'BTC', targetPct: 60 },
            { asset: 'ETH', targetPct: 40 },
          ],
        }), { status: 200 })

      const result = await portfolioSourceFetcher.fetch('https://example.com/data.json')
      expect(result.length).toBe(2)
      expect(result[0].asset).toBe('BTC')
      expect(result[0].targetPct).toBe(60)
    })

    it('should validate allocations sum to ~100%', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          { asset: 'BTC', targetPct: 50.5 },
          { asset: 'ETH', targetPct: 49.5 },
        ]), { status: 200 })

      const result = await portfolioSourceFetcher.fetch('https://example.com/data.json')
      expect(result.length).toBe(2)
    })

    it('should reject allocations not summing to ~100%', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 30 },
        ]), { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('expected ~100%')
    })

    it('should trim and uppercase asset names', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          { asset: '  btc  ', targetPct: 50 },
          { asset: 'eth', targetPct: 50 },
        ]), { status: 200 })

      const result = await portfolioSourceFetcher.fetch('https://example.com/data.json')
      expect(result[0].asset).toBe('BTC')
      expect(result[1].asset).toBe('ETH')
    })

    it('should reject empty allocations array', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([]), { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('empty')
    })

    it('should reject non-object items', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          'not an object',
        ]), { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('not an object')
    })

    it('should reject missing asset field', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          { targetPct: 50 },
        ]), { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('asset')
    })

    it('should reject invalid targetPct', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          { asset: 'BTC', targetPct: 'invalid' },
        ]), { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('targetPct')
    })

    it('should reject negative targetPct', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          { asset: 'BTC', targetPct: -10 },
        ]), { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('targetPct')
    })

    it('should reject HTTP error responses', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({}), { status: 404 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('HTTP 404')
    })

    it('should reject invalid JSON response', async () => {
      globalThis.fetch = async () =>
        new Response('not valid json', { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('valid JSON')
    })

    it('should reject unexpected response shape', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ foo: 'bar' }), { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('Unexpected response shape')
    })

    it('should handle fetch network errors', async () => {
      globalThis.fetch = async () => {
        throw new Error('Network error')
      }

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('Failed to fetch')
    })

    it('should handle fetch abort errors', async () => {
      globalThis.fetch = async () => {
        throw new Error('AbortError')
      }

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('Failed to fetch')
    })

    it('should reject empty asset string', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify([
          { asset: '   ', targetPct: 50 },
        ]), { status: 200 })

      await expect(portfolioSourceFetcher.fetch('https://example.com/data.json')).rejects.toThrow('asset')
    })
  })
})
