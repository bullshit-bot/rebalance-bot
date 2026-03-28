---
status: pending
priority: P2
effort: 2h
depends_on: [phase-01]
---

## Context Links

- [Strategy Config Page](../../frontend/src/pages/StrategyConfigPage.tsx)
- [Strategy config types](../../src/rebalancer/strategies/strategy-config-types.ts)

## Overview

Add UI controls for cash reserve and DCA rebalance settings on the Strategy Config page. Show cash reserve status on Overview page.

## Requirements

**Functional:**
- Cash reserve % slider (0-50%, step 1)
- DCA rebalance enabled toggle
- Hard rebalance threshold input (5-50%, step 1)
- Cash reserve status indicator on Overview (current cash vs target)
- Updated presets selectable from UI

**Non-functional:**
- Controls disabled/hidden when not applicable
- Responsive layout consistent with existing config page

## Related Code Files

**Modify:**
- `frontend/src/pages/StrategyConfigPage.tsx` — Add new controls to global settings section

**Investigate (read before implementation):**
- Frontend component library used (check existing UI patterns)
- Overview page file path for cash status widget

## Implementation Steps

### Step 1: Add controls to StrategyConfigPage

In the Global Settings section of StrategyConfigPage.tsx, add:

1. **Cash Reserve slider:**
   - Label: "Cash Reserve %"
   - Range: 0-50, default 0
   - Helper text: "Percentage of portfolio held in stablecoins (USDT/USDC/BUSD)"

2. **DCA Rebalance toggle:**
   - Label: "DCA-Based Rebalancing"
   - Default: OFF
   - Helper text: "Route DCA deposits to most underweight asset instead of proportional allocation"

3. **Hard Rebalance Threshold:**
   - Label: "Hard Rebalance Threshold %"
   - Range: 5-50, default 15
   - Only visible when DCA Rebalance is ON
   - Helper text: "Traditional sell+buy rebalance only triggers above this drift %"

### Step 2: Wire form state to API

- Add fields to form state matching GlobalSettingsSchema
- Submit via existing strategy config API endpoint
- Validate ranges client-side (match Zod schema constraints)

### Step 3: Add cash reserve status to Overview page

Find Overview page component. Add a card/section showing:
- "Cash Reserve: $X / $Y (Z%)" where X=current stablecoin value, Y=target, Z=current%
- Green if within 2% of target, yellow if deviating, red if >5% off
- Only shown when cashReservePct > 0

### Step 4: Update preset selector

- Existing preset dropdown should auto-populate new fields when CashAwareBalanced or DCARebalance preset is selected
- No new UI needed for presets — they flow through existing preset selection logic

## Todo List

- [ ] Add cashReservePct slider to Global Settings section
- [ ] Add dcaRebalanceEnabled toggle
- [ ] Add hardRebalanceThreshold input (conditional on dcaRebalanceEnabled)
- [ ] Wire new fields to form state and API submission
- [ ] Add client-side validation matching Zod schema
- [ ] Add cash reserve status card to Overview page
- [ ] Test preset selection populates new fields correctly
- [ ] Test conditional visibility (threshold hidden when DCA off)

## Success Criteria

- [ ] Cash reserve slider visible and functional (0-50%)
- [ ] DCA toggle controls visibility of hard rebalance threshold
- [ ] Form submission includes new fields
- [ ] Overview shows cash reserve status when enabled
- [ ] Presets auto-fill new fields
- [ ] Responsive layout on mobile

## Risk Assessment

- **UI consistency**: Must match existing design patterns. Read StrategyConfigPage before implementing to follow conventions.
- **API contract**: New fields are optional with defaults in Zod schema, so API is backward compatible.
