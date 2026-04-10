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
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Mock Provider  │────▶│    Consumer     │────▶│ Support Console │
│   (port 3001)   │     │  (port 3002)    │     │   (port 3003)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  File Store │
                        │    (JSON)   │
                        └─────────────┘
```

**Data Flow**:
1. Mock Provider sends webhooks with HMAC-SHA256 signatures
2. Consumer validates contract, checks idempotency, handles ordering
3. Support Console displays real-time metrics and replay queue
4. File-backed store persists all state across restarts

## Demo Scenarios

### 1. Lost Events / No Replay
Simulates Ghost-style blog post loss where webhooks timeout and events vanish. The replay queue captures dropped events for manual recovery.

**Run**: `POST /api/simulate/dropped`

### 2. Out-of-Order Delivery
Simulates FedEx-style tracking where events arrive in wrong sequence. The ordering handler buffers and replays events in correct order.

**Run**: `POST /api/simulate/out-of-order`

### 3. Duplicate Events / Idempotency
Simulates PagerDuty-style retry storms where the same event arrives multiple times. The idempotency store ensures exactly-once processing.

**Run**: `POST /api/simulate/duplicate`

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
5. Reports generate in `reports/` directory

### Reset Between Demos
```bash
# Clear all runtime state
rm -rf runtime/*.json
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

## Key Features

- **Native Node.js HTTP**: No Express dependency, uses built-in `http` module
- **HMAC-SHA256 Signatures**: Cryptographic verification of webhook authenticity
- **File-Backed Persistence**: No database required, JSON files for all state
- **30+ Tests**: Comprehensive coverage with Vitest
- **Field-by-Field Validation UI**: See exactly which fields failed contract checks
- **Real-Time Metrics**: Live dashboard showing idempotency scores and replay queue

## Tech Stack

- **Node.js 18+**: Runtime environment
- **Native HTTP Server**: Built-in `http` module, no framework
- **File-Backed JSON Store**: Persistence without database
- **Vitest**: Test runner for unit and integration tests
- **Vanilla JavaScript UI**: No frontend framework

## Project Structure

```
├── mock-provider/          # Webhook sender simulation
│   └── src/
│       └── webhook-server.js
├── webhook-consumer/       # Contract validation and idempotency
│   └── src/
│       ├── webhook-handler.js
│       ├── contract-validator.js
│       ├── idempotency-store.js
│       ├── ordering-handler.js
│       └── replay-queue.js
├── support-console/        # Operator dashboard
│   └── server.js
├── flake-control-plane/    # Report generation
│   └── report-generator.js
├── runtime/                # File-backed state
│   ├── contract-results.json
│   ├── idempotency-store.json
│   ├── event-ordering.json
│   └── replay-queue.json
├── reports/                # Generated reports
│   └── sample-contract-test-report.md
├── tests/                  # Test suites
│   ├── contract/
│   ├── idempotency/
│   └── failure-modes/
└── docs/                   # Documentation
    ├── webhook-contract-spec.md
    ├── idempotency-patterns.md
    └── failure-mode-catalog.md
```

## Sample Report

See [reports/sample-contract-test-report.md](reports/sample-contract-test-report.md) for an example contract test report showing:
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
