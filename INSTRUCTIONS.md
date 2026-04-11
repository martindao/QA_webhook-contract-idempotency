# Repo 06 — Webhook Contract & Idempotency Harness

## Quick Start For AI Agents

**If you are an AI reading this:** Your job is to build this repo following the exact pattern of `SUP_incident-intelligence-fastpath`, which already exists at `C:\Users\marti\Desktop\Projects\SUP_incident-intelligence-fastpath`.

**Reference repo to clone patterns from:** `SUP_incident-intelligence-fastpath`

**This repo is QA Automation focused** — it demonstrates how to test event-driven systems, webhook reliability, and idempotency patterns.

---

## Repo Identity

- **Folder name:** `webhook-contract-idempotency`
- **GitHub repo name:** `webhook-contract-idempotency`
- **Public title:** Webhook Contract & Idempotency Harness
- **Tagline:** "When webhooks drop, duplicate, or arrive out of order, this is what catches it before production."
- **Target hiring role:** QA Automation / Integration QA / Platform QA Engineer at Series A/B SaaS
- **Hiring-manager pitch:** "I take brittle webhook integrations and turn them into contract-tested, idempotent, replay-safe systems. Your payment processing stops double-charging customers when Stripe retries."

---

## What This Repo Proves

Martin Dao can:
- Validate webhook contracts (payload schema, headers, signatures)
- Test idempotency (same event processed once, not twice)
- Simulate webhook failure modes (dropped, delayed, duplicate, out-of-order)
- Build replay/backfill testing for lost events
- Generate contract test reports that prove integration reliability
- Reduce webhook-related support tickets by 65%+

---

## Source Research (Real 2025-2026 Evidence)

### Primary Sources

#### 1. Ghost: Outbound Webhooks Blocked, No Retries (2026)
- **URL:** https://statuspage.incident.io/ghostpro/incidents/02xde3qy
- **Key lesson:** Infra config blocked outbound webhooks. No retries meant events were permanently lost and could not be replayed. Catastrophic for integrators.
- **Use this for:** Scenario 1 (Lost Events / No Replay)

#### 2. FedEx: Webhook Delays + Missed Events (2026)
- **URL:** https://developer.fedex.com/api/en-ao/announcements/Webhook_Event_Issue_Resolved.html
- **Key lesson:** Webhook delays and missed events. Republishing changes "push timestamp" vs original event time — classic consumer reconciliation pain.
- **Use this for:** Scenario 2 (Delayed/Out-of-Order Events)

#### 3. GitHub Community: Webhook Reliability Gaps (2026)
- **URL:** https://github.com/orgs/community/discussions/185003
- **Key lesson:** Real integrator complaint: webhooks arrive late/missing; opaque errors; wants delivery attempt visibility + replay + idempotency guarantees.
- **Use this for:** Business impact framing

#### 4. PagerDuty: Kafka Backbone Outage (2025)
- **URL:** https://www.pagerduty.com/eng/august-28-kafka-outages-what-happened-and-how-were-improving/
- **Key lesson:** Cascading failures hit webhooks. Delayed/duplicate webhooks. Comms process failure.
- **Use this for:** Scenario 3 (Duplicate Events / Idempotency)

### Secondary Sources
- Stripe Webhook Best Practices — for idempotency patterns
- Svix (webhook infrastructure) documentation — for delivery guarantee patterns
- AWS EventBridge documentation — for event ordering patterns

### What to Extract From Each Source
- **Failure mode:** What specifically broke (no retries, timestamp drift, duplicate delivery)
- **Detection gap:** What monitoring missed
- **Recovery pattern:** How to replay/backfill lost events
- **Idempotency pattern:** How to ensure same event processed once

---

## Architecture (Hybrid: Mock Provider + Consumer + Test Harness)

This repo needs:
1. **A mock webhook provider** that simulates real webhook behavior (Stripe-like)
2. **A webhook consumer** that receives and processes webhooks
3. **A contract test harness** that validates payloads, signatures, and idempotency
4. **A failure simulator** that injects dropped, delayed, duplicate, and out-of-order events
5. **A reporting dashboard** that shows contract test results and idempotency metrics

```
webhook-contract-idempotency/
├── mock-provider/                        # Simulated webhook sender
│   ├── src/
│   │   ├── webhook-server.js             # HTTP server that sends webhooks
│   │   ├── event-generator.js            # Generates realistic events
│   │   ├── signature-signer.js           # Signs payloads (HMAC-SHA256)
│   │   └── delivery-simulator.js         # Simulates failures (drop, delay, dup)
│   ├── package.json
│   └── README.md
├── webhook-consumer/                     # The app that receives webhooks
│   ├── src/
│   │   ├── webhook-handler.js            # Receives and validates webhooks
│   │   ├── idempotency-store.js          # Tracks processed event IDs
│   │   ├── contract-validator.js         # Validates payload schema
│   │   └── replay-queue.js               # Queues failed events for replay
│   ├── package.json
│   └── README.md
├── tests/
│   ├── contract/
│   │   ├── payload-schema.test.js        # Validates payload structure
│   │   ├── signature-verification.test.js # Validates HMAC signatures
│   │   └── header-validation.test.js     # Validates required headers
│   ├── idempotency/
│   │   ├── duplicate-event.test.js       # Same event processed once
│   │   ├── out-of-order.test.js          # Events arrive out of order
│   │   └── replay-safety.test.js         # Replay doesn't double-process
│   ├── failure-modes/
│   │   ├── dropped-event.test.js         # Event lost, no retry
│   │   ├── delayed-event.test.js         # Event arrives late
│   │   └── timestamp-drift.test.js       # Event timestamp vs push timestamp
│   └── fixtures/
│       ├── sample-events.json            # Realistic webhook payloads
│       ├── invalid-payloads.json         # Malformed payloads for negative tests
│       └── signature-keys.json           # Test signing keys
├── flake-control-plane/                  # (Optional) Contract test metrics
│   ├── classifier.js
│   ├── report-generator.js
│   └── runtime/
│       ├── contract-history.json
│       └── idempotency-metrics.json
├── support-console/
│   ├── server.js
│   └── ui/index.html                     # Operator dashboard
├── reports/
│   └── sample-contract-test-report.md
├── docs/
│   ├── research-blueprint.md
│   ├── webhook-contract-spec.md          # Formal contract definition
│   ├── idempotency-patterns.md           # How idempotency is implemented
│   └── failure-mode-catalog.md           # All simulated failure modes
├── package.json
├── README.md
└── .gitignore
```

---

## Required Dependencies (package.json)

```json
{
  "name": "webhook-contract-idempotency",
  "version": "1.0.0",
  "description": "Webhook contract testing and idempotency verification harness",
  "scripts": {
    "start:provider": "node mock-provider/src/webhook-server.js",
    "start:consumer": "node webhook-consumer/src/webhook-handler.js",
    "test:contract": "vitest run tests/contract",
    "test:idempotency": "vitest run tests/idempotency",
    "test:failures": "vitest run tests/failure-modes",
    "test:all": "vitest run tests",
    "console": "node support-console/server.js",
    "start:all": "concurrently -n provider,consumer,console -c blue,green,yellow \"npm run start:provider\" \"npm run start:consumer\" \"npm run console\""
  },
  "dependencies": {
    "concurrently": "^8.2.2",
    "chalk": "^4.1.2",
    "crypto": "^1.0.1"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "@playwright/test": "^1.41.0",
    "axios": "^1.6.0"
  }
}
```

**Why these dependencies:**
- `crypto` — for HMAC-SHA256 signature signing/verification (Node.js built-in)
- `axios` — for making HTTP requests in tests
- `vitest` — test runner
- `@playwright/test` — E2E browser tests for the operator console
- `concurrently` — multi-process orchestration

---

## Deterministic Scenarios (3 Required)

### Scenario 1: Lost Events / No Replay (Inspired by Ghost incident)
**Problem:** Webhook provider sends an event. Consumer's infra blocks it (firewall, timeout). Provider doesn't retry. Event is permanently lost.

**Simulated via:**
```javascript
// tests/failure-modes/dropped-event.test.js
import { test, expect } from 'vitest';
import { sendWebhook, getProcessedEvents } from '../fixtures/helpers.js';

test('dropped event is detected and queued for replay', async () => {
  // 1. Send webhook that will be "dropped" (simulated timeout)
  const event = { id: 'evt_001', type: 'payment.succeeded', data: { amount: 9900 } };
  const response = await sendWebhook(event, { simulateDrop: true });

  expect(response.status).toBe(504); // Timeout

  // 2. Verify event is NOT processed
  const processed = await getProcessedEvents();
  expect(processed).not.toContain('evt_001');

  // 3. Verify event is queued for replay
  const replayQueue = await getReplayQueue();
  expect(replayQueue).toContain('evt_001');
});
```

**Expected outcome:**
- Dropped event detected
- Event queued for replay
- Report shows "1 lost event, 1 queued for replay"

---

### Scenario 2: Delayed/Out-of-Order Events (Inspired by FedEx incident)
**Problem:** Event A is sent at T+0. Event B is sent at T+1. Event B arrives first (T+2), Event A arrives late (T+5). Consumer processes them out of order, causing state inconsistency.

**Simulated via:**
```javascript
// tests/failure-modes/out-of-order.test.js
import { test, expect } from 'vitest';
import { sendWebhook, getOrderState } from '../fixtures/helpers.js';

test('out-of-order events are reordered correctly', async () => {
  // 1. Send Event B first (simulated delay on Event A)
  const eventB = { id: 'evt_002', type: 'order.shipped', sequence: 2, timestamp: '2026-04-01T10:01:00Z' };
  await sendWebhook(eventB);

  // 2. Send Event A late (simulated delay)
  const eventA = { id: 'evt_001', type: 'order.created', sequence: 1, timestamp: '2026-04-01T10:00:00Z' };
  await sendWebhook(eventA, { delay: 5000 });

  // 3. Verify final state is correct (created → shipped, not shipped → created)
  const orderState = await getOrderState('order_123');
  expect(orderState.status).toBe('shipped');
  expect(orderState.history).toEqual(['created', 'shipped']);
});
```

**Expected outcome:**
- Out-of-order events detected
- Events reordered by sequence/timestamp
- Final state is correct

---

### Scenario 3: Duplicate Events / Idempotency (Inspired by PagerDuty incident)
**Problem:** Webhook provider retries an event 3 times (network timeout). Consumer processes it 3 times, causing 3x charges.

**Simulated via:**
```javascript
// tests/idempotency/duplicate-event.test.js
import { test, expect } from 'vitest';
import { sendWebhook, getChargeCount } from '../fixtures/helpers.js';

test('duplicate event is processed exactly once', async () => {
  const event = { id: 'evt_003', type: 'payment.charge', data: { amount: 5000 } };

  // 1. Send same event 3 times (simulating retries)
  await sendWebhook(event);
  await sendWebhook(event);
  await sendWebhook(event);

  // 2. Verify only ONE charge was created
  const chargeCount = await getChargeCount('evt_003');
  expect(chargeCount).toBe(1);

  // 3. Verify idempotency store has the event ID
  const idempotencyStore = await getIdempotencyStore();
  expect(idempotencyStore).toContain('evt_003');
});
```

**Expected outcome:**
- Duplicate events detected
- Only one charge created
- Idempotency store tracks processed event IDs

---

## Required Features

### 1. Mock Webhook Provider (`mock-provider/src/webhook-server.js`)

Simulates a real webhook provider (like Stripe):
- Generates realistic events (payment.succeeded, order.created, etc.)
- Signs payloads with HMAC-SHA256
- Simulates failure modes:
  - `simulateDrop: true` — returns 504 timeout
  - `simulateDelay: 5000` — delays delivery by 5 seconds
  - `simulateDuplicate: 3` — sends same event 3 times
  - `simulateOutOfOrder: true` — sends events out of sequence

### 2. Webhook Consumer (`webhook-consumer/src/webhook-handler.js`)

Receives and processes webhooks:
- Validates HMAC signature
- Validates payload schema (contract test)
- Checks idempotency store (skip if already processed)
- Queues failed events for replay
- Reorders out-of-order events by sequence/timestamp

### 3. Contract Validator (`webhook-consumer/src/contract-validator.js`)

Validates webhook payloads against a formal contract:
```javascript
// docs/webhook-contract-spec.md defines the contract
const contract = {
  required_fields: ['id', 'type', 'timestamp', 'data'],
  allowed_types: ['payment.succeeded', 'payment.failed', 'order.created', 'order.shipped'],
  signature_header: 'X-Webhook-Signature',
  timestamp_tolerance_seconds: 300 // 5 minutes
};

export function validateContract(payload, headers) {
  // Check required fields
  // Check allowed types
  // Check signature
  // Check timestamp freshness
  // Return { valid: true/false, errors: [] }
}
```

### 4. Idempotency Store (`webhook-consumer/src/idempotency-store.js`)

Tracks processed event IDs:
```javascript
export class IdempotencyStore {
  constructor() {
    this.processed = new Set();
  }

  isProcessed(eventId) {
    return this.processed.has(eventId);
  }

  markProcessed(eventId) {
    this.processed.add(eventId);
  }

  // Persistence to file for demo
  save() { /* write to runtime/idempotency-store.json */ }
  load() { /* read from runtime/idempotency-store.json */ }
}
```

### 5. Operator Console UI (Dashboard)

The UI is a **webhook reliability dashboard**.

Required panels:
- **Summary Stats** (top): Total webhooks received, contract pass rate, idempotency score, duplicate count
- **Contract Test Results** (middle): Table of payload validations (pass/fail per field)
- **Idempotency Metrics** (middle): Duplicate events detected, replay queue size
- **Live Simulation Buttons** (right panel):
  - "Send Valid Webhook"
  - "Send Duplicate Webhook (3x)"
  - "Send Out-of-Order Events"
  - "Simulate Dropped Event"
  - "Run Contract Tests"
  - "Generate Report"
  - "Reset Demo Data"

**CRITICAL UI WARNING:** Same as repo-01 / SUP_incident-intelligence-fastpath. Write `index.html` in ONE pass.

#### Visual Design
- Same dark operator theme
- Use color: green for valid contracts, red for invalid, yellow for duplicates
- Show webhook payload snippets (JSON)
- Include sequence diagram of webhook flow

### 6. Server Endpoints

```
GET  /
GET  /api/contract-results
GET  /api/idempotency-metrics
GET  /api/replay-queue
GET  /api/reports
POST /api/simulate/valid
POST /api/simulate/duplicate
POST /api/simulate/out-of-order
POST /api/simulate/dropped
POST /api/run-contract-tests
POST /api/generate-report
POST /api/reset
```

### 7. Sample Reports

Commit a sample report to `reports/sample-contract-test-report.md`:
```markdown
# Webhook Contract & Idempotency Report — 2026-04-01

## Summary
- 1,247 webhooks received
- 1,198 contract-valid (96.1%)
- 49 contract-invalid (3.9%)
- 12 duplicate events detected (all idempotent)
- 3 events queued for replay

## Contract Violations
1. Missing `timestamp` field (23 events)
2. Invalid `type` value (15 events)
3. Signature mismatch (11 events)

## Idempotency Metrics
- Duplicate events: 12
- Successfully deduplicated: 12 (100%)
- Double-processing incidents: 0

## Recommended Actions
1. Fix timestamp generation in payment service
2. Update allowed types list for new event types
3. Rotate webhook signing keys (11 signature mismatches)
```

---

## Acceptance Criteria

### Functional
- [ ] All 3 scenarios trigger via UI buttons
- [ ] Contract validator catches invalid payloads
- [ ] Idempotency store prevents double-processing
- [ ] Replay queue captures dropped events
- [ ] Out-of-order events are reordered correctly
- [ ] Reset → Simulate flow works
- [ ] Sample report committed to `reports/`

### Quality
- [ ] 30+ tests in demo suite (contract + idempotency + failure modes)
- [ ] HMAC-SHA256 signature verification works correctly
- [ ] No JavaScript console errors
- [ ] All endpoints return correct status codes

### Portfolio
- [ ] README explains webhook reliability challenges
- [ ] At least 2 screenshots of dashboard
- [ ] Architecture diagram showing webhook flow
- [ ] Sample report committed
- [ ] Built With section lists Vitest, Playwright, crypto

---

## Critical Warnings From repo-01 / SUP_incident-intelligence-fastpath Experience

### 1. UI must have simulation buttons
Don't just build a passive dashboard. Make it interactive.

### 2. Don't edit large inline scripts with partial edits
Rewrite `index.html` in one pass.

### 3. Cache-busting headers
Same `serveFile` pattern as repo-01 / SUP_incident-intelligence-fastpath.

### 4. Test the Reset → Simulate flow
Verify that after reset, simulations regenerate state correctly.

### 5. HMAC signatures must be correct
Use Node.js `crypto` module. Don't implement crypto from scratch. Test signature verification with known test vectors.

### 6. Idempotency is the hardest part
Test edge cases:
- Same event ID with different payloads (should reject)
- Event ID collision (should handle gracefully)
- Idempotency store persistence across restarts

---

## Build Order

1. **Day 1: Mock Provider**
   - Folder structure
   - Build webhook server with event generation
   - Implement HMAC-SHA256 signing
   - Test signature generation

2. **Day 2: Webhook Consumer**
   - Build webhook handler
   - Implement contract validator
   - Implement idempotency store
   - Test signature verification and contract validation

3. **Day 3: Failure Simulator**
   - Build delivery simulator (drop, delay, duplicate, out-of-order)
   - Test each failure mode independently
   - Verify consumer handles each correctly

4. **Day 4: Tests**
   - Write contract tests
   - Write idempotency tests
   - Write failure mode tests
   - Verify all 30+ tests pass

5. **Day 5: Reports**
   - Build report generator
   - Generate sample contract test report
   - Commit to `reports/`

6. **Day 6: Operator Console**
   - Backend with all endpoints
   - Frontend dashboard in ONE pass
   - Add simulation buttons

7. **Day 7: README + Docs**
   - Public README with screenshots
   - Contract spec documentation
   - Final verification

---

## Public README Structure

```markdown
# Webhook Contract & Idempotency Harness

> When webhooks drop, duplicate, or arrive out of order, this is what catches it before production.

## Overview
Webhook integrations are fragile. Events drop, duplicate, arrive late, or come out of order. This repo demonstrates contract testing and idempotency patterns that make webhook integrations reliable.

## The Startup Pain This Solves
- Double-charging customers when Stripe retries
- Lost events that never get replayed
- State inconsistency from out-of-order delivery
- Hours of forensic work to figure out what happened

## What This Repo Demonstrates
- Webhook contract validation (payload schema, signatures, headers)
- Idempotency enforcement (same event processed once)
- Failure mode simulation (drop, delay, duplicate, out-of-order)
- Replay/backfill testing for lost events
- Contract test reports for engineering leadership

## Architecture
[Diagram showing mock-provider → webhook-consumer → contract-validator → idempotency-store → dashboard]

## Demo Scenarios
1. Lost Events / No Replay (Ghost-inspired)
2. Delayed/Out-of-Order Events (FedEx-inspired)
3. Duplicate Events / Idempotency (PagerDuty-inspired)

## Built With
- Node.js crypto (HMAC-SHA256)
- Vitest (test runner)
- Playwright (E2E browser tests)
- Vanilla JS dashboard (no framework)

## How to Run Locally
[Instructions]

## Live Dashboard
[Screenshot]

## Sample Report
[Link to reports/sample-contract-test-report.md]
```

---

## Post-Build Deliverable (Screenshot Capture)

After this repo passes the acceptance criteria, do **not** create a landing page yet.
Landing pages are built in a separate phase after the app is verified real.

Before declaring the repo done, save these screenshots to `docs/SCREENSHOTS/`:

1. `01-main-view.png` — default dashboard / empty state
2. `02-active-simulation.png` — after a simulation runs, with the contract/idempotency detail view populated
3. `03-side-panel-state.png` — the panel showing the most important operational context (delivery state, replay status, duplicate handling, or equivalent)

These screenshots are the raw material for the later landing-page phase.

## Success Criteria

A QA hiring manager should:
1. Open the repo
2. See real webhook contract testing (not toy examples)
3. See idempotency enforcement working (duplicate events processed once)
4. Run the dashboard and click buttons to simulate failures
5. Read the contract test report and find it credible
6. Decide to interview within 5 minutes

If the repo just looks like "a webhook receiver", it failed. It must look like an INTEGRATION RELIABILITY FRAMEWORK.

## Additional Deliverable Requirement

The builder must create these extra files before calling the repo complete:

- `PORTFOLIO_INTEGRATION.md`
- `SCREENSHOT_PLAN.md`

### `PORTFOLIO_INTEGRATION.md` must include
- canonical project title
- role family (SUP / QA / SEC / DATA / CFT)
- homepage card title
- one-sentence homepage description
- category label
- tag list
- GitHub CTA label
- demo-page requirements
- SVG artwork direction

### `SCREENSHOT_PLAN.md` must include
- 3-5 required screenshot/GIF shots
- exact UI states to capture
- one hero/cover image recommendation for the portfolio page

## Final Locked Reference Repos (Do Not Replace Casually)

### Primary GitHub references
- `https://github.com/hookdeck/webhook-skills`
  - Use for: signature verification and provider webhook handling patterns
- `https://github.com/keploy/keploy`
  - Use for: replay/mocking/integration test inspiration
- `https://github.com/brightdata/bright-data-unlock-webhook-demo`
  - Use for: lightweight webhook receiver structure only

### Secondary inspiration
- `https://github.com/ar27111994/webhook-debugger-logger`
  - Use for: inspection/debug UX ideas
- `https://github.com/adyen-examples/adyen-react-online-payments`
  - Use for: webhook processing realism and HMAC flow ideas

### What to borrow
- signature verification patterns
- replay / retry / dropped-event ideas
- event inspection UX

### What not to copy literally
- full debugger products
- payment/product-specific checkout UI
