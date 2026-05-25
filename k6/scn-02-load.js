import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    'http_req_failed{expected_response:true}': ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function LOAD() {
  const phone = `+38099${Math.floor(Math.random() * 9000000 + 1000000)}`;
  const password = 'Password123!';
  const name = 'Load Test User';

  // 1. Register
  let res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    phone, password, name
  }), { headers: { 'Content-Type': 'application/json' } });

  check(res, { 'registered successfully': (r) => r.status === 200 });

  if (res.status === 200) {
    // 2. Browse medications
    res = http.get(`${BASE_URL}/api/medications?limit=500`);
    check(res, { 'got medications': (r) => r.status === 200 });

    const meds = res.json();
    if (meds && meds.length > 0) {
      // Pick a random medication from the first 500
      const med = meds[Math.floor(Math.random() * Math.min(meds.length, 500))];

      // 3. Create order
      res = http.post(`${BASE_URL}/api/orders`, JSON.stringify({
        items: [{ medication: med._id, quantity: 1, price: med.price }],
        total: med.price
      }), { headers: { 'Content-Type': 'application/json' } });

      check(res, { 'order created': (r) => r.status === 200 });

      if (res.status === 200) {
        http.del(`${BASE_URL}/api/orders`);
      }
    }

    http.del(`${BASE_URL}/api/profile`);
  }

  sleep(1);
}
