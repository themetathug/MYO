import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1200'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const health = http.get(`${BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const ready = http.get(`${BASE}/health/ready`);
  check(ready, { 'ready 200/503 tolerated': (r) => r.status === 200 || r.status === 503 });

  sleep(1);
}
