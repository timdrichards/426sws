import http from 'k6/http';
import { check } from 'k6';

// ===========================================================================
// SCENARIO 4: BREAKING THE SYSTEM
// ===========================================================================
//
// Scenario 3 showed that 3 replicas behind a load balancer handle 100 VUs
// better than a single replica. But every system has a ceiling. This test
// finds it.
//
// Instead of a fixed number of VUs, this test uses "stages" to ramp up
// traffic over time:
//
//   10s at 100 VUs  -- warm-up (the system can handle this from Scenario 3)
//   20s to 300 VUs  -- increasing pressure
//   20s to 500 VUs  -- heavy pressure
//   20s to 800 VUs  -- extreme pressure
//   10s back to 0   -- cool-down
//
// At some point during the ramp, you will see:
//   - request duration spike (requests queuing far longer than 500ms)
//   - error rate climb above 0% (connection refused, timeouts)
//   - throughput plateau or drop (the system cannot process requests faster)
//
// The containers in this scenario are also resource-constrained:
//   - 64MB memory limit per service replica
//   - 0.5 CPU per service replica
//
// These limits simulate a production environment where containers do not
// have unlimited resources. Under enough pressure, a container may run out
// of memory and get killed by Docker (OOMKilled), or the CPU throttling
// may make the 500ms blocking work take even longer.
//
// WHY THIS MATTERS:
//
// Knowing that load balancing helps is not enough. You also need to know
// WHERE the system breaks so you can set alerts, plan capacity, and define
// SLOs (Service Level Objectives). The thresholds below define what
// "acceptable" looks like. When the test finishes, k6 will tell you
// whether the system met those targets or failed them.
// ===========================================================================

export const options = {
  stages: [
    { duration: '10s', target: 100 },  // warm-up: same load as Scenario 3
    { duration: '20s', target: 300 },   // ramp: increasing pressure
    { duration: '20s', target: 500 },   // ramp: heavy pressure
    { duration: '20s', target: 800 },   // ramp: extreme pressure
    { duration: '10s', target: 0 },     // cool-down
  ],

  // Thresholds define pass/fail criteria. k6 will report whether the system
  // met these targets. These are intentionally set to values that should be
  // achievable at low VU counts but will likely fail under extreme load.
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // p95 latency under 2 seconds
    http_req_failed: ['rate<0.10'],     // fewer than 10% of requests fail
  },
};

const targetUrl = __ENV.TARGET_URL || 'http://caddy/';

export default function () {
  const res = http.get(targetUrl);

  // check() records pass/fail rates in k6 output so you can see at what
  // point responses stop being successful.
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has hostname': (r) => {
      try {
        return JSON.parse(r.body).hostname !== undefined;
      } catch {
        return false;
      }
    },
  });
}
