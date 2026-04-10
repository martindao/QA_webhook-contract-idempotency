# Idempotency Patterns

This document explains how the webhook consumer ensures exactly-once processing, even when the same event is delivered multiple times.

## The Problem

Webhook providers retry on failure. If your consumer crashes, times out, or returns a 5xx error, the provider will resend the same event. Without idempotency:

- A `payment.succeeded` event processes twice
- Customer gets charged twice
- Support nightmare ensues

## The Solution

Every webhook is assigned an idempotency key (the event `id` field). Before processing, the consumer checks if this key has been seen before.

## Deduplication Mechanism

### 1. Event ID as Idempotency Key

The `id` field in every webhook serves as the unique identifier:

```json
{
  "id": "evt_payment_abc123",
  "type": "payment.succeeded",
  "timestamp": "2026-04-10T08:00:00.000Z",
  "data": { "payment_id": "pay_123" }
}
```

The consumer uses `evt_payment_abc123` as the idempotency key.

### 2. Idempotency Store Lookup

Before processing, the consumer checks the idempotency store:

```javascript
function checkIdempotency(eventId) {
  const store = loadIdempotencyStore();
  const existing = store.processed_events.find(e => e.event_id === eventId);
  
  if (existing) {
    // Already processed - skip
    return { duplicate: true, firstProcessedAt: existing.first_processed_at };
  }
  
  // New event - proceed
  return { duplicate: false };
}
```

### 3. Processing and Recording

If the event is new:

1. Process the event (update business state)
2. Record in idempotency store with timestamp
3. Return success

If the event is a duplicate:

1. Skip processing entirely
2. Return success with `duplicate: true` flag
3. Increment receive count for metrics

## Payload Hash Comparison

In addition to event ID, the consumer stores a hash of the payload:

```javascript
function computePayloadHash(payload) {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}
```

### Why Hash the Payload?

1. **Detect corruption**: If the same ID arrives with different data, something is wrong
2. **Audit trail**: Can verify payload hasn't been tampered with
3. **Debugging**: Can compare expected vs actual payload

### Hash Mismatch Handling

If an event ID is seen again but the payload hash differs:

```javascript
if (existing.payload_hash !== computedHash) {
  // Log warning - possible corruption or tampering
  logWarning(`Payload hash mismatch for ${eventId}`);
  // Still skip processing (use original payload)
}
```

## Metrics Calculation

The idempotency store tracks metrics for reporting:

### Tracked Metrics

| Metric | Description |
|--------|-------------|
| `total_events_received` | All events that arrived (including duplicates) |
| `unique_events_processed` | Events that passed idempotency check |
| `duplicates_detected` | Events skipped due to prior processing |
| `duplicates_correctly_skipped` | Should equal `duplicates_detected` |
| `double_processing_incidents` | Should always be 0 |
| `idempotency_score` | Percentage of duplicates correctly handled |

### Score Calculation

```javascript
function calculateIdempotencyScore(metrics) {
  if (metrics.duplicates_detected === 0) return 1.0;
  
  const correctlyHandled = metrics.duplicates_correctly_skipped;
  const totalDuplicates = metrics.duplicates_detected;
  
  return correctlyHandled / totalDuplicates;
}
```

A score of 1.0 (100%) means every duplicate was correctly identified and skipped.

### Per-Event Tracking

Each event in the store tracks:

```json
{
  "event_id": "evt_001",
  "type": "payment.succeeded",
  "first_processed_at": "2026-04-10T08:00:00.000Z",
  "last_received_at": "2026-04-10T08:00:05.000Z",
  "receive_count": 3,
  "processed_count": 1,
  "payload_hash": "sha256:abc123..."
}
```

- `receive_count`: How many times this event arrived
- `processed_count`: Should always be 1 if idempotency works
- If `processed_count > 1`, there's a bug in the idempotency logic

## Idempotency Store Schema

The store is persisted to `runtime/idempotency-store.json`:

```json
{
  "store_version": "1.0",
  "last_updated": "2026-04-10T08:30:00.000Z",
  "processed_events": [
    {
      "event_id": "evt_001",
      "type": "payment.succeeded",
      "first_processed_at": "2026-04-10T08:00:00.000Z",
      "last_received_at": "2026-04-10T08:00:05.000Z",
      "receive_count": 3,
      "processed_count": 1,
      "payload_hash": "sha256:abc123...",
      "data": { "payment_id": "pay_123" }
    }
  ],
  "total_unique_events": 1235,
  "total_duplicates_skipped": 12,
  "double_processing_incidents": 0
}
```

## Concurrency Considerations

### File-Backed Store

The file-backed approach works for single-instance consumers. For distributed systems:

1. Use a database with unique constraint on `event_id`
2. Use atomic `INSERT IF NOT EXISTS` operations
3. Handle race conditions with database-level locking

### Current Implementation

The current implementation assumes single consumer instance:

```javascript
// Not safe for concurrent access
function recordProcessed(event) {
  const store = loadStore();
  store.processed_events.push(event);
  saveStore(store);
}
```

For production, wrap in file locks or use a proper database.

## Testing Idempotency

The test suite verifies:

1. **Same event sent 3 times**: Only processed once
2. **Different events with same ID**: Second rejected
3. **Metrics accuracy**: Counts match actual behavior
4. **Score calculation**: 100% when all duplicates skipped

```javascript
test('duplicate event is skipped', async () => {
  const event = createValidEvent();
  
  // First send - processed
  const result1 = await sendWebhook(event);
  expect(result1.duplicate).toBe(false);
  
  // Second send - skipped
  const result2 = await sendWebhook(event);
  expect(result2.duplicate).toBe(true);
  
  // Third send - skipped
  const result3 = await sendWebhook(event);
  expect(result3.duplicate).toBe(true);
  
  // Verify metrics
  const metrics = await getIdempotencyMetrics();
  expect(metrics.duplicates_detected).toBe(2);
  expect(metrics.duplicates_correctly_skipped).toBe(2);
  expect(metrics.idempotency_score).toBe(1.0);
});
```

## Common Pitfalls

### 1. Using Timestamp as Key
Bad: Timestamps can collide or be wrong. Use the event ID.

### 2. Not Storing the Key
Bad: If you process but don't record, retries will duplicate.

### 3. Processing Before Recording
Bad: If processing fails after recording, the event is blocked forever.

### 4. Ignoring Hash Mismatches
Bad: Same ID with different payload could indicate tampering.

## Best Practices

1. **Always check before processing**: No exceptions
2. **Record immediately after processing**: Before returning success
3. **Track metrics**: Know your duplicate rate
4. **Alert on double processing**: `processed_count > 1` is a bug
5. **Use unique constraint**: Database-level enforcement is safest
