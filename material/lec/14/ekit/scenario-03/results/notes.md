# Scenario 3: Breaking the System

## Memory Baselines (before test)

- service-1 rss:
- service-2 rss:
- service-3 rss:

## Observations

- requests/sec (beginning of test):
- requests/sec (end of test):
- p(95) latency:
- error rate:
- thresholds:
  - http_req_duration p(95) < 2s: pass / fail
  - http_req_failed rate < 10%: pass / fail
- did any containers crash or restart?
- request counts per replica:
  - service-1:
  - service-2:
  - service-3:

## Memory After Test

- service-1 rss:
- service-2 rss:
- service-3 rss:

## Reflection

- At roughly how many VUs did the system start to degrade?

> Your answer here.

- What was the first sign of trouble in the k6 output?

> Your answer here.

- If this were a real service, what would you do with this information? Think about alerts, autoscaling triggers, and capacity planning.

> Your answer here.

- How does this connect to the idea of an [SLO](../../slo)? If your SLO says "p95 latency under 2 seconds," at what traffic level would you violate that SLO?

> Your answer here.
