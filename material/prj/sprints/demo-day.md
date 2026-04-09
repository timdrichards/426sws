---
layout: layouts/prj.njk
title: Project → Demo Day
permalink: /spring-2026/demo-day/
---

# Demo Day — 05.07

The final class session is a **project expo**. Instead of teams presenting one at a time to a passive audience, every team sets up a station simultaneously. Classmates and course staff rotate through the room, stopping at each station to see the system run, ask questions, and leave feedback. The format rewards teams that built something they can genuinely show — not just talk about.

---

## Format

Demo Day runs as a **science-fair expo**, not a series of presentations.

- Every team sets up a station before class begins (arrive by **9:45 AM**)
- All stations open at **10:00 AM** when class starts
- Students rotate freely — visit as many stations as you can during the session
- Teaching staff rotates on a fixed schedule to grade each station
- Stations close at **11:15 AM**
- The last 15 minutes are for whole-class reflection and wrap-up

Each team has a **table** with their laptop running the system, a printed architecture diagram, and whatever else they choose to bring. Two to three team members staff the station at any given time. The rest of the team is free to visit other stations — and is expected to.

---

## Who Staffs the Station

Every team designates **two to three members** to staff the station throughout the expo. The other team members should spend the session visiting other teams' stations, asking questions, and completing peer feedback.

**Rotating your team through the session is encouraged.** If your team has six people, you might have two people staff for the first half and two different people for the second half. Everyone should be able to explain the system — the TA could show up at any moment.

**Everyone is evaluated individually** on their ability to explain the system. Teaching staff may stop by when the "usual" explainers are not at the station. Do not send only your strongest speakers to staff.

---

## What to Bring to Your Station

Your station should have **at least two physical artifacts** that help visitors understand your system without reading your code. Bring things a person can look at while you talk.

### Required: Architecture Diagram (Printed)

Print your system architecture diagram on paper — at minimum 11×17 inches, larger if possible. The diagram must show:

- Every service and worker, labeled by name
- Every database, labeled by which service owns it
- Redis, with arrows showing which services read/write from it and what they use it for (cache, queue, pub/sub)
- Caddy and which services it fronts
- Numbered arrows for the key request flows (e.g., "① User places order → Order Service → ② Payment Service → ③ Redis queue → ④ Dispatch Worker")

This diagram is what you point at while you talk. Visitors should be able to follow a request flow through the system by reading the diagram alone. Use color: one color for HTTP calls, another for Redis interactions, another for database reads/writes.

You made design decisions — this is where they become visible.

### Required: k6 Results Summary (Printed)

Print a one-page summary of your k6 results across all four sprints. Include:

| Sprint | Test                  | p50    | p95    | p99    | RPS  |
| ------ | --------------------- | ------ | ------ | ------ | ---- |
| 1      | Baseline (no cache)   |        |        |        |      |
| 2      | With Redis cache      |        |        |        |      |
| 2      | Async pipeline burst  |        |        |        |      |
| 3      | Poison pill resilience|        |        |        |      |
| 4      | Single instance       |        |        |        |      |
| 4      | 3 replicas            |        |        |        |      |
| 4      | Replica failure       |        |        |        |      |

Annotate the numbers — do not just print the table. Add a one-sentence observation next to each row: "Adding the Redis cache reduced p95 from 380ms to 42ms — every read was hitting the database before." Numbers without context tell visitors nothing.

### Suggested: One Additional Artifact

Bring one more physical item that tells part of your story. Pick something that reflects what was interesting or hard about your system. Suggestions:

- **A printed "request journey" walkthrough** — one full request traced step by step through every service and queue it touches, with the exact Redis commands and database queries it triggers. Good for systems with complex pipelines (IoT sensor reading, video upload, ticket purchase).
- **A "what went wrong" card** — a 5×7 index card listing the three hardest bugs you hit during the project and how you fixed them. Visitors and TAs find this more interesting than a polished success story.
- **A printed sequence diagram** of your most complex async pipeline (producer → queue → worker → pub/sub → second worker). Draw it by hand or use a tool — just print it.
- **A failure mode map** — a small table listing every failure scenario you handle in Sprint 3, what triggers it, and what your system does instead of crashing. Good for teams that want to highlight their DLQ work.
- **A team decision log** — a single printed page listing the five biggest technical decisions you made (e.g., "we chose Redis pub/sub over a queue for notifications because...") and why you made them.

The artifact does not need to be fancy. A hand-drawn diagram on paper is fine. Printed Google Docs are fine. What matters is that there is something on the table a visitor can look at and learn from.

---

## What You Will Demonstrate

When teaching staff visit your station, they will ask you to show the system running. Prepare a **five-minute demo script** that hits the following beats in order. Practice it before 05.07.

### 1. Start the System (30 seconds)

Show that the system starts from a clean state:

```bash
docker compose up --scale order-service=3 --scale restaurant-service=3
```

(Use the exact `--scale` command from your README.)

While it starts, point to the architecture diagram and explain what is coming up. Do not stare at the terminal waiting.

### 2. Show All Services Healthy (30 seconds)

```bash
docker compose ps
```

Walk the visitor through the output. Every container should show `(healthy)`. Point to the services on your architecture diagram as you name them.

### 3. Walk Through One Request End-to-End (90 seconds)

Pick your most interesting end-to-end flow — not the simplest one, the most illustrative one. Trigger it from Holmes:

```bash
docker compose exec holmes bash
curl -X POST http://order-service:8000/orders \
  -H "Content-Type: application/json" \
  -d '{ ... }' | jq .
```

While the request runs, narrate what is happening:

- "The Order Service is validating the restaurant ID with a synchronous call to the Restaurant Service."
- "Now it's pushing a message onto the dispatch queue in Redis."
- "Watch the Dispatch Worker logs — it should pick this up in a moment."

Switch to the worker logs:

```bash
docker compose logs -f dispatch-worker
```

The visitor should see the message flow through the pipeline live. Point to the relevant arrows on your architecture diagram.

### 4. Show the Redis Cache Working (30 seconds)

Make the same GET request twice. Show the response times — the second should be faster because it hits the cache:

```bash
curl -w "\nTime: %{time_total}s\n" http://order-service:8000/restaurants/123
curl -w "\nTime: %{time_total}s\n" http://order-service:8000/restaurants/123
```

Or show it from `redis-cli MONITOR` so the visitor can see the GET/SET commands.

### 5. Show DLQ Handling (30 seconds)

Inject a poison pill:

```bash
redis-cli -h redis RPUSH orders:dispatch '{"broken": true}'
```

Hit the worker's `/health` endpoint and show `dlq_depth` is non-zero while the worker status is still `healthy`. "The worker saw this, knew it could not process it, and routed it to the dead letter queue without crashing."

### 6. Show Replication (60 seconds)

Point to `docker compose ps` showing three replicas. Make several requests through Caddy and show that different replicas are handling them:

```bash
docker compose logs order-service | grep "GET /orders"
```

Different container names should appear in the log output.

---

## How Other Students Visit Your Station

When visiting another team's station, you are not just watching — you are evaluating for the peer feedback form. For each station you visit, you will fill out a short form (distributed at the start of class) with:

- Team name and system they built
- One thing that impressed you about their system
- One question you asked and how they answered it
- One thing you would have done differently

You need to visit **at least three other teams** during the session. Peer feedback forms are due at the end of class.

**Good questions to ask other teams:**

- "What was the hardest part of your system to get right?"
- "How does your idempotency implementation work?"
- "What happens if the Dispatch Worker crashes mid-job?"
- "Why did you choose pub/sub instead of a queue here?"
- "What surprised you most about running this under load?"
- "What would you change if you had another sprint?"

---

## Grading at the Demo

Teaching staff will visit every station. The grading rubric is the same as the Sprint 4 rubric (see [Sprint 4](sprint-04/)), applied at the demo.

When staff arrive at your station:

- **Do not** just hand them a laptop and step back. Walk them through the demo script.
- **Do** point to the architecture diagram as you explain things. It shows you understand the system, not just the code.
- **Do** have the k6 summary visible so you can reference numbers during the conversation.
- **Do not** read from a script. Explain it the way you would explain it to a friend.
- **Do** be honest if something is not working. "This part broke on Friday and we did not have time to fix it, but here is what it was supposed to do" is a better answer than pretending a broken demo is intentional.

Every team member who is present must be able to answer questions. If a TA asks you how your DLQ handling works and you say "I don't know, that was someone else's part," that reflects on your individual grade. You should understand your whole system, not just your own service.

---

## Day-of Timeline

| Time     | What Happens                                                                              |
| -------- | ----------------------------------------------------------------------------------------- |
| 9:45 AM  | Teams arrive, set up stations, start the system, confirm everything is healthy            |
| 10:00 AM | Expo opens — all stations open simultaneously                                             |
| 10:00–11:15 | Teaching staff rotates through stations; students visit other teams                  |
| 11:15 AM | Expo closes — stations tear down                                                          |
| 11:15–11:30 | Whole-class reflection and wrap-up                                                   |
| End of day | Peer evaluations due on Canvas                                                        |

**Arrive by 9:45 AM.** If your system is not running by 10:00 AM, you lose time for your demo. There is no setup grace period — teaching staff begin rotating at 10:00 AM sharp.

---

## Setup Checklist

Complete this before class starts on 05.07:

- [ ] Clone from the `sprint-4` tag into a fresh directory and confirm `docker compose up --scale ...` starts cleanly
- [ ] `docker compose ps` shows every container `(healthy)`
- [ ] Architecture diagram is printed (at least 11×17 inches)
- [ ] k6 results summary is printed with annotations
- [ ] Third artifact (your choice) is ready
- [ ] Demo script is practiced — you can do the five-minute walk-through without looking at notes
- [ ] Every team member can explain the whole system, not just their own service
- [ ] Peer feedback forms — pick up from the instructor at the start of class
- [ ] Peer evaluations are ready to submit on Canvas (due end of day)

---

## What Makes a Good Station

The best stations share a few things in common:

**The system actually runs.** This sounds obvious, but teams that spend the whole session explaining why it is not working will not score well. Start your laptop at 9:45 and stay at a working state until 11:15.

**The presenters know the whole system.** Visitors ask unexpected questions. If the person staffing the station only knows their own service, the conversation dies quickly. Read your teammates' code before Demo Day.

**The diagram does the heavy lifting.** When a visitor walks up, you can hand them the diagram before saying a word. A good diagram lets someone understand your system in 60 seconds. A bad one forces you to explain everything verbally.

**The numbers tell a story.** The k6 summary should show a clear arc: baseline was slow, caching helped, replication helped more. If your numbers do not show improvement, you need to explain why — "we discovered our bottleneck was the payment service, not the database" is a fine answer if it is true.

**The team is honest about what went wrong.** Every team had something go sideways. The teams that handle this well say "we ran out of time to implement X, but here is how it would have worked" or "this bug cost us two days — here is what we learned." That is more impressive than a polished demo of a simpler system.
