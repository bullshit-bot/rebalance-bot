# Mainnet Configuration Guide

## Pre-flight Checklist

- [ ] Run on testnet for 1-2 weeks with trend filter enabled
- [ ] Verify all Telegram alerts working (startup, trend flip, daily summary)
- [ ] Confirm MA data persists across restarts (`GET /api/health` → `dataPoints > 0`)
- [ ] Health endpoint shows memory, version, last price update
- [ ] Autoheal restarts unhealthy containers (test by killing health endpoint)

## Switch to Mainnet

1. **API Key Setup**
   - Generate Binance API key with **trade-only** permissions (no withdraw)
   - Enable IP whitelist on Binance — VPS IP only

2. **Environment Variables** (`.env`)
   ```env
   BINANCE_SANDBOX=false
   PAPER_TRADING=false
   BINANCE_API_KEY=your_mainnet_key
   BINANCE_API_SECRET=your_mainnet_secret
   ```

3. **Start Small**
   - Begin with $100-500 for live validation
   - Monitor for 48h before increasing allocation

## Monitoring

- **Telegram daily summary**: arrives at 08:00 UTC with portfolio overview
- **Health endpoint**: `GET /api/health` — uptime, memory, trend status, last price update
- **Docker logs**: `docker logs -f rebalance-backend`
- **Autoheal**: monitors all containers with healthchecks, restarts unhealthy ones within 60s

## Rollback

| Action | Command |
|--------|---------|
| Stop live trades immediately | Set `PAPER_TRADING=true` in `.env`, restart backend |
| Halt bot completely | `docker compose stop backend` |
| Switch back to testnet | Set `BINANCE_SANDBOX=true` in `.env`, restart backend |

## Architecture Notes

- `restart: unless-stopped` handles crashes (process exits)
- `autoheal` handles deadlocks (process running but healthcheck failing)
- Healthcheck: `curl -f http://localhost:3001/api/health` every 30s, 3 retries
- Memory limit: backend 512MB, MongoDB 512MB, autoheal 32MB (fits 8GB VPS)
