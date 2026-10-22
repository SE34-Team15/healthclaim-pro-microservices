import http from 'k6/http';
import { check, sleep } from 'k6';

// ==============================================================================
// HealthClaim Pro - k6 Scalability Experiment: Scenario A (Baseline - 1 Replica)
// Workload Profile: Ramp-up from 50 to 500 VUs over 3 minutes
// ==============================================================================

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 VUs
    { duration: '60s', target: 250 }, // Ramp-up to 250 VUs
    { duration: '60s', target: 500 }, // Peak burst to 500 VUs
    { duration: '30s', target: 0 },   // Cool-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Max 5% failures under stress
    http_req_duration: ['p(95)<3000'], // P95 latency baseline threshold
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:4000';

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
    hospitalName: 'Singapore General Hospital (Polyclinic)',
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
      remainingBalance: 3500.0,
      annualLimit: 5000.0,
      cumulativeDeductibleSpent: 200.0,
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Benchmark-Scenario': 'Baseline-Single-Replica',
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

  sleep(0.1); // Small think-time between simulated claim submissions
}
