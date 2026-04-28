---
layout: layouts/prj.njk
title: Project → Sprint 03 Demo Guide
permalink: /spring-2026/sprints/03/demo/
---

# Sprint 3 Demo Guide - Reliability and Poison Pills

_COMPSCI 426 Scalable Web Systems - Spring 2026_

_Demo window: Apr 28, 2026 → Apr 30, 2026_

---

## How Demos Work

This document is shared between teams and TAs. It describes exactly what will happen during every Sprint 3 demo. Read it together before you schedule.

**The team drives the demo. The TA observes and asks questions.**

The team runs every command. The TA does not touch the keyboard. The TA's job is to watch, probe, and score.

- Demos are **25 minutes maximum**
- Teams that exceed 25 minutes will be cut off by their TA reviewer
- TA reviewers that keep teams longer than 25 minutes should be reported by the teams
- Teams should practice beforehand - especially the DLQ injection sequence

---

## Before the Demo

**Teams must complete these steps before contacting a TA to schedule.**

1. Tag the sprint commit on your main branch:

   ```bash
   git tag sprint-3
   git push origin sprint-3
   ```

2. Verify the tag exists on GitHub before reaching out. If the tag is missing when the TA checks, the demo cannot proceed and the team loses points.

3. Every team member must be present. If someone cannot attend, notify the TA in advance.

4. Prepare demo scripts - it is **strongly recommended** that your team write shell scripts for the DLQ injection sequence and failure scenarios rather than typing commands live. You save time and avoid typos.

   **Be prepared to show your TA reviewer the contents of those scripts to verify authenticity.**

---

## Systems Demo Guides

Review the shared demo procedure and scoring rubric first, then find your system section. Teaching staff should review all five system sections for the teams they are evaluating.

1. [Demo Procedure (All Systems)](#demo-procedure-all-systems)
2. [Scoring Rubric (All Systems)](#scoring-rubric-all-systems)
3. [System 1: Event Ticketing Platform](#system-1-event-ticketing-platform)
4. [System 2: Food Delivery Coordination](#system-2-food-delivery-coordination)
5. [System 3: Video Processing Pipeline](#system-3-video-processing-pipeline)
6. [System 4: IoT Sensor Monitoring Dashboard](#system-4-iot-sensor-monitoring-dashboard)
7. [System 5: Collaborative Document Workspace](#system-5-collaborative-document-workspace)

---

# Demo Procedure (All Systems)

## Shared Demo Steps

Every demo follows this sequence regardless of which system your team built. System-specific commands and TA question lists follow in each system section.

### Step 1 - Tag Verification (TA) | 0:00–1:00

The TA verifies the following before the demo begins.

**Tag exists on main:**

```bash
git log --oneline sprint-3 -1
```

If the tag is missing, the demo stops here.

**Sprint 3 plan was committed on time:**

```bash
git log --oneline --follow sprint-plans/SPRINT-3-PLAN.md | tail -1
```

Confirm the commit date is on or before 04.21. Note it but do not stop the demo over it - flag it in the score sheet.

### Step 2 - Clean Checkout and Startup (Team) | 1:00–5:00

The team clones the repository fresh, checks out the tag, and brings the system up. No pre-running containers, no uncommitted local changes.

```bash
git clone <your-repo-url>
cd <repo-name>
git checkout sprint-3
docker compose up --build
```

The team narrates the startup. The TA watches for services that fail to start or require manual intervention. If the system does not come up cleanly from this sequence, the demo stops.

Once up, show every container is healthy:

```bash
docker compose ps
```

Every container must show `(healthy)`. If any container shows `(unhealthy)` or is restarting, the TA notes it before continuing.

### Step 3 - DLQ Proof (Team) | 5:00–12:00

This is the core Sprint 3 deliverable. The team demonstrates that every worker routes unprocessable messages to the dead letter queue instead of crashing or retrying forever.

**The team will:**

1. Open a terminal watching worker logs:

   ```bash
   docker compose logs -f <worker-name>
   ```

2. Inject a poison pill directly into one of the team's queues from inside the Holmes container:

   ```bash
   docker compose exec holmes bash
   redis-cli -h redis RPUSH <queue-name> '{"broken_field": null}'
   ```

3. Point to the log line showing the worker caught the error and routed to the DLQ - not a crash, not a retry loop.

4. Verify the DLQ received the message:

   ```bash
   redis-cli -h redis LLEN <queue-name>:dlq
   # Must be >= 1
   ```

5. Hit the worker's `/health` endpoint and show `dlq_depth` is non-zero. Run this from inside Holmes using the Docker Compose service name, not localhost:

   ```bash
   curl -s http://<service-name>:<port>/health | jq
   ```

   The expected shape:

   ```json
   {
     "redis": "healthy",
     "queue": {
       "status": "degraded",
       "depth": 0,
       "dlq_depth": 1
     },
     "last_job_at": "2026-04-28T10:15:00Z",
     "jobs_processed": 5
   }
   ```

   `queue.status: "degraded"` is the correct and expected signal - it means poison pills have been routed to the DLQ. The worker itself is functioning normally. If `queue.status` still reads `"healthy"` after injecting pills, DLQ routing is not wired up.

6. Send a valid good message and show the worker still processes it normally. The DLQ depth should not grow; the queue depth should drain.

Repeat this sequence for **at least two different workers** (e.g., dispatch worker and notification worker). The team narrates each step.

### Step 4 - Failure Scenarios (Team) | 12:00–19:00

The team demonstrates at least three failure scenarios from their system. For each scenario the team:

- States what failure input they are about to send
- Sends it
- Shows where the system handles it gracefully (logs, DLQ depth, database state)
- Confirms no dangling state was left behind

Failure scenarios are system-specific. See your system section below for the expected scenarios. The TA will prompt: _"Walk me through what happens in your system when..."_

### Step 5 - k6 Resilience Test (Team) | 19:00–23:00

```bash
k6 run /workspace/k6/sprint-3-poison.js
```

Run this from inside the Holmes container, where `/workspace` is the mounted repo root. While the test runs, poll the worker health endpoint in a second Holmes shell (`docker compose exec holmes bash`):

```bash
while true; do curl -s http://<service-name>:<port>/health | jq; sleep 2; done
```

The team narrates:

- The DLQ depth climbing as poison pills arrive
- Good request success rates staying high throughout
- Worker status remaining `healthy` (never `degraded` due to crashes)
- What the p95 latency for good requests looks like - and why it does or does not spike

The TA notes whether the DLQ depth is non-zero after the test completes.

### Step 6 - TA Questions | 23:00–25:00

The TA asks questions from the system-specific list below. Any team member may be called on. Keep answers focused - you have two minutes.

---

## Scoring Rubric (All Systems)

Sprint 3 is worth **100 points** using the following rubric. The rubric is identical across all five systems; the TA applies it to what they observe during the demo.

| Area                   | Points | What full credit looks like                                                                                                                                                                                                       |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DLQ handling**       | 30     | Every worker has dead letter queue handling. Injecting a poison pill causes `dlq_depth` to increment in `/health`. Worker status remains `healthy`. Good messages continue flowing after poison pills arrive.                     |
| **Complete system**    | 25     | All services and workers from the chosen system are running. `docker compose ps` shows every container `(healthy)`. Every service exposes a working `GET /health` endpoint.                                                       |
| **Failure scenarios**  | 20     | At least three failure scenarios are handled gracefully and demonstrated live. No dangling state after failures. No crash loops.                                                                                                  |
| **k6 resilience test** | 15     | `k6/sprint-3-poison.js` runs without errors. Good request success rates stay high throughout. DLQ depth is non-zero after the test. Worker throughput does not collapse.                                                          |
| **README and report**  | 10     | README is accurate for all services. Sprint report documents what each person built with specific directory and file ownership backed by commit history. Failure scenarios described with evidence (logs, DLQ depth screenshots). |

Teaching staff may award half credit for a deliverable that is partially working - for example, DLQ routing works for one worker but not all, or failure scenarios are handled but the team cannot explain the mechanism.

---

# System 1: Event Ticketing Platform

## DLQ Injection Commands

The team runs this sequence during Step 3. Replace port numbers with what your team actually uses.

**Dispatch worker - poison pill:**

```bash
# From inside Holmes
docker compose exec holmes bash
redis-cli -h redis RPUSH ticket:purchase:dispatch '{"broken_field": null}'
```

Watch the Purchase Dispatch Worker catch the error and route to the DLQ:

```bash
docker compose logs -f purchase-dispatch-worker
redis-cli -h redis LLEN ticket:purchase:dispatch:dlq
curl -s http://<dispatch-worker>:<port>/health | jq '.queue'
```

**Notification worker - poison pill:**

```bash
redis-cli -h redis RPUSH ticket:notification '{"event_id": null, "user_id": null}'
docker compose logs -f notification-worker
redis-cli -h redis LLEN ticket:notification:dlq
curl -s http://<notification-worker>:<port>/health | jq '.queue'
```

**Good message after poison pills:**

```bash
redis-cli -h redis RPUSH ticket:purchase:dispatch \
  '{"purchase_id":"demo-001","user_id":"user-1","event_id":1,"seat":"A12"}'
# Worker should process it; DLQ depth should not grow
```

## Failure Scenarios to Demonstrate

Demonstrate all three. The team narrates what the failure input is, what the system does, and where evidence appears.

**Scenario 1 - Payment failure leaves no dangling reservation**

Send a purchase request through the API using a payment method that will fail (use a test card or a flag your team added for demos). Show that after the payment failure:

- The seat `A12` is not marked as reserved in the database
- No orphaned reservation record exists

```bash
# From inside Holmes
# Trigger a payment failure
curl -s -X POST http://<purchase-service>:<port>/purchases \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-1","event_id":1,"seat":"A12","payment_method":"fail-card"}' | jq

# Confirm seat is still available
curl -s http://<purchase-service>:<port>/events/1/seats | jq
```

**Scenario 2 - Waitlist entry for a nonexistent event goes to DLQ**

```bash
redis-cli -h redis RPUSH ticket:waitlist \
  '{"user_id":"user-2","event_id":99999,"timestamp":"2026-04-28T10:00:00Z"}'
docker compose logs -f waitlist-worker
redis-cli -h redis LLEN ticket:waitlist:dlq
# DLQ depth increments; worker status stays healthy
```

**Scenario 3 - Duplicate fraud detection event is handled without double-flagging**

Send the same purchase event to the fraud detection worker twice. Show the worker processes the first and skips (or safely ignores) the second without creating a duplicate fraud alert.

```bash
# Inject the same message twice
redis-cli -h redis RPUSH ticket:fraud \
  '{"purchase_id":"demo-dup-001","user_id":"user-3","event_id":1,"amount":500}'
redis-cli -h redis RPUSH ticket:fraud \
  '{"purchase_id":"demo-dup-001","user_id":"user-3","event_id":1,"amount":500}'
docker compose logs -f fraud-detection-worker
# Only one fraud alert record should exist
```

## TA Questions - System 1

- A payment fails after a seat is reserved. Walk me through every state change that must be rolled back and exactly where in the code that rollback happens.
- The Waitlist Worker encounters a waitlist entry for an event that no longer exists. How does it know the event is gone - does it query the database, or is the event ID validated when the entry is first created?
- Your Fraud Detection Worker processes the same purchase ID twice. What is the exact mechanism that prevents two fraud alert records?
- The Notification Worker's DLQ is filling up. How would you inspect the DLQ contents to diagnose what kind of messages are failing?
- After injecting five poison pills into the dispatch queue, a team member sends a valid purchase. Does it process immediately, or is it stuck behind the DLQ messages?

---

# System 2: Food Delivery Coordination

## DLQ Injection Commands

**Order dispatch worker - poison pill:**

```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH orders:dispatch '{"broken_field": null}'
docker compose logs -f order-dispatch-worker
redis-cli -h redis LLEN orders:dispatch:dlq
curl -s http://<dispatch-worker>:<port>/health | jq '.queue'
```

**Notification worker - poison pill:**

```bash
redis-cli -h redis RPUSH orders:notification '{"order_id": null}'
docker compose logs -f notification-worker
redis-cli -h redis LLEN orders:notification:dlq
curl -s http://<notification-worker>:<port>/health | jq '.queue'
```

**Good message after poison pills:**

```bash
redis-cli -h redis RPUSH orders:dispatch \
  '{"order_id":"demo-002","restaurant_id":"rest-1","items":["burger"],"user_id":"user-1"}'
# Worker should process normally; confirm driver is assigned in logs
```

## Failure Scenarios to Demonstrate

**Scenario 1 - Order for a nonexistent restaurant goes to DLQ**

```bash
# From inside Holmes
curl -s -X POST http://<order-service>:<port>/orders \
  -H "Content-Type: application/json" \
  -d '{"restaurant_id":"00000000-0000-0000-0000-000000000000","items":["pizza"],"idempotency_key":"demo-bad-rest"}' | jq

# The API accepts it (202); the dispatch worker validates and routes to DLQ
docker compose logs -f order-dispatch-worker
redis-cli -h redis LLEN orders:dispatch:dlq
```

**Scenario 2 - Driver assignment failure does not orphan the order**

Simulate a driver assignment failure (mock the Driver Service to return an error, or use a test flag). Show that after the failure:

- The order is not stuck in an invisible "assigned" state
- The order either retries with backoff or routes to the DLQ - it does not disappear

```bash
docker compose logs -f order-dispatch-worker
# From inside Holmes
curl -s http://<order-service>:<port>/orders/<order-id> | jq '.status'
# Status should reflect the failure state, not "assigned"
```

**Scenario 3 - Duplicate delivery confirmation is tolerated**

Send the same delivery confirmation event twice to the notification worker. Show that only one notification is sent and no duplicate delivery record is created.

```bash
redis-cli -h redis RPUSH orders:notification \
  '{"order_id":"demo-003","event":"delivery_confirmed","driver_id":"driver-1"}'
redis-cli -h redis RPUSH orders:notification \
  '{"order_id":"demo-003","event":"delivery_confirmed","driver_id":"driver-1"}'
docker compose logs -f notification-worker
# Only one notification log line for order demo-003
```

## TA Questions - System 2

- The Order Dispatch Worker picks up an order but cannot find a driver. Exactly what state is the order left in, and how would an operator recover it?
- An order references a restaurant ID that does not exist in your database. Walk me through how the dispatch worker detects that and how quickly it routes to the DLQ - does it call the Restaurant Service, or is it a direct DB lookup?
- The Notification Worker receives the same delivery confirmation twice. What is the mechanism that suppresses the duplicate notification?
- The Surge Pricing Worker applies a surcharge to an order. What prevents it from applying the surcharge twice if the same event is delivered twice?
- After seeing ten poison pills, is your Order Dispatch Worker still able to process valid orders at the same throughput? How do you know?

---

# System 3: Video Processing Pipeline

## DLQ Injection Commands

**Transcode worker - poison pill:**

```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH video:transcode '{"broken_field": null}'
docker compose logs -f transcode-worker
redis-cli -h redis LLEN video:transcode:dlq
curl -s http://<transcode-worker>:<port>/health | jq '.queue'
```

**Search index worker - poison pill:**

```bash
redis-cli -h redis RPUSH video:search:index '{"upload_id": null, "title": null}'
docker compose logs -f search-index-worker
redis-cli -h redis LLEN video:search:index:dlq
curl -s http://<search-index-worker>:<port>/health | jq '.queue'
```

**Good message after poison pills:**

```bash
redis-cli -h redis RPUSH video:transcode \
  '{"upload_id":"upload-demo-001","filename":"lecture.mp4","duration_seconds":120,"user_id":"user-1"}'
docker compose logs -f transcode-worker
# Should process and publish transcode:complete
```

## Failure Scenarios to Demonstrate

**Scenario 1 - Transcode job for a deleted upload goes to DLQ**

Insert a transcode job referencing an upload ID that does not exist in the database:

```bash
redis-cli -h redis RPUSH video:transcode \
  '{"upload_id":"00000000-0000-0000-0000-000000000000","filename":"ghost.mp4","user_id":"user-2"}'
docker compose logs -f transcode-worker
redis-cli -h redis LLEN video:transcode:dlq
# DLQ grows; worker status stays healthy
```

**Scenario 2 - Duplicate transcode request produces the same output**

Submit the same upload twice and show the transcode worker is idempotent - it processes once and returns the same output for the second request without creating a second transcode record.

```bash
# From inside Holmes
# First submission
curl -s -X POST http://<upload-service>:<port>/uploads \
  -H "Content-Type: application/json" \
  -d '{"filename":"demo.mp4","duration_seconds":60,"file_hash":"abc123","user_id":"user-3"}' | jq

# Same file_hash - must return existing upload record
curl -s -X POST http://<upload-service>:<port>/uploads \
  -H "Content-Type: application/json" \
  -d '{"filename":"demo.mp4","duration_seconds":60,"file_hash":"abc123","user_id":"user-3"}' | jq

docker compose logs -f transcode-worker
# Only one transcode job should have run for file_hash abc123
```

**Scenario 3 - Moderation rejection is handled without leaving the video visible**

Simulate the Moderation Worker rejecting a video (use a test flag or inject a moderation failure event). Show that after rejection:

- The video is not visible via the Catalog Service
- The transcode output is not served

```bash
# Inject a moderation:rejected event or trigger via your test flag
docker compose logs -f moderation-worker
# From inside Holmes
curl -s http://<catalog-service>:<port>/videos/<upload-id> | jq '.status'
# Should be "rejected" or 404 - not "available"
```

## TA Questions - System 3

- A transcode job arrives for an upload ID that was deleted between when the job was queued and when the worker picked it up. Exactly how does your worker detect this - does it query the database, check object storage, both?
- The same file is uploaded twice with the same `file_hash`. Where in your stack does the idempotency check happen - at the API, inside the Transcode Worker, or both?
- The Moderation Worker rejects a video. How does the Catalog Service learn the video is now unavailable? Is this a synchronous update, a pub/sub event, or a polling mechanism?
- Three workers (Thumbnail, Search Index, Moderation) all react to `transcode:complete`. If the Search Index Worker is slow, does it block the Thumbnail Worker? Explain the fan-out mechanism.
- After ten transcode poison pills, is your Thumbnail Worker still healthy? Does it share a queue with the Transcode Worker or have its own?

---

# System 4: IoT Sensor Monitoring Dashboard

## DLQ Injection Commands

**Storage worker - poison pill:**

```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH sensor:ingestion '{"broken_field": null}'
docker compose logs -f storage-worker
redis-cli -h redis LLEN sensor:ingestion:dlq
curl -s http://<storage-worker>:<port>/health | jq '.queue'
```

**Anomaly detection worker - poison pill:**

```bash
redis-cli -h redis RPUSH sensor:anomaly '{"sensor_id": null, "value": null}'
docker compose logs -f anomaly-detection-worker
redis-cli -h redis LLEN sensor:anomaly:dlq
curl -s http://<anomaly-detection-worker>:<port>/health | jq '.queue'
```

**Good message after poison pills:**

```bash
redis-cli -h redis RPUSH sensor:ingestion \
  '{"sensor_id":"sensor-001","timestamp":"2026-04-28T10:00:00Z","temperature":22.5,"humidity":60,"pressure":1013}'
docker compose logs -f storage-worker
# Should batch-write to Readings DB; DLQ depth should not grow
```

## Failure Scenarios to Demonstrate

**Scenario 1 - Reading from an unregistered sensor goes to DLQ**

```bash
redis-cli -h redis RPUSH sensor:ingestion \
  '{"sensor_id":"sensor-UNREGISTERED","timestamp":"2026-04-28T10:00:00Z","temperature":99.9,"humidity":50,"pressure":1010}'
docker compose logs -f storage-worker
redis-cli -h redis LLEN sensor:ingestion:dlq
# DLQ grows; worker does not crash
```

**Scenario 2 - Duplicate reading with same sensor ID and timestamp is ignored**

```bash
# From inside Holmes
# First reading
curl -s -X POST http://<ingestion-service>:<port>/readings \
  -H "Content-Type: application/json" \
  -d '{"sensor_id":"sensor-001","timestamp":"2026-04-28T10:00:00Z","temperature":22.5,"humidity":60,"pressure":1013}' | jq

# Exact duplicate - acknowledged but not re-queued
curl -s -X POST http://<ingestion-service>:<port>/readings \
  -H "Content-Type: application/json" \
  -d '{"sensor_id":"sensor-001","timestamp":"2026-04-28T10:00:00Z","temperature":22.5,"humidity":60,"pressure":1013}' | jq

# Queue length must not have grown by 2
docker compose exec redis redis-cli LLEN sensor:ingestion
```

**Scenario 3 - Alert worker handles missing sensor configuration gracefully**

Inject an anomaly event for a sensor whose configuration (thresholds) cannot be fetched. Show the alert worker routes to the DLQ instead of crashing, and continues processing readings from registered sensors.

```bash
redis-cli -h redis RPUSH sensor:anomaly \
  '{"sensor_id":"sensor-NOCFG","value":999,"timestamp":"2026-04-28T10:01:00Z"}'
docker compose logs -f anomaly-detection-worker
redis-cli -h redis LLEN sensor:anomaly:dlq
# Sensor-NOCFG message in DLQ; valid sensor anomaly still processes
```

## TA Questions - System 4

- A reading arrives from a sensor ID that is not in the Sensor Registry. Where does the worker look up the registry - is it a direct DB call, a call to the Sensor Registry Service, or cached in Redis? What does the cache miss path look like?
- A duplicate reading comes in with the same sensor ID and timestamp. What is the exact key used for deduplication - where is it stored (Redis, database, both)?
- The Anomaly Detection Worker caches sensor thresholds in Redis. A threshold is updated in the Sensor Registry. When does the cached threshold refresh?
- The Storage Worker writes in batches. How large is the batch, and what triggers a flush? If the worker is killed mid-batch, what happens to the unflushed readings?
- After you injected poison pills for unregistered sensors, did your dashboard still show live data from registered sensors? How do you know the worker kept processing?

---

# System 5: Collaborative Document Workspace

## DLQ Injection Commands

**Export worker - poison pill:**

```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH document:export '{"broken_field": null}'
docker compose logs -f export-worker
redis-cli -h redis LLEN document:export:dlq
curl -s http://<export-worker>:<port>/health | jq '.queue'
```

**Notification worker - poison pill:**

```bash
redis-cli -h redis RPUSH document:notification '{"document_id": null, "event": null}'
docker compose logs -f notification-worker
redis-cli -h redis LLEN document:notification:dlq
curl -s http://<notification-worker>:<port>/health | jq '.queue'
```

**Good message after poison pills:**

```bash
redis-cli -h redis RPUSH document:export \
  '{"export_id":"exp-demo-001","document_id":"doc-001","format":"pdf","requested_by":"user-1"}'
docker compose logs -f export-worker
# Should process and produce output; DLQ depth should not grow
```

## Failure Scenarios to Demonstrate

**Scenario 1 - Export request for a deleted document goes to DLQ**

```bash
redis-cli -h redis RPUSH document:export \
  '{"export_id":"exp-ghost-001","document_id":"00000000-0000-0000-0000-000000000000","format":"pdf","requested_by":"user-1"}'
docker compose logs -f export-worker
redis-cli -h redis LLEN document:export:dlq
# DLQ grows; worker status stays healthy
```

**Scenario 2 - Notification worker tolerates duplicate "document updated" events**

Send the same document update event twice and show only one notification is dispatched, with no duplicate revision snapshot.

```bash
redis-cli -h redis RPUSH document:notification \
  '{"document_id":"doc-001","event":"document_updated","version":7,"updated_by":"user-2"}'
redis-cli -h redis RPUSH document:notification \
  '{"document_id":"doc-001","event":"document_updated","version":7,"updated_by":"user-2"}'
docker compose logs -f notification-worker
# Only one notification dispatched for version 7
```

**Scenario 3 - Search indexing handles a deleted document gracefully**

Inject a search index event for a document that has since been deleted. Show the Search Index Worker routes to the DLQ or safely no-ops rather than crashing.

```bash
redis-cli -h redis RPUSH document:search:index \
  '{"document_id":"00000000-0000-0000-0000-000000000000","event":"document_updated"}'
docker compose logs -f search-index-worker
redis-cli -h redis LLEN document:search:index:dlq
# Routes to DLQ; worker continues processing valid index events
```

## TA Questions - System 5

- The Export Worker picks up a job for a document that was deleted between when the job was queued and when the worker ran. What is the exact sequence of checks - does it validate before processing, mid-process, or after?
- The Notification Worker receives the same `document_updated` event twice. What is the deduplication key - document ID plus version, something else?
- Three workers subscribe to `document:updated` events (Revision, Notification, Search Index). If the Revision Service is backed up, does it create backpressure for the other two? Explain the pub/sub topology.
- The Auth Service caches permission lookups. A user's write permission is revoked. What is the window during which the stale cached permission could still let them write?
- After injecting poison pills into the export queue, does your Notification Worker still send notifications for normal document updates? How do you show this during the demo?

---

# Scoring Summary

| Area               | Points  |
| ------------------ | ------- |
| DLQ handling       | 30      |
| Complete system    | 25      |
| Failure scenarios  | 20      |
| k6 resilience test | 15      |
| README and report  | 10      |
| **Total**          | **100** |

Points are not partial by default - each area is either demonstrated and explained or it is not. Teaching staff may award half credit for a deliverable that is partially working (e.g., DLQ routing works for one worker but not all, or failure scenarios are handled but the team cannot explain the mechanism).

**Scheduling:** Demos are not held during class. Contact your assigned TA via email to book a 30-minute slot between Apr 28 and Apr 30. Book early - slots fill fast on the last day.
