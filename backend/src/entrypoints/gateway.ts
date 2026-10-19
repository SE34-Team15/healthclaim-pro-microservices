import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const UPSTREAMS = {
  claimService: process.env.CLAIM_SERVICE_URL || 'http://localhost:3001',
  ruleEngineService: process.env.RULE_ENGINE_SERVICE_URL || 'http://localhost:3002',
  actuarialService: process.env.ACTUARIAL_SERVICE_URL || 'http://localhost:3003',
};

// Express native CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin as string;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Reverse proxy helper using Node.js streaming
function createProxy(targetBaseUrl: string) {
  return (req: express.Request, res: express.Response) => {
    try {
      const targetUrl = new URL(req.originalUrl, targetBaseUrl);
      const isHttps = targetUrl.protocol === 'https:';
      const clientReq = http.request(
        targetUrl,
        {
          method: req.method,
          headers: {
            ...req.headers,
            host: targetUrl.host,
            'x-forwarded-for': req.ip,
            'x-forwarded-host': req.headers.host,
            'x-gateway-proxy': 'healthclaim-api-gateway',
          },
        },
        (targetRes) => {
          res.writeHead(targetRes.statusCode || 500, targetRes.headers);
          targetRes.pipe(res);
        },
      );

      clientReq.on('error', (err) => {
        res.status(502).json({
          statusCode: 502,
          error: 'Bad Gateway',
          message: `API Gateway failed to reach upstream [${targetBaseUrl}]: ${err.message}`,
          timestamp: new Date().toISOString(),
        });
      });

      req.pipe(clientReq);
    } catch (err: any) {
      res.status(500).json({
        statusCode: 500,
        error: 'Gateway Routing Error',
        message: err.message,
      });
    }
  };
}

// 1. Gateway Status & Health Aggregator
app.get('/api/v1/health', async (_req, res) => {
  const upstreamsStatus: Record<string, string> = {};

  await Promise.all(
    Object.entries(UPSTREAMS).map(async ([name, url]) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        const resp = await fetch(`${url}/api/v1/health`, { signal: controller.signal });
        clearTimeout(timeout);
        upstreamsStatus[name] = resp.ok ? 'UP' : `DEGRADED (${resp.status})`;
      } catch {
        upstreamsStatus[name] = 'DOWN';
      }
    }),
  );

  res.json({
    status: 'UP',
    gateway: 'HealthClaim Pro Platform API Gateway',
    timestamp: new Date().toISOString(),
    routes: {
      '/api/v1/rules/*': UPSTREAMS.ruleEngineService,
      '/api/v1/policies/*': UPSTREAMS.actuarialService,
      '/api/v1/claims/*': UPSTREAMS.claimService,
    },
    upstreams: upstreamsStatus,
  });
});

// 2. Microservice Ingress Route Bindings
// Rule Engine Service (AST compiler & dynamic evaluation)
app.use('/api/v1/rules', createProxy(UPSTREAMS.ruleEngineService));

// Actuarial & Policy Service (Pipeline & tier calculations)
app.use('/api/v1/policies', createProxy(UPSTREAMS.actuarialService));

// Claim Service (Aggregate root, state machine, attachments, IAM, audit)
app.use('/api/v1/claims', createProxy(UPSTREAMS.claimService));
app.use('/api/v1/auth', createProxy(UPSTREAMS.claimService));
app.use('/api/v1/users', createProxy(UPSTREAMS.claimService));
app.use('/api/v1/departments', createProxy(UPSTREAMS.claimService));
app.use('/api/v1/audit', createProxy(UPSTREAMS.claimService));
app.use('/api/v1/analytics', createProxy(UPSTREAMS.claimService));
app.use('/api/v1/attachments', createProxy(UPSTREAMS.claimService));

// Static frontend SPA hosting fallback
const publicDir = path.resolve(__dirname, '..', '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[API Gateway] HealthClaim Pro Ingress Gateway running on http://localhost:${PORT}`);
  console.log(`[API Gateway] Route: /api/v1/rules    -> ${UPSTREAMS.ruleEngineService}`);
  console.log(`[API Gateway] Route: /api/v1/policies -> ${UPSTREAMS.actuarialService}`);
  console.log(`[API Gateway] Route: /api/v1/claims   -> ${UPSTREAMS.claimService}`);
});
