---
layout: layouts/base.njk
title: COMPSCI 426
---

# Service Level Objectives (SLOs)

## What is an SLO?

A Service Level Objective is a target for how well a service should behave, expressed as a measurable statement. It answers the question: "How do we know if this service is working well enough?"

SLOs sit between two related concepts:

- **SLI (Service Level Indicator)**: a metric you can measure. Examples: request latency, error rate, throughput, availability.
- **SLO (Service Level Objective)**: a target value or range for an SLI. Examples: "p95 latency should be under 500ms," "error rate should be below 1%."
- **SLA (Service Level Agreement)**: a contract with consequences (usually financial) if an SLO is not met. SLAs are business agreements. SLOs are engineering targets.

You can have SLOs without SLAs. Most internal services define SLOs to guide engineering decisions without attaching contractual penalties.

## Why SLOs matter

Without an SLO, there is no way to answer questions like:

- Is this service fast enough?
- Should we wake someone up at 3am because of this error rate?
- Did our last deployment make things worse?
- Do we need to add capacity?

SLOs turn subjective feelings ("the service feels slow") into objective measurements ("p95 latency exceeded our 500ms target for 12 minutes today"). They also help teams make tradeoffs. If your service is well within its SLOs, you can spend time on features instead of optimization. If it is close to violating them, you know to prioritize reliability work.

## How SLOs are defined

An SLO has three parts:

1. **The SLI**: what you are measuring (latency, error rate, availability, etc.)
2. **The target**: the threshold that defines "good enough"
3. **The window**: the time period over which the target applies

For example: "Over any rolling 30-day window, 99.9% of requests should complete successfully" combines all three parts. The SLI is request success rate, the target is 99.9%, and the window is 30 days.

## A simple text format for SLOs

You can define SLOs in a structured text file. Here is a format:

```
slo: <name>
sli: <what you are measuring>
target: <threshold>
window: <time period>
description: <plain-language explanation>
```

Each SLO definition is separated by a blank line.

## Examples

### Web API

```
slo: api-latency
sli: http_req_duration p95
target: < 500ms
window: rolling 24h
description: 95th percentile request latency should stay under 500ms over any 24-hour period.

slo: api-availability
sli: http_req_failed rate
target: < 0.1%
window: rolling 30d
description: Fewer than 0.1% of requests should fail over any rolling 30-day window.

slo: api-throughput
sli: http_reqs rate
target: >= 100 req/s
window: rolling 1h
description: The system should sustain at least 100 requests per second over any 1-hour window.
```

### Background job processor

```
slo: job-completion
sli: job_duration p99
target: < 30s
window: rolling 24h
description: 99th percentile job duration should stay under 30 seconds.

slo: job-success-rate
sli: job_failed rate
target: < 1%
window: rolling 7d
description: Fewer than 1% of jobs should fail over any rolling 7-day window.
```

### Database

```
slo: query-latency
sli: query_duration p95
target: < 50ms
window: rolling 24h
description: 95th percentile query latency should stay under 50ms.

slo: connection-availability
sli: connection_pool_exhausted rate
target: < 0.01%
window: rolling 7d
description: Connection pool exhaustion should occur on fewer than 0.01% of connection attempts.
```

## Connecting SLOs to load testing

Load testing helps you answer the question: "At what traffic level will we violate our SLOs?"

In Scenario 4 of this activity, the k6 test defines two thresholds:

```js
thresholds: {
  http_req_duration: ['p(95)<2000'],
  http_req_failed: ['rate<0.10'],
}
```

These are SLOs expressed in k6 syntax. They say:

- p95 latency should stay under 2 seconds
- Fewer than 10% of requests should fail

When k6 reports that a threshold failed, it means the system violated that SLO under the test conditions. By ramping traffic and watching when thresholds fail, you can determine the maximum load your system can handle while staying within its SLOs. That number is your capacity limit, and it tells you when you need to scale.
