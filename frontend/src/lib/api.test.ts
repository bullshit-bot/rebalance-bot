import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getApiKey, setApiKey, clearApiKey, api } from '@/lib/api'

// Mock fetch globally
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock window.location.href
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
})

describe('api.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Storage Tests ──────────────────────────────────────────────────────────

  describe('getApiKey', () => {
    it('returns empty string when key not in localStorage', () => {
      const result = getApiKey()
      expect(result).toBe('')
    })

    it('returns stored api key', () => {
      localStorage.setItem('apiKey', 'test-key-123')
      const result = getApiKey()
      expect(result).toBe('test-key-123')
    })
  })

  describe('setApiKey', () => {
    it('stores api key in localStorage', () => {
      setApiKey('my-secret-key')
      const stored = localStorage.getItem('apiKey')
      expect(stored).toBe('my-secret-key')
    })
  })

  describe('clearApiKey', () => {
    it('removes api key from localStorage', () => {
      localStorage.setItem('apiKey', 'some-key')
      clearApiKey()
      const stored = localStorage.getItem('apiKey')
      expect(stored).toBeNull()
    })
  })

  // ─── API Fetch Tests ──────────────────────────────────────────────────────────

  describe('apiFetch', () => {
    beforeEach(() => {
      setApiKey('test-api-key')
    })

    it('includes Content-Type header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response)

      await api.getPortfolio()

      const call = vi.mocked(fetch).mock.calls[0]
      expect(call[1]?.headers).toHaveProperty('Content-Type', 'application/json')
    })

    it('includes X-API-Key header from localStorage', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response)

      await api.getPortfolio()

      const call = vi.mocked(fetch).mock.calls[0]
      expect(call[1]?.headers).toHaveProperty('X-API-Key', 'test-api-key')
    })

    it('returns parsed JSON on success', async () => {
      const mockData = { totalValueUsd: 100000, assets: [] }
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await api.getPortfolio()
      expect(result).toEqual(mockData)
    })

    it('clears api key and redirects on 401', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
        ok: false,
        text: async () => 'Unauthorized',
      } as Response)

      try {
        await api.getPortfolio()
        expect.fail('should throw')
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
      }

      expect(getApiKey()).toBe('')
      expect(window.location.href).toBe('/login')
    })

    it('throws error on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
        ok: false,
        text: async () => 'Internal Server Error',
      } as Response)

      await expect(api.getPortfolio()).rejects.toThrow('Internal Server Error')
    })
  })

  // ─── Query String Builder Tests ──────────────────────────────────────────────

  describe('qs() query string builder', () => {
    it('omits undefined values in getPortfolioHistory', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => [],
      } as Response)

      await api.getPortfolioHistory(undefined, undefined)

      const call = vi.mocked(fetch).mock.calls[0]
      const url = call[0] as string
      expect(url).toBe('http://localhost:3001/api/portfolio/history')
    })

    it('encodes query params in getPortfolioHistory', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => [],
      } as Response)

      await api.getPortfolioHistory(1000, 2000)

      const call = vi.mocked(fetch).mock.calls[0]
      const url = call[0] as string
      expect(url).toContain('?from=1000&to=2000')
    })

    it('handles empty string values in getTrades', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => [],
      } as Response)

      await api.getTrades(undefined, '')

      const call = vi.mocked(fetch).mock.calls[0]
      const url = call[0] as string
      expect(url).toBe('http://localhost:3001/api/trades')
    })

    it('includes limit and rebalanceId in getTrades', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => [],
      } as Response)

      await api.getTrades(50, 'reb-123')

      const call = vi.mocked(fetch).mock.calls[0]
      const url = call[0] as string
      expect(url).toContain('limit=50')
      expect(url).toContain('rebalanceId=reb-123')
    })
  })

  // ─── Representative API Methods Tests ────────────────────────────────────────

  describe('getPortfolio', () => {
    it('fetches portfolio data', async () => {
      const mockData = { totalValueUsd: 100000, assets: [], updatedAt: Date.now() }
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await api.getPortfolio()
      expect(result).toEqual(mockData)
    })

    it('uses correct endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ totalValueUsd: 0, assets: [] }),
      } as Response)

      await api.getPortfolio()

      const call = vi.mocked(fetch).mock.calls[0]
      expect(call[0]).toContain('/portfolio')
    })
  })

  describe('getTrades', () => {
    it('fetches trades with limit', async () => {
      const mockData = [
        { id: 1, exchange: 'binance', pair: 'BTC/USDT', side: 'buy', amount: 0.1, price: 40000, costUsd: 4000, executedAt: Date.now(), fee: null, feeCurrency: null, orderId: null, rebalanceId: null },
      ]
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await api.getTrades(50)
      expect(result).toEqual(mockData)
    })
  })

  describe('triggerRebalance', () => {
    it('sends POST request to rebalance endpoint', async () => {
      const mockData = { id: 'reb-123', trigger: 'threshold', status: 'executing', createdAt: Date.now() }
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await api.triggerRebalance()
      expect(result).toEqual(mockData)

      const call = vi.mocked(fetch).mock.calls[0]
      expect(call[1]?.method).toBe('POST')
    })
  })

  describe('getHealth', () => {
    it('fetches health status', async () => {
      const mockData = { status: 'ok', uptimeSeconds: 3600, exchanges: { binance: 'connected', okx: 'connected' } }
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await api.getHealth()
      expect(result).toEqual(mockData)
    })
  })

  // ─── Content-Type Body Tests ────────────────────────────────────────────────

  describe('API methods with JSON body', () => {
    it('updateAllocations sends JSON body', async () => {
      const mockData = [{ id: 1, asset: 'BTC', targetPct: 50, exchange: null, minTradeUsd: null, updatedAt: Date.now() }]
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData,
      } as Response)

      const input = [{ asset: 'BTC', targetPct: 50 }]
      await api.updateAllocations(input)

      const call = vi.mocked(fetch).mock.calls[0]
      expect(call[1]?.method).toBe('PUT')
      expect(call[1]?.body).toBe(JSON.stringify(input))
    })

    it('runBacktest sends POST with config', async () => {
      const mockResult = { id: 'bt-123', createdAt: Date.now(), config: {} as any, metrics: {}, trades: [], benchmark: {} }
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockResult,
      } as Response)

      const config = {
        pairs: ['BTC/USDT'],
        allocations: [],
        startDate: 1000,
        endDate: 2000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.1,
        timeframe: '1d' as const,
        exchange: 'binance',
      }

      await api.runBacktest(config)

      const call = vi.mocked(fetch).mock.calls[0]
      expect(call[1]?.method).toBe('POST')
      expect(call[1]?.body).toBe(JSON.stringify(config))
    })
  })

  // ─── Export URL Tests (No Fetch) ──────────────────────────────────────

  describe('exportTaxCsvUrl', () => {
    it('builds correct export URL without query params', () => {
      const url = api.exportTaxCsvUrl()
      expect(url).toBe('http://localhost:3001/api/tax/export')
    })

    it('builds correct export URL with year param', () => {
      const url = api.exportTaxCsvUrl(2024)
      expect(url).toBe('http://localhost:3001/api/tax/export?year=2024')
    })
  })

  // ─── All API Methods Coverage ──────────────────────────────────────────────
  // Each test calls the actual method to ensure function coverage

  describe('all api methods', () => {
    const ok = (data: unknown = {}) =>
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200, ok: true, json: async () => data,
      } as Response)

    beforeEach(() => setApiKey('k'))

    // Portfolio
    it('getPortfolioHistory', async () => { ok([]); await api.getPortfolioHistory(1, 2) })

    // Rebalance
    it('triggerRebalance', async () => { ok({}); await api.triggerRebalance() })
    it('getRebalancePreview', async () => { ok({}); await api.getRebalancePreview() })
    it('getRebalanceHistory', async () => { ok([]); await api.getRebalanceHistory(10) })

    // Allocations
    it('getAllocations', async () => { ok([]); await api.getAllocations() })
    it('updateAllocations', async () => { ok([]); await api.updateAllocations([]) })
    it('deleteAllocation', async () => { ok({}); await api.deleteAllocation('BTC') })

    // Trades
    it('getTrades', async () => { ok([]); await api.getTrades(50, 'r1') })

    // Health
    it('getHealth', async () => { ok({}); await api.getHealth() })

    // Backtest
    it('runBacktest', async () => { ok({}); await api.runBacktest({ pairs: [], allocations: [], startDate: 0, endDate: 0, initialBalance: 0, threshold: 0, feePct: 0, timeframe: '1d', exchange: 'binance' }) })
    it('getBacktestResult', async () => { ok({}); await api.getBacktestResult('bt1') })
    it('listBacktests', async () => { ok([]); await api.listBacktests() })

    // Analytics
    it('getEquityCurve', async () => { ok({}); await api.getEquityCurve(1, 2) })
    it('getPnL', async () => { ok({}); await api.getPnL() })
    it('getDrawdown', async () => { ok({}); await api.getDrawdown() })
    it('getFees', async () => { ok({}); await api.getFees() })

    // Tax
    it('getTaxReport', async () => { ok({}); await api.getTaxReport(2026) })
    it('exportTaxCsvUrl', () => { expect(api.exportTaxCsvUrl(2026)).toContain('year=2026') })

    // Smart Orders
    it('createSmartOrder', async () => { ok({}); await api.createSmartOrder({ type: 'twap', exchange: 'binance', pair: 'BTC/USDT', side: 'buy', totalAmount: 1, durationMs: 3600000, slices: 4 }) })
    it('getSmartOrder', async () => { ok({}); await api.getSmartOrder('so1') })
    it('getActiveSmartOrders', async () => { ok([]); await api.getActiveSmartOrders() })
    it('pauseSmartOrder', async () => { ok({}); await api.pauseSmartOrder('so1') })
    it('resumeSmartOrder', async () => { ok({}); await api.resumeSmartOrder('so1') })
    it('cancelSmartOrder', async () => { ok({}); await api.cancelSmartOrder('so1') })

    // Grid
    it('createGridBot', async () => { ok({}); await api.createGridBot({ exchange: 'binance', pair: 'BTC/USDT', priceLower: 60000, priceUpper: 70000, gridLevels: 10, investment: 1000 }) })
    it('getGridBot', async () => { ok({}); await api.getGridBot('gb1') })
    it('listGridBots', async () => { ok([]); await api.listGridBots() })
    it('stopGridBot', async () => { ok({}); await api.stopGridBot('gb1') })

    // Copy Trading
    it('addCopySource', async () => { ok({}); await api.addCopySource({ name: 'x', sourceType: 'url' }) })
    it('getCopySources', async () => { ok([]); await api.getCopySources() })
    it('updateCopySource', async () => { ok({}); await api.updateCopySource('cs1', {}) })
    it('deleteCopySource', async () => { ok({}); await api.deleteCopySource('cs1') })
    it('syncCopy', async () => { ok({}); await api.syncCopy('cs1') })
    it('getCopyHistory', async () => { ok([]); await api.getCopyHistory('cs1', 20) })

    // AI
    it('getAISuggestions', async () => { ok([]); await api.getAISuggestions('pending', 50) })
    it('approveSuggestion', async () => { ok({}); await api.approveSuggestion('ai1') })
    it('rejectSuggestion', async () => { ok({}); await api.rejectSuggestion('ai1') })
    it('updateAIConfig', async () => { ok({}); await api.updateAIConfig({ autoApprove: true }) })
    it('getMarketSummary', async () => { ok({}); await api.getMarketSummary() })
  })

  // ─── Error Cases ────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('handles network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(api.getPortfolio()).rejects.toThrow('Network error')
    })

    it('handles JSON parse error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      } as Response)

      await expect(api.getPortfolio()).rejects.toThrow('Invalid JSON')
    })
  })
})
