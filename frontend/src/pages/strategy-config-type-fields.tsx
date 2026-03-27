// Per-strategy-type parameter fields component
// Shows/hides fields based on selected strategy type

export type StrategyType =
  | 'threshold'
  | 'equal-weight'
  | 'momentum-tilt'
  | 'vol-adjusted'
  | 'mean-reversion'
  | 'momentum-weighted'

export const STRATEGY_TYPES: StrategyType[] = [
  'threshold',
  'equal-weight',
  'momentum-tilt',
  'vol-adjusted',
  'mean-reversion',
  'momentum-weighted',
]

interface FieldDef {
  key: string
  label: string
  step?: number
  defaultValue: number
}

// Field definitions per strategy type
const TYPE_FIELDS: Record<StrategyType, FieldDef[]> = {
  'threshold': [
    { key: 'thresholdPct', label: 'Threshold %', step: 0.1, defaultValue: 5 },
    { key: 'minTradeUsd', label: 'Min Trade (USD)', defaultValue: 15 },
  ],
  'equal-weight': [
    { key: 'thresholdPct', label: 'Threshold %', step: 0.1, defaultValue: 5 },
    { key: 'minTradeUsd', label: 'Min Trade (USD)', defaultValue: 15 },
  ],
  'momentum-tilt': [
    { key: 'thresholdPct', label: 'Threshold %', step: 0.1, defaultValue: 5 },
    { key: 'minTradeUsd', label: 'Min Trade (USD)', defaultValue: 15 },
    { key: 'momentumWindowDays', label: 'Momentum Window (days)', defaultValue: 14 },
    { key: 'momentumWeight', label: 'Momentum Weight', step: 0.05, defaultValue: 0.3 },
  ],
  'vol-adjusted': [
    { key: 'baseThresholdPct', label: 'Base Threshold %', step: 0.1, defaultValue: 5 },
    { key: 'minTradeUsd', label: 'Min Trade (USD)', defaultValue: 15 },
    { key: 'volLookbackDays', label: 'Vol Lookback (days)', defaultValue: 30 },
    { key: 'minThresholdPct', label: 'Min Threshold %', step: 0.1, defaultValue: 1 },
    { key: 'maxThresholdPct', label: 'Max Threshold %', step: 0.1, defaultValue: 15 },
  ],
  'mean-reversion': [
    { key: 'lookbackDays', label: 'Lookback (days)', defaultValue: 30 },
    { key: 'bandWidthSigma', label: 'Band Width (sigma)', step: 0.1, defaultValue: 1.5 },
    { key: 'minDriftPct', label: 'Min Drift %', step: 0.1, defaultValue: 2 },
    { key: 'minTradeUsd', label: 'Min Trade (USD)', defaultValue: 15 },
  ],
  'momentum-weighted': [
    { key: 'rsiPeriod', label: 'RSI Period', defaultValue: 14 },
    { key: 'macdFast', label: 'MACD Fast', defaultValue: 12 },
    { key: 'macdSlow', label: 'MACD Slow', defaultValue: 26 },
    { key: 'weightFactor', label: 'Weight Factor', step: 0.05, defaultValue: 0.5 },
    { key: 'minTradeUsd', label: 'Min Trade (USD)', defaultValue: 15 },
  ],
}

export function getDefaultParams(type: StrategyType): Record<string, number> {
  return Object.fromEntries(
    TYPE_FIELDS[type].map((f) => [f.key, f.defaultValue])
  )
}

interface Props {
  strategyType: StrategyType
  params: Record<string, number>
  onChange: (key: string, value: number) => void
}

export function StrategyTypeFields({ strategyType, params, onChange }: Props) {
  const fields = TYPE_FIELDS[strategyType]
  return (
    <>
      {fields.map((f) => (
        <div key={f.key}>
          <label className="stat-label mb-1 block">{f.label}</label>
          <input
            className="brutal-input w-full text-sm"
            type="number"
            step={f.step ?? 1}
            value={params[f.key] ?? f.defaultValue}
            onChange={(e) => onChange(f.key, Number(e.target.value))}
          />
        </div>
      ))}
    </>
  )
}
