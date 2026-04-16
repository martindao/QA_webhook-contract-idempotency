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

- **Contract Validation**: Field-by-field payload validation with specific error messages
- **Idempotency**: Deduplication with metrics and 100% score tracking
- **Ordering**: Out-of-order event handling with sequence tracking
- **Replay Safety**: Dropped event queue for manual replay
- **Failure Mode Simulation**: Drop, delay, duplicate, and out-of-order scenarios
- **Contract Test Reports**: Human-readable reports for engineering leadership

## Architecture

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Mock Provider   │────▶│ Consumer        │────▶│ Support Console │
│ (port 3001)     │     │ (port 3002)     │     │ (port 3003)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │ File Store  │
                        │ (JSON)      │
                        └─────────────┘
```

**Data Flow**:
1. Mock Provider sends webhooks with HMAC-SHA256 signatures
2. Consumer validates contract, checks idempotency, handles ordering
3. Support Console displays real-time metrics and replay queue
4. File-backed store persists all state across restarts

## Demo Scenarios

Use the **Live Simulation** buttons in the support console to test each scenario:

### 1. Valid Webhook
Sends a properly signed webhook through the full validation pipeline. Confirms contract validation, signature verification, and processing.

**Button**: `Send Valid Webhook`

### 2. Duplicate Events / Idempotency
Sends the same event 3 times to test idempotency. The idempotency store ensures exactly-once processing.

**Button**: `Send Duplicate (3x)`

### 3. Out-of-Order Delivery
Sends events B then A to test ordering. The ordering handler buffers and processes events in correct sequence.

**Button**: `Send Out-of-Order`

### 4. Dropped Event
Simulates a timeout/dropped webhook. The event lands in the replay queue for manual recovery.

**Button**: `Simulate Dropped`

## How to Run Locally

### Prerequisites
- Node.js 18+

### Quick Start
```bash
# Install dependencies
npm install

# Start all services
npm run start:all

# Open the support console
open http://localhost:3003
```

### What to Watch For
1. Mock Provider sends webhooks on port 3001
2. Consumer validates and processes on port 3002
3. Support Console shows metrics on port 3003
4. Runtime files appear in `runtime/` directory
5. Reports generate in `generated-reports/` directory

### Reset Between Demos
```bash
# Clear all runtime state
npm run reset
```

## How to Test

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:contract
npm run test:idempotency
npm run test:failures
```

The test suite validates:
- Contract validation catches missing fields, invalid types, bad signatures
- Idempotency prevents double processing
- Ordering handler buffers out-of-sequence events
- Replay queue captures dropped events

## API testing with Postman

Postman = manual/collection authoring. Use Postman to build and debug request collections interactively before automating them in CI.

```bash
# Import the collection
postman/webhook-idempotency.collection.json

# Import the environment
postman/webhook-idempotency.environment.json

# Run manually in Postman GUI to verify endpoints
```

## Headless verification with Newman

Newman = CI/headless execution. Run the Postman collection in automated pipelines without a GUI.

```bash
# Run the collection headlessly
newman run postman/webhook-idempotency.collection.json \
  -e postman/webhook-idempotency.environment.json

# Sample output: docs/tool-proof/newman-sample-output.txt
```

## Performance checks with k6

k6 = load/performance under stress. Validate that the webhook consumer handles concurrent load without breaking idempotency guarantees.

```bash
# Run performance tests
k6 run k6/webhook-load.js

# Summary output: docs/tool-proof/k6-summary.json
```

## Key Features

- **Native Node.js HTTP**: No Express dependency, uses built-in `http` module
- **HMAC-SHA256 Signatures**: Cryptographic verification of webhook authenticity
- **File-Backed Persistence**: No database required, JSON files for all state
- **138 Tests**: Comprehensive coverage with Vitest
- **Field-by-Field Validation UI**: See exactly which fields failed contract checks
- **Real-Time Metrics**: Live dashboard showing idempotency scores and replay queue
- **Simulation Buttons**: One-click scenarios for valid, duplicate, out-of-order, and dropped events
- **Auto-Refresh**: Dashboard updates every 3 seconds with user interaction awareness
- **Toast Notifications**: Visual feedback for all simulation actions

## Tech Stack

- **Node.js 18+**: Runtime environment
- **Native HTTP Server**: Built-in `http` module, no framework
- **File-Backed JSON Store**: Persistence without database
- **Vitest**: Test runner for unit and integration tests
- **Vanilla JavaScript UI**: No frontend framework

## Project Structure

```
├── mock-provider/           # Webhook sender simulation
│   └── src/
│       └── webhook-server.js
├── webhook-consumer/        # Contract validation and idempotency
│   └── src/
│       ├── webhook-handler.js
│       ├── contract-validator.js
│       ├── idempotency-store.js
│       ├── ordering-handler.js
│       └── replay-queue.js
├── support-console/         # Operator dashboard
│   └── server.js
├── flake-control-plane/     # Report generation
│   └── report-generator.js
├── runtime/                 # File-backed state
│   ├── contract-results.json
│   ├── idempotency-store.json
│   ├── event-ordering.json
│   └── replay-queue.json
├── generated-reports/       # Generated reports
│   └── sample-contract-test-report.md
├── tests/                   # Test suites
│   ├── contract/
│   ├── idempotency/
│   └── failure-modes/
├── postman/                 # Postman collection and environment for webhook scenarios
│   ├── webhook-idempotency.collection.json
│   └── webhook-idempotency.environment.json
├── perf/                    # k6 load test scripts
│   └── webhook-load-test.js
└── docs/                    # Documentation
    ├── webhook-contract-spec.md
    ├── idempotency-patterns.md
    ├── failure-mode-catalog.md
    └── tool-proof/          # Newman output and k6 summary artifacts
        ├── newman-sample-output.txt
        ├── k6-summary.json
        └── api-testing-workflow.md
```

## Sample Report

See [generated-reports/sample-contract-test-report.md](generated-reports/sample-contract-test-report.md) for an example contract test report showing:
- 96.1% contract validity rate
- 12 duplicate events detected (100% deduplicated)
- 3 events in replay queue
- Specific violation breakdown by field

## Why This Matters

This repo demonstrates that webhook reliability is not magic. It requires:
- Strict contract validation before processing
- Idempotency keys to prevent double charges
- Ordering logic to handle out-of-sequence events
- Replay queues to recover from dropped events

The patterns shown here are directly applicable to any startup integrating with Stripe, Shopify, GitHub, or any webhook-emitting service.
