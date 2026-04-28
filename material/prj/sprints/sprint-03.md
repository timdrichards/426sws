---
layout: layouts/prj.njk
title: Project → Sprint 03
permalink: /spring-2026/sprints/03/
---

# Sprint 3 — Reliability and Poison Pills

**04.21 → 04.28**

Sprint 3 is about making your system handle failure gracefully. Every queue must now have a dead letter queue. Workers that encounter malformed or unprocessable messages must route them to the DLQ instead of crashing or retrying forever. All remaining services and workers from your chosen system must be running by the end of this sprint. You will prove your system's resilience with a k6 test that mixes normal traffic with deliberate poison pills.

---

## Timeline

| Date        | Day      | What Happens                                                                                 |
| ----------- | -------- | -------------------------------------------------------------------------------------------- |
| **04.21**   | Tuesday  | **Sprint 3 Kickoff** — write your Sprint 3 plan and commit it to `main` before leaving class |
| 04.22–04.24 | Wed–Fri  | **Sprint 2 Demo Window** — schedule and complete your Sprint 2 demo with a TA                |
| 04.23       | Thursday | **Sprint 3 Work Session** — in-class work time, instructor and TA check-ins                  |
| **04.28**   | Tuesday  | **Sprint 3 Due before class** — tag `sprint-3`, submit, Sprint 4 kickoff begins              |
| 04.29–05.01 | Wed–Fri  | **Sprint 3 Demo Window** — schedule and complete your demo with a TA                         |

---

## Kickoff Class — 04.21

### 1. Merge and Tag Sprint 2

If you have not already done so, merge `dev` into `main` and tag:

```bash
git checkout main
git pull origin main
git tag sprint-2
git push origin sprint-2
```

Verify the tag from a clean clone before moving on.

### 2. Write Your Sprint 3 Plan

Fill in `sprint-plans/SPRINT-3-PLAN.md` as a team. Sprint 3 has two parallel workstreams: (a) adding poison pill / DLQ handling to every queue and (b) implementing any remaining services and workers from your system. Assign ownership to both.

For Sprint 3, your plan must list:

- Which queues need DLQ handling added, and who owns each
- Which remaining services or workers need to be implemented, and who owns each
- The failure scenarios your system must handle gracefully
- Who owns the `k6/sprint-3-poison.js` test

### 3. Commit the Plan to `main` Before You Leave

```bash
git add sprint-plans/SPRINT-3-PLAN.md
git commit -m "docs: add Sprint 3 plan"
git push origin main
```

### 4. Take Stock of What Is Left

Before splitting into tasks, spend 10 minutes as a team mapping your system diagram (see [Systems](../../docs/systems/)) against what you have already built. Identify:

- Which services are missing entirely?
- Which services are scaffolded but incomplete (missing routes, missing database writes, missing Redis interactions)?
- Which queues have no DLQ handling?

Write this down. It becomes your task list.

---

## How to Approach This Sprint

### Step 1: Add Dead Letter Queue Handling to Every Worker

A **poison pill** is a message your worker cannot process — one that will fail every time it is retried. Without a DLQ, a poison pill either causes the worker to crash in a loop, blocking all subsequent messages, or gets silently dropped. Neither is acceptable.

**The DLQ pattern:**

```
[main queue] → worker tries to process → success → done
                                        → failure (bad data, nonexistent reference) → [dead letter queue]
```

In practice:

1. Your worker pops a message from the main queue.
2. It tries to process the message (validate it, look up references, do the work).
3. If processing raises a known, unrecoverable error (invalid JSON, missing required field, foreign key lookup returns nothing), push the message to the DLQ and continue to the next message.
4. If processing raises an unexpected error (transient network failure, database timeout), consider a short retry with a backoff before sending to the DLQ. Do not retry indefinitely.

**Naming convention:** name your DLQ `<queue-name>:dlq`. For example, if your main queue is `orders:dispatch`, your DLQ is `orders:dispatch:dlq`.

**How to structure this as tasks:**

```
task/dispatch-worker-dlq           Add try/catch around job processing; route bad jobs to DLQ
task/analytics-worker-dlq          Same pattern for the analytics worker
task/notification-worker-dlq       Same pattern for the notification worker
```

Each DLQ task is small — typically adding a try/catch, a validation check, and an `RPUSH` to the DLQ on failure. Do not bundle multiple workers into one branch.

**Update the worker health endpoint:**

Your worker's `GET /health` must now report a non-zero `dlq_depth` when poison pills have been sent. The TA will inject pills and immediately hit `/health` to confirm the DLQ is filling up. If `dlq_depth` is always 0, DLQ routing is not working.

```javascript
const dlqDepth = await redis.lLen(`${process.env.QUEUE_NAME}:dlq`)
checks.queue = {
  status: dlqDepth > 0 ? 'degraded' : 'healthy',
  depth: mainQueueDepth,
  dlq_depth: dlqDepth,
}
```

### Step 2: Implement Remaining Services and Workers

Consult the [Systems](../../docs/systems/) page for your chosen system. Every component listed there must be running by the end of Sprint 3. Sprint 4 is for replication and polish — Sprint 3 is the last chance to add missing functionality.

**Common gaps teams discover in Sprint 3:**

- Workers that exist but have no health endpoint
- Services that are running but not connected to Redis at all
- Pub/sub listeners that were never wired into the worker loop
- Services that exist as stubs returning `{ "status": "ok" }` with no real database writes

For each missing piece, create a focused task branch. Do not try to finish an entire service in one PR.

### Step 3: Handle Failure Scenarios Gracefully

Your system description in [Systems](../../docs/systems/) implies specific failure scenarios your code must handle. These are not edge cases — the TA will test them at the demo.

**Common failure scenarios by system:**

| System                 | Failure scenario to handle                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Event Ticketing        | Payment failure must not leave a dangling seat reservation. Waitlist entry for a nonexistent event goes to DLQ.           |
| Food Delivery          | Order referencing a nonexistent restaurant goes to DLQ. Driver assignment failure must not orphan the order.              |
| Video Processing       | Transcode job for a deleted or invalid upload goes to DLQ. Duplicate transcode requests produce the same output.          |
| IoT Sensor Monitoring  | Reading from an unregistered sensor ID goes to DLQ. Duplicate readings with the same sensor ID and timestamp are ignored. |
| Collaborative Document | Export request for a deleted document goes to DLQ. Notification worker tolerates duplicate "document updated" events.     |

Read your system's description carefully and write down at least three failure scenarios you will demonstrate. Add them to your sprint plan.

### Step 4: Write the Poison Pill k6 Test

`k6/sprint-3-poison.js` is a mixed-traffic test. It sends a combination of valid and deliberately malformed requests to your system. The test must demonstrate:

1. **Normal requests succeed** while poison pills are being processed simultaneously.
2. **Poison pills land in the DLQ** — verify by polling the worker's `/health` endpoint and showing `dlq_depth` increments.
3. **Workers do not crash** — the worker's status in `/health` remains `healthy` even while routing bad messages to the DLQ.
4. **Overall throughput does not collapse** — your p95 response time for good requests should not spike dramatically when poison pills are in the mix.

**Structure of the test:**

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = 'http://localhost:<port>'

// 80% valid requests, 20% poison pills
export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '30s', target: 20 },
    { duration: '10s', target: 0 },
  ],
}

export default function () {
  const isPoisonPill = Math.random() < 0.2

  if (isPoisonPill) {
    // Send a deliberately malformed request
    const res = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        // missing required fields, or reference to a nonexistent ID
        restaurantId: '00000000-0000-0000-0000-000000000000',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    // We expect this to be accepted (HTTP 202) and routed to the DLQ by the worker
  } else {
    // Send a normal, valid request
    const res = http.post(`${BASE_URL}/orders`, JSON.stringify(validOrder()), {
      headers: { 'Content-Type': 'application/json' },
    })
    check(res, {
      'status is 201 or 202': r => r.status === 201 || r.status === 202,
    })
  }

  sleep(0.5)
}
```

---

## Deliverables

Every team must deliver the following by **04.28 before class**.

### Poison Pill / DLQ Handling

- Every worker pipeline has dead letter queue handling
- A malformed or unprocessable message is moved to the DLQ, not retried forever or dropped silently
- The DLQ is named `<queue-name>:dlq`
- After injecting poison pills, the worker's `GET /health` shows a non-zero `dlq_depth` while the worker's own status remains `healthy`
- Workers continue processing good messages after encountering bad ones

### All Services and Workers Running

- All components from your chosen system description are implemented and running
- Every service exposes a working `GET /health` endpoint
- `docker compose ps` shows every container as `(healthy)`

### Failure Scenarios

- At least three specific failure scenarios from your system description are handled gracefully
- These are documented in your sprint report and can be demonstrated live

### k6 Resilience Test

- `k6/sprint-3-poison.js` runs without errors
- Test mixes valid and malformed requests
- Sprint report shows that good requests continue succeeding and that the DLQ fills with poison pills during the test

### README and Sprint Report

- `README.md` updated for all new services and endpoints
- `sprint-reports/SPRINT-3.md` committed to `main` before the sprint tag, including:
  - What each person did with specific directory/file ownership claims
  - k6 results with p50, p95, p99, and RPS for both good and bad traffic
  - Description of at least three failure scenarios and how they are handled
  - DLQ depth screenshots or log evidence

---

## Team Workflow for This Sprint

### Divide the Work Clearly

Sprint 3 has two kinds of work running in parallel: DLQ additions (small, surgical changes to existing workers) and new service implementations (larger, requires planning). Assign these explicitly so each person knows what they own.

A good split for a 6-person team:

- 3 people add DLQ handling to the existing workers (one worker per person)
- 3 people implement the remaining services (one service per person)

Everyone opens their own task branches, submits their own PRs, and gets reviewed by a teammate.

### Test DLQ Routing Before the Demo

Do not wait until the demo to test DLQ routing. Push a malformed message manually from Holmes:

```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH orders:dispatch '{"broken": true}'
```

Then watch the worker logs:

```bash
docker compose logs -f dispatch-worker
```

You should see a log line indicating the message was routed to the DLQ, and within a few seconds:

```bash
redis-cli -h redis LLEN orders:dispatch:dlq
# Should be 1
```

Hit the worker's `/health` endpoint and confirm `dlq_depth` is non-zero. If it is still 0, your DLQ routing is not wired up correctly.

### Verify the Worker Stays Healthy After Poison Pills

After injecting several poison pills, the worker must still report `healthy` in its `GET /health` response. A worker that crashes or becomes `(unhealthy)` after seeing bad messages has not implemented DLQ handling correctly — it is crashing instead of catching the error and routing to the DLQ.

### Keep All Services Integrated

As you add new services, make sure they are wired into `compose.yml` with proper `depends_on` and `healthcheck` directives. A new service that starts before its database is ready will fail and restart in a loop.

---

## Submission

**One team member** submits the GitHub repository URL to the **Sprint 3** assignment on Canvas before class on 04.28.

Before submitting, tag the commit on your `main` branch:

```bash
git checkout main
git pull origin main
git tag sprint-3
git push origin sprint-3
```

**Verify your tag before the deadline.** Clone into a fresh directory, check out the tag, and run `docker compose up`.

```bash
git clone https://github.com/<your-team>/<your-fork>.git verify-test
cd verify-test
git checkout sprint-3
docker compose up
```

Code pushed after the tag does not count for this sprint.

---

## Grading

Sprint 3 is worth **10% of the team project grade**. The following rubric is used at the demo.

| Area                   | Points | Criteria                                                                                                                                                                                                                                  |
| ---------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DLQ handling**       | 30     | Every worker has dead letter queue handling. Injecting a poison pill causes `dlq_depth` to increment in the worker's `/health` response. The worker's status remains `healthy`. Good messages continue flowing after poison pills arrive. |
| **Complete system**    | 25     | All services and workers from the chosen system are running. `docker compose ps` shows every container `(healthy)`. Every service has a working `GET /health` endpoint.                                                                   |
| **Failure scenarios**  | 20     | At least three failure scenarios are handled gracefully and demonstrated live. No dangling state after failures. No crash loops.                                                                                                          |
| **k6 resilience test** | 15     | `k6/sprint-3-poison.js` runs without errors. Sprint report shows good requests succeeded throughout. DLQ depth is non-zero after the test. Worker throughput did not collapse.                                                            |
| **README and report**  | 10     | README is accurate. Sprint report documents what each person built, with commit-backed ownership. Failure scenarios are described with evidence.                                                                                          |

**Total: 100 points**

---

## For Teaching Staff

### Before the Demo

1. Confirm the team submitted a GitHub repository URL to Canvas.
2. Confirm the `sprint-3` tag exists on the `main` branch: `git log --oneline sprint-3 -1`
3. Confirm `sprint-plans/SPRINT-3-PLAN.md` was committed on or before 04.21.
4. Note which services and workers from the team's chosen system are now expected to be running.

### At the Demo

Clone the repo fresh. Do not use a cached local copy.

```bash
git clone <repo-url> sprint3-demo
cd sprint3-demo
git checkout sprint-3
docker compose up --build
```

**DLQ handling (30 pts)**

From Holmes, inject a poison pill directly into one of the team's queues:

```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH <queue-name> '{"broken_field": null}'
```

Watch the worker logs:

```bash
docker compose logs -f <worker-name>
```

Then check the DLQ depth:

```bash
redis-cli -h redis LLEN <queue-name>:dlq
```

Hit the worker's `/health` endpoint and verify `dlq_depth` is non-zero and status is still `healthy`. Send several more poison pills and verify good messages still flow.

**Complete system (25 pts)**

```bash
docker compose ps
```

Every service and worker in the team's system description should show `(healthy)`. For each service, from Holmes:

```bash
curl http://<service-name>:<port>/health | jq .
```

**Failure scenarios (20 pts)**

Ask the team to demonstrate at least three failure scenarios from their system. For each:

- What is the failure input?
- What does the system do instead of crashing?
- Where does the evidence of handling appear (logs, DLQ depth, database state)?

**k6 resilience test (15 pts)**

```bash
k6 run /workspace/k6/sprint-3-poison.js
```

Verify the test runs without errors. During the run, periodically hit the worker's `/health` endpoint to show `dlq_depth` incrementing. After the run, verify that good request success rates stayed high.

**README and report (10 pts)**

- README documents all services and how to start the system
- Sprint report lists what each person owned with specific directories backed by commit history
- Deduct points if a person's commits do not touch the directories they claimed

### Scheduling

Demos are **not** held during class. Ask teams to contact you via email to schedule a 30-minute slot between 04.29 and 05.01. Book slots in advance so you are not flooded with last-minute requests.
