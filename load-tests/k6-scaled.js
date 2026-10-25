import http from 'k6/http';
import { check, sleep } from 'k6';

// ==============================================================================
// HealthClaim Pro - k6 Scalability Experiment: Scenario B (HPA Auto-Scaled)
// Workload Profile: Ramp-up from 50 to 500 VUs over 3 minutes with HPA active
// ==============================================================================

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Initial warm-up
    { duration: '60s', target: 250 }, // HPA triggers scale-out (1 -> 3 replicas)
    { duration: '60s', target: 500 }, // Peak sustained load (scales to 5 replicas)
    { duration: '30s', target: 0 },   // Cool-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Under 1% failures expected with HPA
    http_req_duration: ['p(95)<800'],  // P95 latency threshold tailored for public cloud WAN & Cloudflare (<800ms)
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://ms.healthclaim.pro';

const SAMPLE_DIAGNOSES = [
  'J06.9 - Acute upper respiratory infection',
  'M54.5 - Low back pain',
  'K21.9 - Gastro-esophageal reflux disease',
  'I10 - Essential hypertension',
  'E11.9 - Type 2 diabetes mellitus',
];

const HOSPITAL_GRADES = ['GRADE_3A', 'GRADE_2A', 'GRADE_1A', 'GRADE_B'];

export default function () {
  const diagnosis = SAMPLE_DIAGNOSES[Math.floor(Math.random() * SAMPLE_DIAGNOSES.length)];
  const hospitalGrade = HOSPITAL_GRADES[Math.floor(Math.random() * HOSPITAL_GRADES.length)];
  const totalAmount = Math.floor(Math.random() * 800) + 50;

  const payload = JSON.stringify({
    category: 'CONSULTATION',
    totalAmount: totalAmount,
    hospitalName: 'National University Hospital (NUH)',
    hospitalGrade: hospitalGrade,
    diagnosisCode: diagnosis,
    items: [
      {
        description: 'Specialist Consultation Fee',
        category: 'CONSULTATION',
        unitPrice: totalAmount * 0.6,
        quantity: 1,
        totalPrice: totalAmount * 0.6,
      },
      {
        description: 'Prescription Pharmaceuticals',
        category: 'MEDICATION',
        unitPrice: totalAmount * 0.4,
        quantity: 1,
        totalPrice: totalAmount * 0.4,
      },
    ],
    userQuota: {
      remainingBalance: 4200.0,
      annualLimit: 5000.0,
      cumulativeDeductibleSpent: 150.0,
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Benchmark-Scenario': 'Scaled-HPA-Active',
    },
  };

  const res = http.post(`${BASE_URL}/api/v1/rules/benchmark-evaluate`, payload, params);

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'rule evaluation completed': (r) => {
      try {
        const body = JSON.parse(r.body);
        const results = body.data?.results !== undefined ? body.data.results : body.results;
        return results !== undefined;
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}
