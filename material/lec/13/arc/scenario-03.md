# Scenario 3: Load Balancing with Caddy

In this scenario, you will put Caddy in front of three service instances and send traffic through it. The goal is to compare this load-balanced setup against the earlier scenarios.

## Your goal

By the end of this scenario, you should be able to answer this question:

What changes when traffic is distributed across multiple replicas instead of being sent to only one?

## Files in this folder

- `docker-compose.yml`: starts three backend service containers and one Caddy container
- `app/server.js`: returns the container hostname, simulated delay, and a per-container request count
- `app/Dockerfile`: builds the service image used by all three backends
- `Caddyfile`: tells Caddy to distribute requests across the three backends with round robin
- `tools/`: builds a utility container with `bash`, `curl`, `jq`, `k6`, and other helpful command-line tools
- `results/`: save your output files and notes here
- `load-test.js`: sends load to Caddy on port `80`

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

## Step 3: Confirm the load-balanced endpoint works

From inside the tools container, run:

```bash
curl -s http://caddy/ | jq
```

Run that command a few times. You should see the hostname in the response change as Caddy routes requests to different backends.

## Step 4: Make the distribution visible

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

## Step 5: Run the load test

From inside the tools container, run:

```bash
mkdir -p results
k6 run --summary-export results/k6-summary.json load-test.js | tee results/k6-output.txt
```

This script sends traffic to Caddy, not directly to an individual service.

Because `/workspace` is a bind mount to this folder, everything in `results/` will be saved in `scenario-03/results/` on your machine.

## Step 6: Inspect the counters after k6

Run:

```bash
curl -s http://service-1:3000/stats | tee results/service-1-stats.json | jq
curl -s http://service-2:3000/stats | tee results/service-2-stats.json | jq
curl -s http://service-3:3000/stats | tee results/service-3-stats.json | jq
```

These files will help you compare how traffic was distributed across replicas.

## Step 7: Compare your results

Compare this scenario against Scenarios 1 and 2 and write down:

- requests/sec
- p95 latency
- error rate
- what evidence you see that requests are being distributed
- how the request counters differ from Scenario 2

## Before You Analyze Your Results

Read [the k6 analysis guide](../k6-guide.md) before you write your conclusions. It will help you explain not just what changed, but what those changes suggest about the system.

## Step 8: Reflect

Answer these questions before moving on:

- How do your results compare with the earlier scenarios?
- What evidence do you see that load balancing is actually happening?

Add a short note in `results/notes.md` summarizing your answer.

If you want to look even closer, run `docker compose logs caddy service-1 service-2 service-3` in another terminal while the test is running.

## Step 9: Stop the scenario

When you are done, run:

```bash
exit
docker compose down
```
