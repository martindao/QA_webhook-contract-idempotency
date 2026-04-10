# API Contract — Webhook Contract & Idempotency Harness

This file is the source of truth for the repo's HTTP surface. Any AI building this repo must follow these request/response contracts exactly unless there is a documented reason to extend them.

## General Rules

- Content type for JSON routes: `application/json`
- All successful POST simulation endpoints return `{ success: true, scenario: <name> }`
- All failed requests return `{ success: false, error: <message> }`
- The webhook reliability dashboard depends on these routes. Do not rename them casually.

---

## 1. Console and Report Routes

### `GET /`
Serve `support-console/ui/index.html`

### `GET /api/contract-results`
Returns current contract validation results.

**Response 200**
```json
{
  "last_validated": "2026-04-06T08:00:00.000Z",
  "total_webhooks": 1247,
  "contract_valid": 1198,
  "contract_invalid": 49,
  "pass_rate": 0.961,
  "violations": [
    {
      "webhook_id": "evt_001",
      "field": "timestamp",
      "error": "Missing required field",
      "severity": "critical"
    },
    {
      "webhook_id": "evt_002",
      "field": "type",
      "error": "Invalid value: 'payment.processed' not in allowed types",
      "severity": "critical"
    },
    {
      "webhook_id": "evt_003",
      "field": "signature",
      "error": "HMAC-SHA256 signature mismatch",
      "severity": "critical"
    }
  ],
  "violation_breakdown": {
    "missing_field": 23,
    "invalid_type": 15,
    "signature_mismatch": 11
  }
}
```

### `GET /api/idempotency-metrics`
Returns dedupe and duplicate detection metrics.

**Response 200**
```json
{
  "total_events_received": 1247,
  "unique_events_processed": 1235,
  "duplicates_detected": 12,
  "duplicates_correctly_skipped": 12,
  "double_processing_incidents": 0,
  "idempotency_score": 1.0,
  "replay_queue_size": 3,
  "replay_success_rate": 0.92,
  "recent_duplicates": [
    {
      "event_id": "evt_003",
      "received_count": 3,
      "processed_count": 1,
      "first_received": "2026-04-06T08:00:00.000Z",
      "last_received": "2026-04-06T08:00:05.000Z"
    }
  ]
}
```

### `GET /api/replay-queue`
Returns events queued for replay.

**Response 200**
```json
{
  "queue_size": 3,
  "events": [
    {
      "event_id": "evt_dropped_001",
      "type": "payment.succeeded",
      "original_timestamp": "2026-04-06T07:55:00.000Z",
      "queued_at": "2026-04-06T08:00:00.000Z",
      "retry_count": 0,
      "status": "pending",
      "source": "dropped-event-simulation"
    },
    {
      "event_id": "evt_dropped_002",
      "type": "order.created",
      "original_timestamp": "2026-04-06T07:56:00.000Z",
      "queued_at": "2026-04-06T08:00:00.000Z",
      "retry_count": 2,
      "status": "retrying",
      "source": "timeout-retry"
    }
  ],
  "oldest_event_age_seconds": 300
}
```

### `GET /api/reports`
Returns available report metadata.

**Response 200**
```json
[
  {
    "id": "report_2026_04_06",
    "generated_at": "2026-04-06T08:00:00.000Z",
    "type": "contract-test",
    "summary": "96.1% contract valid, 12 duplicates detected",
    "ref": "reports/contract-test-2026-04-06.md"
  }
]
```

### `GET /api/reports/:id`
Returns a generated markdown report.

---

## 2. Health and Runtime Routes

### `GET /api/health`
Returns current system health.

**Response 200**
```json
{
  "mock_provider": "operational",
  "webhook_consumer": "operational",
  "contract_validator": "operational",
  "idempotency_store": "operational",
  "replay_queue": "operational"
}
```

### `POST /api/reset`
Clears runtime state and processed events.

**Response 200**
```json
{ "success": true }
```

---

## 3. Simulation Routes

### `POST /api/simulate/valid`
Sends a valid webhook through the system.

**Response 200**
```json
{
  "success": true,
  "scenario": "valid",
  "event_id": "evt_valid_001",
  "contract_status": "valid",
  "processing_status": "processed"
}
```

### `POST /api/simulate/duplicate`
Sends the same event 3 times to test idempotency.

**Response 200**
```json
{
  "success": true,
  "scenario": "duplicate",
  "event_id": "evt_dup_001",
  "sent_count": 3,
  "processed_count": 1,
  "duplicates_skipped": 2
}
```

### `POST /api/simulate/out-of-order`
Sends events B then A to test ordering.

**Response 200**
```json
{
  "success": true,
  "scenario": "out-of-order",
  "events": [
    { "id": "evt_order_002", "sequence": 2, "sent_first": true },
    { "id": "evt_order_001", "sequence": 1, "sent_second": true }
  ],
  "final_state": "correct",
  "processing_order": ["evt_order_001", "evt_order_002"]
}
```

### `POST /api/simulate/dropped`
Simulates a dropped event that lands in replay queue.

**Response 200**
```json
{
  "success": true,
  "scenario": "dropped",
  "event_id": "evt_dropped_001",
  "delivery_status": "timeout",
  "replay_queued": true,
  "replay_queue_size": 1
}
```

---

## 4. Control Routes

### `POST /api/run-contract-tests`
Runs the full contract test suite.

**Response 200**
```json
{
  "success": true,
  "tests_run": 30,
  "passed": 28,
  "failed": 2,
  "results_ref": "runtime/contract-test-results.json"
}
```

### `POST /api/generate-report`
Generates a new contract test report.

**Response 200**
```json
{
  "success": true,
  "report_id": "report_2026_04_06",
  "ref": "reports/contract-test-2026-04-06.md"
}
```

---

## 5. Webhook Consumer Endpoints (Internal)

These are the endpoints the mock provider sends webhooks to:

### `POST /webhook/receive`
Receives a webhook from the mock provider.

**Request Headers**
```
X-Webhook-Signature: sha256=<hmac_signature>
X-Webhook-Timestamp: 2026-04-06T08:00:00.000Z
X-Webhook-Event-Id: evt_001
Content-Type: application/json
```

**Request Body**
```json
{
  "id": "evt_001",
  "type": "payment.succeeded",
  "timestamp": "2026-04-06T08:00:00.000Z",
  "data": {
    "payment_id": "pay_123",
    "amount": 9900,
    "currency": "usd"
  }
}
```

**Response 200**
```json
{
  "received": true,
  "event_id": "evt_001",
  "processed": true,
  "duplicate": false
}
```

**Response 200 (Duplicate)**
```json
{
  "received": true,
  "event_id": "evt_001",
  "processed": false,
  "duplicate": true,
  "first_processed_at": "2026-04-06T08:00:00.000Z"
}
```

---

## 6. Optional Extension Routes (MVP+)

### `GET /api/events/:id`
Returns details for a specific event.

### `GET /api/signature/verify`
Manually verify a signature.

These are optional. Do not block the MVP on them.

---

## Implementation Notes

- The server must send **no-cache headers** on HTML and markdown responses.
- The UI assumes the artifact endpoints are directly readable.
- HMAC signatures must use SHA-256 with the shared secret.
- The idempotency store must persist across restarts (file-backed).
- Replay queue should have a maximum age (events older than 24h should be alerting).
