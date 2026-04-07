---
title: COMPSCI 426 - Project -- Starter Repository
navTitle: Starter
navOrder: 4
---

# Starter Repository

**Repository:** https://github.com/umass-cs-426/starter-project

Every team forks this repository at the start of Sprint 1. It provides the scaffolding your team needs from day one: a Holmes investigation container, a `compose.yml` to build on, sprint plan and report templates, a k6 starter script, and a README template you fill in together during the first class session.

---

## Forking the Starter

One team member (and only one) forks the repository. The rest of the team clones the fork.

### Step 1: Fork

1. Go to https://github.com/umass-cs-426/starter-project
2. Click **Fork** in the top-right corner
3. Under **Owner**, select your own GitHub account (not an organization)
4. Give the fork a meaningful name — for example, `team-nucleus-ticketing`
5. Leave **Copy the `main` branch only** checked
6. Click **Create fork**

### Step 2: Add Team Members as Collaborators

The team member who forked must add every other team member with push access:

**Settings → Collaborators → Add people**

Each teammate must accept the invitation before they can push.

### Step 4: Create a `dev` Branch

```bash
git clone https://github.com/<your-team>/<your-fork>.git
cd <your-fork>
git checkout -b dev
git push -u origin dev
```

From this point, follow the Git workflow described in the [Git & GitHub Workflow](../git/) guide. No one pushes directly to `main`.

---

## What Is in the Starter

```
starter-project/
├── compose.yml                     compose file; add your services here
├── README.md                       fill this in during Sprint 1 kickoff
├── .gitignore                      covers node_modules, .env, build output
├── .vscode/
│   └── extensions.json             recommended extensions (Docker, Dev Containers, etc.)
├── holmes/
│   ├── Dockerfile                  builds the Holmes investigation container
│   └── README.md                   full tool reference and connection instructions
├── k6/
│   └── sprint-1.js                 baseline load test starter script
├── sprint-plans/
│   ├── SPRINT-1-PLAN.md            fill in during Sprint 1 kickoff
│   ├── SPRINT-2-PLAN.md            fill in during Sprint 2 kickoff
│   ├── SPRINT-3-PLAN.md            fill in during Sprint 3 kickoff
│   └── SPRINT-4-PLAN.md            fill in during Sprint 4 kickoff
└── sprint-reports/
    ├── SPRINT-1.md                 fill in and commit before Sprint 1 tag
    ├── SPRINT-2.md                 fill in and commit before Sprint 2 tag
    ├── SPRINT-3.md                 fill in and commit before Sprint 3 tag
    └── SPRINT-4.md                 fill in and commit before Sprint 4 tag
```

### `compose.yml`

The starter `compose.yml` defines the `holmes` service and a shared bridge network called `team-net`. Add every service your team builds below the provided comment block. Every service must join `team-net` so it is reachable from Holmes by name.

See the comments inside the file for copy-pasteable service, Postgres, and Redis templates.

### `holmes/`

Holmes is a persistent container that sits on `team-net` with your services. It contains curl, wget, jq, k6, psql, redis-cli, Node.js, Python 3, bat, lsd, fd, ripgrep, Neovim + LazyVim, and more. Use it to inspect and test your running system from inside the Docker network.

```bash
docker compose exec holmes bash
curl http://your-service:3000/health | jq .
redis-cli -h redis LLEN your-queue
k6 run /workspace/k6/sprint-1.js
```

See `holmes/README.md` for the full tool reference.

### `k6/sprint-1.js`

A working k6 script skeleton. Update `TARGET_URL` to point to your main read endpoint and run it to produce your Sprint 1 baseline. Add `sprint-2-cache.js`, `sprint-2-async.js`, and so on as subsequent sprints require.

### Sprint Plans (`sprint-plans/`)

Each plan is committed to `main` before you leave the Tuesday kickoff class for that sprint. The templates are pre-filled with the ownership table, task checklist, and definition-of-done structure described in the [Project Guide](../project/). Fill in the goal, assign ownership rows, and list your tasks before you close your laptop.

### Sprint Reports (`sprint-reports/`)

Each report is committed to `main` with your code before you tag the sprint. The templates include a contributions table, a k6 results table, and the before-and-after comparison format required from Sprint 2 onward.

### `README.md`

The root README is a template your team fills in at Sprint 1 kickoff. It includes:

- Team member names and service ownership table
- `docker compose up` and `--scale` commands
- Base URL table for all services
- System overview paragraph
- API reference section (one `###` per endpoint, following the format in [Endpoint Descriptions](../endpoint/))
- Sprint history table linking to each plan and report

**The README must be accurate at every sprint tag.** A TA will read it before cloning your repo.

---

## What to Do at Sprint 1 Kickoff (04.07)

Do these steps together as a team, in class, before you leave.

1. **One person forks** the starter repository (leave it public)
2. **Add all teammates** as collaborators; everyone clones the fork
3. **Create the `dev` branch** and push it to origin
4. **Fill in `README.md`** — team name, system name, member names, and the ownership table
5. **Fill in `sprint-plans/SPRINT-1-PLAN.md`** — sprint goal, who owns which directories, and your task list
6. **Commit both files to `main`** — the sprint plan must be on `main` before you leave class

```bash
git add README.md sprint-plans/SPRINT-1-PLAN.md
git commit -m "docs: fill in team README and Sprint 1 plan"
git push origin main
```

7. **Verify everyone can push** — each teammate makes a trivial edit to a file and pushes to `dev` to confirm their collaborator invitation worked

---

## What to Add During Each Sprint

Teams build their services alongside the starter scaffolding. Add a new directory for each service:

```
your-fork/
├── compose.yml                     ← add your services here
├── README.md                       ← keep this current
├── holmes/                         ← do not modify
├── k6/
│   ├── sprint-1.js                 ← update TARGET_URL
│   ├── sprint-2-cache.js           ← add in Sprint 2
│   ├── sprint-2-async.js           ← add in Sprint 2
│   ├── sprint-3-poison.js          ← add in Sprint 3
│   ├── sprint-4-scale.js           ← add in Sprint 4
│   └── sprint-4-replica.js         ← add in Sprint 4
├── order-service/                  ← add your services
├── restaurant-service/
├── dispatch-worker/
└── ...
```

---

## Keeping Holmes Up to Date

Do not modify `holmes/Dockerfile` unless you have a specific reason (for example, adding a tool your team needs). If the course staff updates the starter repository, you can pull the change into your fork:

```bash
git remote add upstream https://github.com/umass-cs-426/starter-project.git
git fetch upstream
git merge upstream/main
```

Resolve any conflicts (typically none — Holmes lives in its own directory) and push to your fork.
