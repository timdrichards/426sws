---
title: Project → Grading
navTitle: Grading
navOrder: 10
---

# Project Grading

Your project grade has three independent components: a **team grade**, an **individual grade**, and a **repository grade**. They are combined as follows:

| Component            | Weight |
| -------------------- | ------ |
| Team grade           | 60%    |
| Individual grade     | 25%    |
| Repository grade     | 15%    |

In addition, your attendance during the project period is applied as a **Professionalism Multiplier** to your entire final course grade — not just the project. This is described at the bottom of this page.

---

## Team Grade — 60%

The team grade reflects the quality and completeness of what your team delivered across all four sprints. It is assessed on a 100-point scale and then weighted at 60% of the project grade.

| Category              | Weight | What Is Evaluated                                                                                                    |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| **Sprint 1 delivery** | 10%    | Core services running, synchronous call working, k6 baseline in the report                                          |
| **Sprint 2 delivery** | 15%    | Redis cache implemented, async pipeline working end-to-end, at least one idempotent write                            |
| **Sprint 3 delivery** | 15%    | All services and workers running, DLQ handling on all queues, failure scenarios handled gracefully                   |
| **Sprint 4 delivery** | 20%    | Replication working across three or more services, system survives replica failure, system fully complete            |
| **Final demo**        | 10%    | System starts cleanly from `sprint-4` tag with replicas; team walks through key flows live; questions answered well |
| **k6 test quality**   | 15%    | Tests are meaningful; results are analyzed in reports; progression from baseline through scaling tells a clear story |
| **Code quality**      | 15%    | Code is readable; services are organized correctly; Compose file is clean; README is accurate                        |

### How Each Sprint Is Graded

Each sprint is graded at the TA demo on a 100-point rubric specific to that sprint's deliverables. The sprint score is then weighted by the percentages above. See each sprint document for the full rubric:

- [Sprint 1](../sprints/sprint-01/) — Foundation (10%)
- [Sprint 2](../sprints/sprint-02/) — Async Pipelines and Caching (15%)
- [Sprint 3](../sprints/sprint-03/) — Reliability and Poison Pills (15%)
- [Sprint 4](../sprints/sprint-04/) — Replication, Scaling, and Polish (20%)
- [Demo Day](../sprints/demo-day/) — Final expo (10%)

**Every sprint is graded on what is working at the tagged commit, not what was planned or promised.** A system that starts cleanly and demonstrates one working pipeline is better than an ambitious system that crashes on startup.

### What All Teams Are Expected to Deliver by Sprint 4

Regardless of team size, every team must reach the same finishing state:

- All core services and workers from the chosen system, fully implemented
- Redis used for caching, queuing, and pub/sub as specified by the system
- Dead letter queue handling on every worker pipeline
- At least one idempotent write path
- Replication of three or more services via `docker compose up --scale`
- A load balancer (Caddy) distributing traffic across replicas
- Health endpoints on every service and worker, with the required checks and fields
- k6 tests for every sprint, with results analyzed in the sprint reports

See [Systems](systems/) for what your chosen system requires.

---

## Individual Grade — 25%

The individual grade ensures that each team member contributes meaningfully. A strong team grade does not automatically mean a strong individual grade — if your peers say you were absent or your commit history is empty, your individual grade reflects that.

| Input                | Weight | How It Works                                                                                                                                                                                                 |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Git contribution** | 10%    | Commit history is verified against sprint report ownership claims using `git log --author` on each tagged commit. Commits must be in your claimed directories, spread across the sprint — not one last-minute dump. |
| **Sprint reports**   | 5%     | Each report must name specific files and directories you own and describe what you built. "Helped with backend" is not acceptable. Ownership claims must match your commit history.                           |
| **Peer evaluation**  | 10%    | A confidential form submitted after Demo Day. You rate each teammate on effort, reliability, communication, and technical contribution. Due **05.07**.                                                       |

### What "Good" Looks Like for Git Contribution

We run `git log --author="Your Name" --oneline sprint-X` against each tagged commit and look at which files each person's commits touch. A good individual record shows:

- Commits spread across the sprint, not all on the last day
- Commits touching files in the directories you claimed to own
- At least 3–5 commits per task branch (not one giant commit per feature)
- Commit messages that use the prefix format and describe what changed

A bad individual record — commits only in merge commits, commits touching files outside your stated scope, or no commits in a sprint — will result in a low individual score even if the team grade is high.

See [Git & GitHub Workflow](git/) for commit standards and how TAs verify contributions.

### What "Good" Looks Like for Sprint Reports

Each sprint report must include a contributions section where each team member's name is followed by:

- The specific directories and files they own (`order-service/src/routes.js`, `k6/sprint-2-cache.js`)
- One or two sentences describing what they actually built or changed

This section is cross-referenced against commit history. A person whose name appears only in merge commits, or who claims ownership of a directory their commits never touch, will lose individual points.

See the [Project Guide](project/) for the sprint report template and a worked example.

---

## Repository Grade — 15%

The repository grade evaluates how professional and usable your repository is as a whole. This is assessed once, at the end of the project, against the `sprint-4` tag.

| Criteria                   | What We Are Looking For                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **README quality**         | Accurate, complete, and up to date. A stranger could clone the repo, read the README, start the system with the documented `--scale` flags, and understand it. |
| **Repository structure**   | One directory per service at the root level. No nested service directories. Configuration, k6 tests, and sprint reports are where they are supposed to be. |
| **Commit history**         | Clear, descriptive commit messages using the prefix format. Work committed in small logical chunks, not one giant commit per sprint.                       |
| **Branching and tagging**  | All four sprint tags present and pointing to working commits. Main branch always in a working state at each tag.                                          |
| **Hygiene**                | No committed `node_modules/`, `.env` files, secrets, or build artifacts. `.gitignore` covers all the right cases.                                        |
| **Docker Compose clarity** | `compose.yml` is well-organized with clear service names and comments. Services are designed to scale correctly (no hardcoded ports or container names).  |

See [Repository Structure](repository/) for the full rules and conventions. See [Git & GitHub Workflow](git/) for commit and branching standards.

---

## Professionalism Multiplier

Attendance is taken at every project class session. There are **9 attendance opportunities** from 04.07 through 05.05 (Demo Day on 05.07 is graded separately and not part of this count).

Your Professionalism Multiplier is based on how many sessions you attend:

| Sessions Attended | Multiplier | Effect on Final Course Grade |
| ----------------- | ---------- | ---------------------------- |
| 9 of 9            | 1.00       | No change                    |
| 8 of 9            | 0.95       | Reduced by 5%                |
| 7 of 9            | 0.85       | Reduced by 15%               |
| 6 of 9            | 0.70       | Reduced by 30%               |
| 5 of 9            | 0.55       | Reduced by 45%               |
| 4 or fewer        | 0.40       | Reduced by 60%               |

**This multiplier applies to your entire final course grade, not just the project grade.** Missing multiple sessions can move you from an A to a B, or from a B to a D. Missing four or more sessions risks failing the course.

Excused absences (illness, family emergency, university-sanctioned event) do not count against your multiplier if you notify the instructor **before** the session. Retroactive excuses without documentation are not accepted.

---

## Summary: What Gets Graded and When

| What                       | When                             | Affects              |
| -------------------------- | -------------------------------- | -------------------- |
| Sprint 1 demo rubric       | 04.14–04.16 (TA demo)            | Team grade (10%)     |
| Sprint 2 demo rubric       | 04.21–04.23 (TA demo)            | Team grade (15%)     |
| Sprint 3 demo rubric       | 04.28–04.30 (TA demo)            | Team grade (15%)     |
| Sprint 4 demo rubric       | 05.05–05.07 (TA demo + expo)     | Team grade (20%)     |
| Final demo (expo)          | 05.07 (Demo Day)                 | Team grade (10%)     |
| k6 test quality            | Assessed across all four sprints | Team grade (15%)     |
| Code quality               | Assessed across all four sprints | Team grade (15%)     |
| Git contribution           | Verified at each sprint tag      | Individual grade (10%)|
| Sprint plan + report quality | Verified at each sprint tag    | Individual grade (5%) |
| Peer evaluations           | Due 05.07                        | Individual grade (10%)|
| Repository quality         | Assessed at `sprint-4` tag       | Repository grade (15%)|
| Attendance (9 sessions)    | Ongoing, 04.07–05.05             | Professionalism multiplier (entire final course grade) |

---

## A Note on Fairness

The three-part grading structure is designed so that a student who contributes strongly cannot be dragged down by a weak teammate, and a student who coasts cannot be lifted by a strong one.

If a team member is not contributing and you have made a good-faith effort to address it internally, notify the instructor early — ideally before Sprint 2. We can adjust workloads and intervene during the project. We cannot fix things retroactively after the peer evaluation is submitted.
