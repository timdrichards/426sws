---
layout: layouts/prj.njk
title: Project → Sprint 02
permalink: /spring-2026/sprints/02/
---

# Sprint 2 — Async Pipelines and Caching

**04.14 → 04.21**

Sprint 2 adds the async backbone of your system. By the end of this sprint, your core services must be reading from a Redis cache (instead of hitting the database on every request), at least one background worker must be consuming messages from a queue and doing something useful, and at least one write path must be idempotent. You will also measure the cache speedup with k6 and stress-test your async pipeline under burst load.

---

## Timeline

| Date        | Day      | What Happens                                                                                 |
| ----------- | -------- | -------------------------------------------------------------------------------------------- |
| **04.14**   | Tuesday  | **Sprint 2 Kickoff** — write your Sprint 2 plan and commit it to `main` before leaving class |
| 04.15–04.17 | Wed–Fri  | **Sprint 1 Demo Window** — schedule and complete your Sprint 1 demo with a TA                |
| 04.16       | Thursday | **Sprint 2 Work Session** — in-class work time, instructor and TA check-ins                  |
| **04.21**   | Tuesday  | **Sprint 2 Due before class** — tag `sprint-2`, submit, Sprint 3 kickoff begins              |
| 04.22–04.24 | Wed–Fri  | **Sprint 2 Demo Window** — schedule and complete your demo with a TA                         |

---

## Kickoff Class — 04.14

The first half of class is your Sprint 1 submission deadline; the second half is Sprint 2 kickoff. Before you leave:

### 1. Merge and Tag Sprint 1

If you have not already done so:

```bash
git checkout main
git pull origin main
git tag sprint-1
git push origin sprint-1
```

Verify the tag points to a working commit — clone it fresh in a new directory and run `docker compose up`. If it does not start cleanly, fix it before submitting.

### 2. Write Your Sprint 2 Plan

Fill in `sprint-plans/SPRINT-2-PLAN.md` as a team. Assign explicit ownership for every component you plan to build this sprint. Be specific: "I own `order-service/`" is graded; "I'll help with caching" is not.

For Sprint 2, your plan must list:

- Which service will have a Redis cache added, and who owns it
- Which async pipeline you are implementing first (producer service + queue + worker)
- Which write path will be made idempotent, and how
- Who owns the two k6 tests

### 3. Commit the Plan to `main` Before You Leave

```bash
git add sprint-plans/SPRINT-2-PLAN.md
git commit -m "docs: add Sprint 2 plan"
git push origin main
```

The commit timestamp is checked. A plan committed after 04.14 is considered retroactive.

### 4. Agree on Integration Points

Before everyone heads off to their task branches, agree as a team on the interface contracts your async pipeline depends on:

- What is the **name of the Redis queue**? (e.g., `orders:queue`, `transcode:jobs`)
- What is the **JSON shape of the message**? (Write it down. Both the producer and consumer must agree.)
- What is the **name of the pub/sub channel** if you are using pub/sub?
- When does your worker need to be running so the producer can test against it?

Write these down in your sprint plan under "Service Interfaces."

---

## How to Approach This Sprint

### Step 1: Add a Redis Cache to Your Main Read Endpoint

Pick the read endpoint that gets the most traffic — the one you ran your Sprint 1 k6 baseline against. Add a Redis cache in front of it.

The pattern is:

1. On each request, check Redis for the resource by its ID (or list key).
2. If found (cache hit), return the cached value immediately — no database query.
3. If not found (cache miss), query the database, store the result in Redis with a reasonable TTL (e.g., 60 seconds), and return it.

**How to structure this as tasks:**

Break the cache work into two or three task branches, not one giant PR:

```
task/event-catalog-redis-cache-layer      Add the cache read/write logic (hit → return, miss → populate)
task/event-catalog-cache-ttl              Set TTL and invalidation on writes/updates
task/event-catalog-health-cache-check     Add Redis check to GET /health
```

**Watch out for:**

- Cache stampede: if 50 requests come in for the same uncached resource at the same time, all 50 will miss and query the database. For Sprint 2 this is acceptable — you do not need to solve this yet.
- TTL too long: stale data is confusing during demos. A 30–60 second TTL is enough to show the cache working.
- Not actually using the cache: run `redis-cli MONITOR` (inside Holmes: `docker compose exec holmes redis-cli -h redis MONITOR`) and confirm you see `GET` and `SET` commands while your k6 test runs.

### Step 2: Implement an Async Pipeline

An async pipeline has three parts: a **producer** that pushes a message, a **queue or pub/sub channel** in Redis, and a **worker** that consumes and processes.

**Decide: queue or pub/sub?**

Use a **Redis queue** (RPUSH / BLPOP) when only one consumer should process each message — for example, a single Analytics Worker that accumulates stats, or a single Dispatch Worker that assigns a driver. Use **Redis pub/sub** (PUBLISH / SUBSCRIBE) when multiple consumers should each receive every message — for example, a Notification Worker and an Analytics Worker both need to see every purchase.

**Typical flow:**

1. A service endpoint receives a request (e.g., POST /purchases, POST /orders, POST /uploads).
2. After writing to its database, the service pushes a message onto a Redis queue or publishes to a channel.
3. The worker runs in a loop: consume one message, process it, log a structured result, repeat.

**How to structure this as tasks:**

```
task/order-service-queue-producer     Push to Redis queue after successful order write
task/dispatch-worker-consumer         BLPOP loop: consume, call Driver Service, publish dispatched event
task/dispatch-worker-health           GET /health with queue depth, DLQ depth, last_job_at
```

**Logging in workers:**

Your worker must log what it is doing in a format a TA can read in `docker compose logs`. Use structured JSON:

```javascript
console.log(
  JSON.stringify({
    event: 'job_processed',
    jobId: job.id,
    queueDepth: remainingDepth,
    processingTimeMs: elapsed,
    timestamp: new Date().toISOString(),
  })
)
```

The TA will literally scroll through `docker compose logs dispatch-worker` during the demo. Make it readable.

### Step 3: Make a Write Path Idempotent

Pick one write endpoint that accepts a unique key from the client — a purchase request with an `idempotencyKey`, an order with a client-generated `id`, or a video upload with a `fileHash`. Make that endpoint idempotent: if the same key arrives twice, return the original result without creating a duplicate record.

The standard pattern is:

1. Accept the idempotency key in the request body or header.
2. Before inserting, check whether a record with that key already exists in the database.
3. If it exists, return the existing record with HTTP 200 (or 409, depending on your design).
4. If it does not exist, insert the new record and return HTTP 201.

This can be done with a unique constraint on the key column, which lets the database enforce the invariant:

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  ...
);
```

Then in your handler, catch the unique constraint violation and return the existing record.

### Step 4: Worker Health Endpoint

Every worker needs a `GET /health` endpoint that reports its current state. This is how the TA sees the pipeline working during the demo. The endpoint must include:

- Redis connectivity check
- Current queue depth (`depth`)
- Current dead letter queue depth (`dlq_depth`) — even if DLQ handling is not complete, add the key now with a value of 0
- Timestamp of the last successfully processed job (`last_job_at`)
- Count of jobs processed (`jobs_processed`)

See [Health Endpoints](../../docs/health/) for implementation examples. Run a minimal HTTP server alongside your worker loop — this is not optional.

---

## Deliverables

Every team must deliver the following by **04.21 before class**.

### Redis Cache

- At least one service reads from Redis before querying the database
- Cache misses populate Redis with a TTL
- `redis-cli MONITOR` (from Holmes) shows `GET` and `SET` commands during a k6 run
- The cached service's `GET /health` includes a Redis check

### Async Pipeline

- At least one service pushes messages to a Redis queue or pub/sub channel after a write
- At least one worker consumes those messages and does something useful (logs output, writes to a database, calls another service)
- Workers log structured output visible in `docker compose logs`
- The full pipeline works end-to-end and can be demonstrated live

### Idempotent Write Path

- At least one write endpoint accepts an idempotency key
- Sending the same request twice returns the same result without creating duplicate data
- This can be demonstrated with a simple `curl` in the demo

### Worker Health Endpoints

- Every worker exposes `GET /health`
- The response includes Redis status, queue depth, DLQ depth (even if 0), and last job timestamp
- `docker compose ps` shows every worker as `(healthy)`

### k6 Tests

Two tests are required this sprint:

**`k6/sprint-2-cache.js`** — run the same endpoint as your Sprint 1 baseline, now with caching enabled. Your sprint report must include a side-by-side comparison of the Sprint 1 and Sprint 2 numbers.

**`k6/sprint-2-async.js`** — fire a burst of write requests that trigger your async pipeline. Verify the pipeline keeps up. Include queue depth readings (from the worker's `/health` endpoint) taken during the test.

Both tests must:

- Ramp up to at least 20 virtual users over 30 seconds
- Sustain load for at least 30 seconds
- Report p50, p95, p99 response times and requests per second

### README and Sprint Report

- `README.md` updated to document new endpoints and how to run the new k6 tests
- `sprint-reports/SPRINT-2.md` committed to `main` before the sprint tag, including:
  - What each person did with specific directory/file ownership claims
  - k6 results with a before-and-after caching comparison
  - Explanation of what changed and why the numbers look the way they do

---

## Team Workflow for This Sprint

### Avoid the "One Giant Branch" Trap

Sprint 2 is the sprint where teams most often try to add too many things in a single PR. Resist this. A PR that adds the Redis cache, the async pipeline, the worker, and the idempotent write all at once is unreviable and untestable. Break each concern into its own task branch.

### Keep `dev` Green

Every PR that merges into `dev` should leave the system in a working state. If someone's PR breaks `docker compose up`, it blocks everyone. Before opening a PR, verify:

```bash
docker compose up --build
docker compose ps   # all services (healthy)
curl http://localhost:<port>/health | jq .
```

### Coordinate Queue Names Early

The person building the producer and the person building the consumer must agree on the queue name and message schema before writing any code. Put both in your sprint plan. A producer pushing to `orders:new` while the consumer reads from `order-queue` is a common and embarrassing bug.

### Use `docker compose logs -f <service>` During Integration

When you are testing the pipeline end-to-end, watch the worker logs in real time:

```bash
docker compose logs -f dispatch-worker
```

You should see log lines appear within a few seconds of posting to the producer endpoint.

---

## Submission

**One team member** submits the GitHub repository URL to the **Sprint 2** assignment on Canvas before class on 04.21.

Before submitting, tag the commit on your `main` branch:

```bash
git checkout main
git pull origin main
git tag sprint-2
git push origin sprint-2
```

**Verify your tag before the deadline.** Clone into a fresh directory, check out the tag, and run `docker compose up`. If it does not start cleanly from that checkout, it will not work for the TA.

```bash
git clone https://github.com/<your-team>/<your-fork>.git verify-test
cd verify-test
git checkout sprint-2
docker compose up
```

Code pushed after the tag does not count for this sprint.

---

## Grading

Sprint 2 is worth **10% of the team project grade**. The following rubric is used at the demo.

| Area               | Points | Criteria                                                                                                                                                                                           |
| ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redis cache**    | 25     | At least one service reads from Redis before the database. Cache hits and misses are visible via `redis-cli MONITOR` or equivalent. The service's `/health` reports Redis as healthy.              |
| **Async pipeline** | 25     | A service pushes to a queue or pub/sub channel; a worker consumes and processes. The pipeline works end-to-end, demonstrated live. Worker logs show structured output.                             |
| **Idempotency**    | 20     | At least one write endpoint handles duplicate requests without creating duplicates. Demonstrated live with `curl`.                                                                                 |
| **Worker health**  | 15     | Every worker's `/health` reports queue depth, DLQ depth, and last job timestamp. `docker compose ps` shows all workers `(healthy)`. Queue depth visibly changes during a burst test.               |
| **k6 results**     | 15     | Both `sprint-2-cache.js` and `sprint-2-async.js` run without errors. Sprint report includes a before/after caching comparison with p50, p95, p99, and RPS. Results are explained, not just pasted. |

**Total: 100 points**

---

## For Teaching Staff

### Before the Demo

1. Confirm the team submitted a GitHub repository URL to Canvas.
2. Confirm the `sprint-2` tag exists on the `main` branch: `git log --oneline sprint-2 -1`
3. Confirm `sprint-plans/SPRINT-2-PLAN.md` was committed on or before 04.14.

### At the Demo

Clone the repo fresh. Do not use a cached local copy.

```bash
git clone <repo-url> sprint2-demo
cd sprint2-demo
git checkout sprint-2
docker compose up --build
```

**Redis cache (25 pts)**

From Holmes, run the k6 cache test and watch `redis-cli MONITOR`:

```bash
docker compose exec holmes bash
redis-cli -h redis MONITOR &
k6 run /workspace/k6/sprint-2-cache.js
```

Confirm GET and SET commands appear. Ask the team to show the Sprint 1 vs Sprint 2 numbers in their report. If p95 did not improve, the cache is not being used correctly — ask them to explain.

**Async pipeline (25 pts)**

Ask the team to trigger the pipeline live. Watch `docker compose logs -f <worker>` while they POST a request to the producer endpoint. The worker logs should show a processed job within a few seconds. Verify the worker's `/health` endpoint shows `last_job_at` updated.

**Idempotency (20 pts)**

Ask the team to send the same request twice using the same idempotency key:

```bash
curl -X POST http://<service>:<port>/<endpoint> \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey": "test-key-123", ...}'
```

Run it twice. Verify the database does not have duplicate records.

**Worker health (15 pts)**

Hit every worker's `/health` endpoint from Holmes. Verify queue depth, DLQ depth, and last job timestamp are present. During the async pipeline k6 test, hit `/health` mid-run and show that `depth` is non-zero, then decreases as the worker catches up.

**k6 results (15 pts)**

```bash
k6 run /workspace/k6/sprint-2-cache.js
k6 run /workspace/k6/sprint-2-async.js
```

Both should run without errors. Sprint report should include the output and a brief explanation of what changed between Sprint 1 and Sprint 2.

### Scheduling

Demos are **not** held during class. Ask teams to contact you via email or course to schedule a 30-minute slot between 04.22 and 04.24. Book slots in advance so you are not flooded with last-minute requests.
