# HealthClaim Pro: 微服务化与云原生重构实施规划 (Refactoring Master Plan)

> **目标课程:** NUS-ISS SWE5001 Practice Module (*Graduate Certificate in Architecting Scalable Systems*)  
> **团队编号:** Team 14 (5 位成员，预算严格 50.0 Person-Days，每人 10.0 PD)  
> **答辩时间:** 2026年10月26日 (10:40 AM – 11:20 AM)  
> **报告定稿:** 2026年11月16日  

---

## 1. 核心战略与架构原则

### 1.1 编程语言决策：严禁变更语言，保持全栈 TypeScript / NestJS
- **结论：不需要也不允许更改编程语言。**
- **依据**：
  1. **开题提案（Proposal）已获正式批准**：Proposal 第 2.1 节明确规定以 `@healthclaim/shared`（TypeScript 合约库）作为平台统一类型核心。
  2. **核心业务逻辑完全复用（Zero-Reinvention）**：SWE5006 时期已建立极高质量的领域代码（AST 规则编译器、精算策略管道、理赔状态机、MinIO 适配器），并通过了 163 个严苛的 Vitest 单元测试。
  3. **时间紧迫（仅剩 1 周答辩）**：更换语言（如改成 Java/Go）将导致全部领域模型重写、测试报废、调试周期拉长，具有致命风险。使用 TypeScript (NestJS 11) 进行微服务物理拆解是最高效、最稳健的技术路线。

### 1.2 仓库模式决策：坚持采用 Monorepo（单代码仓多微服务）
- **结论：无需拆分为多个独立 Git 仓库，坚持使用 Monorepo。**
- **理由与优势**：
  1. **微服务的本质是运行态解耦，而非 Git 仓库割裂**：微服务要求的是“独立进程、独立伸缩、独立故障域、独立存储/Schema”，Monorepo 同样能构建出完全独立的 Docker 镜像并部署到不同的 Kubernetes Pod。
  2. **领域契约原子同步（Atomic Shared Contracts）**：在 `@healthclaim/shared` 中更新领域事件（如 `ClaimSubmittedEvent`）时，所有微服务能瞬间获得编译级类型提示，无需配置 npm 私服发包，彻底杜绝联调时的版本漂移。
  3. **一键本地编排与压测演示**：在单个根目录下执行 `docker-compose up` 即可同时启动基础设施与微服务集群，k6 压测脚本也可集中管理与运行，答辩演示时开箱即用。
  4. **课程评阅与归档极佳体验**：导师在录音中明确提到“A Git archive will be ideal”。如果拆成 5 个独立仓库，打包与助教评审体验会极度碎片化；单仓归档（Git Archive）最符合规范。

### 1.3 云端新仓库关联方案
- 导师明确要求：“上一个课程（SWE5006）的代码库保持单体归档，本课程（SWE5001）应有独立的代码库展示微服务重构成果”。
- **操作方式**：
  1. 在云端（GitHub/GitLab）创建一个全新的空仓库（例如 `healthclaim-microservices` 或 `healthclaim-pro`）。
  2. 在本地执行：
     ```bash
     # 查看现有远端
     git remote -v
     # 将 origin 更改为云端新仓库地址（或添加新 remote）
     git remote set-url origin <NEW_CLOUD_REPO_URL>
     # 推送当前状态到新仓库 main 分支
     git push -u origin main
     ```
  3. 后续所有微服务演进、CI/CD 配置与提交记录均完全归属于新仓库。

---

## 2. 目标微服务物理拓扑与架构拆解

```
+--------------------------------------------------------------------------------------------------+
|                                    1. Client & Ingress Tier                                      |
|            [ React 18 SPA (Vite, Tailwind) ]           [ Third-Party OpenAPI Consumers ]         |
|            (Port: 5173 - Zero Touch)                   (k6 Stress Test Runners)                  |
|                        \                                          /                              |
|                         +---------> [ API Gateway ] <------------+                               |
|                                     (Port: 4000)                                                 |
|                               (Reverse Proxy & Health Aggregation)                               |
+---------------------------------------------+----------------------------------------------------+
                                              |
                   RESTful Ingress            |  /api/v1/claims   -> claim-service:3001
                                              |  /api/v1/rules    -> rule-engine-service:3002
                                              |  /api/v1/policies -> actuarial-service:3003
                                              v
+-------------------------------------------------------------+------------------------------------+
|                2. Core Microservices Tier                   | 4. Asynchronous Event & Settlement |
|                                                             |                                    |
|  [ Claim Service ]   [ Rule Engine ]   [ Actuarial Service ]| [ RabbitMQ Broker ]                |
|  • Port: 3001        • Port: 3002      • Port: 3003         | (Exchange: healthclaim.events)     |
|  • Aggregate Root    • AST Compiler    • Co-Pay Pipeline    |                 |                  |
|  • State Machine     • Stateless Eval  • Quota Ledger       |                 | claim.settled    |
+---------+------------------+-------------------+------------+                 |                  |
          |                  |                   |                              v                  |
          | SQL              | Cache (Dashed)    | SQL                [ Settlement Worker ]        |
          v                  v                   v                    • Voucher Artifacts          |
+-------------------------------------------------------------+       • Email Dispatch Mock        |
|               3. Distributed Infrastructure                 |                 |                  |
|  [ PostgreSQL 16 ]   [ Redis 7 Cache ] [ MinIO S3 Storage ] |                 v Archive          |
|  (Schemas: claims,   (Hot AST rules,   (Receipts & Vouchers)|       [ MinIO S3 Bucket ]          |
|   policies, users)    quota balances)  (Bucket: vouchers)   |       (settlement-vouchers)        |
+-------------------------------------------------------------+------------------------------------+
```

### 2.1 微服务职责边界与端口映射表

| 微服务 / 模块名 | 运行端口 | 负责人员 | 核心职责与设计模式 |
| :--- | :--- | :--- | :--- |
| **API Gateway** | `4000` | Wang Jiaxuan | 统一反向代理网关，路由分发、聚合健康检查、对外暴露兼容接口 |
| **`claim-service`** | `3001` | Ding Zihe | 理赔聚合根、状态机（State Pattern）、理赔单 CRUD、发布 `claim.submitted` |
| **`rule-engine-service`** | `3002` | Wang Jiaxuan | 规则 AST 编译（Composite/Specification Pattern）、无状态规则匹配、Redis 缓存加速 |
| **`actuarial-service`** | `3003` | Wei Qianxiang | 精算计算管道（Pipeline/Strategy Pattern）、保额与自付比例计算、Redis 额度同步 |
| **`settlement-worker`** | N/A (后台) | Yang Rushang | 异步结算消费者，生成结算单凭证归档至 MinIO S3，模拟交易邮件通知 |

---

## 3. 详细分阶段重构路线图 (Implementation Roadmap)

### Phase 1: 共享领域契约与事件模型扩展 (`@healthclaim/shared`)
- **目标**：规范分布式环境下的通讯语言，建立 Zod Schema 与 TypeScript 类型。
- **文件目标**：
  - `shared/src/events/claim-submitted.event.ts`
  - `shared/src/events/eligibility-evaluated.event.ts`
  - `shared/src/events/benefit-calculated.event.ts`
  - `shared/src/events/claim-settled.event.ts`
  - `shared/src/index.ts`
- **实施动作**：
  1. 定义 4 个核心领域事件的数据结构与校验 Schema。
  2. 导出标准 RabbitMQ 路由键常量（Routing Keys: `claim.submitted`, `eligibility.evaluated`, `benefit.calculated`, `claim.settled`）。
  3. 执行 `pnpm --filter @healthclaim/shared build` 确保单仓各服务可用。

### Phase 2: 基础设施拓扑补齐 (`docker-compose.yml`)
- **目标**：为本地开发与压测搭建完整的微服务支撑基础设施。
- **实施动作**：
  1. 在 `docker-compose.yml` 中新增：
     - **RabbitMQ 3 (Management)**：端口 5672 (AMQP) 与 15672 (Web UI)。
     - **Redis 7 (Alpine)**：端口 6379，配置 AOF 持久化与内存上限策略。
     - **MinIO S3**：自动初始化 `claim-receipts` 和 `settlement-vouchers` 两个存储桶。
  2. 验证容器健康检查与连通性。

### Phase 3: 基础设施通用客户端模块封装
- **目标**：为后端提供轻量、健壮的 RabbitMQ 与 Redis 连接模块。
- **实施动作**：
  1. 封装 `RabbitMQModule`：基于 `amqplib`，支持自动声明 Topic Exchange (`healthclaim.events`)、Queue 绑定、自动重试和消息序列化。
  2. 封装 `RedisCacheModule`：基于 `ioredis`，提供 `get`, `setex`, `del`, `scan` 等高速缓存接口及命中率指标统计。

### Phase 4: 微服务物理拆解与独立打包
- **实施路径选择**：
  采用最干净的微服务布局，在根目录创建 `services/`：
  ```
  services/
  ├── gateway/               # API 网关 (Port 4000)
  ├── claim-service/         # 理赔服务 (Port 3001)
  ├── rule-engine-service/   # 规则引擎 (Port 3002)
  ├── actuarial-service/     # 精算与保单服务 (Port 3003)
  └── settlement-worker/     # 结算凭证生成器 (Background Consumer)
  ```
- **核心逻辑迁移**：
  1. **Rule Engine Service (3002)**：迁移 `backend/src/rules`，接入 Redis 缓存编译后的 AST 表达式树，订阅 `claim.submitted`，发布 `eligibility.evaluated`。
  2. **Actuarial Service (3003)**：迁移 `backend/src/actuarial` 与 `backend/src/policies`，订阅 `eligibility.evaluated`，发布 `benefit.calculated`。
  3. **Claim Service (3001)**：迁移 `backend/src/claims`、`auth`、`users` 等，持久化理赔单状态，发起异步评审并在结算后归档。
  4. **Settlement Worker**：消费 `claim.settled`，生成结构化结算单凭证，上传 MinIO 并记录审计日志。

### Phase 5: API Gateway 路由汇聚与前端联调
- **目标**：统一流量入口，确保前端零修改可用。
- **实施动作**：
  1. 实现 API Gateway（监听 4000 端口）。
  2. 配置反向代理路由规则：
     - `/api/v1/claims` $\rightarrow$ `claim-service:3001`
     - `/api/v1/rules` $\rightarrow$ `rule-engine-service:3002`
     - `/api/v1/policies` $\rightarrow$ `actuarial-service:3003`
     - `/api/v1/auth`, `/api/v1/users`, `/api/v1/departments` $\rightarrow$ `claim-service:3001`
  3. 启动 Vite 前端（5173 端口），测试全流程跑通（登录 $\rightarrow$ 提单 $\rightarrow$ 异步审核 $\rightarrow$ 结算）。

### Phase 6: Kubernetes 编排清单与 HPA 自动伸缩 (`k8s/`)
- **目标**：满足 SWE5001 强制性云原生与弹性伸缩评审指标。
- **实施动作**：
  1. 编写各微服务的精简多阶段构建 `Dockerfile`。
  2. 编写 Kubernetes Manifests：
     - `k8s/claim-service-deployment.yaml` & `service.yaml`
     - `k8s/rule-engine-deployment.yaml` & `service.yaml`
     - `k8s/actuarial-service-deployment.yaml` & `service.yaml`
     - `k8s/settlement-worker-deployment.yaml`
     - `k8s/gateway-deployment.yaml` & `service.yaml`
  3. 编写 **HPA (Horizontal Pod Autoscaler)** 清单：
     - `k8s/hpa-rule-engine.yaml`：最小 1 副本，最大 5 副本，目标 CPU 利用率 70%。

### Phase 7: k6 压测基准实验与报告图表生成 (`load-tests/`)
- **目标**：获取 Baseline vs. Scaled 以及 Cache OFF vs. ON 的实验数据，用于 10 月 26 日答辩 PPT 与报告。
- **实施动作**：
  1. `load-tests/k6-baseline.js`：单副本状态下 50 $\rightarrow$ 500 VUs 阶梯加压，记录延迟突增（>1500ms）与吞吐瓶颈。
  2. `load-tests/k6-scaled.js`：HPA 启用状态下执行相同负载，记录 Pod 扩容至 4-5 副本、延迟稳定在 <200ms 的平稳曲线。
  3. `load-tests/k6-cache-benchmark.js`：测试 Redis 缓存开启与关闭的 DB 负载与 RPS 对比。
  4. 编写轻量绘图脚本生成可直接用于答辩 PPT 的 SVG/PNG 图表。

---

## 4. 团队 WBS 与 50 人天预算落实矩阵

项目总预算严格按照学术规范分配（5 位同学每人 10.0 PD）：

| 成员姓名 | 学号邮箱 | 分配工作量 (PD) | 核心负责模块与交付物 (Deliverables) |
| :--- | :--- | :--- | :--- |
| **Wang Jiaxuan** | `e1374585@u.nus.edu` | **10.0 PD** | • **WBS 1.1** DDD 限界上下文划分 (2.0 PD)<br>• **WBS 1.2** API Gateway 网关开发 (2.0 PD)<br>• **WBS 2.1** 规则引擎独立微服务化 (4.0 PD)<br>• **WBS 4.1** 跨服务异步链路联调 (2.0 PD) |
| **Wei Qianxiang** | `e1374587@u.nus.edu` | **10.0 PD** | • **WBS 2.2** 精算计算微服务化 (3.5 PD)<br>• **WBS 3.2** Redis 7 缓存与额度索引设计 (3.5 PD)<br>• **WBS 4.3** 规则与精算 UI 绑定验证 (2.0 PD)<br>• **WBS 5.3** 答辩幻灯片精算与架构部分 (1.0 PD) |
| **Ding Zihe** | `e1374573@u.nus.edu` | **10.0 PD** | • **WBS 2.3** 理赔微服务与状态机 (3.5 PD)<br>• **WBS 3.4** k6 压测脚本与基准实验执行 (2.0 PD)<br>• **WBS 4.2** 前端理赔工作流验证 (2.5 PD)<br>• **WBS 5.2** 项目报告 Section 3 & 4 编写 (2.0 PD) |
| **Yang Rushang** | `e1374578@u.nus.edu` | **10.0 PD** | • **WBS 2.4** 结算 Worker 与 MinIO S3 归档 (4.0 PD)<br>• **WBS 3.3** Docker/K8s 编排与 HPA 清单 (2.0 PD)<br>• **WBS 5.1** 系统部署运维 Runbook (2.0 PD)<br>• **WBS 5.2** 项目报告 Section 1, 2 & 5 编写 (2.0 PD) |
| **Hu Lunwei** | `e1374566@u.nus.edu` | **10.0 PD** | • **WBS 1.3** Shared 共享事件模型与契约 (2.0 PD)<br>• **WBS 3.1** RabbitMQ 消息总线与死信队列 (3.5 PD)<br>• **WBS 4.4** CI/CD 自动化构建流与覆盖率 (2.5 PD)<br>• **WBS 5.3** 答辩 Demo 现场演练脚本与主持 (2.0 PD) |
| **合计** | **5 位成员** | **50.0 PD** | **严格平衡，全模块覆盖** |

---

## 5. 答辩（10月26日）关键交付物准备清单

为确保 10 月 26 日上午顺利通过答辩，本规划锁定以下 4 项核心现场展示物：
1. **Live Demo 流程**：
   - 前端发起理赔 $\rightarrow$ 网关接收入口 $\rightarrow$ RabbitMQ 异步解耦派发 $\rightarrow$ 状态平滑变更为 `SETTLED` $\rightarrow$ 结算凭证已写入 MinIO。
2. **HPA 弹性扩缩容演示**：
   - 运行 k6 压测命令，实时展示 `kubectl get hpa -w`，观察 `rule-engine-service` 从 1 副本自动扩容至 5 副本。
3. **压测性能对比图表（PPT 核心）**：
   - 图 1：单副本 vs HPA 扩容下的 RPS 与 P95 响应时间对比曲线。
   - 图 2：Redis 缓存开启 vs 穿透 DB 的延迟与吞吐对比。
4. **代码工程规范**：
   - 代码目录结构清晰，每个服务保持高内聚，单元测试覆盖率 $\ge 85\%$。
