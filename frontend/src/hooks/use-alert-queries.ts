import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface DerivedAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  time: string
  dismissed: boolean
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async (): Promise<DerivedAlert[]> => {
      const alerts: DerivedAlert[] = []
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

      try {
        const health = await api.getHealth()
        for (const [name, status] of Object.entries(health.exchanges)) {
          if (status === 'disconnected') {
            alerts.push({
              id: `ex-${name}`,
              severity: 'critical',
              title: `${name} Disconnected`,
              message: `Exchange ${name} is not connected. Check API credentials.`,
              time: now,
              dismissed: false,
            })
          }
        }
      } catch {
        // health check failed — skip exchange alerts
      }

      try {
        const portfolio = await api.getPortfolio()
        for (const asset of portfolio.assets) {
          if (Math.abs(asset.driftPct) > 3) {
            alerts.push({
              id: `drift-${asset.asset}`,
              severity: 'warning',
              title: `${asset.asset} Drift ${asset.driftPct.toFixed(1)}%`,
              message: `${asset.asset} allocation drifted ${asset.driftPct > 0 ? 'above' : 'below'} target by ${Math.abs(asset.driftPct).toFixed(1)}%.`,
              time: now,
              dismissed: false,
            })
          }
        }
      } catch {
        // portfolio check failed — skip drift alerts
      }

      return alerts
    },
    refetchInterval: 60_000,
  })
}
