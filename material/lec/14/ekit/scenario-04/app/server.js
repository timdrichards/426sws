const http = require('http');
const os = require('os');
const { URL } = require('url');

const port = Number(process.env.PORT || 3000);
const delayMs = Number(process.env.DELAY_MS || 200);
const startedAt = new Date().toISOString();
let requestCount = 0;

// CPU-bound blocking work. Blocks the event loop for the entire duration.
function cpuWork(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {} // busy-wait blocks the event loop
}

// Track memory usage so students can see it climb under pressure.
function memUsage() {
  const mem = process.memoryUsage();
  return {
    rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/stats') {
    const payload = {
      hostname: os.hostname(),
      requestCount,
      startedAt,
      memory: memUsage(),
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
  console.log(`stress-test service listening on ${port}`);
});
