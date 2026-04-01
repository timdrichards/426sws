import http from 'k6/http';

// ===========================================================================
// WHY THIS LOAD TEST IS DIFFERENT FROM LAST TIME
// ===========================================================================
//
// In the previous activity (Lecture 13), the load test looked like this:
//
//   export const options = { vus: 20, duration: '30s' };
//   export default function () {
//     http.get(targetUrl);
//     sleep(1);   // <-- each VU waits 1 full second between requests
//   }
//
// That test produced nearly identical results across all three scenarios
// (single replica, 3 replicas, 3 replicas + load balancer). The k6 numbers
// did not change because the test never actually stressed the server.
//
// Two problems made the old test ineffective:
//
// 1. sleep(1) throttled the CLIENT, not the server.
//    Each VU sent one request (~200ms), then sat idle for 1 second. With 20
//    VUs, the server only saw ~16 requests/sec. That is trivial load for
//    even a single Node.js process. The bottleneck was k6 pacing itself,
//    not the server being overwhelmed. Adding replicas to an un-saturated
//    server changes nothing measurable.
//
// 2. The server delay was ASYNC (non-blocking).
//    The old server used: await sleep(delayMs)  -- a setTimeout wrapped in
//    a Promise. Node.js handles thousands of concurrent timers without
//    breaking a sweat because setTimeout does not block the event loop.
//    Even without the k6 sleep, 20 concurrent async sleeps is nothing for
//    a single Node process.
//
// WHAT CHANGED:
//
// - The server now uses CPU-bound blocking work instead of async sleep.
//   A single Node process can only handle one request at a time because
//   the event loop is blocked for 500ms per request (~2 req/s max).
//
// - This load test removes sleep() entirely and increases VUs to 100.
//   k6 now sends requests as fast as the server can answer them, which
//   means the server is the bottleneck, not the test client.
//
// With these changes, Scenario 1 (single replica) should show significantly
// lower throughput and higher latency than Scenario 3 (3 replicas + Caddy),
// because the load balancer can spread work across 3 event loops instead
// of queuing everything behind one.
// ===========================================================================

export const options = {
  // 100 virtual users, each sending requests back-to-back with no pause.
  // This generates enough concurrent load to saturate a single Node process
  // and make the difference between 1 and 3 replicas clearly visible.
  vus: 100,
  duration: '30s',
};

const targetUrl = __ENV.TARGET_URL || 'http://service:3000/';

export default function () {
  // No sleep() between requests. Each VU sends the next request immediately
  // after the previous one completes. This is what makes the server the
  // bottleneck instead of the test client.
  http.get(targetUrl);
}
