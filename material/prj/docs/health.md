---
title: Project → Health Endpoints and System Monitoring
---

# Health Endpoints and System Monitoring

Every service in your system must expose a `GET /health` endpoint. This document explains what that endpoint should check, what it should return, how to wire it into Docker Compose, and how to monitor the health of your entire system at a glance.

---

## Why Health Endpoints Matter

A health endpoint is not a demo feature — it is the primary tool your team uses to understand whether your system is working. Without it you are flying blind. With it you can answer questions like:

- Is the Order Service connected to its database right now?
- Is the Redis queue for dispatching orders backed up?
- When did the Transcode Worker last successfully process a job?
- Which replica is unhealthy after I scaled up?

Health endpoints also drive Docker Compose's built-in restart and dependency logic, so they affect whether your services come up in the right order and recover automatically when something crashes.

---

## What a Health Endpoint Should Check

Your `/health` endpoint should check every external dependency your service relies on. A service that is running but cannot reach its database is not healthy.

| Dependency                   | What to check                                                           |
| ---------------------------- | ----------------------------------------------------------------------- |
| PostgreSQL                   | Open a connection and run `SELECT 1`                                    |
| Redis                        | Send a `PING` command and verify the response is `PONG`                 |
| Queue depth                  | Read the length of the queues your service owns; flag if unusually deep |
| Dead letter queue depth      | Read the DLQ length; any non-zero value is worth surfacing              |
| Last processed job (workers) | Record the timestamp of the last successful job; flag if too long ago   |

You do not need to check dependencies owned by _other_ services. The Order Service should check its own database and Redis — not the Restaurant Service's database.

---

## Response Format

Use a consistent JSON format across all your services. Consistency matters because your monitoring script (covered below) will parse these responses.

**Healthy response — HTTP 200**

```json
{
  "status": "healthy",
  "service": "order-service",
  "timestamp": "2025-04-14T10:23:01Z",
  "uptime_seconds": 3612,
  "checks": {
    "database": { "status": "healthy", "latency_ms": 2 },
    "redis": { "status": "healthy", "latency_ms": 1 }
  }
}
```

**Degraded response — HTTP 503**

```json
{
  "status": "unhealthy",
  "service": "order-service",
  "timestamp": "2025-04-14T10:23:01Z",
  "uptime_seconds": 3612,
  "checks": {
    "database": { "status": "unhealthy", "error": "connection refused" },
    "redis": { "status": "healthy", "latency_ms": 1 }
  }
}
```

The HTTP status code is what matters most — 200 means healthy, 503 means something is wrong. The JSON body is for humans and your monitoring script.

---

## Implementing `/health` in Node.js (Express)

### HTTP Service with Database and Redis

```javascript
import express from 'express'
import pg from 'pg'
import { createClient } from 'redis'

const app = express()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

const startTime = Date.now()

app.get('/health', async (req, res) => {
  const checks = {}
  let healthy = true

  // Check PostgreSQL
  const dbStart = Date.now()
  try {
    await pool.query('SELECT 1')
    checks.database = { status: 'healthy', latency_ms: Date.now() - dbStart }
  } catch (err) {
    checks.database = { status: 'unhealthy', error: err.message }
    healthy = false
  }

  // Check Redis
  const redisStart = Date.now()
  try {
    const pong = await redis.ping()
    if (pong !== 'PONG') throw new Error(`unexpected response: ${pong}`)
    checks.redis = { status: 'healthy', latency_ms: Date.now() - redisStart }
  } catch (err) {
    checks.redis = { status: 'unhealthy', error: err.message }
    healthy = false
  }

  const body = {
    status: healthy ? 'healthy' : 'unhealthy',
    service: process.env.SERVICE_NAME ?? 'unknown',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    checks,
  }

  res.status(healthy ? 200 : 503).json(body)
})
```

### Worker with Queue Depth and Last Job Time

Workers do not receive HTTP traffic, but they still need a health endpoint. The simplest approach is to run a minimal HTTP server alongside the worker loop.

```javascript
import express from 'express'
import { createClient } from 'redis'

const app = express()
const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

const startTime = Date.now()
let lastJobAt = null
let jobsProcessed = 0

// Your worker loop sets these as it runs
export function recordJobProcessed() {
  lastJobAt = new Date().toISOString()
  jobsProcessed++
}

app.get('/health', async (req, res) => {
  const checks = {}
  let healthy = true

  // Check Redis
  const redisStart = Date.now()
  try {
    await redis.ping()
    checks.redis = { status: 'healthy', latency_ms: Date.now() - redisStart }
  } catch (err) {
    checks.redis = { status: 'unhealthy', error: err.message }
    healthy = false
  }

  // Check queue depth — flag if backlog is growing
  try {
    const depth = await redis.lLen(process.env.QUEUE_NAME)
    const dlqDepth = await redis.lLen(
      process.env.DLQ_NAME ?? `${process.env.QUEUE_NAME}:dlq`
    )
    checks.queue = {
      status: depth < 1000 ? 'healthy' : 'degraded',
      depth,
      dlq_depth: dlqDepth,
    }
    if (dlqDepth > 0) checks.queue.status = 'degraded' // any DLQ entries are worth surfacing
  } catch (err) {
    checks.queue = { status: 'unhealthy', error: err.message }
    healthy = false
  }

  // Check that the worker is actually processing jobs
  const secondsSinceLastJob = lastJobAt
    ? (Date.now() - new Date(lastJobAt).getTime()) / 1000
    : null
  checks.worker = {
    status:
      secondsSinceLastJob === null || secondsSinceLastJob < 60
        ? 'healthy'
        : 'degraded',
    last_job_at: lastJobAt ?? 'never',
    jobs_processed: jobsProcessed,
    seconds_since_last_job: secondsSinceLastJob,
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    service: process.env.SERVICE_NAME ?? 'worker',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    checks,
  })
})

app.listen(process.env.PORT ?? 8080)
```

---

## Implementing `/health` in Python (FastAPI)

### HTTP Service with Database and Redis

```python
import os
import time
import asyncio
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import asyncpg
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.responses import JSONResponse

start_time = time.time()
db_pool: asyncpg.Pool = None
redis_client: aioredis.Redis = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool, redis_client
    db_pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])
    redis_client = aioredis.from_url(os.environ["REDIS_URL"])
    yield
    await db_pool.close()
    await redis_client.aclose()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    checks = {}
    healthy = True

    # Check PostgreSQL
    t = time.monotonic()
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        checks["database"] = {"status": "healthy", "latency_ms": round((time.monotonic() - t) * 1000)}
    except Exception as e:
        checks["database"] = {"status": "unhealthy", "error": str(e)}
        healthy = False

    # Check Redis
    t = time.monotonic()
    try:
        pong = await redis_client.ping()
        if not pong:
            raise RuntimeError("no response")
        checks["redis"] = {"status": "healthy", "latency_ms": round((time.monotonic() - t) * 1000)}
    except Exception as e:
        checks["redis"] = {"status": "unhealthy", "error": str(e)}
        healthy = False

    body = {
        "status": "healthy" if healthy else "unhealthy",
        "service": os.environ.get("SERVICE_NAME", "unknown"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": int(time.time() - start_time),
        "checks": checks,
    }
    return JSONResponse(content=body, status_code=200 if healthy else 503)
```

### Worker with Queue Depth and Last Job Time

```python
import os
import time
import asyncio
import threading
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import redis

start_time = time.time()
last_job_at: float | None = None
jobs_processed: int = 0

def record_job_processed():
    global last_job_at, jobs_processed
    last_job_at = time.time()
    jobs_processed += 1

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404)
            self.end_headers()
            return

        r = redis.from_url(os.environ["REDIS_URL"])
        checks = {}
        healthy = True

        # Check Redis
        t = time.monotonic()
        try:
            r.ping()
            checks["redis"] = {"status": "healthy", "latency_ms": round((time.monotonic() - t) * 1000)}
        except Exception as e:
            checks["redis"] = {"status": "unhealthy", "error": str(e)}
            healthy = False

        # Queue depth
        try:
            queue_name = os.environ["QUEUE_NAME"]
            dlq_name = os.environ.get("DLQ_NAME", f"{queue_name}:dlq")
            depth = r.llen(queue_name)
            dlq_depth = r.llen(dlq_name)
            checks["queue"] = {
                "status": "degraded" if depth >= 1000 or dlq_depth > 0 else "healthy",
                "depth": depth,
                "dlq_depth": dlq_depth,
            }
        except Exception as e:
            checks["queue"] = {"status": "unhealthy", "error": str(e)}
            healthy = False

        # Worker liveness
        seconds_since = round(time.time() - last_job_at) if last_job_at else None
        checks["worker"] = {
            "status": "healthy" if seconds_since is None or seconds_since < 60 else "degraded",
            "last_job_at": datetime.fromtimestamp(last_job_at, timezone.utc).isoformat() if last_job_at else "never",
            "jobs_processed": jobs_processed,
            "seconds_since_last_job": seconds_since,
        }

        body = json.dumps({
            "status": "healthy" if healthy else "unhealthy",
            "service": os.environ.get("SERVICE_NAME", "worker"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": int(time.time() - start_time),
            "checks": checks,
        }).encode()

        self.send_response(200 if healthy else 503)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # suppress access logs for health checks

def start_health_server(port: int = 8080):
    server = HTTPServer(("", port), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
```

---

## Wiring Health Checks into Docker Compose

Docker Compose has a built-in `healthcheck` directive. When configured, `docker compose ps` shows each container's health status, and other services can wait for a healthy state before starting.

### Adding a healthcheck to a service

```yaml
services:
  order-service:
    build: ./order-service
    environment:
      DATABASE_URL: postgres://app:secret@order-db:5432/orders
      REDIS_URL: redis://redis:6379
      SERVICE_NAME: order-service
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 10s # how often to run the check
      timeout: 5s # how long to wait for a response
      retries: 3 # mark unhealthy after this many consecutive failures
      start_period: 15s # grace period while the service is starting up
    depends_on:
      order-db:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### Adding a healthcheck to PostgreSQL

```yaml
order-db:
  image: postgres:16
  environment:
    POSTGRES_DB: orders
    POSTGRES_USER: app
    POSTGRES_PASSWORD: secret
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U app -d orders']
    interval: 5s
    timeout: 5s
    retries: 5
    start_period: 10s
```

### Adding a healthcheck to Redis

```yaml
redis:
  image: redis:7-alpine
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 5s
    timeout: 3s
    retries: 5
```

### Full example with startup ordering

With `condition: service_healthy` on `depends_on`, Docker Compose will not start a service until its dependency passes its health check. This prevents the common failure mode where a service starts, cannot reach its database, crashes, and has to be restarted.

```yaml
services:
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

  order-db:
    image: postgres:16
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d orders']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  order-service:
    build: ./order-service
    # no ports: — reach services from Holmes by service name; Caddy handles external traffic
    environment:
      DATABASE_URL: postgres://app:secret@order-db:5432/orders
      REDIS_URL: redis://redis:6379
      SERVICE_NAME: order-service
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    depends_on:
      order-db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped # restart automatically if the process crashes
```

`restart: unless-stopped` means Docker will restart a crashed container automatically. Combined with a health check that can mark a container unhealthy, your system becomes self-healing for common transient failures (a brief network blip, a database restart).

---

## Monitoring System Health

### Checking status with `docker compose ps`

Once your services have `healthcheck` configured, `docker compose ps` shows the health status of each container:

```
NAME                      STATUS                   PORTS
order-service-1           Up 4 minutes (healthy)
order-service-2           Up 4 minutes (healthy)
order-service-3           Up 2 minutes (starting)
restaurant-service-1      Up 4 minutes (healthy)
order-db-1                Up 5 minutes (healthy)
redis-1                   Up 5 minutes (healthy)
dispatch-worker-1         Up 4 minutes (healthy)
caddy-1                   Up 4 minutes
```

`(healthy)` means the last health check passed. `(unhealthy)` means it has failed `retries` times in a row. `(starting)` means the `start_period` grace window has not yet elapsed.

### Watching health events in real time

```bash
# Stream Docker health events as they happen
docker events --filter event=health_status

# Example output:
# 2025-04-14T10:31:02 container health_status order-service-1 (status=healthy)
# 2025-04-14T10:31:45 container health_status dispatch-worker-1 (status=unhealthy)
```

### Polling all `/health` endpoints with a watchdog script

The following script polls every service's health endpoint on a fixed interval and prints a summary. Run it inside Holmes while your system is under load — Holmes is on the same Docker network as your services and can reach them by service name without any host port mappings.

```bash
docker compose exec holmes bash /workspace/scripts/watchdog.sh
```

**`scripts/watchdog.sh`**

```bash
#!/usr/bin/env bash
# Usage: run from Holmes — docker compose exec holmes bash /workspace/scripts/watchdog.sh
# Polls all /health endpoints every 5 seconds and prints a colour-coded summary.

SERVICES=(
  "order-service|http://order-service:8000/health"
  "restaurant-service|http://restaurant-service:8000/health"
  "driver-service|http://driver-service:8000/health"
  "dispatch-worker|http://dispatch-worker:8000/health"
  "notification-worker|http://notification-worker:8000/health"
)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

while true; do
  clear
  echo "=== System Health $(date '+%H:%M:%S') ==="
  for entry in "${SERVICES[@]}"; do
    name="${entry%%|*}"
    url="${entry##*|}"

    response=$(curl -s -o /tmp/health_body -w "%{http_code}" --max-time 3 "$url" 2>/dev/null)
    if [[ "$response" == "200" ]]; then
      status=$(cat /tmp/health_body | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null)
      echo -e "  ${GREEN}✓${RESET} $name ($status)"
    elif [[ "$response" == "503" ]]; then
      details=$(cat /tmp/health_body | python3 -c "
import sys, json
d = json.load(sys.stdin)
bad = [k for k,v in d.get('checks',{}).items() if v.get('status') != 'healthy']
print('failing: ' + ', '.join(bad))
" 2>/dev/null)
      echo -e "  ${RED}✗${RESET} $name (unhealthy — $details)"
    else
      echo -e "  ${YELLOW}?${RESET} $name (no response — HTTP $response)"
    fi
  done
  sleep 5
done
```

**`scripts/watchdog.js`** (Node.js alternative)

```javascript
#!/usr/bin/env node
// Usage: run from Holmes — docker compose exec holmes node /workspace/scripts/watchdog.js
// Polls all /health endpoints every 5 seconds and prints a colour-coded summary.

const SERVICES = [
  { name: 'order-service', url: 'http://order-service:8000/health' },
  { name: 'restaurant-service', url: 'http://restaurant-service:8000/health' },
  { name: 'driver-service', url: 'http://driver-service:8000/health' },
  { name: 'dispatch-worker', url: 'http://dispatch-worker:8000/health' },
  {
    name: 'notification-worker',
    url: 'http://notification-worker:8000/health',
  },
]

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

async function checkAll() {
  process.stdout.write('\x1Bc') // clear terminal
  console.log(`=== System Health ${new Date().toLocaleTimeString()} ===`)

  await Promise.all(
    SERVICES.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
        const body = await res.json()
        if (res.status === 200) {
          console.log(`  ${GREEN}✓${RESET} ${name} (${body.status})`)
        } else {
          const failing = Object.entries(body.checks ?? {})
            .filter(([, v]) => v.status !== 'healthy')
            .map(([k]) => k)
            .join(', ')
          console.log(
            `  ${RED}✗${RESET} ${name} (unhealthy — failing: ${failing})`
          )
        }
      } catch (err) {
        console.log(
          `  ${YELLOW}?${RESET} ${name} (no response — ${err.message})`
        )
      }
    })
  )
}

checkAll()
setInterval(checkAll, 5000)
```

---

## What Healthy Looks Like

When your entire system is running correctly, every service returns HTTP 200 with all checks green, `docker compose ps` shows `(healthy)` for every container, and the watchdog shows all ticks. Here is what to look for sprint by sprint.

**Sprint 1 — baseline**
All three core services healthy. Each reports its database check as healthy. Redis check is healthy. No queue checks yet.

**Sprint 2 — async pipelines**
Workers appear in the watchdog output. Queue depth checks are present. After a burst of requests you can watch the queue depth rise and fall in the worker health responses as the worker catches up.

**Sprint 3 — poison pills**
The DLQ depth check is non-zero after injecting bad messages. The worker health check shows `"dlq_depth": 4` (or however many pills you injected). The worker itself remains healthy — it did not crash. Good messages continue flowing, and `jobs_processed` keeps incrementing.

**Sprint 4 — replicas**
Running `docker compose up --scale order-service=3` produces three entries in `docker compose ps`. The watchdog should show all three healthy. Kill one with `docker stop <id>` and watch it flip to `(unhealthy)` or disappear while the others remain green.

---

## Common Problems and What They Look Like

| Symptom                                             | Likely cause                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database: unhealthy, "connection refused"`         | Service started before its database was ready. Add `depends_on: condition: service_healthy` and a `healthcheck` to the database container.                                                              |
| `redis: unhealthy, "connection refused"`            | Redis container is not running or the `REDIS_URL` environment variable is wrong. Check `docker compose ps` and your env config.                                                                         |
| Worker shows `seconds_since_last_job: 180`          | Worker is alive but not consuming the queue. Check that the queue name in the worker matches the name the producer is pushing to.                                                                       |
| `dlq_depth` keeps growing                           | Poison pills are arriving faster than expected, or the dead letter logic has a bug that routes valid messages to the DLQ. Inspect the DLQ contents with `redis-cli LRANGE <dlq-name> 0 9`.              |
| Service flips between `(healthy)` and `(unhealthy)` | Intermittent database connectivity — often caused by the database being under heavy load. Check whether your database container has enough memory and whether connection pool limits are set correctly. |
| All replicas show `(unhealthy)` simultaneously      | Shared dependency is down — Redis or a database. The problem is not the service itself.                                                                                                                 |
