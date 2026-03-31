# Scenario 2: Scaled Services Without Load Balancing

In this scenario, you will run three service instances, but you will still send traffic to only one of them. The goal is to test whether scaling alone improves behavior when the traffic pattern does not change.

## Your goal

By the end of this scenario, you should be able to answer this question:

> If you add replicas but keep sending traffic to only one instance, what improvement should you expect?

## Files in this folder

- `docker-compose.yml`: starts three service containers on ports `3001`, `3002`, and `3003`
- `app/server.js`: returns the container hostname, simulated delay, and a per-container request count
- `app/Dockerfile`: builds the service image used by all three containers
- `tools/`: builds a utility container with `bash`, `curl`, `jq`, `k6`, and other helpful command-line tools
- `results/`: save your output files and notes here
- `load-test.js`: sends load to only one service instance

## Step 1: Start the services

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

## Step 3: Confirm all three services work

From inside the tools container, run:

```bash
curl -s http://service-1:3000/ | jq
curl -s http://service-2:3000/ | jq
curl -s http://service-3:3000/ | jq
```

Each service should respond with JSON. Notice that each container has its own hostname.

## Step 4: Make the traffic pattern visible

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

## Step 5: Run the load test

From inside the tools container, run:

```bash
mkdir -p results
k6 run --summary-export results/k6-summary.json load-test.js | tee results/k6-output.txt
```

This script targets only `http://service-1:3000/`.

Because `/workspace` is a bind mount to this folder, everything in `results/` will be saved in `scenario-02/results/` on your machine.

## Step 6: Inspect the counters after k6

Run:

```bash
curl -s http://service-1:3000/stats | tee results/service-1-stats.json | jq
curl -s http://service-2:3000/stats | tee results/service-2-stats.json | jq
curl -s http://service-3:3000/stats | tee results/service-3-stats.json | jq
```

These files will make it easy to compare how much traffic each replica actually handled.

## Step 7: Compare your results

Compare this scenario against Scenario 1 and write down:

- requests/sec
- p95 latency
- error rate
- whether the numbers changed much from the baseline
- how the request counters differed across the three replicas

## Before You Analyze Your Results

Read [the k6 analysis guide](../k6-guide.md) before you write your conclusions. It explains which k6 metrics matter most and how to compare one system configuration to another.

## Step 8: Reflect

Answer this question before moving on:

> If the architecture changed but the traffic pattern did not, what improvement should you actually expect?

Add a short note in `results/notes.md` summarizing your answer.

If you want to make the point even more obvious, run `docker compose logs service-1 service-2 service-3` in another terminal and compare how noisy each container is.

## Step 9: Stop the scenario

When you are done, run:

```bash
exit
docker compose down
```
