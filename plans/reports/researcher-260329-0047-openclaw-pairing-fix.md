# OpenClaw "Pairing Required" Error: Remote Access via Docker + Nginx Fix

## Executive Summary

OpenClaw's "pairing required" (WebSocket 1008) error on Docker + remote access has **two primary causes** and **two complementary fixes**:

1. **Docker NAT translates localhost → internal IP** (127.0.0.1 → 172.18.0.1), gateway treats as external, requires pairing
2. **Browser cannot complete pairing flow** for security reasons

**Solution: Configure `trustedProxies` + `allowInsecureAuth`** to tell gateway that connections from your nginx proxy are trusted and don't require device pairing.

---

## Root Cause Analysis

### Why "Pairing Required" Happens

When OpenClaw gateway runs in Docker with `network_mode: host` or standard Docker networking:
- Browser connects to nginx reverse proxy on HTTPS (external)
- Nginx proxies to gateway on `127.0.0.1:18789` (loopback)
- **Docker NAT intercepts this connection** and transforms the source IP
- Gateway sees connection from 172.18.0.1 (or similar Docker bridge IP), not localhost
- Gateway treats non-loopback connections as "external devices" requiring pairing
- Browser UI cannot complete automated pairing flow → stuck on "pairing required"

**Key insight:** Even with `allowInsecureAuth: true`, the gateway still requires device pairing when it detects a non-loopback source IP. The `allowInsecureAuth` flag alone is **insufficient for reverse proxy setups**.

### Why `openclaw pair` CLI Crashes

When you run `openclaw pair` in the container, it tries to spawn a pairing UI or daemon process. Since:
- Container has no display (headless)
- Pairing likely tries to open a browser or socket listener
- The process crashes and container restarts

This is **expected and not the intended solution path** for Docker deployments.

---

## The Fix: Configuration for Docker + Nginx Remote Access

### Minimal Configuration

Add/update your OpenClaw config (in `openclaw.json` or via environment):

```json
{
  "gateway": {
    "bind": "loopback",
    "trustedProxies": ["127.0.0.1", "::1"],
    "controlUi": {
      "enabled": true,
      "allowInsecureAuth": true
    },
    "auth": {
      "mode": "token"
    }
  }
}
```

**Explanation:**
- `bind: "loopback"` → gateway listens only on 127.0.0.1 (nginx proxies external traffic)
- `trustedProxies: ["127.0.0.1", "::1"]` → trust local nginx reverse proxy, don't require pairing
- `allowInsecureAuth: true` → allows token-based auth over HTTP, bypasses device pairing for trusted IPs
- `auth.mode: "token"` → use token authentication (secure when behind HTTPS nginx)

### If Gateway is on Different Host Than Nginx

If your gateway Docker container is on a different machine than nginx:

```json
{
  "gateway": {
    "bind": "lan",
    "trustedProxies": ["10.0.0.5"],
    "controlUi": {
      "enabled": true,
      "allowInsecureAuth": true
    },
    "auth": {
      "mode": "token"
    }
  }
}
```

Replace `10.0.0.5` with nginx's actual IP on your network.

### For Docker Desktop (macOS/Windows)

Docker Desktop uses Docker's internal NAT network for bridge networks:

```json
{
  "gateway": {
    "bind": "loopback",
    "trustedProxies": ["127.0.0.1", "::1", "192.168.65.0/24"],
    "controlUi": {
      "enabled": true,
      "allowInsecureAuth": true
    }
  }
}
```

Add `192.168.65.0/24` (Docker Desktop's NAT range on macOS/Windows).

---

## Step-by-Step Implementation

### 1. Update OpenClaw Configuration

Locate your `openclaw.json` or create it at `~/.openclaw/config.json`:

```bash
# On your VPS
cat > /path/to/openclaw.json <<'EOF'
{
  "gateway": {
    "bind": "loopback",
    "trustedProxies": ["127.0.0.1", "::1"],
    "controlUi": {
      "enabled": true,
      "allowInsecureAuth": true
    },
    "auth": {
      "mode": "token"
    }
  }
}
EOF
```

Or mount config via Docker:
```yaml
services:
  openclaw:
    image: openclaw:latest
    volumes:
      - ./openclaw.json:/root/.openclaw/config.json
      - ./data:/data
    ports:
      - "127.0.0.1:18789:18789"
    environment:
      OPENCLAW_CONFIG: /root/.openclaw/config.json
```

### 2. Restart OpenClaw Gateway

```bash
docker restart <container-name>
```

Check logs to confirm no errors:
```bash
docker logs -f <container-name> | grep -i pairing
```

### 3. Verify Nginx Configuration

Ensure nginx forwards WebSocket headers properly:

```nginx
upstream openclaw {
    server 127.0.0.1:18789;
}

server {
    listen 443 ssl http2;
    server_name openclaw.example.nip.io;

    ssl_certificate /etc/letsencrypt/live/openclaw.example.nip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openclaw.example.nip.io/privkey.pem;

    location / {
        proxy_pass http://openclaw;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Access Control UI

Visit `https://openclaw.example.nip.io` in browser. It should load without "pairing required" error.

If it still shows pairing required:
- Check `docker logs` for auth errors
- Verify nginx is forwarding to 127.0.0.1:18789 (not Docker hostname)
- Confirm OpenClaw is actually listening on 127.0.0.1:18789 (not 0.0.0.0)

---

## Why This Works

| Component | Purpose |
|-----------|---------|
| `bind: "loopback"` | Forces gateway to only accept connections from localhost (nginx must proxy externals) |
| `trustedProxies: ["127.0.0.1"]` | Tells gateway "if connection comes from 127.0.0.1, treat it as a local/trusted request" |
| `allowInsecureAuth: true` | Allows token-based auth over HTTP once the request is from a trusted proxy |
| **Result** | Browser → HTTPS nginx → local proxy → HTTP localhost gateway (no pairing required) |

The gateway sees the connection originating from `127.0.0.1` (nginx's loopback connection), so it:
1. Recognizes it as a trusted, local connection
2. Skips device pairing requirement
3. Accepts token-based authentication
4. Allows Control UI access

---

## Security Notes

### This Configuration Is Safe Because:

1. **Gateway port is NOT exposed externally** — only accessible via nginx
2. **HTTPS termination at nginx** — browser traffic encrypted
3. **Token authentication required** — not open to anyone
4. **Trusted proxy list is minimal** — only localhost, not `0.0.0.0/0`

### NEVER Do This:

```json
"trustedProxies": ["0.0.0.0/0"]  // DANGEROUS - trusts all IPs
"dangerouslyDisableDeviceAuth": true  // For break-glass only, revert immediately
```

---

## Troubleshooting

### Still Getting "Pairing Required"?

1. **Check OpenClaw is actually using the config:**
   ```bash
   docker exec <container> cat /root/.openclaw/config.json | grep trustedProxies
   ```

2. **Verify gateway listens on loopback only:**
   ```bash
   docker exec <container> netstat -tlnp | grep 18789
   # Should show: tcp 0 0 127.0.0.1:18789
   ```

3. **Check if nginx is truly proxying to localhost:**
   ```bash
   curl -v http://127.0.0.1:18789
   # Should return 200/upgrade required (not "pairing required")
   ```

4. **Enable debug logging:**
   ```bash
   docker exec <container> env OPENCLAW_DEBUG=1 openclaw gateway
   ```

### Container Crashes When Running `openclaw pair`?

**This is expected and not needed.** The configuration above bypasses the need for `openclaw pair` entirely. The pairing requirement is disabled via `trustedProxies` + `allowInsecureAuth`, not via manual device pairing.

### Why allowInsecureAuth Alone Didn't Work?

Because `allowInsecureAuth` only allows **HTTP** connections from `localhost`. When Docker NAT changes the source IP to 172.18.0.1, the gateway no longer sees it as "from localhost," so it still requires pairing. Adding `trustedProxies` is the critical missing piece.

---

## Alternative: Manual Device Pairing (Not Recommended for Docker)

If you want to keep strict pairing enabled, you'd need to:

1. Add `allowInsecureAuth: true` temporarily
2. Restart container
3. Access Control UI and approve the browser device in Device/Nodes section
4. Remove `allowInsecureAuth` and restart again

This is fragile because:
- Browser typically cannot complete CLI pairing flow automatically
- Manual approval is required each time you add a device
- The pairing state is stored in container and lost if you recreate the container

**Not recommended for remote access via Docker.**

---

## References

- [OpenClaw Trusted Proxy Auth Docs](https://docs.openclaw.ai/gateway/trusted-proxy-auth)
- [GitHub Issue #1679 - allowInsecureAuth does not bypass pairing for Docker/reverse proxy](https://github.com/openclaw/openclaw/issues/1679)
- [GitHub Issue #4941 - Dashboard pairing required (1008) in Docker Desktop](https://github.com/openclaw/openclaw/issues/4941)
- [GitHub Issue #6959 - Fix "pairing required" error in Docker](https://github.com/openclaw/openclaw/issues/6959)
- [Simon Willison's TIL: Running OpenClaw in Docker](https://til.simonwillison.net/llms/openclaw-docker)
- [DEV Community: OpenClaw Behind Nginx](https://dev.to/agent_paaru/openclaw-behind-nginx-on-a-shared-server-multi-app-reverse-proxy-setup-535)

---

## Unresolved Questions

- **For your specific VPS setup (14.225.218.190):** What is the exact internal IP of your nginx container when it proxies to openclaw? Run `docker network inspect bridge` to verify the Docker network configuration and identify the correct `trustedProxies` entry.
- **Current config location:** Is your `openclaw.json` being read from `~/.openclaw/config.json` or mounted at a custom path? Verify the container is actually loading the config with `docker exec`.
