# golazo-server

Wraps the [golazo](https://github.com/0xjuanma/golazo) CLI in a small HTTP API
so the World Cup site can fetch live scores from your VPS. golazo has no
daemon mode — it only emits JSON per invocation — so `server.js` runs the
binary on each request and serves the result with CORS headers.

## Deploy on the VPS

```bash
# 1. Install golazo on the VPS (see golazo's own install instructions)
brew install 0xjuanma/tap/golazo   # or the install script for Linux

# 2. Copy this folder to the VPS, then run:
GOLAZO_BIN=golazo \
PORT=8787 \
ALLOWED_ORIGIN=https://<seu-usuario>.github.io \
node server.js
```

Keep it running with `pm2` or a `systemd` unit, e.g.:

```ini
# /etc/systemd/system/golazo-server.service
[Unit]
Description=golazo-server
After=network.target

[Service]
Environment=PORT=8787
Environment=ALLOWED_ORIGIN=https://<seu-usuario>.github.io
ExecStart=/usr/bin/node /opt/golazo-server/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Put it behind nginx/Caddy with HTTPS (the GitHub Pages site is served over
HTTPS, so the browser will block `fetch()` calls to a plain `http://` VPS —
a reverse proxy with a cert, or a free Cloudflare/Caddy TLS setup, is
required).

## Endpoints

- `GET /live` — current live matches
- `GET /finished` — matches finished in the last 2 days (+ today's upcoming)
- `GET /leagues` — supported leagues

Each returns golazo's own JSON envelope: `{ status, count, data }`.

## Pointing the site at it

On the site, open the **Live Scores** tab and paste the server's public URL
(e.g. `https://golazo.seudominio.com`) into the config box — it's saved in
the browser's `localStorage`, no rebuild/deploy needed.
