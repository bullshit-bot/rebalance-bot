// Strategy type definitions — shared across StrategyConfigPage and backtest components

export type StrategyType =
  | 'threshold'
  | 'equal-weight'
  | 'momentum-tilt'
  | 'vol-adjusted'
  | 'mean-reversion'
  | 'momentum-weighted'
