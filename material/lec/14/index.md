---
layout: layouts/base.njk
title: COMPSCI 426 - Scalable Systems
---

# 14 Load Testing That Actually Tests Load

In this lecture, we revisit the scaling and load balancing scenarios from Lecture 13 with a critical correction: a load test designed to actually saturate the server. Last time, the k6 results were nearly identical across all scenarios because the test never generated enough pressure to expose the bottleneck. This time, we fix the server to do CPU-bound blocking work and fix the load test to send traffic at full speed. Students will observe a clear, measurable difference between a single replica and three replicas behind a load balancer, then push the system to its breaking point.

- [Slides](deck) ([pdf](deck/14-load-testing.pdf))
- [Activity](ekit)
- [k6 Analysis Guide](ekit/k6-guide)
- [SLO Reference](ekit/slo)
