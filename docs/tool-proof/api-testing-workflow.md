# API Testing Workflow: Local CI/Headless Execution

This document provides copy-paste command blocks for running Postman/Newman and k6 tests in a headless/CI environment. Use this as the CI-ready proof path when GitHub Actions workflows are not available.

## Prerequisites

- Node.js 18+
- k6 installed (for load testing)
- npm dependencies installed

```bash
npm install
```

## 1. Start Services

Start all three services (provider, consumer, console) in a single terminal:

```bash
npm run start:all
```

This starts:
- Mock webhook provider on port 3001
- Webhook consumer on port 3002
- Support console on port 3003

### Alternative: Start Services Individually

If you need to run services in separate terminals:

```bash
# Terminal 1: Provider
npm run start:provider

# Terminal 2: Consumer
npm run start:consumer

# Terminal 3: Console (optional for headless runs)
npm run console
```

**Expected outcome**: All services report "listening on port XXXX" with no errors.

## 2. Reset State

Clear all runtime state before each test run:

```bash
npm run reset
```

**Expected outcome**: "Runtime reset complete" printed to console.

This clears:
- `runtime/contract-results.json`
- `runtime/idempotency-store.json`
- `runtime/event-ordering.json`
- `runtime/replay-queue.json`

## 3. Run Newman (Postman Collection)

Execute the Postman collection headlessly via Newman:

```bash
npm run test:newman
```

This runs the collection defined in `postman/webhook-idempotency.collection.json` with environment from `postman/webhook-idempotency.environment.json`.

**Expected outcome**: Newman summary showing passed tests, response times, and any failures.

### Capture Newman Output

To save Newman output for artifact collection:

```bash
npm run test:newman 2>&1 | tee docs/tool-proof/newman-sample-output.txt
```

**Expected outcome**: Test results saved to `docs/tool-proof/newman-sample-output.txt`.

## 4. Run k6 Load Test

Execute the k6 performance test:

```bash
k6 run perf/webhook-load-test.js --summary-export docs/tool-proof/k6-summary.json
```

**Expected outcome**: k6 outputs iteration counts, request rates, and latency percentiles. Summary JSON exported to `docs/tool-proof/k6-summary.json`.

### k6 Output Interpretation

Key metrics to verify:
- `http_req_duration`: Request latency (p90, p95, p99)
- `iterations`: Total test iterations completed
- `http_req_failed`: Should be 0 for passing runs

## 5. Artifact Locations

After running the full workflow, artifacts are located at:

| Artifact | Path |
|----------|------|
| Newman output | `docs/tool-proof/newman-sample-output.txt` |
| k6 summary | `docs/tool-proof/k6-summary.json` |
| Runtime state | `runtime/*.json` |
| Contract reports | `generated-reports/` |

## Full Workflow (Copy-Paste)

Run the complete headless test sequence:

```bash
# Install dependencies (first time only)
npm install

# Reset state
npm run reset

# Start services (in background or separate terminal)
npm run start:all &

# Wait for services to initialize
sleep 5

# Run Newman tests
npm run test:newman 2>&1 | tee docs/tool-proof/newman-sample-output.txt

# Run k6 load test
k6 run perf/webhook-load-test.js --summary-export docs/tool-proof/k6-summary.json

# Verify artifacts exist
ls docs/tool-proof/
```

## Troubleshooting

### Port Already in Use

If ports 3001, 3002, or 3003 are occupied:

```bash
# Find and kill process on port
# Windows
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# macOS/Linux
lsof -i :3001
kill -9 <pid>
```

### k6 Not Found

Install k6:

```bash
# Windows (Chocolatey)
choco install k6

# macOS (Homebrew)
brew install k6

# Linux (apt)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747667E0C
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update && sudo apt install k6
```

### Newman Collection Not Found

Verify Postman files exist:

```bash
ls postman/
# Should show:
# webhook-idempotency.collection.json
# webhook-idempotency.environment.json
```

## Portfolio Handoff Note

N/A - external portfolio target. The proof artifacts in this directory should be referenced when updating the external project portfolio or demo page. Include mentions of:

- **API contract testing**: Field-by-field payload validation with specific error messages
- **Postman collections**: Manual/collection authoring for interactive debugging
- **Newman automation**: CI/headless execution of Postman collections
- **k6 performance checks**: Load testing to validate idempotency under concurrent stress
