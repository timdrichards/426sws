---
layout: layouts/base.njk
title: COMPSCI 426
---

# k6 Analysis Guide

This guide shows you how to read `k6` output as evidence about system behavior, not just as a wall of numbers.

Use it with the scenario work in class:

- Scenario 1: one service, no load balancer
- Scenario 2: three services, but traffic still hits only one
- Scenario 3: three services behind Caddy

The main idea is simple:

`k6` does not tell you what is wrong. It tells you what changed, how much it changed, and where you should investigate next.

---

## A Good Way to Read k6 Output

When you look at `k6` output, do not start by reading every number in order. Start with four questions:

1. How much load did we generate?
2. How fast did the system respond?
3. Did requests fail?
4. How much work did the system actually complete?

In practice, that means focusing on:

- `vus`: how much concurrency was applied
- `http_req_duration`: how long requests took
- `http_req_failed`: whether requests failed
- `http_reqs`: how many requests were completed and at what rate

After that, you can look at the supporting metrics like `iteration_duration`.

---

## Example 1: A Strained Single Service

Imagine this came from a system with one replica and no load balancer.

```text
scenarios: (100.00%) 1 scenario, 20 max VUs, 1m0s max duration
default: 20 looping VUs for 30s

     data_received..................: 76 kB 2.5 kB/s
     data_sent......................: 21 kB 694 B/s
     http_req_blocked...............: avg=91us    min=4us    med=8us    max=2.11ms p(90)=16us   p(95)=24us
     http_req_connecting............: avg=22us    min=0s     med=0s     max=1.01ms p(90)=0s     p(95)=0s
     http_req_duration..............: avg=412ms   min=188ms  med=367ms  max=2.14s  p(90)=703ms  p(95)=931ms
       { expected_response:true }...: avg=412ms   min=188ms  med=367ms  max=2.14s  p(90)=703ms  p(95)=931ms
     http_req_failed................: 2.13%  ✓ 9        ✗ 413
     http_req_receiving.............: avg=82us    min=19us   med=41us   max=1.34ms p(90)=129us  p(95)=171us
     http_req_sending...............: avg=29us    min=7us    med=16us   max=244us  p(90)=47us   p(95)=63us
     http_req_tls_handshaking.......: avg=0s      min=0s     med=0s     max=0s     p(90)=0s     p(95)=0s
     http_req_waiting...............: avg=411ms   min=188ms  med=367ms  max=2.14s  p(90)=703ms  p(95)=930ms
     http_reqs......................: 422    14.02/s
     iteration_duration.............: avg=1.41s   min=1.19s  med=1.37s  max=3.14s  p(90)=1.70s  p(95)=1.93s
     iterations.....................: 422    14.02/s
     vus............................: 20     min=20     max=20
     vus_max........................: 20     min=20     max=20
```

### What story does this output tell?

This system is handling the workload, but not comfortably.

The big clues are:

- p95 latency is high: `931ms`
- max latency is much worse: `2.14s`
- some requests are failing: `2.13%`
- throughput is modest: `14.02 requests/sec`

This looks like a service that is becoming overloaded. Most requests still work, but response times are stretching out and the worst requests are much slower than the median.

### How to read it line by line

#### `scenarios`

```text
scenarios: (100.00%) 1 scenario, 20 max VUs, 1m0s max duration
default: 20 looping VUs for 30s
```

This tells you the shape of the test:

- one scenario was configured
- at most 20 virtual users were active
- the scenario ran for 30 seconds
- the extra time in `1m0s max duration` includes setup, shutdown, and overhead

This gives context to every metric below it. If you do not know the load level, the performance numbers are hard to interpret.

#### `data_received` and `data_sent`

These tell you how much network traffic moved during the test.

- `data_received`: bytes the client received from the server
- `data_sent`: bytes the client sent to the server

These are usually not the first metrics to focus on in this class, but they help you understand scale and can matter if payload sizes change.

#### `http_req_blocked`

This is time spent waiting before the request could actually start.

It can include:

- waiting for a free TCP connection
- connection pool limits
- DNS lookup delays
- other client-side waiting

Here it is tiny, which suggests the client was not the main bottleneck.

#### `http_req_connecting`

This measures TCP connection setup time.

Here it is also tiny, which means the network connection itself was not expensive.

#### `http_req_duration`

This is one of the most important metrics in the whole report.

It is the total time for the HTTP request, from sending until the full response is received.

Important parts:

- `avg=412ms`: the average request took 412 ms
- `med=367ms`: half the requests finished faster than 367 ms
- `p(90)=703ms`: 90% of requests finished in 703 ms or less
- `p(95)=931ms`: 95% of requests finished in 931 ms or less
- `max=2.14s`: the slowest request took more than 2 seconds

### Why p95 matters more than average

The average says, “on average, requests were around 412 ms.”

But the p95 says, “5% of requests were slower than 931 ms.”

That matters because users do not experience averages. They experience individual requests. If enough requests are much slower than the average, the average hides the pain.

In this example:

- average: moderately high
- p95: much worse
- max: much worse again

That spread suggests unstable performance under load.

#### `{ expected_response:true }`

This is a filtered version of request duration for responses that counted as expected.

In many cases, it will be the same as `http_req_duration` if nearly all responses were treated as expected. If you had many errors, these two could differ more.

#### `http_req_failed`

```text
http_req_failed................: 2.13%  ✓ 9        ✗ 413
```

This tells you the percentage of requests that k6 considered failed.

In k6, this line is a **rate metric**. The percentage is the important part.

The counts at the end show how many times the metric evaluated to true or false:

- `✓ 9` means 9 requests counted as failed
- `✗ 413` means 413 requests did not count as failed

That can look a little odd at first, because the checkmark here means “the condition was true,” not “everything is good.”

Important idea:

This does **not** automatically tell you the exact reason.

A request might count as failed because:

- the connection timed out
- the server returned an error status
- your script explicitly marked it as failed with a check

In this example, any non-zero failure rate is a warning sign. A `2.13%` failure rate means some users are definitely having a bad experience.

#### `http_req_receiving`

This is the time spent receiving the response body from the server after the server started sending it.

Here it is tiny, which suggests the network transfer itself is not the main problem.

#### `http_req_sending`

This is the time spent sending the request body.

It is usually tiny for simple GET requests.

#### `http_req_tls_handshaking`

This is the time spent negotiating TLS.

It is zero here because the example uses plain HTTP rather than HTTPS.

#### `http_req_waiting`

This is also very important.

It is often the biggest clue about where the time went.

`http_req_waiting` is roughly the time to first byte: how long the client waited for the server to start responding.

If this is large, the server is usually where the delay is happening.

In this example:

- `http_req_waiting` is almost the same as `http_req_duration`

That suggests the server spent most of the request time thinking, sleeping, processing, or waiting internally. The network was not the main issue.

#### `http_reqs`

```text
http_reqs......................: 422    14.02/s
```

This tells you:

- total HTTP requests completed: `422`
- average request rate: `14.02 requests/sec`

This is your throughput signal.

When comparing systems, higher throughput can be good, but only if latency and errors stay acceptable.

#### `iteration_duration`

This is how long each full loop of the default function took.

In this class, one iteration is:

1. make one HTTP request
2. sleep for one second

That means iteration duration is not just request time. It includes the `sleep(1)` too.

This is why `iteration_duration` is around `1.41s` while request duration is `412ms`.

#### `iterations`

This is how many times the default function completed.

In this script, each iteration makes exactly one HTTP request, so `iterations` and `http_reqs` match.

If your script made two requests per loop, these would be different.

#### `vus` and `vus_max`

- `vus`: how many virtual users were active
- `vus_max`: the maximum configured VUs available for the test

Here both confirm the system was tested with 20 concurrent users.

### What should you focus on most in Example 1?

If you only had time to report four things, report:

- `p95 latency`: `931ms`
- `error rate`: `2.13%`
- `throughput`: `14.02 req/s`
- the gap between median and max latency

### A good summary sentence for Example 1

“Under 20 VUs, the single-service system completed about 14 requests per second, but p95 latency was close to 1 second and some requests failed, which suggests the service was under meaningful strain.”

---

## Example 2: A Healthier Load-Balanced System

Now imagine the same style of test after traffic is routed through a load balancer to multiple replicas.

```text
scenarios: (100.00%) 1 scenario, 20 max VUs, 1m0s max duration
default: 20 looping VUs for 30s

     data_received..................: 93 kB 3.1 kB/s
     data_sent......................: 24 kB 793 B/s
     http_req_blocked...............: avg=79us    min=4us    med=8us    max=1.86ms p(90)=14us   p(95)=21us
     http_req_connecting............: avg=18us    min=0s     med=0s     max=932us  p(90)=0s     p(95)=0s
     http_req_duration..............: avg=171ms   min=101ms  med=159ms  max=488ms  p(90)=234ms  p(95)=267ms
       { expected_response:true }...: avg=171ms   min=101ms  med=159ms  max=488ms  p(90)=234ms  p(95)=267ms
     http_req_failed................: 0.00%  ✓ 0        ✗ 512
     http_req_receiving.............: avg=75us    min=18us   med=39us   max=820us  p(90)=111us  p(95)=143us
     http_req_sending...............: avg=27us    min=7us    med=14us   max=169us  p(90)=43us   p(95)=57us
     http_req_tls_handshaking.......: avg=0s      min=0s     med=0s     max=0s     p(90)=0s     p(95)=0s
     http_req_waiting...............: avg=171ms   min=101ms  med=159ms  max=488ms  p(90)=234ms  p(95)=267ms
     http_reqs......................: 512    17.03/s
     iteration_duration.............: avg=1.17s   min=1.10s  med=1.16s  max=1.49s  p(90)=1.24s  p(95)=1.27s
     iterations.....................: 512    17.03/s
     vus............................: 20     min=20     max=20
     vus_max........................: 20     min=20     max=20
```

### What story does this output tell?

This system looks healthier under the same load.

The strongest clues are:

- p95 latency dropped from `931ms` to `267ms`
- error rate dropped from `2.13%` to `0.00%`
- throughput rose from `14.02 req/s` to `17.03 req/s`
- worst-case latency dropped from `2.14s` to `488ms`

This suggests the system is using its available capacity more effectively.

### What stayed the same?

- same kind of test
- same max VUs
- same duration

That is what makes the comparison meaningful.

### What changed?

- requests are completing faster
- fewer extreme outliers appear
- no requests failed
- more requests complete per second

### Why is the p95 especially important here?

The average improved a lot, but the p95 improvement matters more for user experience:

- Example 1 p95: `931ms`
- Example 2 p95: `267ms`

That means the slower end of the request population improved dramatically.

This is often what load balancing helps with: not just raw throughput, but consistency.

### What does the max tell us?

- Example 1 max: `2.14s`
- Example 2 max: `488ms`

The worst request in Example 2 is still slower than the average request in Example 1.

That is a strong signal that the system became more stable under load.

### What should you focus on most in Example 2?

Again, the most important metrics are:

- `p95 latency`: `267ms`
- `error rate`: `0.00%`
- `throughput`: `17.03 req/s`
- the smaller spread between median, p95, and max

### A good summary sentence for Example 2

“Under the same 20-VU workload, the load-balanced system handled more requests per second, reduced p95 latency to about 267 ms, and eliminated request failures, which suggests the traffic path was distributing load more effectively.”

---

## Comparing the Two Examples

| Metric             | Example 1: Strained Single Service | Example 2: Healthier Load-Balanced System | What it suggests                          |
| ------------------ | ---------------------------------: | ----------------------------------------: | ----------------------------------------- |
| Average latency    |                             412 ms |                                    171 ms | requests are faster overall               |
| Median latency     |                             367 ms |                                    159 ms | the typical request is faster             |
| p95 latency        |                             931 ms |                                    267 ms | the slower user experience improved a lot |
| Max latency        |                             2.14 s |                                    488 ms | fewer severe outliers                     |
| Error rate         |                              2.13% |                                     0.00% | the healthier system is more reliable     |
| Requests/sec       |                              14.02 |                                     17.03 | the healthier system completes more work  |
| Iteration duration |                             1.41 s |                                    1.17 s | each VU loop finishes sooner              |

### What is the big lesson?

Do not ask only:

- “Which system had a lower average?”

Also ask:

- “Which system gave users a more consistent experience?”
- “Which system failed less often?”
- “Which system completed more work?”

In systems work, consistency and reliability often matter as much as speed.

---

## Which Metrics Matter Most in This Class?

For the three scenarios in this class, focus on these first:

### `http_req_duration`

Focus especially on:

- `med`
- `p(90)`
- `p(95)`
- `max`

Why:

- the median tells you what a typical request looks like
- p90 and p95 tell you what slower requests look like
- max tells you whether there were very bad outliers

### `http_req_failed`

Why:

- even a small non-zero failure rate matters
- a faster system is not better if it is dropping requests

### `http_reqs`

Why:

- this is your throughput signal
- it tells you how much work the system actually completed

### `iteration_duration`

Why:

- it helps you connect request behavior to the full loop each VU is running
- in this class, it includes the `sleep(1)` in the script

### `vus`

Why:

- it reminds you what load was actually applied
- a result only makes sense relative to the workload

---

## What to Pay Less Attention To at First

These metrics are still real, but they are usually secondary in this class:

- `http_req_sending`
- `http_req_receiving`
- `http_req_connecting`
- `http_req_blocked`
- `data_sent`
- `data_received`

Why?

Because in these scenarios the main story is usually:

- server-side waiting time
- latency percentiles
- throughput
- whether traffic was distributed

If one of the secondary metrics suddenly becomes large, then it becomes important.

---

## How to Write a Good Analysis Paragraph

A strong analysis usually includes four parts:

1. State the workload.
2. Report the most important metrics.
3. Compare them to another scenario or baseline.
4. Interpret what the change suggests about the system.

### Example

“With 20 virtual users for 30 seconds, Scenario 3 completed more requests per second than Scenario 1, reduced p95 latency substantially, and had no request failures. This suggests that routing traffic through Caddy allowed multiple replicas to share the load, producing both higher throughput and more consistent response times.”

---

## Common Mistakes When Reading k6 Output

### Mistake 1: Focusing only on the average

Why it is a mistake:

- averages can hide slow outliers
- p95 often tells a more honest story

### Mistake 2: Ignoring failure rate because it is “small”

Why it is a mistake:

- even a few failed requests mean some users had a broken experience

### Mistake 3: Comparing two runs with different workloads

Why it is a mistake:

- if VUs or duration changed, the comparison may not be fair

### Mistake 4: Assuming higher throughput always means better

Why it is a mistake:

- a system can push more requests while also getting less reliable

### Mistake 5: Treating k6 as proof of root cause

Why it is a mistake:

- k6 shows symptoms
- you still need logs, container stats, counters, and architecture knowledge

---

## A Simple Checklist for Your Scenario Write-Up

When you finish a scenario, answer these questions:

- What workload did I run?
- What were the requests/sec?
- What was the p95 latency?
- Were there any failed requests?
- How did this compare to the previous scenario?
- What system change probably explains the difference?
- What extra evidence supports that interpretation?

For this class, extra evidence might include:

- hostname rotation in responses
- per-replica request counters
- service logs
- Caddy being present or absent in the traffic path

---

## How This Connects to the Three Scenarios

### Scenario 1

Expected story:

- one service handles everything
- latency may rise under load
- throughput is limited by one replica

### Scenario 2

Expected story:

- multiple replicas exist
- performance may look similar to Scenario 1
- request counters should show one replica doing most of the work

### Scenario 3

Expected story:

- multiple replicas actually share the work
- throughput should improve
- latency should become lower and more consistent
- counters and hostname rotation should support the claim

---

## Final Advice

When you analyze `k6` output, do not just say:

- “Scenario 3 was better.”

Say something stronger:

- what changed
- by how much
- compared to what
- what that suggests about the system

That is the difference between reporting numbers and doing analysis.
