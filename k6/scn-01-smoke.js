import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1%
    http_req_duration: ['p(95)<300'], // p95 < 300ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function SMOKE() {
  const res = http.get(`${BASE_URL}/api/medications`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has medications': (r) => r.json().length >= 0,
  });
  sleep(1);
}
