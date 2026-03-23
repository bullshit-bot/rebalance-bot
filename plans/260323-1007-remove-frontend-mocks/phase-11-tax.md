---
phase: 11
title: Tax Page
status: pending
priority: medium
depends_on: [1]
---

# Phase 11: Tax Page

## Context

TaxPage imports `TAX_EVENTS` mock.

Backend endpoints:
- `GET /api/tax/report?year=2026` — FIFO-based tax report
- `GET /api/tax/export?year=2026` — CSV download (Koinly-compatible)

## Related Code Files

**Modify:** `frontend/src/pages/TaxPage.tsx`
**Create:** `frontend/src/hooks/use-tax-queries.ts`

## Implementation Steps

1. Create `use-tax-queries.ts`: `useTaxReport(year)`
2. Replace TAX_EVENTS with hook call
3. Add year selector
4. Wire CSV export button to `api.exportTaxCsv(year)` download URL
5. Add loading/error states

## Todo List

- [ ] Create `use-tax-queries.ts`
- [ ] Migrate TaxPage to real data
- [ ] Wire CSV export download
- [ ] Add loading/error states

## Success Criteria

- [ ] Tax report shows real FIFO-calculated events
- [ ] CSV export downloads real data
- [ ] Zero imports from mockData.ts
