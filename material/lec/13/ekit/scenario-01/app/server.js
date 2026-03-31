const http = require('http');
const os = require('os');

const port = Number(process.env.PORT || 3000);
const delayMs = Number(process.env.DELAY_MS || 200);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const server = http.createServer(async (_req, res) => {
  await sleep(delayMs);

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
