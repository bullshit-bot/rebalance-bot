// Presets panel: shows API presets + fallback hardcoded presets
// Applying a preset calls createFromPreset + activates it

import { SectionTitle } from "@/components/ui-brutal"
import { useStrategyPresets, useCreateFromPreset } from "@/hooks/use-strategy-config-queries"
import { toast } from "sonner"

// Fallback presets shown when API is unavailable or loading
const FALLBACK_PRESETS = [
  { name: "Conservative", desc: "Wide threshold, slow rebalance" },
  { name: "Balanced", desc: "Standard configuration" },
  { name: "Aggressive", desc: "Tight threshold, fast rebalance" },
]

interface Props {
  activePreset: string
  onApplyFallback: (name: string) => void
}

export function StrategyPresetsPanel({ activePreset, onApplyFallback }: Props) {
  const { data: apiPresets, isLoading } = useStrategyPresets()
  const createFromPreset = useCreateFromPreset()

  function handleApiPreset(presetName: string) {
    const configName = `${presetName}-${Date.now()}`
    createFromPreset.mutate(
      { presetName, configName },
      {
        onSuccess: () => toast.success(`Applied preset: ${presetName}`),
        onError: (e: any) => toast.error(e.message || "Failed to apply preset"),
      }
    )
  }

  // Use API presets when available, fallback otherwise
  const hasApiPresets = apiPresets && Object.keys(apiPresets).length > 0

  // Show fallback presets while loading or when API has no presets
  const showFallback = !hasApiPresets

  return (
    <div className="brutal-card">
      <SectionTitle>Presets</SectionTitle>
      <div className="space-y-2">
        {hasApiPresets
          ? Object.entries(apiPresets!).map(([name, cfg]: [string, any]) => (
              <button
                key={name}
                onClick={() => handleApiPreset(name)}
                disabled={createFromPreset.isPending}
                className={`w-full text-left p-3 rounded-md border-[2px] border-foreground transition-all duration-75 ${
                  activePreset === name
                    ? "bg-primary/10 brutal-shadow-sm border-primary"
                    : "bg-card hover:bg-secondary"
                }`}
              >
                <div className="font-bold text-sm">{name}</div>
                {cfg.description && (
                  <div className="text-xs text-muted-foreground">{cfg.description}</div>
                )}
                {cfg.strategyType && (
                  <div className="text-xs mt-1 tabular-nums text-muted-foreground">
                    type: {cfg.strategyType}
                  </div>
                )}
              </button>
            ))
          : showFallback && FALLBACK_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => onApplyFallback(p.name)}
                className={`w-full text-left p-3 rounded-md border-[2px] border-foreground transition-all duration-75 ${
                  activePreset === p.name
                    ? "bg-primary/10 brutal-shadow-sm border-primary"
                    : "bg-card hover:bg-secondary"
                }`}
              >
                <div className="font-bold text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </button>
            ))}
      </div>
    </div>
  )
}
