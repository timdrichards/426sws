---
layout: layouts/prj.njk
title: Project → Sprint 04
permalink: /spring-2026/sprints/04/
---

# Sprint 4 — Replication, Scaling, and Polish

**04.28 → 05.07**

Sprint 4 is the final sprint. Your system must be fully complete and running under replicated load. You will scale at least three services using `docker compose up --scale`, put Caddy in front of them as a load balancer, prove that traffic distributes across replicas, and show that your system survives a replica failure without dropping requests. The final demo on 05.07 is live, in front of the class.

---

## Timeline

| Date        | Day      | What Happens                                                                                 |
| ----------- | -------- | -------------------------------------------------------------------------------------------- |
| **04.28**   | Tuesday  | **Sprint 4 Kickoff** — write your Sprint 4 plan and commit it to `main` before leaving class |
| 04.28–04.30 | Tue–Thu  | **Sprint 3 Demo Window** — schedule and complete your Sprint 3 demo with a TA                |
| 04.30       | Thursday | **Sprint 4 Work Session** — in-class work time, instructor and TA check-ins                  |
| **05.05**   | Tuesday  | **Sprint 4 Due before class** — tag `sprint-4`, final submission                             |
| **05.07**   | Thursday | **Final Demos / Project Wrap-Up** — demo day, peer evaluations due end of day                |

---

## Kickoff Class — 04.28

### 1. Merge and Tag Sprint 3

If you have not already done so, merge `dev` into `main` and tag:

```bash
git checkout main
git pull origin main
git tag sprint-3
git push origin sprint-3
```

Verify the tag from a clean clone.

### 2. Write Your Sprint 4 Plan

Fill in `sprint-plans/SPRINT-4-PLAN.md` as a team. Sprint 4 has a narrower scope than previous sprints — the system should be functionally complete. The work is: adding replication, wiring Caddy, verifying stateless service design, and polishing the README and demo.

For Sprint 4, your plan must list:

- Which services will be replicated (at least three) and who is responsible for each
- Who owns the Caddy configuration
- Who owns the two k6 tests (`sprint-4-scale.js` and `sprint-4-replica.js`)
- Any remaining bugs or missing features from Sprint 3 and who will fix them
- Who is responsible for the final README and sprint report

### 3. Commit the Plan to `main` Before You Leave

```bash
git add sprint-plans/SPRINT-4-PLAN.md
git commit -m "docs: add Sprint 4 plan"
git push origin main
```

### 4. Identify What Must Be Stateless

For a service to be replicated, multiple instances of it must be able to run simultaneously and share the same backing store without conflicting. Before writing any Sprint 4 code, look at each service you plan to replicate and ask:

- Does this service store any state in memory that is not in the database or Redis? (If yes, replicas will not share that state — fix it.)
- Does it write to local files? (If yes, replicas will write to different places — fix it or move writes to a shared store.)
- Does it use an in-memory job lock? (If yes, multiple replicas will double-process the same message — use a Redis lock or a queue that naturally prevents double-consumption.)

Most services in your system should already be stateless if they are designed correctly. If not, Sprint 4 is when you fix it.

---

## How to Approach This Sprint

### Step 1: Add Caddy as a Load Balancer

Caddy is a simple, modern reverse proxy that can distribute traffic across multiple replicas automatically. The starter repository includes a reference to Caddy; Sprint 4 is when you configure it for real.

**Basic Caddy configuration for load balancing:**

Create a `Caddyfile` in a `caddy/` directory:

```
:80 {
    reverse_proxy order-service:8000 {
        lb_policy round_robin
    }
}
```

When you run `docker compose up --scale order-service=3`, Caddy will automatically discover all three `order-service` replicas by their Docker network service name and distribute traffic among them using round-robin. You do not need to enumerate individual replica addresses — Docker's built-in DNS returns all of them.

**Add Caddy to `compose.yml`:**

```yaml
caddy:
  image: caddy:2-alpine
  ports:
    - '80:80'
  volumes:
    - ./caddy/Caddyfile:/etc/caddy/Caddyfile
  depends_on:
    - order-service
  networks:
    - team-net
```

Remove the `ports:` mapping from the services that Caddy fronts. Clients should reach them through Caddy on port 80, not directly. Holmes can still reach services by name on the internal network.

**How to structure this as tasks:**

```
task/caddy-caddyfile                  Basic Caddyfile with reverse_proxy for one service
task/caddy-multi-service              Extend Caddyfile to cover all replicated services
task/caddy-compose-integration        Wire Caddy into compose.yml; remove direct port mappings
```

### Step 2: Make Services Stateless for Replication

For each service you plan to replicate:

1. **Check for in-memory state.** Any variable set in one replica's process is invisible to other replicas. Move it to Redis (for ephemeral state like session data or locks) or the database (for durable state).

2. **Check for file writes.** If a service writes to the local filesystem, replicas will write to different places. Move file outputs to a shared location — or, in this project, just log the simulated output instead.

3. **Check for port conflicts.** Your services should not bind to a fixed host port in the Compose file when replicated — let Caddy handle external traffic on port 80 and keep services on internal ports only.

4. **Check for database migrations on startup.** If every service instance runs migrations when it starts, three replicas starting simultaneously can deadlock. Run migrations once, as a separate one-shot container, before the replicas start.

**Common issue: sessions stored in memory.**

If your Auth or Order service tracks any "currently logged in users" or "active orders" in a plain JavaScript object or Python dict, this will not work with replicas. Move that data to Redis or the database.

### Step 3: Replicate at Least Three Services

Scale at least three services using `--scale`. These should be your highest-traffic services — the ones that received the most load in your k6 tests. For most systems, this means the main API services.

```bash
docker compose up --scale order-service=3 --scale restaurant-service=3 --scale driver-service=2
```

Document the exact command in your `README.md`. The TA will copy-paste it directly.

After scaling, verify:

```bash
docker compose ps
# Should show order-service-1, order-service-2, order-service-3 all (healthy)
```

From Holmes, make several requests to the endpoint that Caddy is fronting and watch the logs of each replica:

```bash
# In one terminal:
docker compose logs -f order-service

# In another:
docker compose exec holmes bash
for i in $(seq 1 20); do curl -s http://caddy:80/orders | jq '.service_instance'; done
```

You should see log lines appearing across all three replica containers. If every request is handled by the same replica, Caddy is not routing correctly.

### Step 4: Write the Scaling and Replica Failure k6 Tests

**`k6/sprint-4-scale.js` — scaling comparison**

Run the same read endpoint test from Sprint 1 twice: once against a single instance, once against three replicas. Include both results in your sprint report.

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

// Run with: k6 run --env SCALE=single k6/sprint-4-scale.js
// Run with: k6 run --env SCALE=replicated k6/sprint-4-scale.js

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80'

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '60s', target: 50 }, // push harder than Sprint 1 to show scaling benefit
    { duration: '10s', target: 0 },
  ],
}

export default function () {
  const res = http.get(`${BASE_URL}/orders`)
  check(res, { 'status is 200': r => r.status === 200 })
  sleep(0.5)
}
```

**`k6/sprint-4-replica.js` — replica failure test**

Run sustained traffic, then manually stop one replica mid-test. Show that traffic continues without failures.

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80'

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp up
    { duration: '120s', target: 20 }, // sustained — manually stop a replica during this window
    { duration: '30s', target: 20 }, // verify recovery
    { duration: '10s', target: 0 },
  ],
}

export default function () {
  const res = http.get(`${BASE_URL}/orders`)
  check(res, { 'status is 200': r => r.status === 200 })
  sleep(0.5)
}
```

**During the replica failure test, the TA (or you) will:**

1. Start the test
2. Wait 30 seconds for ramp-up
3. Find the container ID of one replica: `docker compose ps | grep order-service`
4. Stop it: `docker stop <container-id>`
5. Watch `docker compose ps` transition that replica to `(unhealthy)` or stopped
6. Verify the k6 output shows no failed requests during this period
7. Restart the replica: `docker compose up --scale order-service=3 -d`
8. Verify it recovers and traffic redistributes

**In your sprint report,** annotate the timeline: "at approximately T+45s, we stopped replica order-service-2. At T+90s, we restarted it. The k6 output shows zero failed requests throughout."

### Step 5: Polish and Final Prep

Sprint 4 is also the sprint to fix whatever you know is rough:

- Services that start but take too long (reduce the `start_period` in healthchecks, or fix slow startup code)
- Endpoints that return stub data instead of real database reads
- Workers that log nothing useful
- A `compose.yml` that fails on a fresh clone because of a missing volume or env var
- A README that is out of date

**Run the full system from a clean checkout before the 05.05 deadline:**

```bash
git clone <your-repo> final-test
cd final-test
git checkout sprint-4
docker compose up --scale order-service=3 --scale restaurant-service=3 --build
docker compose ps   # all healthy
```

If anything fails, fix it. The final class session is a **project expo**. Instead of teams presenting one at a time to a passive audience, every team sets up a station simultaneously. You will want things working smoothly for the best experience.

---

## Deliverables

Every team must deliver the following by **05.05 before class** (tag `sprint-4`).

### Replication (at Least Three Services)

- `docker compose up --scale <service>=3` starts three healthy instances of at least three services
- Caddy distributes traffic across replicas — visible in the logs of individual containers
- `docker compose ps` shows all replicas as `(healthy)`
- The exact scale command is documented in `README.md`

### Replica Failure Resilience

- `k6/sprint-4-replica.js` runs while a replica is stopped and shows zero failed requests
- The stopped replica is visible in `docker compose ps` as stopped or unhealthy
- The surviving replicas remain `(healthy)` throughout the test
- After restarting, traffic redistributes

### Full System Complete

- All services and workers from your chosen system are running
- Dead letter queue handling on every worker pipeline
- Every service exposes a working `GET /health` endpoint
- `docker compose ps` shows every container as `(healthy)`

### k6 Tests

- `k6/sprint-4-scale.js` — single vs. replicated comparison; sprint report includes side-by-side numbers
- `k6/sprint-4-replica.js` — replica failure test; sprint report annotates the timeline and shows no failed requests during failure

### README (Final Version)

The final README must be complete and accurate. A TA — and your classmates at the final demo — will read it. It must include:

- Team name and system name
- All team members and their service ownership
- **Exact commands** to start the system (both the basic `docker compose up` and the `--scale` version)
- All endpoints with example `curl` commands
- How to run each k6 test (with the exact command)
- Any seed data steps required before running tests

### Sprint Report

`sprint-reports/SPRINT-4.md` committed to `main` before the sprint tag. It must include:

- What each person did this sprint (with commit-backed ownership)
- k6 scaling comparison (single vs. replicated) with p50, p95, p99, and RPS
- k6 replica failure timeline with annotated observations
- Reflection on the full four-sprint arc: what you built, what worked, what you would do differently

No "What we will do next sprint" section is needed for Sprint 4.

---

## Team Workflow for This Sprint

### Assign Caddy to One Person

Caddy configuration is cross-cutting — it touches the Compose file, the Caddyfile, and every replicated service. Assign it to one person who coordinates with the rest of the team. Do not have multiple people editing `compose.yml` at the same time without coordinating.

### Test Replication Early (Not the Night Before)

Replication bugs are subtle. A service that works perfectly with one instance can fail with three because of an in-memory state assumption that was never tested. Set up Caddy and run with `--scale 3` by Wednesday at the latest. Give yourself two days to fix issues.

### Rehearse the Final Demo

The 05.07 demo will be in class on the last day. Your team will always have at least 50% of the team at the table and 50% waling around seeing what other teams did. You will need to present your work to other students. Decide in advance:

- Who will drive the terminal?
- Who will narrate?
- What is the order of the demo? (Start system → show health → show pipeline → scaling comparison → replica failure → DLQ demo → questions)
- What happens if something breaks during the live demo?

Do a dry run with your team before 05.07. The demo is 10 minutes. Know every command you will run. Know your system inside and out. You will be evaluated and you will evaluate. More details will be released on Friday.

### Peer Evaluations

Peer evaluations are due **end of day 05.07**. Each team member evaluates every other team member on contribution, communication, and reliability. These evaluations affect individual grades. Complete them honestly.

---

## Submission

**One team member** submits the GitHub repository URL to the **Sprint 4** assignment on Canvas before class on 05.05.

Before submitting, tag the commit on your `main` branch:

```bash
git checkout main
git pull origin main
git tag sprint-4
git push origin sprint-4
```

**Verify your tag before the deadline.** This is the last sprint. Clone into a fresh directory, check out the tag, and run the full scaled system:

```bash
git clone https://github.com/<your-team>/<your-fork>.git verify-test
cd verify-test
git checkout sprint-4
docker compose up --scale order-service=3 --build
docker compose ps   # all healthy
```

Code pushed after the tag does not count for this sprint.

---

## Grading

Sprint 4 is worth **20% of the team project grade**. The following rubric is used at the final demo.

| Area                  | Points | Criteria                                                                                                                                                                                |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Replication**       | 30     | At least three services scale with `--scale`. Caddy distributes traffic across replicas (visible in logs). All replicas show `(healthy)` in `docker compose ps`.                        |
| **Replica failure**   | 20     | Stopping one replica does not cause the k6 test to fail. The replica shows as stopped/unhealthy while survivors remain healthy. Traffic recovers when the replica restarts.             |
| **Full system**       | 20     | All system components running and integrated. DLQ handling on every queue. Every service has a working `/health`. No stub endpoints.                                                    |
| **k6 results**        | 15     | Both scale tests run without errors. Sprint report includes single vs. replicated comparison and an annotated replica failure timeline. Numbers are explained, not just pasted.         |
| **README and report** | 15     | README is complete, accurate, and includes exact `--scale` commands. Sprint report documents individual contributions with commit evidence. Peer evaluations submitted by end of 05.07. |

**Total: 100 points**

---

## For Teaching Staff

### Before the Demo

1. Confirm the team submitted a GitHub repository URL to Canvas.
2. Confirm the `sprint-4` tag exists on the `main` branch: `git log --oneline sprint-4 -1`
3. Read the team's README to understand their system and the `--scale` command they documented.
4. Confirm `sprint-plans/SPRINT-4-PLAN.md` was committed on or before 04.28.

### At the Final Demo (05.07)

The final demo is live in front of the class. Each team presents for 15–20 minutes. Clone fresh from the sprint-4 tag.

```bash
git clone <repo-url> sprint4-demo
cd sprint4-demo
git checkout sprint-4
docker compose up --scale <service>=3 --scale <service2>=3 --build
docker compose ps
```

**Replication (30 pts)**

Start the system with the `--scale` command from their README. Verify `docker compose ps` shows at least three healthy replicas of at least three services. From Holmes, send several requests to the load-balanced endpoint and show that different replicas handle different requests (visible in container-level logs or via a service identifier in the response).

**Replica failure (20 pts)**

Start `k6/sprint-4-replica.js` running. Wait 30 seconds. Stop one replica:

```bash
docker stop $(docker compose ps -q <service> | head -1)
```

Watch `docker compose ps` — the stopped container should transition to stopped or unhealthy. Verify the k6 run shows no failed requests. After ~30 seconds, restart:

```bash
docker compose up --scale <service>=3 -d
```

Confirm the restarted replica becomes healthy and the test continues cleanly.

**Full system (20 pts)**

```bash
docker compose ps
```

All containers from the team's system description should be `(healthy)`. Hit each service's `/health` endpoint from Holmes and verify all checks pass. Ask the team to demonstrate one full end-to-end flow (e.g., post an order → dispatch worker fires → driver assigned → notification logged).

**k6 results (15 pts)**

```bash
k6 run /workspace/k6/sprint-4-scale.js
k6 run /workspace/k6/sprint-4-replica.js
```

Ask the team to walk through their sprint report's before-and-after comparison. p95 response time should be meaningfully lower under replication at the same load. Ask: "Why did your numbers change? What does this tell you about your bottleneck?"

**README and report (15 pts)**

- Does the README accurately describe how to start the system with replicas?
- Does the sprint report list what each person did with commit-backed evidence?
- Were peer evaluations submitted?

### Peer Evaluations

Collect peer evaluations via Canvas. Each team member should have submitted evaluations for every other team member by end of day 05.07. Factor peer evaluation results into individual grades per the course grading policy.
