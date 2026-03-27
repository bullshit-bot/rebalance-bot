import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Derive log entries from trades — each trade is treated as an execution log entry
export function useLogs() {
  return useQuery({
    queryKey: ['logs'],
    queryFn: async () => {
      const trades = await api.getTrades(50)
      return trades.map((t) => ({
        id: `T-${t._id}`,
        time: new Date(t.executedAt)
          .toISOString()
          .replace('T', ' ')
          .slice(0, 19),
        level: 'execution' as const,
        message: `${t.side.toUpperCase()} ${t.pair} — qty ${t.amount} @ $${t.price.toLocaleString()}${
          t.fee ? ` (fee: $${t.fee.toFixed(2)})` : ''
        }`,
        details: JSON.stringify({
          exchange: t.exchange,
          orderId: t.orderId,
          isPaper: t.isPaper,
        }),
      }))
    },
    refetchInterval: 30_000,
  })
}
