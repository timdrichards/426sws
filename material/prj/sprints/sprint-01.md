---
layout: layouts/prj.njk
title: Project → Sprint 01
permalink: /spring-2026/sprints/01/
---

# Sprint 1 — Foundation

**04.07 → 04.14**

Sprint 1 establishes the foundation of your system. By the end of this sprint your core services must be running in Docker Compose, connected to their own databases, and talking to each other over HTTP. You will also establish a k6 baseline that you will compare against in every subsequent sprint.

---

## Timeline

| Date        | Day      | What Happens                                                                                                     |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| **04.07**   | Tuesday  | **Project Kickoff** — join your team on Canvas, choose a system, fork the starter repo, write your Sprint 1 plan |
| 04.09       | Thursday | **Sprint 1 Work Session** — in-class work time, instructor and TA check-ins                                      |
| **04.14**   | Tuesday  | **Sprint 1 Due before class** — tag `sprint-1`, submit GitHub repo link to Canvas, Sprint 2 kickoff begins       |
| 04.14–04.16 | Tue–Thu  | **Sprint 1 Demo Window** — schedule and complete your demo with a TA                                             |

---

## Kickoff Class — 04.07

The full class period is dedicated to getting your team started. Complete every step below before you leave.

### 1. Join Your Team on Canvas

Teams appear in the **People → Project Teams** tab on Canvas. Find your team and join it. Only after you have joined your Canvas group should you move on to the steps below. Teams are 3–6 people.

If you do not have a team yet, let the instructor know now.

### 2. Choose a System

As a team, pick one of the five systems from the [Project Systems](../../docs/systems/) page. Each system has a different domain and set of core services, but the same technical requirements. Pick the one that sounds most interesting to your team. You will be building the same core architecture and features regardless of which system you choose, so there are no technical advantages or disadvantages to any choice.

### 3. Fork the Starter Repository and Create `dev` Branch

One team member — and only one — forks the starter repo. See the [Starter Repository](../../docs/starter/) page for step-by-step instructions. Add every other team member as a collaborator with push access before leaving class.

That same team member creates a `dev` branch and pushes it to GitHub. This is where you will do all your work for the project. The `main` branch is reserved for stable code that has been demoed to the teaching staff. Please see the [Git Workflow](../../docs/git/) guide for more details on how to use branches and commits for this project.

#### Upstream Updates

On occassion, the course staff may push updates to the starter repo with bug fixes, improvements, or new documentation. If this happens, one team member can pull those changes into your fork with:

```bash
git remote add upstream https://github.com/<your-team>/<your-fork>.git
git fetch upstream
git checkout dev
git merge upstream/main
git push origin dev
```

Everyone else on the team should then pull those changes into their local `dev` branch with:

```bash
git checkout dev
git pull origin dev
```

You can also do this through the GitHub web interface by having one team member click the "Fetch upstream" button on your fork's main page. After you do this, make sure to merge the changes into your `dev` branch which you can also do through the GitHub web interface by creating a pull request from `main` to `dev`. Once you do that, you can merge the pull request and then pull the changes to your local `dev` branch using `git pull origin dev`.

### 4. Clone and Verify

Every team member clones the fork created in the previous step and confirms that `docker compose up --build` starts the Holmes service without errors.

```bash
git clone https://github.com/<your-team>/<your-fork>.git
cd <your-fork>
git checkout -b dev
git push -u origin dev
docker compose up --build
```

### 5. Fill In the README and Sprint 1 Plan

Before leaving class, fill in `README.md` (team name, system choice, member names, ownership table) and `sprint-plans/SPRINT-1-PLAN.md` (sprint goal, ownership, task list). See the [Project Guide](../../docs/project/) for the sprint plan template and a worked example.

### 6. Commit to `main` Before You Leave

```bash
git add README.md sprint-plans/SPRINT-1-PLAN.md
git commit -m "docs: fill in team README and Sprint 1 plan"
git push origin main
```

The sprint plan commit timestamp is checked. If it is committed after Tuesday 04.07, it is considered retroactive and you will lose points on your individual grade.

### 7. Submit Your GitHub Repo Link to Canvas

**One team member** submits the URL of your team's GitHub repository to the Sprint 1 assignment on Canvas. The URL should look like `https://github.com/<your-team>/<your-fork>`. Only one submission per team is needed — we grade the repo, not the submission.

---

## Deliverables

Every team must deliver the following by **04.14 before class**.

### Core Services

- A `compose.yml` that starts all core services and their databases with `docker compose up`
- Each core service connects to its own Postgres database and exposes at least one working endpoint
- At least one **synchronous service-to-service HTTP call** works end-to-end (e.g., the Order Service calls the Restaurant Service to validate a menu item; the Ticket Purchase Service calls the Payment Service)
- A Redis container is running and at least one service connects to it on startup

### Health Endpoints

Every service must expose `GET /health`. See [Health Endpoints](../../docs/health/) for the required response format, Docker Compose `healthcheck` configuration, and implementation examples in both Node.js and Python.

- Returns **HTTP 200** when all dependencies are reachable
- Returns **HTTP 503** when any dependency is unreachable
- Response body includes a `checks` object with the status of the database connection and the Redis connection
- Every service in `compose.yml` has a `healthcheck` directive
- Services use `depends_on: condition: service_healthy` so they wait for their databases and Redis before starting

### README

Your `README.md` must include:

- How to start the system (`docker compose up`)
- The service names and internal ports (for use from Holmes)
- What endpoints are available, following the format in [Endpoint Descriptions](../../docs/endpoint/)
- How to run the k6 test

### Sprint Plan

`sprint-plans/SPRINT-1-PLAN.md` committed to `main` before leaving class on 04.07. It must include the sprint goal, the ownership table (who owns which directories), and your definition of done. See the [Project Guide](../../docs/project/) for the template.

### Sprint Report

`sprint-reports/SPRINT-1.md` committed to `main` before the sprint tag. It must include what you planned, what you delivered, what each person did (with directories owned and commit evidence), the k6 results and analysis, what went wrong, and what you plan for Sprint 2. See the [Project Guide](../../docs/project/) for the template.

### k6 Baseline Test

Write a k6 test that sends read traffic to your main read endpoint (browsing events, listing restaurants, viewing the video catalog, etc.). This is your baseline — no caching yet, so every request hits the database.

Requirements:

- Ramps up to at least **20 virtual users** over 30 seconds
- Sustains load for at least **30 seconds**
- Reports **p50, p95, p99** response times and **requests per second**
- Saved as `k6/sprint-1.js`
- Output included in your sprint report

You will compare these numbers against Sprint 2 after adding a Redis cache.

---

## Submission

**One team member** submits the GitHub repository URL to the **Sprint 1** assignment on Canvas before class on 04.14.

Before submitting, tag the commit on your `main` branch:

```bash
git checkout main
git pull origin main
git tag sprint-1
git push origin sprint-1
```

**Verify your tag before the deadline.** Clone your repo into a fresh directory, check out the tag, and run `docker compose up`. If it does not start cleanly from that checkout, it will not work for the TA.

```bash
git clone https://github.com/<your-team>/<your-fork>.git verify-test
cd verify-test
git checkout sprint-1
docker compose up
```

Code pushed after the tag does not count for this sprint.

---

## Grading

Sprint 1 is worth **10% of the team project grade**. The following rubric is used at the demo.

| Area                  | Points | Criteria                                                                                                                                                                                                             |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Services run**      | 25     | `docker compose up` starts all core services. `docker compose ps` shows every service as `(healthy)`. No services crash or restart in a loop.                                                                        |
| **Health endpoints**  | 20     | `GET /health` on each service returns HTTP 200 with a JSON body showing `database` and `redis` checks. Returns HTTP 503 when a dependency is down. Healthcheck directives are present in `compose.yml`.              |
| **Synchronous call**  | 20     | At least one service-to-service synchronous HTTP call works end-to-end and can be demonstrated live.                                                                                                                 |
| **k6 baseline**       | 20     | `k6/sprint-1.js` runs without errors. Sprint report includes p50, p95, p99, and RPS. Results are explained, not just pasted.                                                                                         |
| **README and report** | 15     | README is accurate and complete. `SPRINT-1.md` includes what each person did with specific file/directory ownership claims and is backed by commit history. Sprint plan was committed before leaving class on 04.07. |

**Total: 100 points**

Grading is based on what is working at the `sprint-1` tag, not what is promised. A system that starts cleanly and shows one working call is better than an ambitious system that crashes on startup.

---

## For Teaching Staff

### Before the Demo

1. Confirm the team submitted a GitHub repository URL to Canvas.
2. Confirm the `sprint-1` tag exists on the `main` branch: `git log --oneline sprint-1 -1`
3. Confirm `sprint-plans/SPRINT-1-PLAN.md` was committed on or before 04.07. Check: `git log --follow sprint-plans/SPRINT-1-PLAN.md`

### At the Demo

Clone the repo fresh. Do not use a cached local copy.

```bash
git clone <repo-url> sprint1-demo
cd sprint1-demo
git checkout sprint-1
docker compose up --build
```

Then verify each deliverable:

**Services run (25 pts)**

```bash
docker compose ps
```

Every core service should show `(healthy)`. If any service shows `(unhealthy)` or is restarting, deduct points proportionally. Note which services are healthy and which are not.

**Health endpoints (20 pts)**

From Holmes:

```bash
docker compose exec holmes bash
# Then for each service:
curl http://<service-name>:<port>/health | jq .
```

Check that:

- HTTP status is 200
- Response body contains a `checks` object with `database` and `redis` keys
- Each check shows `"status": "healthy"` with latency or an error message
- `compose.yml` has `healthcheck:` directives and `depends_on: condition: service_healthy`

**Synchronous call (20 pts)**

Ask the team to demonstrate the synchronous call from Holmes. The call should succeed end-to-end — one service calling another over the Docker network and returning a meaningful response.

**k6 baseline (20 pts)**

From Holmes:

```bash
k6 run /workspace/k6/sprint-1.js
```

Or as documented in the team's README. Verify:

- Test runs without errors
- Output includes p50, p95, p99, and RPS
- Sprint report includes these numbers with a brief explanation

**README and report (15 pts)**

- `README.md` accurately documents how to start the system and what endpoints exist
- `sprint-reports/SPRINT-1.md` lists what each person owned and what they built
- Verify ownership claims against commit history: `git log --author="Name" --oneline sprint-1`
- Commits should touch the directories the person claimed to own, not just merge commits
- Deduct points if a person's name appears only in merge commits or touches files outside their stated scope

### Scheduling

Demos are **not** held during class. Ask teams to contact you via email to schedule a 30-minute slot between 04.14 and 04.16. Book slots in advance so you are not flooded with last-minute requests.
