import http from 'k6/http';
import { check, sleep } from 'k6';

// ==============================================================================
// HealthClaim Pro - k6 Cache Ablation Benchmark: Scenario C (OFF) vs D (ON)
// Workload Profile: Constant 100 VUs evaluating hot rule sets
// Usage:
//   k6 run -e BYPASS_CACHE=true k6-cache-benchmark.js  (Cache OFF)
//   k6 run -e BYPASS_CACHE=false k6-cache-benchmark.js (Cache ON)
// ==============================================================================

const BYPASS_CACHE = __ENV.BYPASS_CACHE === 'true';

export const options = {
  stages: [
    { duration: '15s', target: 50 },  // Ramp-up
    { duration: '60s', target: 100 }, // Sustained 100 concurrent claims
    { duration: '15s', target: 0 },   // Cool-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:4000';

export default function () {
  const payload = JSON.stringify({
    category: 'CONSULTATION',
    totalAmount: 180.0,
    hospitalName: 'Mount Elizabeth Hospital',
    hospitalGrade: 'GRADE_3A',
    items: [
      {
        description: 'General Consultation',
        category: 'CONSULTATION',
        unitPrice: 100.0,
        quantity: 1,
        totalPrice: 100.0,
      },
      {
        description: 'Prescription Drugs',
        category: 'MEDICATION',
        unitPrice: 80.0,
        quantity: 1,
        totalPrice: 80.0,
      },
    ],
    userQuota: {
      remainingBalance: 2000.0,
      annualLimit: 5000.0,
      cumulativeDeductibleSpent: 500.0,
    },
  });

  const url = `${BASE_URL}/api/v1/rules/benchmark-evaluate${BYPASS_CACHE ? '?bypassCache=true' : ''}`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache-Ablation': BYPASS_CACHE ? 'CACHE_OFF' : 'CACHE_ON',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'cache state verified': (r) => {
      try {
        const body = JSON.parse(r.body);
        return BYPASS_CACHE ? body.cached === false : body.cached === true;
      } catch {
        return false;
      }
    },
  });

  sleep(0.05);
}
