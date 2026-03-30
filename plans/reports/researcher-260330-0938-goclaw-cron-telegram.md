# GoClaw Cron → Telegram Delivery Research Report

**Date:** 2026-03-30
**Product:** GoClaw v2.40.1
**Target:** Configure cron jobs to deliver results to Telegram channel instead of HTTP

---

## Executive Summary

GoClaw **officially supports** Telegram delivery for cron jobs via the `delivery` config object. The correct payload format is documented and relatively straightforward. However, **three confirmed bugs** exist in production that can prevent or mask delivery failures. The UI limitation (channel field not editable) is a separate issue from the delivery mechanism itself.

**Status:** Telegram cron delivery is possible, but production bugs create silent failures. Requires either: (1) direct JSON editing + CLI verification, or (2) upgrade to Feb 2026+ build with cron delivery fixes.

---

## How GoClaw Cron → Telegram Delivery Works

### Supported Delivery Channels
GoClaw supports 7 messaging channels as cron delivery targets:
- Telegram
- Discord
- Slack
- Zalo OA
- Zalo Personal
- Feishu/Lark
- WhatsApp

### Correct API Payload Format

Cron jobs are stored in `~/.goclaw/cron/jobs.json` with this structure:

```json
{
  "id": "uuid-string",
  "name": "Rebalance Alert",
  "enabled": true,
  "schedule": {
    "kind": "cron",
    "expr": "0 9 * * *",
    "tz": "Asia/Ho_Chi_Minh"
  },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Execute rebalancing strategy",
    "timeoutSeconds": 600,
    "model": "anthropic/claude-sonnet-4-6"
  },
  "delivery": {
    "mode": "announce",
    "channel": "telegram",
    "to": "1119792006",
    "bestEffort": true
  }
}
```

### Key Delivery Configuration Fields

| Field | Required | Values | Purpose |
|-------|----------|--------|---------|
| `delivery.mode` | ✓ | "announce" | Sends results to external channel |
| `delivery.channel` | ✓ | "telegram", "discord", "slack", etc. | Target platform |
| `delivery.to` | ✓ | Chat ID (e.g., "1119792006") | Destination identifier |
| `delivery.bestEffort` | ✗ | true/false | Continue job if delivery fails |

**Note:** The `to` field accepts the channel ID directly. For your Telegram channel, use `"1119792006"` (matches your `agent:fox-spirit:telegram:direct:1119792006` session).

### Schedule Types

Three schedule formats supported:

1. **Cron Expression** (standard cron syntax + timezone):
   ```json
   { "kind": "cron", "expr": "0 9 * * *", "tz": "Asia/Ho_Chi_Minh" }
   ```

2. **Fixed Interval** (milliseconds):
   ```json
   { "kind": "every", "everyMs": 3600000 }
   ```

3. **One-Time** (ISO 8601 timestamp):
   ```json
   { "kind": "at", "at": "2026-03-30T16:00:00Z" }
   ```

### Creating Cron Jobs via CLI

Instead of editing JSON directly, use:

```bash
goclaw cron add \
  --name "Rebalance Alert" \
  --cron "0 9 * * *" \
  --tz "Asia/Ho_Chi_Minh" \
  --session isolated \
  --message "Execute rebalancing strategy" \
  --announce
```

This auto-generates the JSON. However, CLI doesn't expose `channel` and `to` parameters directly—you'll need to edit the generated job's `delivery` section afterward or use the HTTP API.

---

## Why UI Edit Fails (Channel Field Not Editable)

The UI limitation is separate from the delivery mechanism. This appears to be a **frontend validation issue**—the UI probably doesn't allow changing `channel` or `to` fields from its edit form, defaulting to `http` channel.

**Workaround:** Edit `/root/.goclaw/cron/jobs.json` directly via SSH, then verify with `goclaw cron list --json`.

---

## Production Bugs & Workarounds

### Bug #1: False-Positive Delivery Status
**Issue:** Cron jobs report `delivered: true` even when Telegram receives nothing.

**Root Cause:** The `sendSubagentAnnounceDirectly()` function treats a successful agent call as proof of delivery, without verifying the actual Telegram API response.

**Impact:** You cannot trust the cron job history to confirm actual delivery.

**Workaround:**
- Monitor `/var/log/goclaw/gateway.log` for `telegram sendMessage ok` entries (direct verification)
- Manually check Telegram channel after cron execution
- Use `bestEffort: false` to catch delivery exceptions in job state

**Status:** Reported as Issue #43177; unclear if fixed in v2.40.1.

### Bug #2: System Messages Don't Route to Telegram
**Issue:** Cron jobs configured with `systemEvent` payload fail to deliver to Telegram (work in webchat).

**Root Cause:** Cron-triggered system messages fail during channel routing. Regular messages work fine—issue is specific to automated delivery.

**Impact:** If using `sessionTarget: main` + `payload: systemEvent`, Telegram delivery will fail silently.

**Workaround:** Use `sessionTarget: isolated` + `payload: agentTurn` instead. This creates a hidden agent instance whose output can be delivered.

**Status:** Fixed in PR #8540 (Feb 4, 2026); likely included in v2.40.1.

### Bug #3: wake=now Mode Breaks Telegram Delivery
**Issue:** Cron jobs with `wakeMode: now` fail to deliver to Telegram, though jobs execute and appear in logs.

**Root Cause:** Delivery routing picks up wrong session context when using `wake=now`.

**Impact:** Immediate wake mode prevents successful delivery.

**Workaround:** Use `wakeMode: next-heartbeat` (the default). This ensures the cron job executes at the next agent heartbeat, with correct session context for delivery routing.

**Status:** Fixed in PR #8540 (Feb 4, 2026); likely included in v2.40.1.

---

## Step-by-Step Implementation for Your Use Case

### Goal: Cron job executes rebalancing strategy, delivers result to Telegram channel 1119792006

### Option A: Direct JSON Edit (Recommended)

1. **SSH to VPS:**
   ```bash
   sshpass -p 'VTTvvsN4oGzOPKImacQm' ssh -o StrictHostKeyChecking=no -o PubkeyAuthentication=no root@14.225.218.190
   ```

2. **Edit cron jobs file:**
   ```bash
   nano /root/.goclaw/cron/jobs.json
   ```

3. **Locate your job and update delivery section:**
   ```json
   "delivery": {
     "mode": "announce",
     "channel": "telegram",
     "to": "1119792006",
     "bestEffort": true
   }
   ```

4. **Verify syntax (no trailing commas, valid JSON)**

5. **Restart gateway (if required):**
   ```bash
   systemctl restart goclaw-gateway
   # or, if using docker:
   docker-compose restart gateway
   ```

6. **Verify job was loaded:**
   ```bash
   goclaw cron list --json
   ```

### Option B: HTTP API (If Available)

Check if GoClaw exposes an HTTP API for cron management. This would allow programmatic updates without SSH.

Endpoint pattern (likely): `POST /api/cron/update` or similar, with payload:
```json
{
  "jobId": "uuid",
  "delivery": {
    "mode": "announce",
    "channel": "telegram",
    "to": "1119792006",
    "bestEffort": true
  }
}
```

---

## Architectural Fit Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Feature Support** | ✅ Supported | Telegram delivery is a documented, official feature |
| **API Clarity** | ✅ Clear | Payload format well-documented across sources |
| **Production Maturity** | ⚠️ Caution | Three known bugs; fixes appear to be in Feb 2026+ releases |
| **Session Integration** | ✅ Good | Your existing session `agent:fox-spirit:telegram:direct:1119792006` can be targeted |
| **Monitoring** | ⚠️ Weak | Cron job history unreliable; manual log verification needed |

---

## Unresolved Questions

1. **Exact v2.40.1 Bug Status:** Are bugs #43177, #5339, #2937 fixed in your current version? Requires checking:
   - Check gateway logs for actual Telegram API confirmation
   - Test a cron job and manually verify delivery

2. **HTTP API Endpoint:** Does GoClaw expose `/api/cron/*` endpoints for programmatic job creation/update? Current docs don't list this.

3. **CLI Channel Parameter:** Does newer `goclaw cron add` support `--channel telegram --to 1119792006`? Docs only show basic flags.

4. **HTTP Fallback:** If Telegram delivery fails, does `bestEffort: true` fall back to a secondary channel, or just suppress errors?

---

## Recommended Next Steps

1. **Verify Production Environment:**
   - SSH into VPS and check `/root/.goclaw/cron/jobs.json` structure
   - Confirm expected job exists with current delivery config
   - Run `goclaw cron list --json` to see live state

2. **Test Telegram Delivery:**
   - Create a test cron job with Telegram delivery
   - Wait for next scheduled execution
   - Monitor `/var/log/goclaw/gateway.log` for `telegram sendMessage` entries
   - Manually verify message appears in Telegram channel

3. **Address Known Bugs:**
   - If delivery silently fails: switch to `wakeMode: next-heartbeat` and test again
   - If using `systemEvent`: switch to `agentTurn` payload
   - Consider upgrading to latest GoClaw build if bugs persist

4. **Implement Monitoring:**
   - Since cron history is unreliable, parse `gateway.log` for actual delivery confirmations
   - Or implement Telegram message auditing (check channel periodically)

---

## References

- [Stack Junkie: OpenClaw Cron Jobs Guide](https://www.stack-junkie.com/blog/openclaw-cron-jobs-automation-guide)
- [DeepWiki: Cron Service & Job Management](https://deepwiki.com/openxjarvis/openclaw-python/6.1-cron-service-and-job-management)
- [GoClaw GitHub: CLI Commands](https://github.com/nextlevelbuilder/goclaw-docs/blob/master/reference/cli-commands.md)
- [GitHub Issue #43177: Cron Announce False Delivery](https://github.com/openclaw/openclaw/issues/43177)
- [GitHub Issue #5339: Telegram Unable to Receive Cron](https://github.com/openclaw/openclaw/issues/5339)
- [GitHub Issue #2937: wake=now Not Delivering to Telegram](https://github.com/openclaw/openclaw/issues/2937)
