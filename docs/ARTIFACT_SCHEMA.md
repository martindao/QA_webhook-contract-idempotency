# Artifact Schema — Webhook Contract & Idempotency Harness

Every webhook processed must generate or update these runtime artifacts. These files are the source of truth for the dashboard and reports.

## 1. contract-results.json

Per-webhook contract validation outcomes.

```json
{
  "validated_at": "2026-04-06T08:00:00.000Z",
  "total_webhooks": 1247,
  "results": [
    {
      "event_id": "evt_001",
      "type": "payment.succeeded",
      "contract_valid": true,
      "validation_details": {
        "id_present": true,
        "type_valid": true,
        "timestamp_valid": true,
        "signature_valid": true,
        "timestamp_fresh": true
      },
      "received_at": "2026-04-06T08:00:00.000Z"
    },
    {
      "event_id": "evt_002",
      "type": "payment.failed",
      "contract_valid": false,
      "validation_details": {
        "id_present": true,
        "type_valid": false,
        "type_error": "Invalid type: 'payment.processed' not in allowed list",
        "timestamp_valid": true,
        "signature_valid": true,
        "timestamp_fresh": true
      },
      "received_at": "2026-04-06T08:00:05.000Z"
    },
    {
      "event_id": "evt_003",
      "type": "order.created",
      "contract_valid": false,
      "validation_details": {
        "id_present": true,
        "type_valid": true,
        "timestamp_valid": false,
        "timestamp_error": "Missing required field: timestamp",
        "signature_valid": true,
        "timestamp_fresh": false
      },
      "received_at": "2026-04-06T08:00:10.000Z"
    }
  ],
  "summary": {
    "valid": 1198,
    "invalid": 49,
    "pass_rate": 0.961
  },
  "violation_breakdown": {
    "missing_field": 23,
    "invalid_type": 15,
    "signature_mismatch": 11
  }
}
```

**Required fields:**
- `event_id` — unique webhook identifier
- `contract_valid` — boolean, true if all checks pass
- `validation_details` — per-field validation status
- `received_at` — when the webhook was received

## 2. idempotency-store.json

Processed event IDs with metadata.

```json
{
  "store_version": "1.0",
  "last_updated": "2026-04-06T08:30:00.000Z",
  "processed_events": [
    {
      "event_id": "evt_001",
      "type": "payment.succeeded",
      "first_processed_at": "2026-04-06T08:00:00.000Z",
      "last_received_at": "2026-04-06T08:00:05.000Z",
      "receive_count": 3,
      "processed_count": 1,
      "payload_hash": "sha256:abc123...",
      "data": {
        "payment_id": "pay_123",
        "amount": 9900
      }
    }
  ],
  "total_unique_events": 1235,
  "total_duplicates_skipped": 12,
  "double_processing_incidents": 0
}
```

**Required fields:**
- `event_id` — unique identifier
- `first_processed_at` — when first processed
- `receive_count` — how many times received
- `processed_count` — should always be 1 if idempotency works

## 3. replay-queue.json

Lost events awaiting replay.

```json
{
  "queue_version": "1.0",
  "last_updated": "2026-04-06T08:30:00.000Z",
  "events": [
    {
      "event_id": "evt_dropped_001",
      "type": "payment.succeeded",
      "original_timestamp": "2026-04-06T07:55:00.000Z",
      "queued_at": "2026-04-06T08:00:00.000Z",
      "source": "dropped-event-simulation",
      "retry_count": 0,
      "status": "pending",
      "last_error": null,
      "payload": {
        "id": "evt_dropped_001",
        "type": "payment.succeeded",
        "timestamp": "2026-04-06T07:55:00.000Z",
        "data": {
          "payment_id": "pay_456",
          "amount": 5000
        }
      }
    },
    {
      "event_id": "evt_timeout_001",
      "type": "order.created",
      "original_timestamp": "2026-04-06T07:50:00.000Z",
      "queued_at": "2026-04-06T08:00:00.000Z",
      "source": "consumer-timeout",
      "retry_count": 2,
      "status": "retrying",
      "last_error": "Consumer timeout after 30s",
      "next_retry_at": "2026-04-06T08:35:00.000Z"
    }
  ],
  "queue_size": 2,
  "oldest_event_age_seconds": 1800,
  "max_age_seconds": 86400
}
```

**Required fields:**
- `event_id` — unique identifier
- `original_timestamp` — when the event was originally created
- `queued_at` — when it was added to replay queue
- `status` — pending, retrying, succeeded, failed
- `retry_count` — number of replay attempts

## 4. event-ordering.json

Out-of-order event handling log.

```json
{
  "last_updated": "2026-04-06T08:30:00.000Z",
  "ordering_events": [
    {
      "entity_id": "order_123",
      "events": [
        {
          "event_id": "evt_order_002",
          "type": "order.shipped",
          "sequence": 2,
          "timestamp": "2026-04-06T08:01:00.000Z",
          "received_at": "2026-04-06T08:01:05.000Z",
          "held_until": "2026-04-06T08:01:10.000Z",
          "processed_at": "2026-04-06T08:01:10.000Z"
        },
        {
          "event_id": "evt_order_001",
          "type": "order.created",
          "sequence": 1,
          "timestamp": "2026-04-06T08:00:00.000Z",
          "received_at": "2026-04-06T08:01:10.000Z",
          "processed_at": "2026-04-06T08:01:10.000Z"
        }
      ],
      "final_state": "shipped",
      "processing_order": ["evt_order_001", "evt_order_002"],
      "correct_order_maintained": true
    }
  ]
}
```

## 5. reports/contract-test-YYYY-MM-DD.md

Human-readable contract test report.

```markdown
# Webhook Contract & Idempotency Report — 2026-04-06

## Summary
- 1,247 webhooks received
- 1,198 contract-valid (96.1%)
- 49 contract-invalid (3.9%)
- 12 duplicate events detected (all idempotent)
- 3 events queued for replay

## Contract Violations
1. Missing `timestamp` field (23 events)
   - Fix: Ensure timestamp is set before sending
2. Invalid `type` value (15 events)
   - Fix: Update allowed types list for new event types
3. Signature mismatch (11 events)
   - Fix: Rotate webhook signing keys

## Idempotency Metrics
- Duplicate events: 12
- Successfully deduplicated: 12 (100%)
- Double-processing incidents: 0
- Idempotency score: 100%

## Replay Queue
- Current queue size: 3
- Oldest event age: 5 minutes
- Retry success rate: 92%

## Recommended Actions
1. Fix timestamp generation in payment service
2. Update allowed types list for new event types
3. Rotate webhook signing keys (11 signature mismatches)
4. Review replay queue for stuck events
```

## Quality Rules

- Artifacts must be deterministic and readable
- Do not omit payload hash from idempotency store
- Do not generate empty contract results
- The UI must be able to render all artifacts without transformation errors
- Replay queue must have age limits and retry backoff
- Reports must include specific violation examples, not just counts
