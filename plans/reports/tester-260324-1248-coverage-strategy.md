# Coverage Enhancement Strategy - 95%+ Target

## Status: IN PROGRESS

### Target Files & Current Coverage

| File | Current | Target | Strategy |
|------|---------|--------|----------|
| order-executor.ts | 8% | 95% | Mock exchange errors, test retry loop, waitForFill timeout |
| exchange-manager.ts | 18% | 95% | Test init(), shutdown(), private buildExchangeConfigs |
| drawdown-analyzer.ts | 28% | 95% | Seed snapshots, test analyze() with real data |
| portfolio-tracker.ts | 28% | 95% | Test startWatching, stopWatching, recalculate, watchBalance |
| grid-executor.ts | 44% | 95% | Test placeGrid, startMonitoring, pollFills, cancelAll |
| historical-data-loader.ts | 48% | 95% | Test loadCandles, getCachedCandles with real DB |
| drift-detector.ts | 57% | 95% | Read source, identify uncovered branches |
| dca-service.ts | 57% | 95% | Test start/stop, onPortfolioUpdate, calculateDCAAllocation |
| server.ts | 59% | 95% | Test route mounting, CORS, rate limiter, error handlers |
| backtest-simulator.ts | 60% | 95% | Test run() with seeded OHLCV candles |
| cron-scheduler.ts | 61% | 95% | Test start/stop, getStatus, job scheduling |

### Key Insight: Real Code Execution
- Import REAL modules (not mocks)
- Call REAL methods with edge cases
- Mock only at lowest level (global fetch, error paths)
- Tests MUST exercise source code lines to count toward coverage

### Approach per File
1. Read source to identify all exported methods/branches
2. Read existing test to see what's covered
3. Identify gap areas (uncovered line numbers)
4. ADD tests to existing .integration.test.ts file
5. Use try/catch for expected errors; set { timeout: 15000 } for retry tests
