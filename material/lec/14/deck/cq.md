---
layout: layouts/base.njk
title: "Closing Question: Full Solution"
---

# Closing Question: Full Solution

> Your system handles 6 req/s across 3 replicas on one machine. You need to handle 60 req/s. What is your plan?

---

## What We Know From the Activity

From the scaling experiment, we established these facts:

- Each replica does a **CPU-bound busy-wait** for 500ms per request
- That means each replica can handle: 1000ms / 500ms = **2 req/s**
- With 3 replicas on one machine: 3 × 2 = **6 req/s**
- We need **60 req/s** — a 10× increase

The naive answer is "run 30 replicas." But the scaling experiment showed that doesn't work on one machine. To understand why, we need to understand what a CPU core actually is.

---

## What Is a CPU Core?

A **CPU core** is an independent processing unit inside your computer's processor chip. Each core can execute one sequence of instructions at a time.

Modern processors have multiple cores on a single chip. When you hear "8-core processor," that means the chip has 8 independent units that can each run code simultaneously.

Here is what matters for our problem:

- A **CPU-bound** task (like our busy-wait loop) needs a core for the entire duration
- If a replica is busy-waiting for 500ms, it holds a core for that full 500ms
- If you have 8 cores, you can run **at most 8** CPU-bound tasks truly in parallel
- A 9th replica would have to **share** a core with another replica via time-slicing

**Time-slicing** is when the operating system rapidly switches a core between two tasks. Each task gets a fraction of the core's time, so both run slower. This is **concurrency** (interleaving) not **parallelism** (simultaneous execution).

This is exactly what the scaling experiment demonstrated: once you exceeded your machine's core count, adding more replicas made p(95) worse because every replica was getting less CPU time.

---

## Step 1: How Many Replicas Do We Need?

Each replica handles 2 req/s. We need 60 req/s.

```
replicas needed = 60 req/s ÷ 2 req/s per replica = 30 replicas
```

We need **30 replicas** running in parallel, each with a dedicated CPU core.

---

## Step 2: How Many Replicas Can One Machine Run?

From the scaling experiment, the effective limit is roughly the number of CPU cores. Past that point, replicas compete for cores and performance degrades.

This depends on the machine. Let's analyze two realistic options.

---

## Option A: Beefy Machines (10 Cores Each)

A 10-core machine can run 10 replicas at full speed.

```
throughput per machine = 10 replicas × 2 req/s = 20 req/s
```

One machine gives us 20 req/s. We need 60.

![Single 10-core machine: 20 req/s — not enough](../diagrams/single-machine-10-core.svg)

How many machines?

```
machines needed = 30 replicas ÷ 10 cores per machine = 3 machines
```

Three machines, each running 10 replicas, with a global load balancer distributing traffic:

![Three 10-core machines: 60 req/s](../diagrams/multi-machine-10-core.svg)

```
total throughput = 3 machines × 20 req/s = 60 req/s ✓
```

---

## Option B: Commodity Machines (6 Cores Each)

Smaller, cheaper machines with 6 cores each:

```
throughput per machine = 6 replicas × 2 req/s = 12 req/s
```

How many machines?

```
machines needed = 30 replicas ÷ 6 cores per machine = 5 machines
```

![Five 6-core machines: 60 req/s](../diagrams/multi-machine-6-core.svg)

```
total throughput = 5 machines × 12 req/s = 60 req/s ✓
```

---

## Comparing the Options

| | Beefy (10-core) | Commodity (6-core) |
|---|---|---|
| Machines needed | 3 | 5 |
| Total cores | 30 | 30 |
| Total replicas | 30 | 30 |
| Throughput | 60 req/s | 60 req/s |

Both options use 30 total cores. The choice between fewer big machines and more small machines is a cost and operational trade-off:

- **Fewer big machines**: simpler to manage, fewer network hops, but each failure loses more capacity (one machine down = 33% capacity loss)
- **More small machines**: each failure loses less capacity (one machine down = 20% loss), often cheaper per core in the cloud, but more machines to maintain

---

## Option C: Optimize the Work

Instead of adding hardware, reduce the work per request. If you can cut the 500ms CPU block to 250ms:

```
throughput per replica = 1000ms ÷ 250ms = 4 req/s
replicas needed = 60 req/s ÷ 4 req/s = 15 replicas
```

Now you only need 15 cores instead of 30. With 10-core machines:

```
machines needed = 15 ÷ 10 = 2 machines (with 5 cores to spare)
```

Optimization is a **multiplier** that reduces your infrastructure cost. In practice, this might mean:

- Caching expensive computations
- Moving CPU work to a more efficient language
- Breaking the work into async and sync parts (only the truly CPU-bound part blocks)
- Using a compiled addon for the hot loop

---

## Plan for Headroom

If 60 req/s is your expected peak, you should not provision for exactly 60. When you are at 100% capacity, any traffic spike will violate your SLO.

A common rule of thumb is to provision for **1.5× to 2× your expected peak**:

```
target capacity = 60 req/s × 1.5 = 90 req/s
replicas needed = 90 ÷ 2 = 45 replicas
machines (10-core) = 45 ÷ 10 = 5 machines
```

This headroom is what keeps your SLO intact during traffic spikes, deployments, and partial failures.

---

## Summary

1. "Just add 30 replicas" fails — the scaling experiment proved this
2. You need **30 real CPU cores** running replicas in parallel
3. One machine does not have 30 cores, so you need **multiple machines** (horizontal scaling)
4. A global load balancer distributes traffic across machines
5. Optimizing the work per request is a multiplier that reduces machine count
6. Always provision headroom above your expected peak

This is exactly why cloud platforms sell compute by the core and why Kubernetes clusters span multiple physical nodes.
