---
name: feedback-plan-sync
description: MUST update plan status after every phase completion — user caught missing updates twice
type: feedback
---

Always update plan.md status + checkboxes immediately after completing any phase.

**Why:** User caught plan kanban showing "Pending" / "0%" after phases were already done — twice. Caused confusion and eroded trust.

**How to apply:** After EVERY `/cook` phase completes:
1. Mark all `- [ ]` → `- [x]` in phase plan file
2. Set frontmatter `status: completed`
3. Update master plan.md phase table with `✅ Completed`
4. If all phases done → master plan `status: completed`

Do this BEFORE responding to user. No exceptions. No "I'll do it later."
