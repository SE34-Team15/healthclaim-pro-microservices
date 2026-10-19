# HealthClaim Pro: Project Handover & Implementation Blueprint

> **Module:** NUS-ISS SWE5001 Practice Module (*Graduate Certificate in Architecting Scalable Systems*)  
> **Team:** Team 14  
> **Target System:** HealthClaim Pro (Cloud-Native Medical Insurance Adjudication & Settlement Platform)  
> **Status:** Project Proposal (`Team14_Project_Proposal.md`) **OFFICIALLY APPROVED** by Module Lecturers.  
> **Primary Milestone:** Final Practice Project Presentation on **26 Oct 2026 (10:40 AM – 11:20 AM)**  
> **Final Deliverable:** Final Project Report Submission Freeze on **16 Nov 2026**

---

## 1. Executive Summary & Handover Objective

### 1.1 Purpose of This Handover
This document serves as the master technical specification and execution guide for an autonomous coding agent taking over the implementation of **HealthClaim Pro** for the SWE5001 module. The project proposal and architecture design have been formally approved by the academic faculty. The incoming agent is expected to execute the codebase transition from the prior SWE5006 **Modular Layered Monolith** into a fully functioning, benchmarked **Cloud-Native, Event-Driven Microservices Platform**.

### 1.2 Core Business Context & Problem Statement
In enterprise corporate healthcare and insurance ecosystems, medical claim processing is notoriously plagued by fragmented IT architectures, high operational overhead, and severe scalability bottlenecks:
1. **Burst Traffic Vulnerability:** Claims surge exponentially during month-end payroll cycles and policy renewal windows, exhausting synchronous database connection pools and degrading monolithic backends.
2. **Rigid Policy Rules:** In legacy systems, changes in corporate benefits, deductible thresholds, or compliance regulations require code redeployment rather than dynamic runtime evaluation.
3. **Closed Ecosystem Integration:** Clinics, employers, TPAs (Third-Party Administrators), and clearing rails operate in silos without a standardized, multi-tenant digital platform layer.

### 1.3 The SWE5001 Architectural Objective
Evolve the existing SWE5006 clean-code base into a distributed platform that demonstrates **empirical horizontal scalability**, **cloud-native resiliency**, and **asynchronous decoupling**:
* **Domain-Driven Design (DDD):** Decompose the monolith into autonomous Bounded Contexts.
* **API Gateway Ingress:** Reverse proxy routing, rate limiting, and SSL termination.
* **Asynchronous Messaging:** RabbitMQ event broker for non-blocking domain events (`claim.submitted`, `eligibility.evaluated`, `benefit.calculated`, `claim.settled`).
* **Distributed Caching:** Redis 7 in-memory cache for hot AST rules and member quota balances.
* **Container Orchestration & Elasticity:** Docker Compose and Kubernetes manifests with Horizontal Pod Autoscaling (HPA: 1 $\rightarrow$ 5 replicas under load).
* **Empirical Verification (Mandatory):** Scripted **k6 load test benchmarks** proving baseline vs. scaled throughput (RPS), P95 latency, and error-rate stabilization.

---

## 2. Approved Architectural Blueprint & Platform Thinking

### 2.1 Platform Thinking: The Platform Ecosystem
HealthClaim Pro is architected as an **extensible two-sided digital platform** rather than a standalone CRUD application:
* **The Platform Seed (Reusable Core Assets):**
  * **Dynamic AST Rule Engine:** In-memory compilation and stateless evaluation of boolean compliance trees.
  * **Actuarial Calculation Pipeline:** Modular mathematical pipeline executing sequential deductibles, tiered co-payments, and corporate category caps.
  * **Claim Lifecycle State Machine:** Strict aggregate state governance (`SUBMITTED` $\rightarrow$ `EVALUATING` $\rightarrow$ `APPROVED`/`REJECTED` $\rightarrow$ `SETTLED`).
* **Platform Producers:**
  * **Medical Clinics & Hospitals:** Ingest invoice line items and receipt artifacts via open RESTful APIs.
  * **Insurers & Corporate HR:** Configure dynamic eligibility policies and benefit quotas without redeploying backend code.
* **Platform Consumers:**
  * **Employees & Patients:** Submit claims and track real-time annual limit balances via React SPA.
  * **TPAs & Auditors:** Review exception-flagged claims in real time.
  * **Disbursement Rails:** Consume `claim.settled` events to trigger automated banking vouchers.

```
+--------------------------------------------------------------------------------------------------+
|                                  PRODUCERS (Supply Side)                                         |
|    [ Healthcare Providers & Clinics ]           [ Insurers & Corporate HR ]                      |
|       (Bulk Invoices & Receipts)                   (Dynamic AST Rules & Policy Quotas)           |
+------------------------------------+-------------------------------------+-----------------------+
                                     \                                     /
                                      v                                   v
+--------------------------------------------------------------------------------------------------+
|                             HEALTHCLAIM PRO PLATFORM CORE (The Seed)                             |
|                                                                                                  |
|   +------------------------------------------------------------------------------------------+   |
|   |             Open RESTful API Gateway (Routing, Rate Limiting, Contract Schemas)          |   |
|   +------------------------------------------------------------------------------------------+   |
|                |                                    |                                 |          |
|                v                                    v                                 v          |
|   [ Dynamic AST Rule Engine ]         [ Actuarial Pipeline ]             [ State Machine ]       |
+----------------+------------------------------------+---------------------------------+----------+
                 |                                    |                                 |
                 v                                    v                                 v
+--------------------------------------------------------------------------------------------------+
|                                  CONSUMERS (Demand Side)                                         |
|    [ Insured Employees & Patients ]   [ Third-Party Administrators ]    [ Settlement Rails ]     |
|         (Filing & Balances)                (Audit & Exceptions)              (Disbursements)     |
+--------------------------------------------------------------------------------------------------+
```

---

### 2.2 4-Tier Structural Architecture & Topology
The approved system topology decouples the system into 4 distinct physical tiers:

```
+--------------------------------------------------------------------------------------------------+
|                                    1. Client & Ingress Tier                                      |
|            [ Integrated React SPA ]                    [ Third-Party TPA Systems ]               |
|            (Tailwind CSS, Vite, UI)                    (RESTful OpenAPI Consumers)               |
|                        \                                          /                              |
|                         +---------> [ API Gateway ] <------------+                               |
|                               (Reverse Proxy, Rate Limit)                                        |
+---------------------------------------------+----------------------------------------------------+
                                              |
                          RESTful Ingress     |  (/api/v1/claims, /api/v1/rules, /api/v1/policies)
                                              v
+-------------------------------------------------------------+------------------------------------+
|         2. Core Microservices Tier (DDD Bounded Contexts)   | 4. Asynchronous Event & Settlement |
|  [ Claim Service ]   [ Rule Engine ]   [ Actuarial & Policy]| [ RabbitMQ Message Broker ]        |
|  • Aggregate Root    • AST Compiler    • Co-Pay Pipeline    | (Topics: claim.*, eligibility.*)   |
|  • State Machine     • Stateless Eval  • Quota Ledger       |                 |                  |
+---------+------------------+-------------------+------------+                 | claim.settled    |
          |                  |                   |                              v                  |
          | SQL              | Cache (Dashed)    | SQL                [ Settlement Worker ]        |
          v                  v                   v                    • Voucher PDF Generation     |
+-------------------------------------------------------------+       • Email Notifications        |
|          3. Distributed Persistence & Caching Tier          |                 |                  |
|  [ PostgreSQL ]      [ Redis 7 Cache ] [ PostgreSQL ]       |                 v Archive          |
|  (Claim Schema)      (Hot Rules/Quotas)(Policy Schema)      |       [ MinIO / AWS S3 Storage ]   |
+-------------------------------------------------------------+------------------------------------+
```

* **Tier 1 (Client & Ingress):** Vite + React SPA and external TPA systems route through the **API Gateway** (`/api/v1/claims`, `/api/v1/rules`, `/api/v1/policies`).
* **Tier 2 (Core Microservices):** Stateless, autonomous services operating over their designated DDD Bounded Contexts.
* **Tier 3 (Persistence & Cache):** Polyglot storage: dedicated schemas for Claims and Policies, plus **Redis 7** for sub-millisecond AST rule compilation caching and active quota ledger read acceleration.
* **Tier 4 (Async Event & Settlement):** Dedicated **RabbitMQ broker** distributing domain events to downstream consumers, notably the **Settlement Worker** archiving itemized vouchers to **MinIO / AWS S3**.

---

### 2.3 End-to-End Adjudication Event Pipeline (Happy Path)
During runtime claims adjudication, microservices interact via non-blocking asynchronous event choreography:

$$\text{Step 1} \xrightarrow{\text{claim.submitted}} \text{Step 2} \xrightarrow{\text{eligibility.evaluated}} \text{Step 3} \xrightarrow{\text{benefit.calculated}} \text{Step 4} \xrightarrow{\text{claim.settled}} \text{Step 5}$$

1. **Step 1: Submit Claim (`claim-service`)**  
   Patient/Clinic submits invoice. Claim is persisted as `SUBMITTED` state in PostgreSQL. Claim Service emits domain event: `claim.submitted`.
2. **Step 2: Evaluate Eligibility (`rule-engine-service`)**  
   Rule Engine consumes `claim.submitted`. Compiles AST condition tree (or fetches cached tree from Redis). Evaluates medical eligibility without disk I/O. Emits domain event: `eligibility.evaluated` (Status: `PASSED`).
3. **Step 3: Calculate Benefit (`actuarial-service`)**  
   Actuarial Service consumes `eligibility.evaluated`. Executes calculation pipeline: validates deductible threshold, applies tiered co-pay percentage, deducts against remaining corporate annual quota. Emits domain event: `benefit.calculated` (Approved payout amount).
4. **Step 4: Settle Claim (`claim-service`)**  
   Claim Service consumes `benefit.calculated`. Transitions aggregate state machine to `APPROVED` and `SETTLED`. Emits domain event: `claim.settled`.
5. **Step 5: Voucher & Notification (`settlement-worker`)**  
   Background Settlement Worker consumes `claim.settled`. Generates itemized settlement voucher artifact, archives to MinIO/S3, and dispatches mock transactional notification email.

---

## 3. Existing Codebase Audit (`healthclaim-pro`)

The incoming agent is starting from an existing, high-quality monorepo built in SWE5006:

```
healthclaim-pro/
├── backend/
│   ├── src/
│   │   ├── rules/          # [REUSABLE] AST Compiler, Specification & Composite Pattern
│   │   ├── actuarial/      # [REUSABLE] Strategy & Builder calculation pipeline
│   │   ├── claims/         # [REUSABLE] Claim Aggregate Root & State Machine
│   │   ├── policies/       # [REUSABLE] Policy definitions and quota limits
│   │   ├── auth/           # Minimal JWT authentication & RBAC guards
│   │   ├── audit/          # Audit logging stubs
│   │   ├── storage/        # File attachment adapter
│   │   ├── app.module.ts   # Monolith root NestJS module
│   │   └── main.ts         # Monolith entry point (port 3000)
│   ├── prisma/             # Prisma ORM schema & migrations (PostgreSQL)
│   └── package.json        # NestJS 10, Prisma, Vitest test suite
├── frontend/               # React 18, Vite, Tailwind CSS, Shadcn UI
│   ├── src/
│   │   ├── pages/          # Claim submission, Officer audit queue, Policy manager
│   │   └── components/     # UI components
├── shared/                 # @healthclaim/shared TypeScript DTOs & domain contracts
├── docker-compose.yml      # Local dev database compose
├── Dockerfile              # Monolith container build
└── pnpm-workspace.yaml     # PNPM monorepo configuration
```

### What is Already Built (Do Not Re-invent):
* **AST Rule Engine Core (`backend/src/rules`):** Full boolean condition evaluation (`AND`, `OR`, `NOT`, `EQUALS`, `GREATER_THAN`) compiling JSON expressions into in-memory executable specifications.
* **Actuarial Math Pipeline (`backend/src/actuarial`):** Deductible deduction, co-payment splits, and policy tier caps.
* **Claim State Machine (`backend/src/claims`):** State transitions and aggregate root invariants.
* **Frontend UI (`frontend`):** Working React forms for claim filing and review queues.
* **Unit Tests (`backend/test`):** Extensive Vitest unit test coverage.

### What Must Be Transformed for SWE5001:
1. **Decompose Monolith into Microservice Containers:** Split the single `backend` app into independently runnable services or configure entry points for:
   - `claim-service` (Port 3001)
   - `rule-engine-service` (Port 3002)
   - `actuarial-service` (Port 3003)
   - `settlement-worker` (Background consumer)
2. **RabbitMQ Event Backbone:** Replace in-process EventEmitter with genuine RabbitMQ AMQP publish/subscribe using `amqplib` or `@nestjs/microservices`.
3. **Redis 7 In-Memory Cache:** Integrate Redis client (via `ioredis` / `cache-manager-ioredis`) into Rule Engine and Actuarial Service to cache precompiled ASTs and quota lookups.
4. **API Gateway:** Stand up an API Gateway (Reverse Proxy) routing incoming traffic to the appropriate microservice.
5. **Docker Compose & Kubernetes Manifests:** Complete multi-service orchestration with health checks.
6. **k6 Scalability Load Tests:** Automated load test scripts executing Baseline vs. Scaled and Cache OFF vs. ON benchmarks.

---

## 4. Work Breakdown Structure (WBS) & Team Ownership

> **CRITICAL ACADEMIC REQUIREMENT:**  
> The project budget is **50 Person-Days (PD)** split equally across the 5 team members (**strictly 10.0 PD each**).  
> All code commits, PRs, and documentation must align with these specific assignments:

| WBS Code | Task Name & Scope | Owner | Effort | Deliverables / Key Code Files |
| :--- | :--- | :--- | :--- | :--- |
| **WBS 1.1** | Strategic DDD Isolation & Contracts | **Wang Jiaxuan** | 2.0 PD | Bounded context isolation, inter-service REST DTOs |
| **WBS 1.2** | API Gateway Distributed Ingress | **Wang Jiaxuan** | 2.0 PD | Gateway reverse proxy, route mapping, SSL termination |
| **WBS 2.1** | Core Rule Engine Microservice | **Wang Jiaxuan** | 4.0 PD | Standalone `rule-engine-service`, stateless AST eval |
| **WBS 4.1** | Cross-Service Integration & Debugging | **Wang Jiaxuan** | 2.0 PD | End-to-end event choreography debugging, tracing |
| **Total** | **Wang Jiaxuan's Total Allocation** | | **10.0 PD** | |
| **WBS 2.2** | Actuarial Calculation Pipeline Microservice | **Wei Qianxiang** | 3.5 PD | Standalone `actuarial-service`, co-pay & deductible logic |
| **WBS 3.2** | Redis Caching Layer & Quota Fast-Path | **Wei Qianxiang** | 3.5 PD | Redis 7 cache client, eviction policy, quota caching |
| **WBS 4.3** | Visual Rule & Actuarial UI Binding | **Wei Qianxiang** | 2.0 PD | React UI binding for rules and calculation preview |
| **WBS 5.3** | Slide Deck Preparation | **Wei Qianxiang** | 1.0 PD | Architecture & benchmark slide deck synthesis |
| **Total** | **Wei Qianxiang's Total Allocation** | | **10.0 PD** | |
| **WBS 2.3** | Claim Lifecycle Microservice & State Machine | **Ding Zihe** | 3.5 PD | Standalone `claim-service`, claim aggregate root |
| **WBS 3.4** | Automated Scalability Load Testing (k6) | **Ding Zihe** | 2.0 PD | k6 load scripts (`baseline.js`, `scaled.js`, `cache.js`) |
| **WBS 4.2** | React SPA Claim Filing & Audit UI | **Ding Zihe** | 2.5 PD | End-to-end frontend claim workflows & officer queue |
| **WBS 5.2** | Project Report Drafting (Claims & Testing) | **Ding Zihe** | 2.0 PD | Report Sections 3 & 4 (Architecture & Experiments) |
| **Total** | **Ding Zihe's Total Allocation** | | **10.0 PD** | |
| **WBS 2.4** | Async Settlement Worker & S3 Archival | **Yang Rushang** | 4.0 PD | `settlement-worker`, MinIO/S3 voucher PDF generation |
| **WBS 3.3** | Container Manifests & Kubernetes HPA | **Yang Rushang** | 2.0 PD | `docker-compose.yml`, K8s Deployment, Service, HPA |
| **WBS 5.1** | Deployment Architecture Runbook | **Yang Rushang** | 2.0 PD | Operations runbook, local & cloud deployment guide |
| **WBS 5.2** | Project Report Drafting (DevOps & Deploy) | **Yang Rushang** | 2.0 PD | Report Sections 1, 2 & 5 (Platform & Operations) |
| **Total** | **Yang Rushang's Total Allocation** | | **10.0 PD** | |
| **WBS 1.3** | Shared Contract Library & Event Schemas | **Hu Lunwei** | 2.0 PD | `@healthclaim/shared`, Zod schemas, domain event types |
| **WBS 3.1** | RabbitMQ Broker Setup & Domain Event Pipeline | **Hu Lunwei** | 3.5 PD | RabbitMQ setup, exchange bindings, retry & dead-letter queue |
| **WBS 4.4** | CI/CD Pipeline Automation & Regression Tests | **Hu Lunwei** | 2.5 PD | GitHub Actions CI/CD, linting, Vitest coverage $\ge 85\%$ |
| **WBS 5.3** | Presentation Demo Rehearsals | **Hu Lunwei** | 2.0 PD | Live demo orchestration & failover rehearsal script |
| **Total** | **Hu Lunwei's Total Allocation** | | **10.0 PD** | |
| **SUM** | **Total Project Allocation (5 Members)** | | **50.0 PD** | |

---

## 5. Mandatory Scalability Verification Plan (k6 Experiments)

> **CORE EVALUATION CRITERION:**  
> SWE5001 requires empirical evidence demonstrating scalability rather than untested claims.  
> The incoming agent **must produce working k6 test scripts and repeatable execution results**.

### 5.1 Experiment Matrix

| Scenario | Target Setup | Workload Profile | Evaluation Metrics | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Scenario A: Baseline** | 1 replica of Rule Engine, 1 replica of Claim Service | Ramp-up: 50 $\rightarrow$ 500 VUs over 3 mins | RPS, P95/P99 latency, HTTP error rate | High latency spikes (>1500ms), CPU saturation, request timeouts |
| **Scenario B: Horizontally Scaled (HPA)** | HPA enabled (1 $\rightarrow$ 5 replicas, CPU threshold 70%) | Same workload: 50 $\rightarrow$ 500 VUs over 3 mins | RPS, P95/P99 latency, replica count over time | Pods scale to 4-5 replicas, P95 latency remains stable (<200ms), 0% error rate |
| **Scenario C: Cache Ablation (OFF)** | Redis caching disabled (Direct DB queries for rules) | Constant 100 VUs for 2 mins | DB query latency, DB CPU load, evaluation RPS | Elevated DB connection pressure, lower throughput ceiling |
| **Scenario D: Cache Accelerated (ON)** | Redis active for hot AST rule trees and quotas | Constant 100 VUs for 2 mins | Cache hit ratio, P95 latency, evaluation RPS | $\ge 90\%$ cache hit ratio, sub-10ms evaluation latency, near-zero DB load |

### 5.2 k6 Script Requirements (`load-tests/`)
Create a dedicated `load-tests/` directory with:
* `k6-baseline.js`: Tests the single-replica configuration.
* `k6-scaled.js`: Tests the auto-scaled configuration.
* `k6-cache-benchmark.js`: Tests Cache ON vs. Cache OFF.
* Output: Automated summary JSON/CSV output so charts can be generated for the final presentation.

---

## 6. Implementation Roadmap for Incoming Agent

The incoming agent should follow this phased, step-by-step execution path:

```
[Phase 1: Contracts] ──> [Phase 2: Microservices] ──> [Phase 3: Redis & RabbitMQ]
                                                                  │
                                                                  v
[Phase 6: k6 Tests] <── [Phase 5: K8s & HPA] <── [Phase 4: Gateway & Worker]
```

### Phase 1: Shared Domain Contracts & Event Schemas (`@healthclaim/shared`)
* File targets: `shared/src/contracts/`, `shared/src/events/`
* Actions:
  * Define standard domain events:
    * `ClaimSubmittedEvent` (claim ID, policy ID, diagnosis code, invoice items, amount)
    * `EligibilityEvaluatedEvent` (claim ID, passed/failed, matched rule IDs, reasons)
    * `BenefitCalculatedEvent` (claim ID, approved payout, co-pay deducted, deductible applied)
    * `ClaimSettledEvent` (claim ID, final amount, settlement reference, patient email)
  * Build and export via `pnpm --filter @healthclaim/shared build`.

### Phase 2: Microservice Decomposition
* File targets: `backend/src/` or `services/`
* Actions:
  * Package microservices so each can start independently:
    * **`claim-service`**: Handles `/api/v1/claims`, persists to PostgreSQL, publishes `claim.submitted`, listens for `benefit.calculated`.
    * **`rule-engine-service`**: Stateless service compiling & evaluating AST condition trees. Listens for `claim.submitted`, publishes `eligibility.evaluated`.
    * **`actuarial-service`**: Policy rules & benefit calculations. Listens for `eligibility.evaluated`, publishes `benefit.calculated`.
  * Ensure environment variables are parameterized (`DATABASE_URL`, `RABBITMQ_URL`, `REDIS_URL`, `PORT`).

### Phase 3: RabbitMQ & Redis Infrastructure Integration
* File targets: `docker-compose.yml`, `backend/src/common/rabbitmq/`, `backend/src/common/redis/`
* Actions:
  * Update `docker-compose.yml` to include:
    * `rabbitmq:3-management` (ports 5672, 15672)
    * `redis:7-alpine` (port 6379)
    * `postgres:16-alpine` (port 5432)
    * `minio/minio` (ports 9000, 9001)
  * Implement RabbitMQ producer/consumer helpers with automatic exchange/queue bindings:
    * Exchange: `healthclaim.events` (Topic exchange)
    * Queues: `claim.submission.queue`, `rule.evaluation.queue`, `actuarial.calculation.queue`, `settlement.payout.queue`
  * Implement Redis caching service in Rule Engine: cache compiled AST functions by `policyId:ruleVersion`.

### Phase 4: Settlement Worker & API Gateway
* File targets: `services/settlement-worker/`, `gateway/`
* Actions:
  * Implement `settlement-worker`:
    * Listens for `claim.settled`.
    * Generates mock PDF settlement voucher (or structured itemized JSON voucher).
    * Saves artifact to MinIO S3 bucket `settlement-vouchers`.
    * Logs transactional email notification dispatch.
  * Implement API Gateway:
    * Can be a lightweight NestJS/Express reverse proxy or Nginx/Traefik container.
    * Routes `/api/v1/claims` $\rightarrow$ `claim-service:3001`
    * Routes `/api/v1/rules` $\rightarrow$ `rule-engine-service:3002`
    * Routes `/api/v1/policies` $\rightarrow$ `actuarial-service:3003`

### Phase 5: Containerization & Kubernetes Manifests
* File targets: `deploy/k8s/` or `k8s/`
* Actions:
  * Write Dockerfiles for each service with multi-stage builds.
  * Create Kubernetes manifests:
    * `claim-service-deployment.yaml` & `service.yaml`
    * `rule-engine-deployment.yaml` & `service.yaml`
    * `actuarial-service-deployment.yaml` & `service.yaml`
    * `hpa-rule-engine.yaml` (Min: 1, Max: 5, targetCPUUtilizationPercentage: 70)
  * Provide a clear runbook script to launch on Minikube / Docker Desktop K8s.

### Phase 6: k6 Load Test Suite & Experiment Execution
* File targets: `load-tests/`
* Actions:
  * Write `k6-baseline.js` and `k6-scaled.js`.
  * Execute test runs and generate summary result files (`baseline-results.json`, `scaled-results.json`).
  * Verify that under high concurrency (e.g. 300-500 VUs), HPA scales the Rule Engine from 1 to 5 replicas and stabilizes P95 latency.

---

## 7. Key Architecture Decision Records (ADRs)

| ADR ID | Decision Title | Status | Rationale & Constraint |
| :--- | :--- | :--- | :--- |
| **ADR-01** | **Modular Monolith to Microservices** | Accepted | Decomposes domain into independent bounded contexts allowing tailored horizontal auto-scaling (e.g. scaling Rule Engine 5x while keeping Policy at 1x). |
| **ADR-02** | **Containerized Microservices over Pure Serverless** | Accepted | Eliminates severe cold-start penalties during benchmark stress testing; ensures stable relational connection pooling. |
| **ADR-03** | **RabbitMQ Asynchronous Event Bus** | Accepted | Eliminates synchronous HTTP cascading failures. Claims intake returns HTTP 202/201 in <50ms while adjudication executes asynchronously. |
| **ADR-04** | **Redis 7 Distributed In-Memory Caching** | Accepted | AST trees change infrequently but evaluate on every claim. In-memory caching achieves sub-10ms rule processing without relational DB read bottleneck. |

---

## 8. Non-Functional Constraints & Security Boundaries

1. **Minimal Required Security Controls:**  
   Per module guidelines, implement only standard JWT token authentication and role-based access control (Admin, Officer, Employee) necessary to demonstrate user journeys. Do NOT waste person-days on MFA, zero-trust network policies, or advanced OAuth2 federation.
2. **Explicit Out-of-Scope:**  
   * Physical banking fiat clearing networks (use mock settlement vouchers).
   * Machine Learning / OCR invoice receipt model training (use mock extracted payload).
3. **Coding Standards:**  
   * Maintain strict TypeScript typing (`noImplicitAny: true`).
   * Preserve all existing domain unit tests in `backend/test`.
   * Unit test coverage must maintain $\ge 85\%$.

---

## 9. Key Project References & Artifact Links

* **Approved Project Proposal:** [`Team14_Project_Proposal.md`](file:///Users/aintor/Downloads/PM_Project_Brief/Team14_Project_Proposal.md)
* **Approved Architecture Topology Diagram:** [`02_architecture_topology.svg`](file:///Users/aintor/Downloads/PM_Project_Brief/diagrams/02_architecture_topology.svg)
* **Approved Platform Ecosystem Diagram:** [`01_platform_ecosystem.svg`](file:///Users/aintor/Downloads/PM_Project_Brief/diagrams/01_platform_ecosystem.svg)
* **Approved Adjudication Pipeline Diagram:** [`03_adjudication_pipeline.svg`](file:///Users/aintor/Downloads/PM_Project_Brief/diagrams/03_adjudication_pipeline.svg)
* **Approved Delivery Timeline & Milestones:** [`04_delivery_timeline_gantt.svg`](file:///Users/aintor/Downloads/PM_Project_Brief/diagrams/04_delivery_timeline_gantt.svg)
* **Module Briefing Document:** [`01 Briefing.pdf`](file:///Users/aintor/Downloads/PM_Project_Brief/01%20Briefing.pdf)
* **Presentation Guidelines & Schedule:** [`04 Project Presentation Guidelines & Schedule.pdf`](file:///Users/aintor/Downloads/PM_Project_Brief/04%20Project%20Presentation%20Guidelines%20&%20Schedule.pdf)
* **Academic Report Template:** [`02 Project Report Template for Practice Project.docx`](file:///Users/aintor/Downloads/PM_Project_Brief/02%20Project%20Report%20Template%20for%20Practice%20Project.docx)
