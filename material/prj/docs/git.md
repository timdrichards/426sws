---
title: Project → Git Workflow
navTitle: Git Workflow
navOrder: 6
---

# Git & GitHub Workflow Guide

## 1. Repository Setup

Complete these steps at the start of Sprint 1, during the kickoff class session, before anyone writes service code. See the [Starter Repository](../starter/) for full forking instructions.

### Step 1: Fork the Starter Repository

One team member (and only one) forks the starter repository.

1. Go to https://github.com/umass-cs-426/starter-project
2. Click **Fork** → choose your GitHub account as the owner
3. Give it a meaningful name (e.g., `team-nucleus-ticketing`)
4. Leave the fork **public** — TAs and the instructor need to access it without a collaborator invitation

The starter includes `compose.yml`, the Holmes investigation container, sprint plan and report templates, a k6 starter script, and a README template.

### Step 2: Add Team Members as Collaborators

The team member who forked the repo must add every other team member as a collaborator with push access: **Settings → Collaborators → Add people**. Each teammate must accept the invitation before they can push.

### Step 3: Clone, Create `dev`, and Verify

Every team member clones the fork. Then one team member creates the `dev` branch if it does not already exist:

```bash
git clone https://github.com/<your-team>/<your-fork>.git
cd <your-fork>
git checkout -b dev
git push -u origin dev
docker compose up --build
```

Verify that `docker compose up --build` starts Holmes without errors before writing any service code. You should see the `holmes` container start and stay running.

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

### Step 4: Fill In the Sprint 1 Plan and README

Before leaving the kickoff class, fill in `README.md` (team name, system, ownership table) and `sprint-plans/SPRINT-1-PLAN.md` (goal, ownership, task list), then commit both to `main`:

```bash
git add README.md sprint-plans/SPRINT-1-PLAN.md
git commit -m "docs: fill in team README and Sprint 1 plan"
git push origin main
```

### Step 5: End of Course

After the final demo, every team member forks the team's repository to their own GitHub account to keep a personal copy for their portfolio.

---

## 2. Overview

This document defines the Git and GitHub workflow your team will follow throughout the project. The workflow keeps your codebase stable, your collaboration smooth, and your commit history clean — and it directly affects your individual grade. TAs verify individual contributions by running `git log --author` on each tagged commit and cross-referencing it against the ownership table in your sprint plan. See the [Project Guide](../project/) for grading details.

> **The Golden Rule:** No one pushes directly to `main`. Ever. All code reaches `main` through a Pull Request.

---

## 3. Branch Structure

Your repository uses three types of branches, each with a specific purpose.

```
main                          stable, tagged at each sprint deadline
dev                           integration branch; all PRs target this
task/<short-description>      one focused unit of work per person
fix/<short-description>       targeted bug fix
```

### 3.1 The `main` Branch

`main` is your project's source of truth and the branch that gets tagged for each sprint submission. It must always contain working code — a TA will clone it, check out the sprint tag, and run `docker compose up`. Nothing else.

- Never commit directly to `main`
- Never merge untested code into `main`
- Merge `dev` into `main` at the end of each sprint, after the whole team has verified `docker compose up` works cleanly from scratch
- Tag `main` immediately after the merge sprint — see Section 7

### 3.2 The `dev` Branch

`dev` is the team's shared integration branch. Individual task branches are merged here through Pull Requests. When the team confirms that all services start and talk to each other correctly, `dev` gets merged into `main`.

- All task branches are created from `dev`
- All Pull Requests target `dev`, not `main`
- Fix integration issues on `dev` promptly — a broken `dev` blocks everyone

### 3.3 Task Branches

Each team member creates a task branch for every focused piece of work. Task branches are short-lived: they exist only long enough to implement, test, and merge one coherent change. Delete them after merging.

**Naming format:** `task/<short-description>` or `fix/<short-description>`

Use lowercase letters and hyphens. The name should make it obvious which service and what kind of work is involved.

**Good examples:**

- `task/order-service-db-schema` — the Postgres schema and migrations for the Order Service
- `task/order-service-post-route` — the POST /orders endpoint and idempotency check
- `task/dispatch-worker-queue-consumer` — the Redis queue consumer loop for the Dispatch Worker
- `task/event-catalog-redis-cache` — adding the Redis cache layer to the Event Catalog Service
- `task/k6-sprint2-cache-comparison` — the Sprint 2 caching k6 test
- `fix/purchase-service-dlq-routing` — fixing a bug where poison pills were not moved to the DLQ

**Bad examples:**

- `task/my-stuff` — too vague
- `alices-branch` — not descriptive, missing prefix
- `task/order-service` — too broad; this is an entire service, not one task

---

## 4. Services vs. Tasks

Each team member owns one or more **services** — for example, the Order Service, the Dispatch Worker, or the k6 test suite. A service spans multiple concerns: its database schema, HTTP routes, Redis interactions, health endpoint, and Docker Compose configuration. Services are large. **You should never implement an entire service in a single branch.**

Instead, you break each service into **tasks**. A task is one focused, independently testable piece of work. Multiple tasks, merged one at a time into `dev`, come together to form the complete service.

### 4.1 How to Break a Service into Tasks

Split by concern. Each task branch handles one well-defined piece of the service so the Pull Request is focused and easy to review.

**Example: Breaking down the Order Service**

```
task/order-service-db-schema         Postgres schema, migrations, and seed script
task/order-service-post-route        POST /orders endpoint with idempotency check
task/order-service-get-routes        GET /orders and GET /orders/:id endpoints
task/order-service-health            GET /health endpoint with DB and Redis checks
task/order-service-queue-producer    Push to Redis dispatch queue after order creation
task/order-service-redis-cache       Redis cache for menu lookups (Sprint 2)
```

Each branch is created from `dev`, opened as its own Pull Request, reviewed, and merged independently. By the time all are merged, the Order Service is complete for that sprint.

**Example: Breaking down a worker**

```
task/dispatch-worker-consumer        Redis queue consumer loop and job processing logic
task/dispatch-worker-driver-call     Synchronous HTTP call to the Driver Service
task/dispatch-worker-dlq             Dead letter queue handling for poison pills (Sprint 3)
task/dispatch-worker-health          GET /health endpoint with queue depth and last-job-at
```

### 4.2 How to Scope a Task

Ask yourself these questions before creating a task branch:

- **Does this branch focus on one concern within one service?** If it touches the database schema, the HTTP routes, and the Redis cache all at once, it is too big — split it up.
- **Will the Pull Request be reviewable in under 15 minutes?** If it would take longer, the task probably includes too much.
- **Can this work be tested or verified on its own?** A good task produces something you can point to: a working endpoint, a passing health check, a schema migration that applies cleanly.
- **Does this branch contain work unrelated to the task name?** If yes, move that work to a separate branch.

### 4.3 Right-Sized vs. Wrong-Sized Tasks

```
Right-sized   One concern within one service. Testable in isolation.
              Reviewable in a single PR.
              Example: task/order-service-post-route

Too small     A trivial change that does not represent a meaningful unit.
              Example: "fix typo in README"

Too large     An entire service in one branch, or multiple services bundled together.
              Example: task/order-and-dispatch (two services in one branch)
```

### 4.4 Branches for Cross-Cutting Work

Some work does not belong to a single service. Create appropriately named branches for it:

- `task/docker-compose-networking` — initial Compose file wiring all services together
- `task/caddy-load-balancer` — Caddy configuration for Sprint 4 replication
- `task/k6-sprint1-baseline` — the Sprint 1 k6 load test
- `fix/redis-connection-timeout` — a connectivity bug affecting multiple services

---

## 5. Commit Standards

### 5.1 Commit Message Format

Every commit message must follow this structure:

```
prefix: short description of what changed
```

The prefix indicates the type of change. The description should be a brief, present-tense summary. Keep the entire message under 72 characters.

```
feat:      Adding new functionality
fix:       Fixing a bug
refactor:  Restructuring code without changing behavior
test:      Adding or updating k6 tests
docs:      Documentation or README changes
docker:    docker-compose.yml, Dockerfiles, or container configuration
chore:     Dependencies, environment config, tooling
```

### 5.2 Writing Good Commit Messages

**Good messages** describe what changed and in which service:

- `feat: add POST /orders with idempotency key check`
- `feat: implement Redis cache for event detail lookups`
- `fix: route poison pills to DLQ instead of retrying`
- `docker: add healthcheck directive to order-service`
- `test: add k6 burst test for dispatch queue throughput`
- `docs: document POST /orders endpoint in README`

**Bad messages** are vague and tell reviewers — and graders — nothing:

- `update` — update what?
- `fixed it` — fixed what?
- `wip` — work in progress tells nobody anything
- `stuff` — not a commit message
- `final version` — there is no final version in software

### 5.3 Commit Frequency

Commit early and commit often. A good rule of thumb is to commit every time you complete a small, logical unit of work within your service.

**Minimum expectations:**

- At least **3–5 commits per task branch** before opening a Pull Request
- At least **1 commit per class session** during work sessions
- Each commit represents a **single logical change**, not a dump of everything you did all week

**Think of commits like checkpoints.** You would not work for an entire sprint without saving. Small, frequent commits in your owned directories make it easy to trace bugs, demonstrate your contribution, and satisfy the `git log --author` verification TAs run at grading time.

---

## 6. The Pull Request Workflow

All code must go through a Pull Request before it is merged into any shared branch.

### 6.1 Step-by-Step: From Task Branch to `dev`

#### Step 1: Make sure your branch is up to date

Before opening a PR, pull the latest changes from `dev` to avoid merge conflicts:

```bash
git checkout dev
git pull origin dev
git checkout task/order-service-post-route
git merge dev
```

Resolve any conflicts, verify that `docker compose up` still works, and commit the merge.

#### Step 2: Push your branch to GitHub

```bash
git push origin task/order-service-post-route
```

#### Step 3: Open a Pull Request on GitHub

- Go to your repository on GitHub.
- Click **"Compare & pull request"** or go to the Pull Requests tab and click **"New pull request"**.
- Set the **base branch** to `dev` (not `main`).
- Set the **compare branch** to your task branch.
- Write a descriptive title and description.

#### Step 4: PR Title and Description

Your Pull Request title should match your commit message convention:

```
feat: add POST /orders with idempotency key check
```

Your PR description should include:

- **What this PR does:** A brief summary of the task.
- **How to test it:** The `curl` command or `docker compose` step a reviewer can run to verify the change works.
- **Service affected:** Which service directory this PR touches.

#### Step 5: Request a review

Assign at least one teammate as a reviewer. Do not merge your own Pull Request without a review. The reviewer should verify that `docker compose up` still starts cleanly and that the changed service passes its health check.

#### Step 6: Address feedback and merge

If the reviewer requests changes, make the fixes on your task branch, commit, and push. The PR updates automatically. Once approved, click **"Merge pull request"**. Delete the task branch after merging.

### 6.2 Merging `dev` into `main`

At the end of each sprint (before class on the Tuesday deadline), the team merges `dev` into `main`. This must only happen after the whole team has verified that all services start and integrate correctly from a clean checkout.

- Open a Pull Request from `dev` to `main`
- Title it with the sprint number: `Sprint 2: Async pipelines and caching`
- Have at least one team member review and approve
- Merge the PR, then immediately tag `main` — see Section 7

### 6.3 Deleting a Task Branch After Merging

Once your Pull Request is merged into `dev`, delete the task branch. Keeping stale branches around clutters the repository and makes it harder for teammates to see what work is still in progress.

**Delete the remote branch** (do this first — GitHub also offers a "Delete branch" button on the merged PR page):

```bash
git push origin --delete task/order-service-post-route
```

**Delete the local branch** (switch off it first if it is your current branch):

```bash
git checkout dev
git pull origin dev
git branch -d task/order-service-post-route
```

The `-d` flag (lowercase) is safe: it refuses to delete a branch that has not been fully merged. If Git warns you that the branch is unmerged but you are certain it was merged via a squash or rebase PR, use `-D` (uppercase) to force the deletion.

**Verify the branch is gone:**

```bash
git branch -a
```

The deleted branch should no longer appear under `remotes/origin/`. If it still shows after deleting the remote, run `git fetch --prune` to sync your local list of remote branches.

---

## 7. Sprint Tags

Sprint tags are your submission receipts. A TA will clone your repo, check out the tag, and run `docker compose up`. **If the tag is missing or points to a broken commit, your demo cannot proceed and you will lose points.**

### Creating and pushing a tag

Immediately after merging `dev` into `main` at the end of each sprint:

```bash
git checkout main
git pull origin main
git tag sprint-1
git push origin sprint-1
```

Repeat with `sprint-2`, `sprint-3`, and `sprint-4` at the end of each respective sprint.

### Verifying your tag before the deadline

Do this yourself before every sprint deadline — do not assume it works:

```bash
# Clone into a fresh directory to simulate what the TA will do
git clone https://github.com/<your-team>/<your-repo>.git verify-test
cd verify-test
git checkout sprint-1
docker compose up
```

If any service fails to start from this clean checkout, fix it **before** the Tuesday deadline. The tag is your snapshot. Code pushed after the tag does not count for that sprint.

### Correcting a bad tag

If you tag the wrong commit, delete the tag locally and remotely, then re-tag:

```bash
git tag -d sprint-1
git push origin --delete sprint-1
git tag sprint-1
git push origin sprint-1
```

Do this before the deadline. Do not ask for a deadline extension because of a tagging mistake.

---

## 8. Sprint Files

Two files must be committed at specific points in each sprint. Their commit timestamps are checked.

### Sprint plan — committed at the start of the sprint

On the Tuesday a sprint begins, fill in `sprint-plans/SPRINT-X-PLAN.md` (the starter includes a template for each sprint) and commit it to `main` directly — not through a task branch — before leaving class:

```bash
# On sprint kickoff Tuesday, in class
git checkout main
git pull origin main
# ... fill in sprint-plans/SPRINT-1-PLAN.md ...
git add sprint-plans/SPRINT-1-PLAN.md
git commit -m "docs: add Sprint 1 plan"
git push origin main
```

See the [Project Guide](../project/) for the sprint plan template and a worked example.

### Sprint report — committed with the sprint submission

Fill in `sprint-reports/SPRINT-X.md` (the starter includes a template for each sprint) and commit it as part of your final sprint submission on the following Tuesday, before you tag:

```bash
# Write your sprint report, then:
git add sprint-reports/SPRINT-1.md
git commit -m "docs: add Sprint 1 report"
git push origin main   # or merge dev → main first, then add the report
git tag sprint-1
git push origin sprint-1
```

The sprint report must be present at the tagged commit. A tag without a report is an incomplete submission.

---

## 9. Day-to-Day Workflow Summary

### Starting a new task

```bash
git checkout dev
git pull origin dev
git checkout -b task/order-service-post-route
```

### Working on your task

```bash
# Edit files in your service directory
git add order-service/src/routes.js order-service/src/db.js
git commit -m "feat: add POST /orders with idempotency key check"
```

Commit after each meaningful chunk. Do not batch everything into one commit at the end of the day.

### End of a class session

```bash
git add <your changed files>
git commit -m "feat: describe current progress"
git push origin task/order-service-post-route
```

Push at the end of every session, even if the work is not finished. This protects against data loss and shows ongoing contribution.

### Ready to merge

1. Pull latest `dev` into your branch and resolve any conflicts
2. Verify `docker compose up` starts cleanly and your service's `/health` returns 200
3. Push your branch
4. Open a Pull Request targeting `dev`
5. Request a review from a teammate
6. Address feedback, then merge
7. Delete the task branch

### End of sprint

1. Confirm all task branches for this sprint are merged into `dev`
2. Verify the full system starts cleanly: clone `dev` into a fresh directory and run `docker compose up`
3. Merge `dev` into `main` via Pull Request
4. Commit the sprint report to `main`
5. Tag `main` as `sprint-X` and push the tag
6. Verify the tag: fresh clone, checkout the tag, `docker compose up`

---

## 10. Common Mistakes to Avoid

**Pushing directly to `main` or `dev`.** Always use a task branch and a Pull Request. Direct pushes bypass review and make the history harder to read.

**Giant commits.** A commit titled "finished the order service" that touches 20 files is impossible to review and makes it hard for a TA to verify your individual contribution. Break your work into small, logical commits targeting your owned directories.

**Vague commit messages.** "update," "stuff," and "fixed" tell reviewers nothing. Use the prefix format and name the service: `fix: prevent DLQ retry loop in dispatch-worker`.

**Not pulling before branching.** Always pull the latest `dev` before creating a new task branch. Branching from stale code causes avoidable merge conflicts.

**Committing outside your owned directories.** Your sprint plan claims specific directories. Commits that touch files outside those directories create ambiguity in the `git log --author` verification. If you genuinely need to change something outside your scope (e.g., `compose.yml`), coordinate with the owner of that file and note it in your sprint report.

**Forgetting to push the sprint tag.** `git tag sprint-1` creates the tag locally. `git push origin sprint-1` is the separate step that makes it visible on GitHub. Both are required.

**Tagging a broken commit.** Run the full clean-checkout test before tagging. If `docker compose up` fails on the tag, the demo cannot proceed.

**Not committing the sprint plan before leaving class.** The commit timestamp is how instructors verify the plan was written before the sprint started, not retroactively.

**Merging without a review.** Every PR needs at least one reviewer. Self-merging defeats the purpose of code review and loses the integration check.

---

## 11. Quick Reference

```
Create task branch      git checkout -b task/service-name-concern
Stage specific files    git add path/to/your/files
Commit                  git commit -m "prefix: description"
Push branch             git push origin task/service-name-concern
Update from dev         git checkout dev && git pull && git checkout task/... && git merge dev
Open a PR               GitHub website → Compare & pull request → base: dev
Merge dev → main        End of sprint, via PR, after full system test
Tag a sprint            git tag sprint-X && git push origin sprint-X
Verify tag              git clone <repo> tmp && cd tmp && git checkout sprint-X && docker compose up
Commit sprint plan      git add sprint-plans/SPRINT-X-PLAN.md && git commit && git push origin main
Commit sprint report    git add sprint-reports/SPRINT-X.md && git commit && git push origin main
Commit frequency        3–5 commits per task branch, at least 1 per class session
Commit format           prefix: short description (under 72 chars)
```

---

## 12. Visual Branch Flow

<img src="../git-branch-diagram.svg" alt="Git Branch Flow Diagram" style="width: 100%; height: auto;">

Code flows upward. Task branches merge into `dev` via Pull Requests. `dev` merges into `main` at the end of each sprint. `main` is tagged immediately after. Nothing bypasses this process.

---

## 13. Using VS Code with Git and GitHub

VS Code has built-in Git support and a GitHub extension that lets you do most of this workflow without opening a terminal.

### 13.1 Initial Setup

**Required tools:**

- **Git:** Download from <https://git-scm.com>. On Mac, run `xcode-select --install` if Git is not already present.
- **VS Code:** Download from <https://code.visualstudio.com>. Git integration is built in.
- **GitHub Pull Requests extension:** Extensions panel → search "GitHub Pull Requests" → install. Lets you create and review PRs inside VS Code.
- **Docker Desktop:** Required for running `docker compose up` locally. Download from <https://www.docker.com/products/docker-desktop>.

**Clone your team repository:**

1. Press `Ctrl+Shift+P` / `Cmd+Shift+P` to open the Command Palette.
2. Type `Git: Clone` and paste your team's repository URL.
3. Choose a local folder and click **Open** when prompted.

### 13.2 The Source Control Panel

Open it with `Ctrl+Shift+G` / `Cmd+Shift+G`. This is where you stage files, write commit messages, and push.

```
Changes section          Files you have modified since your last commit
Staged Changes section   Files added to the next commit (git add equivalent)
Message box              Where you type your commit message
Branch name (status bar) Bottom-left corner — always check this before committing
Sync Changes button      Push local commits and pull teammates' changes
```

### 13.3 Daily Workflow in VS Code

**Switch to `dev` and pull latest:**

1. Click the branch name in the bottom-left corner
2. Select `dev`
3. Command Palette → `Git: Pull`

**Create a new task branch:**

1. Click the branch name in the bottom-left corner
2. Select **"Create new branch from..."**
3. Type the branch name (e.g., `task/order-service-post-route`)
4. When asked which branch to create from, select `dev`

**Stage specific files and commit:**

For this project, stage your files by name rather than staging everything at once. You own specific directories — staging everything risks accidentally committing files that belong to a teammate.

1. Open the Source Control panel
2. Click the **+** icon next to each file you own to stage it individually
3. Type your commit message: `feat: add POST /orders with idempotency key check`
4. Click the checkmark or press `Ctrl+Enter` / `Cmd+Enter`

**Push your branch:**
Click **Sync Changes** in the Source Control panel, or Command Palette → `Git: Push`.

**Pull `dev` into your task branch before opening a PR:**
Use the integrated terminal for this (` Ctrl+`` /  `Cmd+``):

```bash
git merge dev
```

VS Code highlights merge conflicts directly in the editor with colored markers. Resolve each one, then stage and commit the result.

### 13.4 Creating a Pull Request from VS Code

1. After pushing your task branch, open the Command Palette and type `GitHub Pull Requests: Create Pull Request`
2. Set **base branch** to `dev`, **compare branch** to your task branch
3. Write a title (`feat: add POST /orders with idempotency key check`) and description
4. Click **Create**

You can also review teammates' PRs directly in VS Code from the GitHub Pull Requests panel in the left sidebar.

### 13.5 Useful Shortcuts

```
Open Source Control panel    Ctrl+Shift+G  /  Cmd+Shift+G
Open Command Palette         Ctrl+Shift+P  /  Cmd+Shift+P
Open integrated terminal     Ctrl+`        /  Cmd+`
Commit staged changes        Ctrl+Enter    /  Cmd+Enter  (in Source Control)
Switch branches              Click branch name in bottom-left status bar
View file diff               Click any file in the Source Control panel
```

### 13.6 Tips for This Project

**Always check the bottom-left corner.** The branch name tells you exactly where your commits will go. If it says `main`, stop and switch to your task branch.

**Stage files individually, not with "Stage All."** You own specific directories. Staging everything can accidentally include files outside your scope, which creates noise in the `git log --author` verification.

**Use the terminal for merges and tags.** `git merge dev`, `git tag sprint-X`, and `git push origin sprint-X` are easier and less error-prone in the terminal than in the GUI.

**Install GitLens (optional but recommended).** GitLens adds inline blame annotations and a visual commit graph. It is free and makes it easy to see who last changed a file and why. Search "GitLens" in the Extensions panel.

**Use the VS Code GUI for staging and committing. Use the terminal for everything else.** The two work together seamlessly via the integrated terminal.
