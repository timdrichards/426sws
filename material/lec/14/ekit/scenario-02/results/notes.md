# Scenario 2: Load Balancing with Caddy

## Observations (3 replicas)

- requests/sec:
- p(95) latency:
- error rate:
- evidence that requests are being distributed:
- request counts per replica:
  - service-1:
  - service-2:
  - service-3:

## Reflection

- How do your results compare with Scenario 1?

> Your answer here.

- What evidence do you see that load balancing is actually happening?

> Your answer here.

- Why did the same architectural setup (3 replicas + Caddy) show no improvement last time but a clear improvement this time?

> Your answer here.

## Scaling Experiment

Record your p(95) values in `scaling-results.csv` in this directory.

- Does p(95) keep improving as you add replicas? At what point does it stop improving?

> Your answer here.

- Does p(95) ever get *worse* as you add more replicas? If so, at what replica count?

> Your answer here.

- Why would adding more replicas eventually stop helping or make things worse? What resource on your machine are the replicas competing for?

> Your answer here.

- If you were running this in production and needed lower latency, what would you do once adding replicas on one machine stopped helping?

> Your answer here.
