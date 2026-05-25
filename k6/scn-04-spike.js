import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '10s', target: 200 },
    { duration: '10s', target: 5 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function SPIKE() {
  // Random product browsing
  const res = http.get(`${BASE_URL}/api/medications`);
  check(res, { 'status is 200': (r) => r.status === 200 });

  const meds = res.json();
  if (meds && meds.length > 0) {
    const medId = meds[Math.floor(Math.random() * meds.length)]._id;
    http.get(`${BASE_URL}/api/medications/${medId}`);
  }

  sleep(0.1); // High frequency for spike
}
