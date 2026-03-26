---
name: auto-rebalance
description: Automated rebalancing workflow with safety checks — evaluates drift, validates conditions, then triggers rebalance
tools:
  - get_portfolio
  - list_allocations
  - trigger_rebalance
  - get_rebalance_history
---

# Auto Rebalance

## Purpose

Execute a full automated rebalancing cycle with safety checks: verify preconditions, assess drift, review recent rebalance history, then trigger a rebalance if all conditions are met.

## Workflow

1. Call `get_portfolio` to retrieve current holdings, weights, and total portfolio value.
2. Call `list_allocations` to get target allocation percentages.
3. Compute per-asset drift. If max drift is below 5%, skip rebalancing — output "No rebalance needed" and stop.
4. Call `get_rebalance_history` to check recent rebalance operations:
   - If a rebalance completed successfully within the last 4 hours, skip — output "Rebalance cooldown active" and stop.
   - If the last rebalance failed, log a warning but continue.
5. Safety checks before proceeding:
   - Total portfolio value must be above minimum threshold (skip if value is zero or unavailable).
   - No single asset's suggested new allocation should exceed 80%.
   - All suggested allocations must sum to 100% (±0.01 tolerance).
6. Call `trigger_rebalance` with the target allocations from `list_allocations`.
7. Report outcome:
   - Success: list assets traded, estimated fees, new weights.
   - Failure: surface error message and suggest manual review.

## MCP Tools Used

- `get_portfolio` — fetches current holdings and weights to compute drift
- `list_allocations` — retrieves target allocation percentages to rebalance toward
- `trigger_rebalance` — executes the rebalance operation with specified target allocations
- `get_rebalance_history` — retrieves past rebalance operations to enforce cooldown and detect failures
