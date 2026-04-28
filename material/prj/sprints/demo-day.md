---
layout: layouts/prj.njk
title: Project → Demo Day
permalink: /spring-2026/demo-day/
---

# Demo Day — 05.07

The final class session is a **project expo**. Every team sets up a station and every student visits every other team. You will see each system run live, ask questions, and submit a reflection for each visit. Teaching staff rotate independently to grade each station.

---

## Format and Rotation

Demo Day runs as a **structured rotation**, not a free-for-all. A rotation schedule will be distributed at the start of class showing exactly which station each group visits in each round.

- Every team sets up before class (arrive by **9:45 AM**)
- All stations open at **10:00 AM**
- Visiting rounds are **10–12 minutes each** — a signal marks each transition
- Teaching staff rotate on their own fixed schedule to grade each station
- Expo closes at **11:15 AM**
- 11:15–11:30 is whole-class reflection and rankings submission

Each team splits in half for each round: **half the team staffs** the station while **the other half visits**. Teams should swap halves partway through so every team member spends time both staffing and visiting.

**Everyone must be able to explain the full system.** Teaching staff may arrive at any moment and will call on whoever is present.

---

## What to Prepare

Teams need three things at their station. Nothing else is required.

### 1. System Architecture Diagram

Display your architecture diagram on one laptop (or printed, if you prefer). The diagram must show:

- Every service and worker, labeled by name
- Every database, labeled by which service owns it
- Redis, with arrows showing which services use it and for what (cache, queue, pub/sub)
- Caddy and which services it fronts
- The key request flows with numbered arrows

The diagram is what you point at while you talk. A visitor should be able to follow a request through your system by reading the diagram alone.

### 2. Running System

Run your system on a second laptop, starting from a clean state before the expo opens:

```bash
git clone <your-repo>
cd <repo-name>
git checkout sprint-4
docker compose up --scale <service>=3 --build
docker compose ps   # every container must show (healthy)
```

Use the exact `--scale` command documented in your README. If the system is not healthy by 10:00 AM, you lose time for your demo.

### 3. Team Cheat Sheet

Prepare a one-page cheat sheet — one per team member — that each person can keep at the station or in their pocket while visiting other teams. It should cover the parts of the system each teammate owns: the key endpoints, queue names, Redis keys, and any non-obvious design decisions. You will not always be standing next to the person who built a given service. When a visitor or teaching staff member asks about it, the cheat sheet is what lets you answer accurately without guessing.

The cheat sheet does not need to be formatted or printed professionally. A handwritten index card is fine. What matters is that every person can answer questions about every part of the system, including the parts they did not personally build.

---

## What to Demonstrate

When a visitor or teaching staff arrives at your station, walk them through the following in order. Each system section below gives the specific commands. Aim for **8–10 minutes**.

Multiple teams in the class may have built the same system. That does not make your demo generic. Use the overview step to explain what makes your implementation specific: which parts you simulated and how, which design choices your team made, and what tradeoffs you considered. A visitor who has already seen another team's version of the same system should leave yours with a clear sense of what was different.

### All Systems — Core Sequence

**0. System overview (1–2 minutes)**

Before touching the terminal, give the visitor a one-paragraph orientation using the architecture diagram:

- What is this system? What does it simulate, and for whom? (e.g., "We built a food delivery platform — restaurants, customers, and drivers are all simulated, but the coordination between them is real.")
- What are the major parts? Walk the diagram from left to right or top to bottom, naming each service in one sentence.
- What did your team choose to simulate, and how? Many components in this system cannot be real in a course project — payments, video transcoding, sensor hardware, email delivery. Tell the visitor what you simulated and the mechanism: a configurable delay, a random pass rate, a stub that returns a canned response.
- What is one design decision your team made that another team might have made differently? This could be a queue topology choice, a caching strategy, how you structured idempotency keys, or how you handled a particular failure mode.

This overview is not a slide presentation. It is a two-minute conversation while pointing at the diagram.

**1. Show the system is healthy (30 seconds)**

```bash
docker compose ps
```

Every container shows `(healthy)`. Point to each service on your architecture diagram as you name it.

**2. Walk through one end-to-end flow (3–4 minutes)**

Pick your most illustrative flow — not the simplest one. Trigger it live and narrate each step as it happens. Point to the relevant arrows on your architecture diagram. Show the async part: "Watch the worker logs — it should pick this up now."

**3. Show the Redis cache working (1 minute)**

Make the same GET request twice and show the second is faster. Or show `redis-cli MONITOR` so the visitor can see the GET/SET commands live.

**4. Inject a poison pill and show DLQ routing (2 minutes)**

```bash
redis-cli -h redis RPUSH <your-queue> '{"broken": true}'
```

Show the worker catches it, routes it to the dead letter queue, and keeps running. Hit `/health` and show `dlq_depth` is non-zero while `status` is still `healthy`.

**5. Show replication (1 minute)**

Make several requests through Caddy and show different replicas handling them:

```bash
docker compose logs <service> | grep "GET /"
# Different container names should appear
```

---

## System-Specific Demo Checklists

Find your system below. These are the flows to demonstrate and the commands that are expected to work. Practice each one before 05.07.

---

### System 1: Event Ticketing Platform

**Flows to demonstrate:**

1. **Browse and cache** — fetch a popular event twice; show Redis cache hit on the second request
2. **Ticket purchase** — submit a purchase through the Ticket Purchase Service; narrate the synchronous call to Payment Service; watch the Notification Worker log the confirmation via pub/sub
3. **Waitlist promotion** — inject a waitlist entry; show the Waitlist Worker promote the next user when a seat is released
4. **Poison pill** — inject a malformed entry into the waitlist queue; show DLQ routing and healthy worker status
5. **Replication** — send several requests through Caddy; show different replicas in logs

**Poison pill command:**
```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH ticket:waitlist '{"broken": true}'
docker compose logs -f waitlist-worker
redis-cli -h redis LLEN ticket:waitlist:dlq
curl -s http://<waitlist-worker>:<port>/health | jq '.queue'
```

**Good questions visitors will ask:**
- A payment fails after a seat is reserved — what state does the system clean up and where?
- How does your idempotency implementation prevent a duplicate ticket purchase?
- What happens if the Notification Worker is slow — does it block the purchase confirmation?
- How does the Fraud Detection Worker know if it has already processed a given purchase ID?
- If the Waitlist Worker crashes mid-promotion, what happens to that waitlist entry?

---

### System 2: Food Delivery Coordination

**Flows to demonstrate:**

1. **Place an order** — submit an order through the Order Service; narrate the synchronous validation call to the Restaurant Service; show the order written to the database
2. **Dispatch pipeline** — watch the Order Dispatch Worker assign a driver; watch the Preparation Tracker Worker begin the countdown; watch the Delivery Tracker Service simulate transit; watch the Notification Worker log each status update
3. **Idempotency** — submit the same order twice with the same idempotency key; show the second request returns the original order without creating a duplicate
4. **Poison pill** — inject an order referencing a nonexistent restaurant; show DLQ routing
5. **Replication** — send several requests through Caddy; show different replicas in logs

**Poison pill command:**
```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH orders:dispatch '{"broken": true}'
docker compose logs -f order-dispatch-worker
redis-cli -h redis LLEN orders:dispatch:dlq
curl -s http://<dispatch-worker>:<port>/health | jq '.queue'
```

**Good questions visitors will ask:**
- The Order Dispatch Worker cannot find a driver — what state is the order left in and how would an operator recover it?
- Walk me through the idempotency implementation: where is the key stored and what does a duplicate request return?
- How does your Surge Pricing Worker prevent applying a surcharge twice to the same restaurant?
- If the Delivery Tracker Service restarts mid-transit, does it lose the simulated position?
- How does the Rating Service invalidate the Restaurant Service's cached menu data?

---

### System 3: Video Processing Pipeline

**Flows to demonstrate:**

1. **Upload** — submit a video upload through the Upload Service; narrate the synchronous quota check against the Quota Service
2. **Transcode pipeline** — watch the Transcode Worker process the job; watch all three downstream workers (Thumbnail, Search Index, Moderation) react to the `transcode:complete` pub/sub event
3. **Catalog cache** — browse the catalog twice; show Redis cache hit on the second request
4. **Idempotency** — upload the same file hash twice; show the second returns the existing record without queuing a second transcode job
5. **Poison pill** — inject a malformed transcode job; show DLQ routing
6. **Replication** — send several browse requests through Caddy; show different replicas in logs

**Poison pill command:**
```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH video:transcode '{"broken": true}'
docker compose logs -f transcode-worker
redis-cli -h redis LLEN video:transcode:dlq
curl -s http://<transcode-worker>:<port>/health | jq '.queue'
```

**Good questions visitors will ask:**
- Three workers all subscribe to `transcode:complete` — if the Search Index Worker is backed up, does it slow down the Thumbnail Worker?
- The same file is uploaded twice with the same hash — where in the stack does the idempotency check happen?
- The Moderation Worker rejects a video — how does the Catalog Service learn it is unavailable?
- What is the Playback Service's deduplication window for view events, and where is that state stored?
- If the Transcode Worker dies mid-job, what happens to that job?

---

### System 4: IoT Sensor Monitoring Dashboard

**Flows to demonstrate:**

1. **Ingest a reading** — POST a sensor reading to the Ingestion Service; show idempotency: same reading with same sensor ID and timestamp submitted twice does not double-queue
2. **Storage pipeline** — watch the Storage Worker batch-write to the Readings DB
3. **Anomaly detection** — post a reading that exceeds a threshold; watch the Anomaly Detection Worker call the Sensor Registry Service for thresholds; watch the Alert Service log the alert
4. **Dashboard cache** — poll the Dashboard API twice for the same sensor; show the first reads from the DB and the second hits Redis
5. **Poison pill** — inject a reading from an unregistered sensor; show DLQ routing
6. **Replication** — send several ingestion requests through Caddy; show different replicas in logs

**Poison pill command:**
```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH sensor:ingestion '{"broken": true}'
docker compose logs -f storage-worker
redis-cli -h redis LLEN sensor:ingestion:dlq
curl -s http://<storage-worker>:<port>/health | jq '.queue'
```

**Good questions visitors will ask:**
- The Anomaly Detection Worker caches sensor thresholds — when does a cache entry expire or refresh if a threshold changes?
- The Storage Worker writes in batches — what triggers a flush, and what happens to readings if the worker is killed mid-batch?
- A reading arrives from a sensor that is not registered — how does the worker know it is unregistered?
- After injecting poison pills for bad sensors, does your dashboard still update for valid sensors? How do you show this?
- How does the Device Management Service notify the Ingestion Service when a new sensor registers?

---

### System 5: Collaborative Document Workspace

**Flows to demonstrate:**

1. **Create and edit a document** — create a document and update it; narrate the synchronous permission check against the Auth Service
2. **Event fan-out** — watch the `document:updated` event trigger the Revision Service snapshot, the Notification Worker, and the Search Service simultaneously via pub/sub
3. **Export pipeline** — request a PDF export; watch the Export Worker pick up the job, call the Document Service for content, and complete
4. **Auth cache** — show a permission lookup hitting Redis on the second request
5. **Poison pill** — inject an export request for a deleted document; show DLQ routing
6. **Replication** — send several document requests through Caddy; show different replicas in logs

**Poison pill command:**
```bash
docker compose exec holmes bash
redis-cli -h redis RPUSH document:export '{"broken": true}'
docker compose logs -f export-worker
redis-cli -h redis LLEN document:export:dlq
curl -s http://<export-worker>:<port>/health | jq '.queue'
```

**Good questions visitors will ask:**
- Three workers subscribe to `document:updated` — walk me through the pub/sub topology and how each worker gets its own copy of the event
- A user's write permission is revoked — what is the window during which the stale cached permission could still allow a write?
- The Export Worker picks up a job for a document that was deleted — how does it detect this?
- The Notification Worker receives the same `document:updated` event twice — what is the deduplication key?
- How does the Activity Feed Worker avoid duplicate feed entries if the same event arrives twice?

---

## Reflection Form

Every student submits a reflection for **each team they visit** on Canvas. The form is due **end of day 05.07**. Here are the exact questions so you know what to observe during your visits.

These questions are also available as a paper form distributed at the start of class.

---

**Team Reflection Form**

*Complete one form per team visited.*

**Team name:** _______________________________________________

**System they built:** _______________________________________________

**1. Did their system run and demonstrate the flows they described?** *(Circle one)*

&nbsp;&nbsp;&nbsp;&nbsp;Yes, fully &nbsp;&nbsp;&nbsp; Partially &nbsp;&nbsp;&nbsp; No

**2. Describe one specific thing about their system that impressed you.** *(2–4 sentences)*

&nbsp;

&nbsp;

**3. Write one question you asked them and summarize their answer.** *(1–3 sentences)*

&nbsp;

&nbsp;

**4. Describe one design decision you would have made differently, and why.** *(1–3 sentences)*

&nbsp;

&nbsp;

**5. Rate this station overall:** *(Circle one)*

&nbsp;&nbsp;&nbsp;&nbsp;1 — Needs improvement &nbsp;&nbsp;&nbsp; 2 — Developing &nbsp;&nbsp;&nbsp; 3 — Meets expectations &nbsp;&nbsp;&nbsp; 4 — Strong &nbsp;&nbsp;&nbsp; 5 — Exceptional

---

**Team Ranking** *(submitted once at the end of the session, not per visit)*

Rank all teams you visited from best (1) to least impressive. Do not include your own team. Each rank must be unique.

| Rank | Team Name |
|------|-----------|
| 1 (Best) | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |
| … | |

Rankings are aggregated across all students to determine the **top 3 teams**, which will be announced during the wrap-up at 11:15 AM. A team's aggregate ranking does not directly affect grades but will be used to recognize the strongest work of the semester.

---

## Grading

Demo Day is worth **10% of the team project grade**, assessed on a 100-point scale.

Teaching staff visit every station during the expo. The rubric below is used at each visit. Scores are finalized based on what is working and demonstrable at the live session — not on reports, plans, or what the system did in a previous sprint.

### Demo Day Rubric

| Area | Points | What Full Credit Looks Like |
|------|--------|-----------------------------|
| **System runs cleanly** | 25 | System starts from the `sprint-4` tag with replicas via `docker compose up --scale`. All containers show `(healthy)`. No manual intervention required to reach a working state. |
| **Architecture diagram** | 15 | Diagram is visible and accurate. Shows every service, database, Redis role, and Caddy. Team references it during the overview and while narrating flows — it does the heavy lifting. |
| **End-to-end demo** | 30 | Team walks through at least one complete request flow live, including the async pipeline component. Narration matches what is happening on screen. Logs, Redis, or database state is shown as evidence. |
| **DLQ and resilience** | 15 | Poison pill is injected live and routed to the dead letter queue without crashing the worker. `/health` shows non-zero `dlq_depth`. System continues processing valid messages after the poison pill. |
| **Questions answered** | 15 | Teaching staff will direct questions to whichever team member is present at the time of the visit — not just the person who built that component. Every person at the station must be able to explain the system overview, identify where a given service lives in the diagram, and describe the team's key design decisions. Answers are accurate, specific, and honest when something did not work. |
| **Total** | **100** | |

**Partial credit** is available when a deliverable is partially working — for example, the demo runs but the DLQ injection crashes the worker rather than routing cleanly.

**Honesty is rewarded.** "This part broke on Friday and we ran out of time, but here is how it was designed to work" earns more credit than a broken demo that the team tries to pass off as working.

---

## Day-of Timeline

| Time | What Happens |
|------|--------------|
| 9:45 AM | Teams arrive, set up stations, start the system, confirm everything is healthy |
| 10:00 AM | Expo opens — all stations open simultaneously, rotation begins |
| 10:00–11:15 | Teaching staff rotate to grade each station; students rotate through all other teams |
| 11:15 AM | Expo closes — rotation ends |
| 11:15–11:30 | Rankings submitted; whole-class reflection and top 3 announcement |
| End of day | Reflection forms and peer evaluations due on Canvas |

**Arrive by 9:45 AM.** Teaching staff begin rotating at 10:00 AM sharp. If your system is not running by then, you lose grading time.

---

## Setup Checklist

Complete this before class starts on 05.07:

- [ ] Clone from the `sprint-4` tag into a fresh directory and confirm `docker compose up --scale ...` starts cleanly
- [ ] `docker compose ps` shows every container `(healthy)`
- [ ] Architecture diagram is ready to display — either on a dedicated laptop or printed
- [ ] Team cheat sheet is prepared and printed — one per person, covering every service's key endpoints, queue names, and design decisions
- [ ] Every person on the team can give the two-minute system overview from scratch: what it simulates, the major parts, what was simulated and how, one design decision the team made
- [ ] Every person on the team can answer questions about services they did not build — use the cheat sheet to study your teammates' work before 05.07
- [ ] Demo script for your system is practiced — you can walk through the 8–10 minute sequence without looking at notes
- [ ] Canvas reflection forms are bookmarked and ready to submit during or after the session
- [ ] Peer evaluations are ready to submit on Canvas (due end of day)
