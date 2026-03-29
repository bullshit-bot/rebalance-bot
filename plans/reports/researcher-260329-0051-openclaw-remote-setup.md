# OpenClaw Remote Access Setup Research Report

**Research Date:** 2026-03-29
**Context:** VPS with Docker deployment, Nginx reverse proxy, Let's Encrypt SSL
**VPS IP:** 14.225.218.190 | **Domain:** 14-225-218-190.nip.io | **Gateway WS:** ws://127.0.0.1:18789

---

## Problem Summary

"Pairing required" error (code 1008) when accessing Control UI via browser from remote host. Current config includes allowInsecureAuth: true, allowedOrigins: ["*"], trustedProxies: ["127.0.0.1"], but device pairing still blocks access.

---

## Root Cause Analysis

### Why Device Pairing Is Being Enforced

1. **Default Security Model:** OpenClaw auto-approves only localhost connections (127.0.0.1). All remote connections require explicit device approval via `openclaw devices approve <device-id>`.

2. **Reverse Proxy Breaks Client IP Detection:** When requests come through Nginx reverse proxy, the gateway sees the proxy's IP (127.0.0.1 in your case, since Nginx is local), BUT the request header analysis detects X-Forwarded-For headers present. This creates a contradiction:
   - If trustedProxies is configured but X-Forwarded-For doesn't match a trusted proxy IP, the gateway treats it as untrusted and enforces pairing
   - If trustedProxies is NOT properly configured, the gateway may see the forwarded client IP and fail to recognize it as local

3. **allowInsecureAuth Doesn't Bypass Device Pairing:** This setting only allows HTTP (non-HTTPS) connections; it does NOT disable device pairing. Device pairing is a separate security layer that remains enforced by default.

### The Key Issue with Your Current Setup

Your nginx reverse proxy is on the same host (127.0.0.1), but if:
- The X-Forwarded-For header contains the remote client IP (14.225.218.190's browser)
- trustedProxies is ["127.0.0.1"]
- The gateway sees X-Forwarded-For ≠ trusted proxy IP
- Result: Connection marked as "remote" → requires device pairing

---

## Solution: Three Paths Forward

### **Path 1: Device Pairing Approval (Quick Fix, Safest)**

If you want to keep the security model intact, simply approve new devices:

```bash
# List pending device pairing requests
docker compose exec openclaw openclaw devices list

# Find the device with status: "pending" and copy its id
# Then approve it:
docker compose exec openclaw openclaw devices approve <device-id>
```

**Pros:** Maintains security model, no config changes needed
**Cons:** Must approve each new device/browser; requests expire after 5 minutes if not approved

---

### **Path 2: Disable Device Pairing via Config (Recommended for Development)**

Add to your `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true
    }
  }
}
```

Then restart the gateway:
```bash
docker compose restart openclaw
```

**What this does:** Removes device pairing requirement for Control UI only; all other security checks remain (token auth, origin validation, etc.)

**Pros:** One-time config, no per-device approval needed, simpler UX
**Cons:** Reduces one layer of security (but OK if gateway is already behind HTTPS + token auth + firewall)

---

### **Path 3: Use Trusted Proxy Auth Mode (Production-Grade, Complex)**

This delegates ALL authentication to Nginx, bypassing device pairing entirely.

#### 3a. Configure OpenClaw for Trusted Proxy Mode

Edit `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "bind": "lan",
    "auth": {
      "mode": "trusted-proxy",
      "trustedProxy": {
        "userHeader": "x-forwarded-for",
        "requiredHeaders": ["x-forwarded-for"]
      }
    },
    "trustedProxies": ["127.0.0.1"]
  }
}
```

#### 3b. Configure Nginx to Override Headers

Update your Nginx reverse proxy config:

```nginx
location / {
    proxy_pass http://127.0.0.1:18789;

    # CRITICAL: OVERWRITE headers (don't append)
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**CRITICAL WARNING:** If nginx is getting X-Forwarded-For from upstream proxies (e.g., Cloudflare), you MUST also trust those IPs in trustedProxies. Otherwise, the gateway rejects the request.

**Pros:** Enterprise-grade, auditable, fine-grained access control possible
**Cons:** Complex to debug, requires nginx/proxy expertise, breaking changes if config misaligned

---

## Current Configuration Issues

### Issue 1: `trustedProxies: ["127.0.0.1"]` May Not Help

This setting tells the gateway "trust X-Forwarded-For headers only if request comes from 127.0.0.1." But:
- If your nginx IS at 127.0.0.1, this is correct
- However, if nginx is setting X-Forwarded-For to the remote client's IP (14.225.218.190), the gateway still sees it as "remote" and enforces pairing
- This is a **security feature**, not a bug

### Issue 2: `allowedOrigins: ["*"]` Is Insufficient

This allows any browser origin to connect, but only AFTER device pairing is approved. It doesn't bypass pairing itself.

### Issue 3: `allowInsecureAuth: true` Doesn't Help

This allows unencrypted HTTP in WebCrypto contexts; it doesn't disable device pairing.

---

## Recommended Action Plan

**For your situation (had it working before, want it back):**

1. **First, try the quick fix** (Path 1):
   ```bash
   docker compose exec openclaw openclaw devices list
   docker compose exec openclaw openclaw devices approve <device-id>
   ```

2. **If you want permanent fix with minimal config change**, use **Path 2** (disable device auth):
   ```json
   {
     "gateway": {
      "controlUi": {
        "dangerouslyDisableDeviceAuth": true
      }
    }
   }
   ```

3. **If you want production-grade security**, implement **Path 3** (trusted-proxy mode), but requires:
   - Proper nginx header overwriting
   - All upstream proxies listed in trustedProxies
   - Firewall rules to prevent direct access to gateway

---

## Configuration Template (Path 2 Recommended)

```json
{
  "gateway": {
    "port": 18789,
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    },
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true,
      "allowedOrigins": ["https://14-225-218-190.nip.io", "http://localhost:3000"]
    },
    "trustedProxies": ["127.0.0.1"]
  }
}
```

---

## Docker Network Mode Note

Your current `network_mode: host` is correct for this setup:
- Allows OpenClaw to bind to ports on the host
- Nginx can reach it at 127.0.0.1:18789
- No Docker NAT complication (which would cause "device pairing always required")

---

## Testing Steps After Configuration

1. Clear browser cookies/site data for the domain
2. Restart gateway: `docker compose restart openclaw`
3. Open Control UI: `https://14-225-218-190.nip.io:8888/`
4. Should connect without "pairing required" error
5. Verify via CLI: `docker compose exec openclaw openclaw status`

---

## Security Considerations

- **Device pairing is enabled by default for a reason:** It prevents unauthorized remote access
- **Disabling it with `dangerouslyDisableDeviceAuth`** is safe IF:
  - Gateway is behind HTTPS (Let's Encrypt ✓)
  - Gateway has token authentication (OPENCLAW_GATEWAY_TOKEN ✓)
  - Access is firewalled to trusted networks (Nginx on same host ✓)
- **Trusted-proxy mode is safer** if you run an OAuth2 proxy or identity service in front of nginx

---

## Unresolved Questions

1. **What auth method was used when it worked before?** Was device pairing explicitly approved then, or was there a different config in place?
2. **Does the gateway log show auth failures?** Check `docker compose logs openclaw` for error details (gatewayAuth, devicePairing rejection)
3. **Are there multiple proxies between client and gateway?** (e.g., Cloudflare, WAF, etc.) — if so, trustedProxies needs all of them listed
4. **Do you need multi-user access control?** If yes, trusted-proxy mode with oauth2-proxy is better than disabling device auth entirely

---

## Sources

- [OpenClaw Control UI Documentation](https://docs.openclaw.ai/web/control-ui)
- [OpenClaw Security Guide](https://docs.openclaw.ai/gateway/security)
- [OpenClaw Remote Gateway Configuration](https://docs.openclaw.ai/gateway/remote)
- [OpenClaw Gateway Configuration Reference](https://docs.openclaw.ai/gateway/configuration-reference)
- [OpenClaw Trusted Proxy Auth](https://docs.openclaw.ai/gateway/trusted-proxy-auth)
- [ClawKit Pairing Required Troubleshooting](https://getclawkit.com/docs/troubleshooting/pairing-required)
- [GitHub Issue: allowInsecureAuth doesn't bypass device pairing (#1679)](https://github.com/openclaw/openclaw/issues/1679)
- [GitHub Issue: Control UI ignores trusted-proxy auth mode (#25293)](https://github.com/openclaw/openclaw/issues/25307/linked_closing_reference?reference_location=REPO_ISSUES_INDEX)
