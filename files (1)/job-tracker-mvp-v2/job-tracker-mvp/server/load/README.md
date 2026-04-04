# Load Profiles

This folder contains load profiles used to prove readiness gates.

## Smoke

- File: `k6-smoke.js`
- Goal: Verify core health endpoints under light concurrency.
- Gate:
  - `http_req_failed < 1%`
  - `p95 < 500ms`
  - `p99 < 1200ms`

Run:

`k6 run load/k6-smoke.js`

## 10k Stress

- File: `k6-10k-stress.js`
- Goal: Ramp to 10k virtual users and verify API stability.
- Gate:
  - `http_req_failed < 2%`
  - `p95 < 800ms`
  - `p99 < 1800ms`

Run:

`k6 run load/k6-10k-stress.js`

## Evidence Pack

Attach these artifacts after each run:

1. k6 CLI output
2. `/metrics` snapshot before and after run
3. Any error logs and restart recovery timestamps
