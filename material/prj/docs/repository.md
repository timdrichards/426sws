---
title: Project → Repository Structure
navTitle: Repository
navOrder: 5
---

# Repository Structure

Your repository is part of your grade. A TA will clone it, check out your sprint tag, and run `docker compose up` — nothing else. If the structure is confusing, files are missing, or the README is out of date, that is visible and it matters. This document explains the required layout, what belongs where, and the conventions that keep a shared repository readable and maintainable.

---

## The Starter Layout

Every team forks the [starter repository](../starter/). Its layout defines the foundation you build on — do not reorganize it.

```
your-repo/
├── compose.yml                      orchestrates every service
├── README.md                        the front door to your project
├── .gitignore                       covers node_modules, .env, build output
├── .vscode/
│   └── extensions.json              recommended extensions
├── holmes/                          investigation container — do not modify
│   ├── Dockerfile
│   └── README.md
├── k6/
│   ├── sprint-1.js                  baseline load test (update TARGET_URL)
│   ├── sprint-2-cache.js            added in Sprint 2
│   ├── sprint-2-async.js            added in Sprint 2
│   ├── sprint-3-poison.js           added in Sprint 3
│   └── sprint-4-scale.js            added in Sprint 4
├── sprint-plans/
│   ├── SPRINT-1-PLAN.md
│   ├── SPRINT-2-PLAN.md
│   ├── SPRINT-3-PLAN.md
│   └── SPRINT-4-PLAN.md
└── sprint-reports/
    ├── SPRINT-1.md
    ├── SPRINT-2.md
    ├── SPRINT-3.md
    └── SPRINT-4.md
```

As your team builds, you add one directory per service alongside this scaffolding:

```
your-repo/
├── compose.yml
├── README.md
├── holmes/
├── k6/
├── sprint-plans/
├── sprint-reports/
├── order-service/          ← your services go here, at the root level
├── restaurant-service/
├── dispatch-worker/
└── ...
```

---

## The Rules

### One directory per service, at the root level

Every service your team builds gets its own directory at the root of the repository. The name should match the service name used in `compose.yml` and in your README.

```
order-service/
restaurant-service/
dispatch-worker/
notification-worker/
caddy/
```

**Do not nest service directories inside each other.** `backend/order-service/` or `services/restaurant-service/` are wrong. Flat is correct.

**Do not create a single catch-all directory** like `src/` or `app/` that houses multiple services. Each service is independently deployable and independently owned — its code must live in its own root-level directory.

### Everything about a service lives in that service's directory

A service directory is self-contained. If it is a Node.js service, the `package.json`, `src/`, and `Dockerfile` are all inside it. If it is a Python service, the `requirements.txt`, application code, and `Dockerfile` are all inside it. The only files that reference services from outside their directories are `compose.yml` and `README.md`.

```
order-service/
├── Dockerfile
├── package.json
├── package-lock.json
├── src/
│   ├── index.js
│   ├── routes.js
│   └── db.js
└── README.md
```

### Do not modify `holmes/`

The Holmes investigation container is maintained by the course staff. Do not change its `Dockerfile` or contents unless you have a specific reason (for example, adding a tool your team needs). If you modify it, upstream updates become painful to merge.

---

## Key Files

### `compose.yml`

The `compose.yml` at the root of your repository is the single file that starts your entire system. Every service, database, cache, and worker your team builds must be declared here.

**Add your services below the provided comment block.** Every service must join the `team-net` bridge network so it is reachable from Holmes by service name. Every service must have a `healthcheck` directive and declare its dependencies using `depends_on: condition: service_healthy`. See [Health Endpoints](../health/) for the required `/health` response format, implementation examples in Node.js and Python, and how to wire healthchecks into Compose so services start in the right order.

Keep `compose.yml` organized: group related services together (e.g., a service and its database), and use comments to mark each group. A TA reading it should be able to understand your system's architecture at a glance.

**Do not expose service ports to the host unless necessary.** Services communicate with each other over `team-net` by service name. External traffic goes through Caddy. The only containers that need host port mappings are Caddy (port 80 or 443) and Holmes (if you need external access).

### `README.md`

The root README is the front door to your project. A TA reads it before doing anything else. It must be accurate at every sprint tag.

The README must contain:

- **Team name and system name**
- **Team member names and service ownership table** — who owns which directory
- **How to start the system** — `docker compose up --build` and `docker compose up --scale <service>=3`
- **Base URL table** — one row per service with its internal Docker network address and any Caddy-proxied external address
- **System overview** — a short paragraph explaining what the system does and how the services connect
- **API reference** — one `###` section per endpoint, following the format in [Endpoint Descriptions](../endpoint/)
- **Sprint history table** — links to each sprint plan and report

Keep the README current. An outdated README that describes services that no longer exist, or omits services that do, is a grading problem.

### `sprint-plans/`

Sprint plans are committed to `main` **at the start of each sprint**, before you leave the Tuesday kickoff class. The commit timestamp is how the instructors verify the plan was written prospectively, not retroactively.

Each plan must list:
- The sprint goal
- Which team member owns which directories and files
- The task list for the sprint, broken down by person

Fill in the provided template (`SPRINT-X-PLAN.md`) — do not create your own format.

### `sprint-reports/`

Sprint reports are committed to `main` as part of your sprint submission, before you tag. A tag without a report is an incomplete submission.

Each report must include:
- A contributions table (who did what, backed by commit history)
- k6 results table (p50, p95, p99, throughput)
- Sprint 2 onward: a before-and-after comparison showing the effect of your changes

Fill in the provided template (`SPRINT-X.md`).

### `k6/`

The `k6/` directory holds every load test script your team writes. Add new scripts as subsequent sprints require them; do not overwrite earlier scripts. Each script is a snapshot of your system's behavior at a particular point in time — they are graded artifacts.

```
k6/
├── sprint-1.js             baseline (no cache)
├── sprint-2-cache.js       with Redis cache
├── sprint-2-async.js       async pipeline throughput
├── sprint-3-poison.js      poison pill injection
└── sprint-4-scale.js       replica scaling
```

---

## What Does Not Belong in the Repository

### Secrets and credentials

Never commit secrets. The `.gitignore` in the starter covers the common cases, but be deliberate:

- **`.env` files** — use environment variables in `compose.yml` directly, or use Docker secrets. Never commit a `.env` file.
- **API keys, tokens, passwords** — if a file contains one, it must not be committed. Rotate the credential if it was ever committed, even briefly.
- **Private keys or certificates** — same rule.

If you need to share configuration values with teammates, document them in the README or in the sprint plan, not in a committed file.

### Build output and dependencies

Do not commit:

- `node_modules/`
- `__pycache__/`, `.pyc` files
- Compiled binaries or build artifacts — add them to `.gitignore` if the starter does not already cover your language

### Large binary files

Do not commit large binaries (video files, database dumps, compiled executables). If a test needs data, generate it programmatically using Faker (see [Simulating Services and Data](../simulate/)) or a seed script that runs at container startup.

---

## Keeping the Repository Clean

### Delete merged task branches

After a Pull Request is merged into `dev`, delete the task branch — both remotely and locally. Stale branches accumulate and make it impossible to tell at a glance what work is in progress. A repository with 30 open branches is a repository no one can navigate.

```bash
git push origin --delete task/order-service-post-route
git branch -d task/order-service-post-route
```

See the [Git & GitHub Workflow](../git/) guide for the full branch deletion procedure.

### Commit only what you own

Your sprint plan declares which directories you own. Stage files by name — not with `git add .` or `git add -A`. Accidentally committing files outside your scope creates noise in the `git log --author` verification TAs run at grading time and can overwrite a teammate's work.

In VS Code, click the `+` icon next to individual files in the Source Control panel rather than staging everything at once.

### Keep `compose.yml` tidy

`compose.yml` is a shared file. Multiple team members will add services to it. Coordinate changes through Pull Requests and communicate before merging. If two people add services at the same time, you will get a merge conflict — resolve it carefully so neither service definition is lost.

When adding a new service, follow the existing formatting: consistent indentation, a blank line between service blocks, and a comment identifying the service group.

### No commented-out dead code

Do not leave large blocks of commented-out code in your repository. If you want to preserve something for reference, the git history already has it. Dead code in the main branch makes the codebase harder to read and suggests work is unfinished.

---

## Directory Naming

Use lowercase letters and hyphens. No spaces, no underscores, no CamelCase.

```
order-service/        correct
dispatch-worker/      correct
OrderService/         wrong — CamelCase
order_service/        wrong — underscores
orderservice/         wrong — not readable
```

The name in the directory must match the service name in `compose.yml` exactly. A `compose.yml` that references `./order-service` must have a directory named `order-service/`.

---

## What a TA Sees

When a TA grades your sprint, they run these steps:

```bash
git clone https://github.com/<your-team>/<your-repo>.git
cd <your-repo>
git checkout sprint-1
docker compose up --build
```

Then they look at your README and walk through the sprint deliverables.

What they should find:
- The sprint tag exists and points to a working commit
- `docker compose up --build` starts cleanly with no errors
- Every service in `compose.yml` has a `healthcheck` and starts healthy
- The README accurately describes the system and its endpoints
- The sprint report is present and complete
- The repository is organized: one directory per service at the root level, no stale branches, no committed secrets

What they should not find:
- Missing services, broken endpoints, or containers that crash on startup
- A README that is out of date or describes a different system
- Nested service directories or services buried inside a `src/` folder
- Committed `node_modules/`, `.env` files, or build artifacts
- A missing or incomplete sprint report

---

## Summary

| Rule | Why it matters |
| ---- | -------------- |
| One directory per service, at the root level | Makes the structure navigable and consistent with `compose.yml` |
| Do not nest service directories | Flat structure is required; nesting makes ownership ambiguous |
| Do not modify `holmes/` | Upstream updates from course staff become merge conflicts |
| Keep `README.md` accurate at every sprint tag | TAs read it first — it is part of the submission |
| Commit sprint plans at kickoff, reports at submission | Timestamps are checked; missing files are incomplete submissions |
| Never commit secrets or `node_modules/` | Cannot be undone once pushed; rotate credentials if they were ever exposed |
| Delete merged branches | Keeps the branch list navigable and signals what is in progress |
| Stage files by name, not `git add .` | Prevents accidental commits outside your ownership scope |

If you have questions about where to put something, ask the instructor. The structure of your repository is part of the project and will be graded.
