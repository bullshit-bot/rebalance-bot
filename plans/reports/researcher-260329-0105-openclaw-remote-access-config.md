# OpenClaw Remote Access Configuration Research

**Date:** 2026-03-29
**Status:** Complete
**Objective:** Find how to bind OpenClaw gateway to all interfaces and access Control UI remotely without nginx

---

## Executive Summary

**The user's memory is outdated.** OpenClaw **no longer accepts raw IP:port bindings** like `0.0.0.0`. Current versions (2026+) only accept specific named modes: `loopback`, `lan`, `tailnet`, `auto`, or `custom`.

**Direct answer to "IP:port without nginx":**
- Use `gateway.bind: "lan"` to listen on all interfaces
- BUT this requires `gateway.auth.token` or `gateway.auth.password` to be set (security requirement)
- Then access via `http://{your-vps-ip}:18789`

**Better approach (recommended):** Use Tailscale Serve or SSH tunneling instead of exposing port directly.

---

## Key Findings

### 1. Valid Bind Modes (Not 0.0.0.0)

OpenClaw `gateway.bind` accepts these **exact values only**:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `loopback` (default) | Localhost only (127.0.0.1:18789) | Secure default, use SSH/Tailscale tunneling |
| `lan` | All interfaces (0.0.0.0:18789) | Direct LAN/VPS IP access (requires auth) |
| `tailnet` | Tailscale network only | Private VPN access |
| `auto` | Auto-detect best binding | Experimental |
| `custom` | Custom host:port configuration | Advanced use |

**Attempting `gateway.bind: "0.0.0.0"` will FAIL** with error:
```
Invalid --bind (use "loopback", "lan", "tailnet", "auto", or "custom")
```

### 2. Configuration for Direct VPS IP Access

**Docker Compose / Config:**
```yaml
gateway:
  bind: "lan"  # Listen on all interfaces
  auth:
    token: "your-secure-token-here"  # REQUIRED for lan binding
```

**Or via environment variables:**
```bash
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_AUTH_TOKEN=your-secure-token-here
```

**Or CLI:**
```bash
openclaw gateway --bind lan --port 18789
```

**Then access:** `http://{your-vps-ip}:18789`

### 3. Security Requirement: Auth is Mandatory

When binding to non-loopback (lan/custom), OpenClaw **enforces authentication**:
- Refuses to bind without `gateway.auth.token` or `gateway.auth.password` configured
- Error: "refusing to bind gateway ... without auth"

This is a hard fail—cannot bind to `lan` without credentials set.

### 4. Recommended Approach: Tailscale Serve (NO Port Exposure)

Instead of exposing port directly, use Tailscale:

```yaml
gateway:
  bind: "loopback"  # Keep on localhost
  tailscale:
    enabled: true
    # Tailscale Serve automatically exposes Control UI
```

**Benefits:**
- Gateway stays on localhost (127.0.0.1)
- Accessed via private Tailscale network only
- No public port exposure
- No nginx needed
- No manual authentication setup (Tailscale handles it)

**Access:** https://your-machine.tailnet-name.ts.net:18789

### 5. Fallback Approach: SSH Tunneling (NO Port Exposure)

Keep gateway on loopback, tunnel from your laptop:

```bash
ssh -N -L 18789:127.0.0.1:18789 user@your-vps-ip
```

Then access locally: `http://127.0.0.1:18789`

---

## Why User's Memory Was Wrong

The user states: "previously had OpenClaw working on a VPS accessed directly by IP:port without nginx."

This might have worked in:
- Very old OpenClaw versions (pre-2024)
- Custom fork/modified version
- Or they're misremembering the setup method

**Current reality (2026):**
- Default binding is `loopback` (not exposed)
- Raw `0.0.0.0` syntax is completely invalid
- Must use named mode `lan` + authentication

---

## What Actually Works Today

### Option A: Direct Access (Not Recommended)
```yaml
gateway:
  bind: lan
  auth:
    token: "use-a-strong-random-token"
```
Access: `http://{vps-ip}:18789` (less secure, exposes to network)

### Option B: Tailscale (Recommended)
```yaml
gateway:
  bind: loopback
  tailscale:
    enabled: true
```
Access: Private Tailscale URL (most secure, no port exposure)

### Option C: SSH Tunnel (Fallback)
```yaml
gateway:
  bind: loopback
```
Access: SSH forward `127.0.0.1:18789` (secure, manual setup)

---

## Docker-Specific Notes

**Issue:** `network_mode: host` with Docker still only listens to loopback because:
- `gateway.bind: "loopback"` is the default
- `network_mode: host` doesn't override the bind config
- Must explicitly set `gateway.bind: "lan"` in config

**Fix in docker-compose.yml:**
```yaml
services:
  openclaw:
    image: openclaw/gateway:latest
    network_mode: host  # Required for lan binding to work
    environment:
      OPENCLAW_GATEWAY_BIND: lan
      OPENCLAW_GATEWAY_AUTH_TOKEN: your-token
    # Or use config file volumes
    volumes:
      - ./config.json:/config/gateway-config.json
```

---

## Unresolved Questions

1. **Exact `custom` bind syntax** — Documentation doesn't specify how to use `gateway.bind: "custom"` with specific IPs
2. **Control UI CORS/origin issues** — `gateway.controlUi.allowedOrigins` may need adjustment for remote HTTPS access
3. **Tailscale Serve port conflict** — If both gateway and Tailscale Serve use 18789, how does routing work?

---

## Sources

- [OpenClaw VPS Setup Docs](https://docs.openclaw.ai/vps)
- [OpenClaw Docker Installation Guide](https://docs.openclaw.ai/install/docker)
- [OpenClaw Gateway Security](https://docs.openclaw.ai/gateway/security)
- [OpenClaw Remote Access (GitHub)](https://github.com/openclaw/openclaw/blob/main/docs/gateway/remote.md)
- [GitHub Issue: bind 0.0.0.0 Invalid Input](https://github.com/openclaw/openclaw/issues/12057)
- [GitHub Issue: Docs Container/Gateway Bind Example Conflicts](https://github.com/openclaw/openclaw/issues/44101)
- [OpenClaw Security Guide - Contabo Blog](https://contabo.com/blog/openclaw-security-guide-2026/)
- [2,000+ Exposed OpenClaw Instances Report](https://findskill.ai/blog/openclaw-docker-setup/)
