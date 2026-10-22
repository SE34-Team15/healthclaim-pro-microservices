# HealthClaim Pro (Microservices & Kubernetes)

> **Distributed Enterprise Medical Insurance & Settlement Platform**  
> Kubernetes (K3s) • Horizontal Pod Autoscaling (HPA) • RabbitMQ Event-Driven Settlement • Redis Rule Cache • Reverse-Proxy API Gateway

---

## 🌐 Live Production Deployment

- **Production URL**: [https://ms.healthclaim.pro](https://ms.healthclaim.pro)
- **Aggregated Health Endpoint**: [https://ms.healthclaim.pro/api/v1/health](https://ms.healthclaim.pro/api/v1/health)
- **Infrastructure**: Rancher K3s (Kubernetes) on AWS EC2 (`ap-southeast-1`), Cloudflare SSL / DNS Proxied
- **Companion Monolith Repository**: [SE34-Team15/healthclaim-pro](https://github.com/SE34-Team15/healthclaim-pro) (Live at [https://healthclaim.pro](https://healthclaim.pro))

### 🔑 Standard RBAC Roles
| Role | Email | Responsibilities |
| :--- | :--- | :--- |
| **System Admin** | `admin@healthclaim.pro` | Compliance rules AST management, benefit tiers configuration, system telemetry |
| **Claim Officer** | `officer@healthclaim.pro` | Medical claim assessment, rule validation overrides, approval workflows |
| **Finance Manager** | `finance@healthclaim.pro` | Payment settlement disbursement, financial analytics, ledger auditing |
| **Security Auditor**| `auditor@healthclaim.pro` | Tamper-evident audit log tracking, compliance inspection |
| **Employee** | `employee@healthclaim.pro` | Claim submission, receipt file uploads, personal quota tracking |

---

## 🏛️ Microservice Architecture & Topology

The distributed platform is partitioned into autonomous microservices orchestrated via Kubernetes (K3s):

```text
                               ┌────────────────────────────────┐
                               │     Cloudflare Edge (HTTPS)    │
                               │      ms.healthclaim.pro        │
                               └──────────────┬─────────────────┘
                                              │ Ingress Port 80/443
                               ┌──────────────▼─────────────────┐
                               │   API Gateway (Reverse Proxy)  │
                               │    Host: api-gateway (port 4000)│
                               │  Serves Frontend SPA & Routes  │
                               └───┬──────────┬─────────────┬───┘
                                   │          │             │
        ┌──────────────────────────┘          │             └──────────────────────────┐
        │ /api/v1/claims                      │ /api/v1/rules                          │ /api/v1/policies
        ▼                                     ▼                                        ▼
┌───────────────────┐               ┌───────────────────┐                    ┌───────────────────┐
│   Claim Service   │               │Rule Engine Service│                    │ Actuarial Service │
│ (Port 3001, NestJS│               │ (Port 3002, NestJS│                    │ (Port 3003, NestJS│
│ State Machine & IAM               │AST Evaluation & HPA                    │ Benefit Tiers &   │
└─────────┬─────────┘               └─────────┬─────────┘                    │ Policy Quotas     │
          │                                   │                              └─────────┬─────────┘
          │ AMQP Events                       │ Cache                                  │
          ▼                                   ▼                                        ▼
┌───────────────────┐               ┌───────────────────┐                    ┌───────────────────┐
│ RabbitMQ Message  │               │   Redis Caching   │                    │PostgreSQL Database│
│ Broker            │               │ healthclaim:rules │                    │   (Isolated DB)   │
└─────────┬─────────┘               └───────────────────┘                    └───────────────────┘
          │ Asynchronous
          ▼
┌───────────────────┐
│ Settlement Worker │
│ Async Disbursement│
└───────────────────┘
```

---

## 📊 SWE5001 Verification & Benchmarks

All benchmark experiments were conducted on the live Kubernetes cluster on AWS EC2 using `grafana/k6`:

### 1. K8s Horizontal Pod Autoscaling (HPA) Benchmark (`load-tests/k6-scaled.js`)
- **Workload**: Ramp-up from 50 $\rightarrow$ 250 $\rightarrow$ 500 Virtual Users (VUs) over 3 minutes targeting `rule-engine-service`.
- **Throughput**: **81,393 requests served** in 3 minutes (**903.3 Requests/second** peak).
- **Success Rate**: **99.99%** (81,389 successful responses, 4 dropped under peak saturation).
- **Autoscaling Behavior**:
  - Initial state: **1 replica**
  - Load surge triggered K8s Metrics-Server CPU threshold (>70%)
  - HPA scaled deployment dynamically from **1 to 4 Pod replicas** (`rule-engine-service-548895bf57-*`) to absorb burst traffic.

### 2. Redis Cache Ablation Experiment (`load-tests/k6-cache-benchmark.js`)
- **Evaluation Target**: AST compliance rule evaluation pipeline comparing Redis-cached evaluation vs database-bypass evaluation (`?bypassCache=true`).
- **Benchmark Results**:
  - **Cache ON (Redis Hit)**: Average latency **8.77 ms** (median 5.15 ms, P95 17.29 ms), 100% check pass rate.
  - **Cache OFF (DB Ablation)**: Average latency **11.30 ms** (median 7.39 ms, P95 26.98 ms), 100% check pass rate.
  - **Improvement**: Redis AST caching delivers a **~22.4% reduction in average latency** and prevents database connection pool exhaustion under sustained concurrency.

---

## 🛠️ Local Development & Deployment

### Run Locally with Docker Compose
```bash
docker compose up -d
```

### Deploy to Kubernetes (K3s / Minikube)
```bash
# 1. Apply Kubernetes manifests
kubectl apply -f k8s/

# 2. Monitor Pod status
kubectl get pods -n healthclaim -o wide

# 3. Check HPA status
kubectl get hpa -n healthclaim
```

### Run k6 Load Tests
```bash
# Cache Ablation benchmark
docker run --network host --rm -v $(pwd)/load-tests:/load-tests grafana/k6:latest run -e TARGET_URL=http://localhost:4000 /load-tests/k6-cache-benchmark.js

# HPA Scalability benchmark
docker run --network host --rm -v $(pwd)/load-tests:/load-tests grafana/k6:latest run -e TARGET_URL=http://localhost:4000 /load-tests/k6-scaled.js
```
