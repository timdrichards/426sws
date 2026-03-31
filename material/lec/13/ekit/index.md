---
layout: layouts/base.njk
title: COMPSCI 426
---

# 13 Services, Scaling, and Load Balancing

## Activity

This activity sequence walks you through three progressively more realistic deployment setups so you can see how architecture and traffic patterns affect performance.

## Setup

Download and unzip [13-ekit.zip](13-ekit.zip). This folder contains a directory for each scenario described below. All of the exploration and discovery you do will be within these folders.

## Overview

The main goal of this activity is to help you connect architecture decisions to observable system behavior. In class, it is easy to say that "scaling out" improves capacity or that "load balancing" improves performance, but those ideas only really make sense when you watch traffic move through actual running services and compare the results. These scenarios are designed to make that comparison concrete.

You are doing this activity so that you can separate three ideas that are often blurred together:

- a single service handling all incoming requests
- multiple replicas existing, but not actually sharing the work
- multiple replicas actively receiving distributed traffic through an intermediary

By working through those cases in order, you can see what changes because of replication, what changes because of traffic routing, and what does not change unless the request path itself changes.

### Purpose

In scalable systems, adding more servers is only part of the story. The system also needs a way to decide where requests should go, how traffic should be distributed, and how clients should access the service without needing to know every backend instance directly. This activity helps you observe that:

- one replica gives you a baseline for latency, throughput, and failure behavior under concurrent load
- extra replicas do not help much if requests continue to hit only one instance
- distributing requests across replicas can change system behavior because the work is shared
- observability data such as request counts, p95 latency, and error rate help explain whether an architectural change is actually doing useful work

### The Architectures You Will Compare

You will work through three related architectures:

- Scenario 1 uses one service instance with no gateway and no load balancer. This gives you the baseline behavior of a single replica.
- Scenario 2 uses three service instances, but the load test still sends traffic to only one of them. This shows that simply having more replicas available does not automatically improve performance.
- Scenario 3 uses three service instances behind Caddy, which distributes incoming requests across the replicas. This lets you compare replicated-but-unused capacity against replicated-and-actively-shared capacity.

### Gateway and Load Balancer

A gateway is an entry point that sits in front of backend services. Clients send requests to the gateway instead of talking directly to individual service instances. In larger systems, a gateway can provide a stable public address, centralize routing, enforce security rules, handle cross-cutting concerns such as logging or authentication, and hide internal service topology from users.

A load balancer is a component that spreads incoming requests across multiple backend instances. Its purpose is to prevent one replica from doing all the work while others sit idle, improve resource utilization, and increase the system's ability to handle more concurrent traffic. In practice, a single tool can act as both a gateway and a load balancer. In this activity, Caddy plays that role by accepting requests at one front door and forwarding them across several backend services.

Across these scenarios, you will:

- establish a baseline for a single service under concurrent traffic
- test whether adding replicas helps when requests still go to only one instance
- observe how a reverse proxy and load balancer change system behavior when traffic is distributed across replicas
- practice reading k6 output and turning metrics into an explanation of system behavior
- compare evidence from latency, throughput, error rate, and per-replica request counts

By the end of the activity, you should be able to explain the difference between scaling a service and actually using that extra capacity through load balancing.

## Scenario 1: Baseline Service

In this scenario, you will measure the behavior of a single service instance with no gateway and no load balancer in front of it. This is your baseline for the rest of the class.

### Your goal

By the end of this scenario, you should be able to answer this question:

How does one replica behave when multiple users hit it at the same time?

### Files in this folder

- `scenario-01/docker-compose.yml`: starts one service container and exposes it on port `3000`
- `scenario-01/app/server.js`: returns the container hostname and a simulated delay
- `scenario-01/app/Dockerfile`: builds the service image
- `scenario-01/tools/`: builds a utility container with `bash`, `curl`, `jq`, `k6`, and other helpful command-line tools
- `scenario-01/results/`: save your output files and notes here
- `scenario-01/load-test.js`: sends load directly to the service

### Step 1: Start the service

From `scenario-01/`, run:

```bash
docker compose up --build
```

Leave that terminal running.

### Step 2: Open a shell in the tools container

In a second terminal, from `scenario-01/`, run:

```bash
docker compose exec tools bash
```

You are now inside a container with the class scenario folder mounted at `/workspace`.

### Step 3: Confirm the service works

From inside the tools container, run:

```bash
curl -s http://service:3000/ | jq
```

You should get a JSON response that includes the container hostname, delay, and timestamp.

### Step 4: Run the load test

From inside the tools container, run:

```bash
mkdir -p results
k6 run --summary-export results/k6-summary.json load-test.js | tee results/k6-output.txt
```

Because `/workspace` is a bind mount to this folder, everything in `results/` will be saved in `scenario-01/results/` on your machine.

### Step 5: Record what you observe

Write down:

- requests/sec
- p95 latency
- error rate
- anything surprising in the raw k6 output

### Before You Analyze Your Results

Read [the k6 analysis guide](./k6-guide.md) before you write your conclusions. It walks through example output and shows you how to turn the raw numbers into an explanation of system behavior.

### Step 6: Reflect

Answer this question before moving on:

What does this baseline tell you about the behavior of a single replica under concurrent traffic?

Add a short note in `results/notes.md` summarizing your answer.

### Step 7: Stop the scenario

When you are done, run:

```bash
exit
docker compose down
```

## Scenario 2: Scaled Services Without Load Balancing

In this scenario, you will run three service instances, but you will still send traffic to only one of them. The goal is to test whether scaling alone improves behavior when the traffic pattern does not change.

### Your goal

By the end of this scenario, you should be able to answer this question:

> If you add replicas but keep sending traffic to only one instance, what improvement should you expect?

### Files in this folder

- `scenario-02/docker-compose.yml`: starts three service containers on ports `3001`, `3002`, and `3003`
- `scenario-02/app/server.js`: returns the container hostname, simulated delay, and a per-container request count
- `scenario-02/app/Dockerfile`: builds the service image used by all three containers
- `scenario-02/tools/`: builds a utility container with `bash`, `curl`, `jq`, `k6`, and other helpful command-line tools
- `scenario-02/results/`: save your output files and notes here
- `scenario-02/load-test.js`: sends load to only one service instance

### Step 1: Start the services

From `scenario-02/`, run:

```bash
docker compose up --build
```

Leave that terminal running.

### Step 2: Open a shell in the tools container

In a second terminal, from `scenario-02/`, run:

```bash
docker compose exec tools bash
```

You are now inside a container with the class scenario folder mounted at `/workspace`.

### Step 3: Confirm all three services work

From inside the tools container, run:

```bash
curl -s http://service-1:3000/ | jq
curl -s http://service-2:3000/ | jq
curl -s http://service-3:3000/ | jq
```

Each service should respond with JSON. Notice that each container has its own hostname.

### Step 4: Make the traffic pattern visible

Before you run k6, reset the counters:

```bash
curl -s -X POST http://service-1:3000/reset | jq
curl -s -X POST http://service-2:3000/reset | jq
curl -s -X POST http://service-3:3000/reset | jq
```

Now send a few manual requests to only `service-1`:

```bash
# This is a bash for-in loop - write this all on a single line
for i in $(seq 1 5); do curl -s http://service-1:3000/ | jq -r '.hostname + " request #" + (.requestCount | tostring)'; done
```

Check the counters:

```bash
curl -s http://service-1:3000/stats | jq
curl -s http://service-2:3000/stats | jq
curl -s http://service-3:3000/stats | jq
```

You should already see the contrast: one service is doing work, and the others are mostly idle.

### Step 5: Run the load test

From inside the tools container, run:

```bash
mkdir -p results
k6 run --summary-export results/k6-summary.json load-test.js | tee results/k6-output.txt
```

This script targets only `http://service-1:3000/`.

Because `/workspace` is a bind mount to this folder, everything in `results/` will be saved in `scenario-02/results/` on your machine.

### Step 6: Inspect the counters after k6

Run:

```bash
curl -s http://service-1:3000/stats | tee results/service-1-stats.json | jq
curl -s http://service-2:3000/stats | tee results/service-2-stats.json | jq
curl -s http://service-3:3000/stats | tee results/service-3-stats.json | jq
```

These files will make it easy to compare how much traffic each replica actually handled.

### Step 7: Compare your results

Compare this scenario against Scenario 1 and write down:

- requests/sec
- p95 latency
- error rate
- whether the numbers changed much from the baseline
- how the request counters differed across the three replicas

### Before You Analyze Your Results

Read [the k6 analysis guide](./k6-guide.md) before you write your conclusions. It explains which k6 metrics matter most and how to compare one system configuration to another.

### Step 8: Reflect

Answer this question before moving on:

> If the architecture changed but the traffic pattern did not, what improvement should you actually expect?

Add a short note in `results/notes.md` summarizing your answer.

If you want to make the point even more obvious, run `docker compose logs service-1 service-2 service-3` in another terminal and compare how noisy each container is.

### Step 9: Stop the scenario

When you are done, run:

```bash
exit
docker compose down
```

## Scenario 3: Load Balancing with Caddy

In this scenario, you will put Caddy in front of three service instances and send traffic through it. The goal is to compare this load-balanced setup against the earlier scenarios.

### Your goal

By the end of this scenario, you should be able to answer this question:

What changes when traffic is distributed across multiple replicas instead of being sent to only one?

### Files in this folder

- `scenario-03/docker-compose.yml`: starts three backend service containers and one Caddy container
- `scenario-03/app/server.js`: returns the container hostname, simulated delay, and a per-container request count
- `scenario-03/app/Dockerfile`: builds the service image used by all three backends
- `scenario-03/Caddyfile`: tells Caddy to distribute requests across the three backends with round robin
- `scenario-03/tools/`: builds a utility container with `bash`, `curl`, `jq`, `k6`, and other helpful command-line tools
- `scenario-03/results/`: save your output files and notes here
- `scenario-03/load-test.js`: sends load to Caddy on port `80`

### Step 1: Start the services

From `scenario-03/`, run:

```bash
docker compose up --build
```

Leave that terminal running.

### Step 2: Open a shell in the tools container

In a second terminal, from `scenario-03/`, run:

```bash
docker compose exec tools bash
```

You are now inside a container with the class scenario folder mounted at `/workspace`.

### Step 3: Confirm the load-balanced endpoint works

From inside the tools container, run:

```bash
curl -s http://caddy/ | jq
```

Run that command a few times. You should see the hostname in the response change as Caddy routes requests to different backends.

### Step 4: Make the distribution visible

Before you run k6, reset the counters on all three backends:

```bash
curl -s -X POST http://service-1:3000/reset | jq
curl -s -X POST http://service-2:3000/reset | jq
curl -s -X POST http://service-3:3000/reset | jq
```

Now send a few manual requests through Caddy:

```bash
for i in $(seq 1 6); do curl -s http://caddy/ | jq -r '.hostname + " request #" + (.requestCount | tostring)'; done
```

Check the backend counters:

```bash
curl -s http://service-1:3000/stats | jq
curl -s http://service-2:3000/stats | jq
curl -s http://service-3:3000/stats | jq
```

Unlike Scenario 2, you should now see work showing up on multiple replicas.

### Step 5: Run the load test

From inside the tools container, run:

```bash
mkdir -p results
k6 run --summary-export results/k6-summary.json load-test.js | tee results/k6-output.txt
```

This script sends traffic to Caddy, not directly to an individual service.

Because `/workspace` is a bind mount to this folder, everything in `results/` will be saved in `scenario-03/results/` on your machine.

### Step 6: Inspect the counters after k6

Run:

```bash
curl -s http://service-1:3000/stats | tee results/service-1-stats.json | jq
curl -s http://service-2:3000/stats | tee results/service-2-stats.json | jq
curl -s http://service-3:3000/stats | tee results/service-3-stats.json | jq
```

These files will help you compare how traffic was distributed across replicas.

### Step 7: Compare your results

Compare this scenario against Scenarios 1 and 2 and write down:

- requests/sec
- p95 latency
- error rate
- what evidence you see that requests are being distributed
- how the request counters differ from Scenario 2

### Before You Analyze Your Results

Read [the k6 analysis guide](./k6-guide.md) before you write your conclusions. It will help you explain not just what changed, but what those changes suggest about the system.

### Step 8: Reflect

Answer these questions before moving on:

- How do your results compare with the earlier scenarios?
- What evidence do you see that load balancing is actually happening?

Add a short note in `results/notes.md` summarizing your answer.

If you want to look even closer, run `docker compose logs caddy service-1 service-2 service-3` in another terminal while the test is running.

### Step 9: Stop the scenario

When you are done, run:

```bash
exit
docker compose down
```
