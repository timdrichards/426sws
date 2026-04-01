const http = require('http');
const os = require('os');
const { URL } = require('url');

const port = Number(process.env.PORT || 3000);
const delayMs = Number(process.env.DELAY_MS || 200);
const startedAt = new Date().toISOString();
let requestCount = 0;

// CPU-bound blocking work. Unlike setTimeout (which is async and non-blocking),
// this function occupies the Node.js event loop for the entire duration. A single
// Node process can only run one of these at a time, so concurrent requests must
// wait in line. This simulates a handler that does real computation (image
// processing, encryption, data transformation) rather than just waiting on I/O.
function cpuWork(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {} // busy-wait blocks the event loop
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/stats') {
    const payload = {
      hostname: os.hostname(),
      requestCount,
      startedAt,
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  if (url.pathname === '/reset' && req.method === 'POST') {
    requestCount = 0;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hostname: os.hostname(), requestCount }));
    return;
  }

  requestCount += 1;
  cpuWork(delayMs);

  const payload = {
    hostname: os.hostname(),
    delayMs,
    requestCount,
    timestamp: new Date().toISOString(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
});

server.listen(port, () => {
  console.log(`scaled service listening on ${port}`);
});
