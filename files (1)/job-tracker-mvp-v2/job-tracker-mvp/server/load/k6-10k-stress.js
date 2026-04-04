import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    ramp_to_10k: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '5m', target: 2000 },
        { duration: '10m', target: 5000 },
        { duration: '10m', target: 10000 },
        { duration: '5m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800', 'p(99)<1800'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const response = http.get(`${BASE}/health`);
  check(response, { 'health responds': (r) => r.status === 200 });
  sleep(1);
}
