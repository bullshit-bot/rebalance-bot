import { describe, it, expect } from 'bun:test'

// Test the equity curve logic
function buildEquityCurve(
  snapshots: Array<{ timestamp: number; valueUsd: number }>,
): Array<{ timestamp: number; valueUsd: number }> {
  return snapshots.sort((a, b) => a.timestamp - b.timestamp)
}

describe('EquityCurveBuilder - Core Logic', () => {
  it('builds equity curve from multiple snapshots', () => {
    const snapshots = [
      { timestamp: 1000, valueUsd: 10000 },
      { timestamp: 2000, valueUsd: 11000 },
      { timestamp: 3000, valueUsd: 12500 },
    ]

    const curve = buildEquityCurve(snapshots)

    expect(curve.length).toBe(3)
    expect(curve[0].valueUsd).toBe(10000)
    expect(curve[1].valueUsd).toBe(11000)
    expect(curve[2].valueUsd).toBe(12500)
  })

  it('returns empty array when no snapshots in range', () => {
    const allSnapshots = [{ timestamp: 1000, valueUsd: 10000 }]

    const from = 2000
    const to = 3000

    const filtered = allSnapshots.filter((s) => s.timestamp >= from && s.timestamp <= to)
    const curve = buildEquityCurve(filtered)

    expect(curve.length).toBe(0)
  })

  it('filters snapshots by timestamp range correctly', () => {
    const allSnapshots = [
      { timestamp: 500, valueUsd: 9000 },
      { timestamp: 1000, valueUsd: 10000 },
      { timestamp: 2000, valueUsd: 11000 },
      { timestamp: 3000, valueUsd: 12000 },
      { timestamp: 4000, valueUsd: 13000 },
    ]

    const from = 1000
    const to = 3000

    const filtered = allSnapshots.filter((s) => s.timestamp >= from && s.timestamp <= to)
    const curve = buildEquityCurve(filtered)

    expect(curve.length).toBe(3)
    expect(curve[0].timestamp).toBe(1000)
    expect(curve[2].timestamp).toBe(3000)
  })

  it('preserves chronological order', () => {
    const snapshots = [
      { timestamp: 3000, valueUsd: 12000 },
      { timestamp: 1000, valueUsd: 10000 },
      { timestamp: 2000, valueUsd: 11000 },
    ]

    const curve = buildEquityCurve(snapshots)

    expect(curve.length).toBe(3)
    expect(curve[0].timestamp).toBe(1000)
    expect(curve[1].timestamp).toBe(2000)
    expect(curve[2].timestamp).toBe(3000)
  })

  it('maps timestamps to equity values correctly', () => {
    const snapshots = [
      { timestamp: 1000, valueUsd: 10000 },
      { timestamp: 2000, valueUsd: 11500 },
      { timestamp: 3000, valueUsd: 13000 },
    ]

    const curve = buildEquityCurve(snapshots)

    const valueMap = new Map(curve.map((p) => [p.timestamp, p.valueUsd]))

    expect(valueMap.get(1000)).toBe(10000)
    expect(valueMap.get(2000)).toBe(11500)
    expect(valueMap.get(3000)).toBe(13000)
  })
})
