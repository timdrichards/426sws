---
layout: layouts/base.njk
title: COMPSCI 426
---

# Scenario 1: Baseline Service

In this scenario, you will measure the behavior of a single service instance with no gateway and no load balancer in front of it. This is your baseline for the rest of the class.

## Your goal

By the end of this scenario, you should be able to answer this question:

How does one replica behave when multiple users hit it at the same time?

## Files in this folder

- `docker-compose.yml`: starts one service container and exposes it on port `3000`
- `app/server.js`: returns the container hostname and a simulated delay
- `app/Dockerfile`: builds the service image
- `tools/`: builds a utility container with `bash`, `curl`, `jq`, `k6`, and other helpful command-line tools
- `results/`: save your output files and notes here
- `load-test.js`: sends load directly to the service

## Step 1: Start the service

Run:

```bash
docker compose up --build
```

Leave that terminal running.

## Step 2: Open a shell in the tools container

In a second terminal, run:

```bash
docker compose exec tools bash
```

You are now inside a container with the class scenario folder mounted at `/workspace`.

## Step 3: Confirm the service works

From inside the tools container, run:

```bash
curl -s http://service:3000/ | jq
```

You should get a JSON response that includes the container hostname, delay, and timestamp.

## Step 4: Run the load test

From inside the tools container, run:

```bash
mkdir -p results
k6 run --summary-export results/k6-summary.json load-test.js | tee results/k6-output.txt
```

Because `/workspace` is a bind mount to this folder, everything in `results/` will be saved in `scenario-01/results/` on your machine.

## Step 5: Record what you observe

Write down:

- requests/sec
- p95 latency
- error rate
- anything surprising in the raw k6 output

## Before You Analyze Your Results

Read [the k6 analysis guide](../k6-guide.md) before you write your conclusions. It walks through example output and shows you how to turn the raw numbers into an explanation of system behavior.

## Step 6: Reflect

Answer this question before moving on:

What does this baseline tell you about the behavior of a single replica under concurrent traffic?

Add a short note in `results/notes.md` summarizing your answer.

## Step 7: Stop the scenario

When you are done, run:

```bash
exit
docker compose down
```
