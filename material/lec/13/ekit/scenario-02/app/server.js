const http = require('http');
const os = require('os');
const { URL } = require('url');

const port = Number(process.env.PORT || 3000);
const delayMs = Number(process.env.DELAY_MS || 200);
const startedAt = new Date().toISOString();
let requestCount = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const server = http.createServer(async (req, res) => {
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
  await sleep(delayMs);

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
