// Thin HTTP wrapper around the golazo CLI (https://github.com/0xjuanma/golazo).
// golazo itself has no daemon/server mode — it only prints JSON to stdout per
// invocation — so this process shells out to the binary on each request and
// re-serves the JSON with CORS headers for the static site to fetch().
//
// Usage: GOLAZO_BIN=golazo PORT=8787 ALLOWED_ORIGIN=https://user.github.io node server.js

const http = require('http');
const https = require('https');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 8787;
const GOLAZO_BIN = process.env.GOLAZO_BIN || 'golazo';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const ROUTES = {
  '/live': ['live'],
  '/finished': ['finished', '--days', '7', '--include-upcoming'],
  '/leagues': ['leagues'],
};

function runGolazo(args, res) {
  execFile(GOLAZO_BIN, args, { env: { ...process.env, GOLAZO_AGENT: '1' }, timeout: 10000 }, (err, stdout, stderr) => {
    if (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(stderr || JSON.stringify({ status: 'error', code: 'upstream_error', message: err.message }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(stdout);
  });
}

// Resolves whatever CazéTV is currently streaming live on YouTube, without
// needing the YouTube Data API: /@channel/live redirects server-side to the
// live video, and its videoId/title are present in the plain HTML response.
function getCazeLive(res) {
  https.get('https://www.youtube.com/@CazeTV/live', { headers: { 'User-Agent': 'Mozilla/5.0' } }, ytRes => {
    let html = '';
    ytRes.on('data', chunk => { html += chunk; });
    ytRes.on('end', () => {
      const videoIdMatch = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
      const titleMatch = html.match(/<title>([^<]*)<\/title>/);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        videoId: videoIdMatch ? videoIdMatch[1] : null,
        title: titleMatch ? titleMatch[1].replace(' - YouTube', '') : null
      }));
    });
  }).on('error', err => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: err.message }));
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/caze-live') { getCazeLive(res); return; }

  const matchIdMatch = url.pathname.match(/^\/match\/(\d+)$/);
  const args = matchIdMatch ? ['match', matchIdMatch[1]] : ROUTES[url.pathname];
  if (!args) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', code: 'not_found', message: 'unknown route' }));
    return;
  }
  runGolazo(args, res);
});

server.listen(PORT, () => console.log(`golazo-server listening on :${PORT}`));
