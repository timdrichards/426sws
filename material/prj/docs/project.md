---
title: COMPSCI 426 - Project -- Guide
navTitle: Guide
navOrder: 2
---

# COMPSCI 426 — Team Project Guide

## Overview

Over the final five weeks of the semester, you will work in a team of 3–6 people to design and build a scalable web system using Docker Compose. Your team will choose one of the five systems described in the systems document. Each system involves multiple services, databases, caches, queues, and workers that communicate with each other — just like the systems we have studied all semester.

The project is organized into **four one-week sprints**. Each sprint has a clear set of deliverables. You will submit working code at the end of every sprint, prove your system's behavior under load with k6 tests, and demo to a TA between sprint classes.

---

## Schedule at a Glance

| Date        | Day          | Session                             | What Happens                                                  |
| ----------- | ------------ | ----------------------------------- | ------------------------------------------------------------- |
| 04.07       | Tuesday      | Project Kickoff                     | Form teams, choose a system, fork the starter repo, write your Sprint 1 plan |
| 04.09       | Thursday     | Sprint 1 Work Session               | In-class work time, instructor and TA check-ins               |
| **04.14**   | **Tuesday**  | **Sprint 1 Due / Sprint 2 Kickoff** | **Sprint 1 submission due before class.** Sprint 2 planning   |
| 04.14–04.16 | Tue–Thu      | Sprint 1 Demo Window                | Schedule and complete your Sprint 1 demo with a TA            |
| 04.16       | Thursday     | Sprint 2 Work Session               | In-class work time, instructor and TA check-ins               |
| **04.21**   | **Tuesday**  | **Sprint 2 Due / Sprint 3 Kickoff** | **Sprint 2 submission due before class.** Sprint 3 planning   |
| 04.21–04.23 | Tue–Thu      | Sprint 2 Demo Window                | Schedule and complete your Sprint 2 demo with a TA            |
| 04.23       | Thursday     | Sprint 3 Work Session               | In-class work time, instructor and TA check-ins               |
| **04.28**   | **Tuesday**  | **Sprint 3 Due / Sprint 4 Kickoff** | **Sprint 3 submission due before class.** Sprint 4 planning   |
| 04.28–04.30 | Tue–Thu      | Sprint 3 Demo Window                | Schedule and complete your Sprint 3 demo with a TA            |
| 04.30       | Thursday     | Sprint 4 Work Session               | In-class work time, instructor and TA check-ins               |
| **05.05**   | **Tuesday**  | **Sprint 4 Due**                    | **Sprint 4 submission due before class.**                     |
| **05.07**   | **Thursday** | **Final Demos / Project Wrap-Up**   | **Live demos to the class.** Peer evaluations due end of day. |

---

## What Is a Sprint?

A sprint is a one-week cycle where your team commits to building a specific piece of your system. Each sprint follows the same rhythm:

1. **Tuesday (start of sprint):** Your team writes a sprint plan and commits it to your repo before leaving class. See [Sprint Plans](#sprint-plans) below for the template and an example. For each team member, the plan must list the specific files and directories they own for this sprint — the services they will implement, the database schemas they will write, and the Redis interactions they are responsible for. This ownership claim is how individual contributions are evaluated, so be precise. "I own `order-service/`" is useful. "I'll help with the backend" is not.
2. **During the week:** Your team builds, tests, and integrates.
3. **Following Tuesday (end of sprint):** You submit your code and sprint report before class. You tag the commit on your main branch as `sprint-1`, `sprint-2`, `sprint-3`, or `sprint-4`.
4. **Between Tuesday and Thursday:** Your team schedules and completes a demo with a TA. The demo is performed by checking out the tagged commit from scratch.

Sprints keep you on track. They prevent the "we'll figure it out at the end" trap that sinks team projects.

---

## Sprint Demos

Demos do **not** happen during class. Instead, your team must **schedule a demo with a TA** during the window between each sprint's Tuesday deadline and the following Thursday class.

### How Demos Work

1. **Before the demo**, make sure your sprint tag is pushed to your repository. The TA will verify that the tag exists on the main branch.
2. **At the demo**, the TA will clone your repository fresh, check out the tag, and run `docker compose up`. Your team walks the TA through the sprint deliverables from that clean checkout. This is not optional — you cannot demo from a local development environment with uncommitted changes.
3. **Every team member** should be present and able to explain any part of the system. If someone cannot attend, let the TA know in advance.
4. **Demos are 10–15 minutes.** Walk through what you built, show it working, run your k6 tests, and answer the TA's questions.

### Tagging Your Submissions

When a sprint is due, you must tag the commit on your main branch:

```bash
git tag sprint-1
git push origin sprint-1
```

Do this **before class on Tuesday**. If the tag is missing or points to a broken commit, your demo cannot proceed and you will lose points.

The tag is your snapshot. It is what gets graded. Code pushed after the tag does not count for that sprint.

---

## Sprint Breakdown

### Sprint 1 — Foundation (04.07 → 04.14)

**Goal:** Get your core services running in Docker Compose and talking to each other. Establish a baseline for performance.

Every team must deliver:

- A `docker-compose.yml` that starts all core services and their databases
- Each core service runs, connects to its own database, and exposes at least one working endpoint (even if it returns placeholder data)
- At least one **synchronous service-to-service HTTP call** works end-to-end (for example, the Order Service calling the Restaurant Service to validate a menu item)
- A Redis container is running and at least one service can connect to it
- Every core service exposes a `GET /health` endpoint that returns HTTP 200 when healthy and HTTP 503 when a dependency is unreachable. The response body must include the status of the database connection and the Redis connection. See [Health Endpoints](../health/) for the required response format and implementation examples.
- Every service in your `docker-compose.yml` has a `healthcheck` directive, and services use `depends_on: condition: service_healthy` so they wait for their databases and Redis to be ready before starting
- A brief `README.md` in your repo explaining how to start the system (`docker compose up`) and what endpoints are available

#### Sprint 1 — k6 Load Test

Write a k6 test script that sends traffic to your main read endpoint (for example, browsing events, listing restaurants, or viewing the video catalog). This is your **baseline measurement** — your system has no caching yet, so every request hits the database.

Your k6 test must:

- Ramp up to at least 20 virtual users over 30 seconds
- Sustain load for at least 30 seconds
- Report response times (p50, p95, p99) and throughput (requests per second)

Save the test script as `k6/sprint-1.js` and include the output in your sprint report. You will compare these numbers against Sprint 2 to show the impact of caching.

**What "done" looks like:** A TA can clone your repo, check out the `sprint-1` tag, run `docker compose up`, and verify that `docker compose ps` shows every service as `(healthy)`. Hitting `GET /health` on each service returns HTTP 200 with a JSON body showing the database and Redis checks passing. The synchronous call works, and the k6 results are included in your report.

### Sprint 2 — Async Pipelines and Caching (04.14 → 04.21)

**Goal:** Add asynchronous communication, caching, and at least one background worker. Measure the improvement.

Every team must deliver:

- At least one **Redis cache** in use (for example, caching event details or menu data so repeated reads do not hit the database every time)
- At least one **async pipeline** working end-to-end: a service pushes a message onto a Redis queue or pub/sub channel, and a worker consumes it and does something useful
- At least one write path is **idempotent** — sending the same request twice produces the same result without duplicating data
- Workers log what they are doing so a TA can see the pipeline in action in the Docker Compose logs
- Every worker exposes a `GET /health` endpoint that includes the current queue depth, the dead letter queue depth, and the timestamp of the last successfully processed job. A TA should be able to hit the worker's health endpoint during a burst test and see the queue depth change in real time.

#### Sprint 2 — k6 Load Tests

You need **two** k6 tests this sprint:

**Test 1: Caching comparison.** Run the same read endpoint test from Sprint 1 against your now-cached system. Include a side-by-side comparison in your sprint report showing how response times and throughput changed. You should see a clear improvement. If you do not, something is wrong with your caching — fix it.

**Test 2: Async pipeline throughput.** Write a k6 test that fires a burst of write requests that trigger your async pipeline (for example, placing 50 orders in rapid succession, or uploading 50 videos). Measure:

- How quickly the service accepts and acknowledges the requests
- Whether the worker keeps up with the queue (check queue depth via the worker's `/health` endpoint during the test)
- Whether duplicate requests are handled correctly (send the same idempotency key twice and verify no duplicate data is created)

Save these as `k6/sprint-2-cache.js` and `k6/sprint-2-async.js`.

**What "done" looks like:** A TA can trigger an action, watch the Docker Compose logs to see the message flow through the queue to the worker, hit the worker's `/health` endpoint to confirm queue depth and last job time, and review the k6 output showing measurable improvement from caching and correct behavior under burst load. `docker compose ps` shows all services and workers as `(healthy)`.

### Sprint 3 — Reliability and Poison Pills (04.21 → 04.28)

**Goal:** Make your system handle failure gracefully. Prove it with tests.

Every team must deliver:

- **Poison pill handling** on at least one queue: when a worker encounters a message it cannot process (malformed data, references to something that does not exist), it moves the message to a dead letter queue instead of retrying forever or crashing
- All remaining workers and services from your chosen scope are implemented
- The system handles basic failure scenarios gracefully (a failed payment does not leave a dangling reservation, a deleted document does not cause the export worker to crash in a loop)
- After poison pills are injected, the affected worker's `/health` endpoint must show a non-zero `dlq_depth` while the worker's own status remains `healthy` — proving the worker is still running and processing good messages

Teams of 4+ must also deliver:

- A second async worker pipeline

Teams of 5–6 must also deliver:

- All worker pipelines described in your chosen system
- Dead letter queue handling on all queues

#### Sprint 3 — k6 Load Test

**Poison pill resilience.** Write a k6 test that mixes normal requests with deliberately malformed requests (poison pills). For example, submit purchase requests for events that do not exist, upload requests with invalid parameters, or sensor readings from unregistered sensors. Your test should demonstrate:

- Normal requests continue to succeed while poison pills are being processed
- Poison pills land in the dead letter queue (verify by hitting the worker's `/health` endpoint after the test and showing `dlq_depth` is non-zero)
- Workers do not crash or get stuck — they keep processing good messages after encountering bad ones
- The system's overall throughput does not collapse when poison pills are injected

Save this as `k6/sprint-3-poison.js`.

**What "done" looks like:** A TA can send malformed messages, then hit the worker's `/health` endpoint and see a non-zero `dlq_depth` alongside a `healthy` worker status. Good messages continue flowing, and the k6 results prove overall throughput does not collapse. `docker compose ps` shows all containers still `(healthy)` after the test.

### Sprint 4 — Replication, Scaling, and Polish (04.28 → 05.07)

**Goal:** Scale your services with replicas, prove your system survives replica failure, and polish the final product.

**Every team, regardless of size**, must deliver:

- **Replication** of at least one service using `docker compose up --scale`. For example, running three instances of your main API service behind Caddy (or another load balancer). Your services must be designed so that multiple instances can run at the same time without conflicting — they must be stateless or use shared backing stores (databases, Redis) correctly.
- Your `README.md` must document the exact command to start the system with replicas. For example:
  ```bash
  docker compose up --scale catalog-service=3 --scale ingestion-service=2
  ```
- The load balancer (Caddy recommended) must distribute traffic across the replicas. You should be able to see in the logs that different replicas are handling different requests.
- `docker compose ps` must show every replica as `(healthy)`. If a replica is not passing its health check it is not considered running for grading purposes.
- The system must be **fully complete** for your team size. All services, workers, and pipelines required for your team size must be working.

Teams of 4+ must also deliver:

- Replication of at least **two** services
- All worker pipelines required for their team size

Teams of 5–6 must also deliver:

- Replication across **three or more** services
- All worker pipelines described in your chosen system
- Dead letter queue handling on all queues

#### Sprint 4 — k6 Load Tests

You need **two** k6 tests this sprint:

**Test 1: Scaling comparison.** Run the same read endpoint test from Sprint 1 against your system running with a single instance, then again with multiple replicas via `--scale`. Include a side-by-side comparison in your sprint report showing how response times and throughput changed under load. With multiple replicas, your system should handle more concurrent users before response times degrade.

**Test 2: Replica failure.** Write a k6 test that runs sustained traffic against a replicated service. During the test, manually stop one replica (`docker stop <container-id>`) and show that:

- The remaining replicas absorb the traffic
- Response times may increase but requests do not fail
- When the stopped replica is restarted, traffic redistributes
- `docker compose ps` transitions the stopped replica to `(unhealthy)` or shows it as stopped, while the surviving replicas remain `(healthy)` throughout

In your sprint report, include the k6 output from before, during, and after the replica failure. Annotate the timeline so the TA can see exactly when the replica went down and came back.

Save these as `k6/sprint-4-scale.js` and `k6/sprint-4-replica.js`.

**What "done" looks like:** A TA can start the system with `--scale` and run `docker compose ps` to confirm every replica is `(healthy)`. During the replica failure test, the TA kills one replica and watches `docker compose ps` mark it as stopped or unhealthy while the k6 run continues without failed requests. The k6 results show measurable improvement from scaling and resilience during failure.

---

## What Does a Sprint Submission Look Like?

Each sprint submission has three parts: **code**, **k6 tests**, and a **sprint report**.

### Code

Push your code to your team's GitHub repository and tag it before the Tuesday class when the sprint is due. The main branch must be in a working state at the tagged commit. Your repo must include:

- A `compose.yml` at the root of the repo
- A `README.md` with:
  - How to start the system (`docker compose up`), including the `--scale` flags for Sprint 4
  - A list of available endpoints with example requests
  - How to run the k6 tests for this sprint
  - Any setup steps (seeding data, etc.)
- Source code for all services and workers, each in its own directory
- A `k6/` directory with all test scripts for this sprint
- A `sprint-plans/SPRINT-X-PLAN.md` committed at the start of the sprint
- A `sprint-reports/SPRINT-X.md` submitted with your code at the end of the sprint

A TA will clone your repo, check out your sprint tag, and run `docker compose up`. **If it does not start from a clean checkout of the tag, you will lose points.** Test this yourself before you submit.

### k6 Tests

All k6 test scripts live in the `k6/` directory. Each test must:

- Be runnable with a single command (document the command in your README)
- Produce clear output showing the metrics that matter for that test
- Not depend on pre-existing data that is not created by your system's startup or seed scripts

### Sprint Plans

Write your sprint plan at the start of each sprint (Tuesday in-class) and commit it to `sprint-plans/SPRINT-X-PLAN.md` before you leave class. The starter repository includes a template for each sprint. This file is separate from your sprint report — it is written at the _beginning_ of the sprint, before you build anything.

The sprint plan must be committed to the main branch and present in the repo at the time of your sprint demo. If the plan is missing or was added retroactively (i.e., committed after the Tuesday start of the sprint), you will lose points on your individual grade.

#### Sprint Plan Template

```markdown
# Sprint [N] Plan — [Team Name]

**Dates:** MM.DD → MM.DD

## Sprint Goal

One sentence describing what this sprint accomplishes as a whole.

## Ownership

| Team member | Files / directories owned             | What they will build |
| ----------- | ------------------------------------- | -------------------- |
| Name        | `service-name/`                       | Brief description    |
| Name        | `service-name/`, `k6/sprint-N.js`     | Brief description    |
| Name        | `service-name/`, `docker-compose.yml` | Brief description    |

## Service Interfaces

List any endpoints or contracts one person must expose so another can integrate against them.

- [Name] will expose `GET /resource/:id` by [day] so [Name] can complete the synchronous call.

## Definition of Done

What must be true for this sprint to be considered complete?

- `docker compose up` starts all services without errors
- [List specific working behaviors]
- k6 test runs and produces output
```

#### Sprint Plan Example

The following is an example for a 3-person team building System 1 (Event Ticketing Platform) during Sprint 1.

```markdown
# Sprint 1 Plan — Team Nucleus

**Dates:** 04.07 → 04.14

## Sprint Goal

Get all three core services running in Docker Compose, connected to their databases, and
talking to each other via at least one synchronous HTTP call. Establish a k6 baseline.

## Ownership

| Team member | Files / directories owned                                  | What they will build                                                                                                                                              |
| ----------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alice       | `event-catalog-service/`                                   | GET /events and GET /events/:id endpoints, events DB schema and migrations, Redis cache for event detail lookups                                                  |
| Bob         | `ticket-purchase-service/`                                 | POST /purchases endpoint with idempotency key check, purchase DB schema, synchronous HTTP call to Payment Service                                                 |
| Carol       | `payment-service/`, `docker-compose.yml`, `k6/sprint-1.js` | Simulated payment endpoint returning success/failure, Docker Compose wiring for all three services and their databases, baseline k6 load test against GET /events |

## Service Interfaces

- Alice will have `GET /events/:id` returning a JSON event object by Wednesday evening
  so Bob can complete the Payment Service call in ticket-purchase-service.
- Carol will have the Docker Compose network up by Tuesday night so Alice and Bob can
  test database connectivity early.

## Definition of Done

- `docker compose up` starts all three services and their databases without errors
- `curl localhost/events` returns a list of events from the database
- `curl localhost/purchases` with a valid body calls the Payment Service and returns a result
- Redis container is running and event-catalog-service connects to it on startup
- k6 baseline test runs against GET /events and reports p50, p95, p99 and RPS
```

---

### Sprint Report

Include a file called `sprint-reports/SPRINT-X.md` (where X is the sprint number), submitted with your code at the end of the sprint. The starter repository includes a template for each sprint. It should contain:

1. **What we planned to do** — copy or summarize your `SPRINT-X-PLAN.md` from the start of the week
2. **What we actually delivered** — a short description of what is working
3. **What each person did** — for each team member, list the files and directories they own, followed by one or two sentences describing what they built or changed. The directories you list here must match what your sprint plan claimed and must be backed by that person's commit history. We will run `git log --author` against the tagged commit to verify. A name appearing only in merge commits, or commits touching files outside their listed directories, is a red flag.
4. **k6 results and analysis** — include the k6 output (or a summary table) and a brief explanation of what the numbers mean. For Sprints 2, 3, and 4, include before-and-after comparisons where relevant.
5. **What went wrong or changed** — anything you planned but could not finish, and why
6. **What we will do next sprint** — your plan for the upcoming sprint (not needed in Sprint 4)

Keep it focused. The k6 analysis is the most important section — do not just paste raw output. Explain what the numbers tell you about your system.

#### Sprint Report Template

```markdown
# Sprint [N] Report — [Team Name]
**Dates:** MM.DD → MM.DD

## What We Planned to Do
[Copy or summarize your SPRINT-X-PLAN.md sprint goal and ownership table]

## What We Actually Delivered
[Short description of what is working at the tagged commit. Be specific — name
the endpoints, workers, or pipelines that are functional.]

## What Each Person Did

**[Name]** — owns `service-name/`
[One or two sentences describing what they built or changed this sprint.]

**[Name]** — owns `service-name/`, `k6/sprint-N.js`
[One or two sentences describing what they built or changed this sprint.]

**[Name]** — owns `service-name/`, `docker-compose.yml`
[One or two sentences describing what they built or changed this sprint.]

## k6 Results and Analysis

[Include the k6 summary output or a table of key metrics. Then explain what the
numbers mean — do not just paste raw output.]

| Metric | Value |
|--------|-------|
| p50    |       |
| p95    |       |
| p99    |       |
| RPS    |       |

[For Sprints 2, 3, and 4: include a before-and-after comparison and explain what
changed and why.]

## What Went Wrong or Changed
[Anything you planned but could not finish, and why. If nothing went wrong, say so.]

## What We Will Do Next Sprint
[Your plan for Sprint N+1. Not needed in Sprint 4.]
```

#### Sprint Report Example

The following is an example for the same 3-person team (System 1, Sprint 1) after completing the sprint.

```markdown
# Sprint 1 Report — Team Nucleus
**Dates:** 04.07 → 04.14

## What We Planned to Do
Get all three core services running in Docker Compose, connected to their databases,
and talking to each other via at least one synchronous HTTP call. Establish a k6 baseline.

Alice owned event-catalog-service, Bob owned ticket-purchase-service, Carol owned
payment-service and the Docker Compose configuration.

## What We Actually Delivered
All three services start cleanly from `docker compose up`. The Event Catalog Service
exposes GET /events and GET /events/:id and reads from its Postgres database. The
Ticket Purchase Service accepts POST /purchases and calls the Payment Service
synchronously over HTTP. The Payment Service returns a simulated success or failure.
Redis is running and event-catalog-service connects to it on startup, though caching
is not yet wired up (planned for Sprint 2). The k6 baseline test runs successfully.

## What Each Person Did

**Alice** — owns `event-catalog-service/`
Implemented GET /events and GET /events/:id in Express, wrote the Postgres schema and
migrations for the events table, and added a Redis connection that verifies on startup.

**Bob** — owns `ticket-purchase-service/`
Implemented POST /purchases with an idempotency key check against the purchase database,
wrote the purchase DB schema, and integrated the synchronous HTTP call to Carol's
Payment Service using axios.

**Carol** — owns `payment-service/`, `docker-compose.yml`, `k6/sprint-1.js`
Built the simulated payment endpoint (returns success 90% of the time, failure 10%),
wired up Docker Compose for all three services with Postgres instances and a shared
Redis container, and wrote the Sprint 1 k6 baseline test.

## k6 Results and Analysis

Baseline load test against GET /events with 20 virtual users, 30-second ramp-up,
30-second sustained load. No caching in place — every request hits Postgres directly.

| Metric | Value   |
|--------|---------|
| p50    | 18 ms   |
| p95    | 74 ms   |
| p99    | 112 ms  |
| RPS    | 847 req/s |

Response times are acceptable at this scale, but p95 and p99 show significant
variance. With no caching, every read is a Postgres query. We expect to see p95
and p99 drop sharply in Sprint 2 once Redis caching is in place for event details,
since the same popular events are requested repeatedly in the test.

## What Went Wrong or Changed
The Redis cache layer was not wired up this sprint — Alice ran out of time after
debugging a Postgres connection issue that turned out to be a missing environment
variable in the Docker Compose file. We are moving that work to Sprint 2, where
it is a required deliverable anyway.

## What We Will Do Next Sprint
Sprint 2 will add the Redis cache for event detail lookups, implement the async
purchase confirmation pipeline using Redis pub/sub, and add the Notification Service
worker. We will also write the two Sprint 2 k6 tests (caching comparison and async
burst test).
```

---

## What Does a Project Class Look Like?

### Tuesday Classes (Sprint Boundaries)

These are structured. Here is how the time breaks down:

- **First 15 minutes:** Instructor announcements, sprint expectations, and Q&A
- **Remaining time:** Teams plan the next sprint together. Discuss what you learned from the previous sprint, divide up the work, and write your sprint plan before you leave class.

Demos do **not** happen during Tuesday class. You will schedule your demo with a TA separately (see the Sprint Demos section above).

### Thursday Classes (Work Sessions)

These are unstructured work time. Your team works together in the classroom. The instructor and TAs circulate to answer questions, give feedback, and check in on progress. Use this time to:

- Pair program on tricky integrations
- Debug Docker Compose networking issues together
- Write and refine your k6 test scripts
- Ask the instructor or TAs for help when you are stuck

---

## Attendance and Professionalism

**Attendance is taken at every project class session (both Tuesdays and Thursdays).**

Building software in a team is a professional activity. Showing up, being present, and working alongside your teammates matters — not just for your learning, but for theirs. In industry, a teammate who disappears for a week without communication is a serious problem. This class is no different.

Your attendance record during the project is factored into your final course grade through a **Professionalism Multiplier**. Here is how it works:

### The Professionalism Multiplier

There are **9 attendance opportunities** during the project (all sessions from 04.07 through 05.05, excluding 05.07 which is the final demo day and is graded separately as part of the project). Your multiplier is determined by how many of these 9 sessions you attend:

| Sessions Attended | Multiplier | Effect on Final Course Grade |
| ----------------- | ---------- | ---------------------------- |
| 9 of 9            | 1.00       | No change — full credit      |
| 8 of 9            | 0.95       | Final grade reduced by 5%    |
| 7 of 9            | 0.85       | Final grade reduced by 15%   |
| 6 of 9            | 0.70       | Final grade reduced by 30%   |
| 5 of 9            | 0.55       | Final grade reduced by 45%   |
| 4 or fewer        | 0.40       | Final grade reduced by 60%   |

**This multiplier applies to your entire final course grade, not just the project grade.** Missing multiple project sessions can move you from an A to a B, or from a B to a D. Missing four or more sessions can mean the difference between passing and failing.

This policy exists because:

1. Your teammates are depending on you. An absent team member shifts their workload onto everyone else.
2. The Thursday work sessions are where the hardest problems get solved. Teams that show up together build better systems.
3. Professional software engineering requires reliability. Treat this like a job.

**Excused absences:** If you have a legitimate reason to miss a session (illness, family emergency, university-sanctioned event), notify the instructor **before** the session. Excused absences do not count against your multiplier. Retroactive excuses without documentation will not be accepted.

---

## Will There Be a Presentation?

Yes, but it is a **demo, not a slide deck**.

On **05.07 (Thursday)**, each team gives a **5-minute live demo** to the class. You will:

1. Check out your `sprint-4` tag and start your system with `docker compose up --scale` (with your documented replica counts)
2. Walk through the main user flows (browsing, purchasing, ordering, uploading, etc.)
3. Show at least one async pipeline in action (point to the logs)
4. Show your poison pill / dead letter handling
5. Show traffic being distributed across replicas in the logs
6. Kill a replica live and show the system continuing to serve requests

After the demo, the class and instructor can ask 2–3 questions. Total time per team: about 8–10 minutes.

You do not need slides. You do not need a formal presentation. Just show your working system and your test results.

---

## Grading

The project is worth a significant portion of your final grade. It is split into three parts: a **team grade**, an **individual grade**, and a **repository grade**.

### Team Grade (60% of project grade)

Your team receives a shared grade based on the quality and completeness of your system. The team grade is assessed across all four sprints:

| Category              | Weight | What We Are Looking For                                                                                                                                                                                                                                                                              |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint 1 Delivery** | 10%    | Core services run in Docker Compose. Synchronous call works. Baseline k6 test runs and results are included in the report.                                                                                                                                                                           |
| **Sprint 2 Delivery** | 15%    | Async pipeline works end-to-end. Caching is implemented and k6 shows measurable improvement over Sprint 1 baseline. At least one idempotent write path. Burst test shows correct async behavior.                                                                                                     |
| **Sprint 3 Delivery** | 15%    | Poison pill handling works and k6 proves it under mixed traffic. All workers and services for your team size are implemented. Failure scenarios are handled gracefully.                                                                                                                              |
| **Sprint 4 Delivery** | 20%    | Replication works via `--scale`. k6 shows measurable scaling improvement. System survives replica failure under load. System is fully complete for your team size.                                                                                                                                   |
| **Final Demo**        | 10%    | System starts cleanly from the `sprint-4` tag with replicas. Team can walk through the key flows. Replica failure shown live. Questions are answered clearly.                                                                                                                                        |
| **k6 Test Quality**   | 15%    | Tests are meaningful (not trivial). Results are clearly presented in sprint reports with analysis. Before-and-after comparisons show real insight into system behavior. The progression from Sprint 1 baseline through caching, async, poison pills, and scaling tells a coherent performance story. |
| **Code Quality**      | 15%    | Code is readable and organized. Each service is in its own directory. Docker Compose file is clean. README is accurate and helpful.                                                                                                                                                                  |

Each sprint is graded on what was delivered, not what was promised. A working subset is better than a broken whole.

**Scaling expectations by team size:**

- **3-person teams** are graded on core services, one worker pipeline, poison pill handling on one queue, and replication of at least one service via `--scale`.
- **4-person teams** are graded on all core services, two worker pipelines, poison pill handling, and replication of at least two services via `--scale`.
- **5–6-person teams** are graded on the full system as described in the Project Systems document, all k6 tests, replication of three or more services via `--scale`, and dead letter queue handling on all queues.

We will not compare 3-person teams against 6-person teams. Your grade is based on whether you delivered what is expected for your team size.

### Individual Grade (25% of project grade)

Your individual grade ensures that every team member contributes meaningfully. It is based on three inputs:

| Input                | Weight | How It Works                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Git contribution** | 10%    | We cross-reference your sprint report's ownership claims against your commit history using `git log --author` on the tagged commit. You should have commits in every sprint touching the files and directories you claimed to own. We are not counting lines of code — we are looking for steady, meaningful contributions throughout the project, not a single large commit on the last day. Commits that only touch files outside your claimed directories, or that appear only as merge commits, do not demonstrate individual ownership. |
| **Sprint reports**   | 5%     | Each sprint report lists the specific files and directories each person owns, followed by a description of what they built. Your ownership claims must be consistent across your sprint plan and sprint report, and must be backed by your commit history. "Helped with backend" is not acceptable. "Implemented `order-service/src/routes.js` and the idempotency check in `order-service/src/db.js`" is.                                                                                                                                   |
| **Peer evaluation**  | 10%    | After the final demo, every team member fills out a confidential peer evaluation form. You will rate each teammate on effort, reliability, communication, and technical contribution. Peer evaluations are due on **05.07**.                                                                                                                                                                                                                                                                                                                 |

If your peers consistently say you did not contribute, or if your Git history is empty for entire sprints, your individual grade will reflect that — even if your team's system is excellent.

**A note on fairness:** If a team member is not contributing and the team has made a good-faith effort to address it, let the instructor know early. Do not wait until the peer evaluation. We can intervene and adjust workloads during the project, but we cannot fix things after the fact.

### Repository Grade (15% of project grade)

A well-maintained repository is a sign of a well-run project. This portion of the grade evaluates how professional and usable your repository is as a whole:

| Criteria                     | What We Are Looking For                                                                                                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **README quality**           | The README is accurate, complete, and up to date for each sprint. A stranger could clone your repo, read the README, start the system (including the `--scale` flags), and understand what it does without asking you.                                                                        |
| **Repo structure**           | The repository is logically organized. Each service has its own directory. Configuration files, k6 tests, and sprint reports are easy to find. There is no junk — no leftover files, no committed `node_modules`, no `.env` files with secrets.                                               |
| **Commit history**           | Commits have clear, descriptive messages. Work is committed in small, logical chunks — not one giant commit per sprint. The history tells a readable story of how the project was built.                                                                                                      |
| **Branching and tagging**    | Sprint tags (`sprint-1` through `sprint-4`) are present and correct. If the team uses branches, they are merged cleanly. The main branch is always in a working state at each tag.                                                                                                            |
| **`.gitignore` and hygiene** | Build artifacts, dependencies, environment files, and OS-specific files are properly ignored. The repo does not contain files that should not be tracked.                                                                                                                                     |
| **Docker Compose clarity**   | The `docker-compose.yml` is well-organized, uses clear service names, and includes comments where the configuration is not obvious. Services are designed to work correctly with `--scale` (no hardcoded ports that would conflict across replicas, no container names that prevent scaling). |

This is not about perfection — it is about care. A repository that is easy to navigate, has a clear README, and shows a clean commit history earns full marks. A repository that is a mess of unorganized files, cryptic commit messages, and a README that says "TODO" loses significant points.

---

## Team Formation

Teams are formed on **04.07** during the Project Kickoff class. Here are the rules:

- Teams must have **3 to 6 members**
- You may form your own team or ask to be placed on one
- Each team picks one of the five systems from the Project Systems document
- No two teams in the same section may pick the same system (first come, first served)
- Once formed, teams are final. Plan carefully.

If you cannot attend the kickoff class, let the instructor know in advance so we can place you on a team.

---

## Tools and Technology

- **Docker and Docker Compose** — required. All services run in containers. You will use `docker compose up --scale` to run multiple replicas of your services.
- **Programming language** — your choice. You may use different languages for different services (this is one of the strengths of a microservice architecture). Python, JavaScript/TypeScript, and Go are all good choices and have been used in this course.
- **Databases** — PostgreSQL is recommended, but you may use any database that runs in a Docker container.
- **Redis** — required for caching, queues, and pub/sub.
- **k6** — required for load testing. Install it locally ([k6.io](https://k6.io)) or run it in a Docker container. All test scripts must be included in your repo.
- **Caddy** — recommended as your load balancer / reverse proxy for distributing traffic across replicas. You may use Nginx or Traefik if you prefer. Your load balancer must sit in front of your scaled services and distribute incoming requests.
- **GitHub** — required. Your team forks the starter repository at https://github.com/umass-cs-426/starter-project at the start of Sprint 1. All code must be committed, tagged, and pushed before each sprint deadline. See the [Starter Repository](../starter/) for forking instructions.

---

## A Note on `docker compose up --scale`

When you run `docker compose up --scale catalog-service=3`, Docker Compose starts three instances of that service. This is how real systems handle increased traffic — you run more copies of the same service behind a load balancer.

There are a few things you need to know to make this work:

1. **Do not set `container_name`** on any service you plan to scale. Docker Compose needs to generate unique names for each replica, and a hardcoded container name prevents that.
2. **Do not map fixed host ports** on scaled services. If your service exposes port 8000 and you try to run three copies, the second and third will fail because port 8000 is already taken. Instead, let Docker assign ports automatically and put a load balancer (Caddy) in front. Only the load balancer should have a fixed host port.
3. **Your services must be stateless** — they should not store anything important in local memory or on the local filesystem. All shared state must live in the database or Redis. If two replicas of the same service get different requests, they should both produce correct results.
4. **Your load balancer configuration** must discover and route to all replicas. Caddy, Nginx, and Traefik all support this. Your README should explain how this is set up.

Getting `--scale` to work correctly is one of the most important learning outcomes of this project. It forces you to think about what makes a service safe to replicate — a skill you will use in every distributed system you ever build.

---

## Tips for Success

1. **Get `docker compose up` working on day one.** Even if your services do nothing yet, get the containers starting and talking to each other. Docker Compose networking issues are the number one time sink in this project.

2. **Design for `--scale` from the start.** Do not hardcode container names or host ports on your services. Even though replication is a Sprint 4 deliverable, making your services scalable from day one is much easier than retrofitting it at the end. Read the "`docker compose up --scale`" section above before writing your first `docker-compose.yml`.

3. **Work in vertical slices, not horizontal layers.** Do not have one person build all the databases while another writes all the API routes. Instead, each person should own a complete service — from its database schema to its endpoints to its Docker configuration.

4. **Commit early and often.** Do not work on a local branch for five days and then push everything at the end. Small, frequent commits make it easier to debug problems, show your individual contributions, and earn a good repository grade.

5. **Test your submission from the tag.** Before the deadline, do this: clone your repo into a fresh directory, check out the sprint tag, and run `docker compose up`. If it does not work on a clean checkout of the tag, it will not work for the TA. This is the single most common way teams lose points.

6. **Write your k6 tests early.** Do not leave them until the night before the sprint is due. The k6 tests often reveal real bugs in your system — caching that is not actually working, workers that crash under load, idempotency keys that are not checked. Finding these problems early gives you time to fix them.

7. **Show up to every class.** The professionalism multiplier is not a suggestion. Missing two sessions drops your entire course grade by 15%. Missing more is dramatically worse. If you have a conflict, notify the instructor in advance.

8. **Use the Thursday work sessions.** Teams that work together in person move faster than teams that try to coordinate entirely over chat. Use the classroom time.

9. **Ask for help early.** If your team is stuck on Docker networking, Redis configuration, or service communication, ask during a work session. These problems feel hard until someone shows you the trick, and then they are easy.

---

## Summary of Deadlines

| Deadline                        | Date                   | What Is Due                                                                                    |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| Team formation + system choice  | 04.07 (in class)       | Team members and chosen system finalized                                                       |
| Sprint 1 plan                   | 04.07 (end of class)   | `SPRINT-1-PLAN.md` committed to main branch before leaving class                               |
| **Sprint 1 code + report + k6** | **04.14 before class** | Working code on main branch, tagged `sprint-1`, plus `SPRINT-1.md` and `k6/sprint-1.js`        |
| Sprint 1 demo                   | 04.14–04.16            | Scheduled with TA, demoed from `sprint-1` tag                                                  |
| Sprint 2 plan                   | 04.14 (end of class)   | `SPRINT-2-PLAN.md` committed to main branch before leaving class                               |
| **Sprint 2 code + report + k6** | **04.21 before class** | Working code on main branch, tagged `sprint-2`, plus `SPRINT-2.md` and `k6/sprint-2-*.js`      |
| Sprint 2 demo                   | 04.21–04.23            | Scheduled with TA, demoed from `sprint-2` tag                                                  |
| Sprint 3 plan                   | 04.21 (end of class)   | `SPRINT-3-PLAN.md` committed to main branch before leaving class                               |
| **Sprint 3 code + report + k6** | **04.28 before class** | Working code on main branch, tagged `sprint-3`, plus `SPRINT-3.md` and `k6/sprint-3-poison.js` |
| Sprint 3 demo                   | 04.28–04.30            | Scheduled with TA, demoed from `sprint-3` tag                                                  |
| Sprint 4 plan                   | 04.28 (end of class)   | `SPRINT-4-PLAN.md` committed to main branch before leaving class                               |
| **Sprint 4 code + report + k6** | **05.05 before class** | Working code on main branch, tagged `sprint-4`, plus `SPRINT-4.md` and `k6/sprint-4-*.js`      |
| Final demo                      | 05.07 (in class)       | Live demo to the class from `sprint-4` tag                                                     |
| Peer evaluation                 | 05.07 (end of day)     | Confidential peer evaluation form submitted                                                    |
