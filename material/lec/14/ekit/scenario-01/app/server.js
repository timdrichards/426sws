const http = require('http');
const os = require('os');

const port = Number(process.env.PORT || 3000);
const delayMs = Number(process.env.DELAY_MS || 200);

// CPU-bound blocking work. Unlike setTimeout (which is async and non-blocking),
// this function occupies the Node.js event loop for the entire duration. A single
// Node process can only run one of these at a time, so concurrent requests must
// wait in line. This simulates a handler that does real computation (image
// processing, encryption, data transformation) rather than just waiting on I/O.
function cpuWork(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {} // busy-wait blocks the event loop
}

const server = http.createServer((_req, res) => {
  cpuWork(delayMs);

  const payload = {
    hostname: os.hostname(),
    delayMs,
    timestamp: new Date().toISOString(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
});

server.listen(port, () => {
  console.log(`baseline service listening on ${port}`);
});
