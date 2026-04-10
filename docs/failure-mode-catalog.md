# Failure Mode Catalog

This document catalogs the failure modes that webhook integrations encounter and how this harness handles each one.

## 1. Dropped Events

### Description
Events that are sent but never arrive at the consumer. The sender believes delivery succeeded, but the consumer never receives the webhook.

### Real-World Examples
- **Ghost blog platform**: Posts published but webhooks lost due to timeout
- **Network partitions**: Brief connectivity loss drops packets
- **Load balancer issues**: Requests dropped during failover
- **Consumer crashes**: Process dies mid-request

### Symptoms
- Event exists in sender's logs
- No record in consumer's logs
- Business state out of sync
- No error reported (sender thinks it worked)

### How This Harness Handles It

**Replay Queue**: Events that timeout or fail to receive acknowledgment are queued for replay.

```json
{
  "event_id": "evt_dropped_001",
  "type": "payment.succeeded",
  "original_timestamp": "2026-04-10T07:55:00.000Z",
  "queued_at": "2026-04-10T08:00:00.000Z",
  "source": "dropped-event-simulation",
  "retry_count": 0,
  "status": "pending"
}
```

**Detection**:
- Sender timeout triggers replay queue entry
- Consumer exposes `/api/replay-queue` endpoint
- Support console shows pending events

**Recovery**:
- Manual replay via support console
- Automatic retry with backoff
- Alert when queue size exceeds threshold

### Simulation
```bash
POST /api/simulate/dropped
```

---

## 2. Out-of-Order Delivery

### Description
Events arrive in a different sequence than they were generated. The consumer receives event B before event A, causing state corruption.

### Real-World Examples
- **FedEx tracking**: Package delivered before shipped in system
- **Payment processing**: Refund arrives before charge
- **Order lifecycle**: Cancelled before created
- **User actions**: Logout before login

### Symptoms
- State transitions appear invalid
- Business logic rejects legitimate events
- Data inconsistency across systems
- Debugging nightmare (event logs look wrong)

### How This Harness Handles It

**Ordering Handler**: Buffers events and processes them in sequence order.

```javascript
function handleOutOfOrder(event) {
  const entityId = extractEntityId(event);
  const sequence = event.sequence;
  
  // Check if we're expecting this sequence
  const expectedSeq = getExpectedSequence(entityId);
  
  if (sequence === expectedSeq) {
    // In order - process immediately
    processEvent(event);
    incrementSequence(entityId);
    processBufferedEvents(entityId);
  } else if (sequence > expectedSeq) {
    // Future event - buffer it
    bufferEvent(entityId, event);
  } else {
    // Past event - already processed or gap
    logWarning(`Received past event: ${event.id}`);
  }
}
```

**Detection**:
- Each event has a `sequence` field
- Consumer tracks expected sequence per entity
- Out-of-order events are buffered, not rejected

**Recovery**:
- Buffered events process when gap is filled
- Timeout triggers alert for missing events
- Manual intervention for persistent gaps

### Simulation
```bash
POST /api/simulate/out-of-order
```

---

## 3. Duplicate Delivery

### Description
The same event is delivered multiple times. The sender retries due to perceived failure, or network issues cause retransmission.

### Real-World Examples
- **PagerDuty**: Incident webhooks sent multiple times during outages
- **Stripe**: Payment webhooks retried on 5xx responses
- **GitHub**: Push events delivered twice due to timeout
- **Shopify**: Order webhooks retried during high load

### Symptoms
- Same customer charged multiple times
- Duplicate records in database
- Notification spam
- Incorrect metrics and reporting

### How This Harness Handles It

**Idempotency Store**: Every event ID is checked before processing.

```javascript
function processWithIdempotency(event) {
  const existing = idempotencyStore.get(event.id);
  
  if (existing) {
    // Duplicate - skip processing
    metrics.duplicates_detected++;
    metrics.duplicates_correctly_skipped++;
    return { duplicate: true, firstProcessedAt: existing.timestamp };
  }
  
  // New event - process and record
  processEvent(event);
  idempotencyStore.record(event.id, event);
  return { duplicate: false };
}
```

**Detection**:
- Event ID lookup in idempotency store
- Payload hash comparison for integrity
- Metrics track duplicate rate

**Recovery**:
- Duplicates are silently skipped
- Response indicates duplicate status
- No business logic executed for duplicates

### Simulation
```bash
POST /api/simulate/duplicate
```

---

## 4. Timestamp Drift

### Description
Event timestamps are significantly different from current time, either in the past (replay attacks) or future (clock skew).

### Real-World Examples
- **Replay attacks**: Attacker resends old valid webhook
- **Clock skew**: Server clocks not synchronized
- **Delayed delivery**: Event queued for hours before delivery
- **Timezone issues**: Timestamps in wrong timezone

### Symptoms
- Events rejected as "too old"
- Valid events rejected as "in future"
- Inconsistent behavior across environments
- Debugging confusion about timing

### How This Harness Handles It

**Timestamp Validation**: Events outside tolerance window are rejected.

```javascript
function validateTimestamp(timestamp) {
  const now = Date.now();
  const eventTime = new Date(timestamp).getTime();
  const drift = Math.abs(now - eventTime) / 1000;
  
  if (drift > MAX_DRIFT_SECONDS) {
    return {
      valid: false,
      error: drift > 0 
        ? `Timestamp too old: ${drift} seconds drift`
        : `Timestamp in future: ${drift} seconds drift`
    };
  }
  
  return { valid: true };
}
```

**Detection**:
- Compare event timestamp to current time
- Calculate drift in seconds
- Reject if drift exceeds tolerance (300s default)

**Recovery**:
- Rejected events return specific error
- Sender can investigate clock sync
- Replay queue captures legitimate delayed events

### Configuration
```javascript
const MAX_DRIFT_SECONDS = 300; // 5 minutes
```

---

## 5. Invalid Signature

### Description
Webhook signature does not match expected value, indicating tampering or configuration error.

### Real-World Examples
- **Secret rotation**: Old secret still in use
- **Key mismatch**: Different secrets on sender and receiver
- **Payload modification**: Man-in-the-middle attack
- **Encoding issues**: Signature computed on wrong payload format

### Symptoms
- All webhooks rejected
- Intermittent failures
- Works in test, fails in production
- Security alerts

### How This Harness Handles It

**HMAC Verification**: Every webhook signature is verified.

```javascript
function verifySignature(payload, signature, timestamp, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');
  
  const provided = signature.replace('sha256=', '');
  
  if (!timingSafeEqual(expectedSignature, provided)) {
    return {
      valid: false,
      error: 'HMAC-SHA256 signature mismatch'
    };
  }
  
  return { valid: true };
}
```

**Detection**:
- Compute expected HMAC
- Timing-safe comparison with provided signature
- Reject on mismatch

**Recovery**:
- Specific error message helps debugging
- Check secret configuration
- Verify payload encoding

---

## 6. Missing Required Fields

### Description
Webhook payload is missing required fields, making it impossible to process.

### Real-World Examples
- **API version mismatch**: Newer sender, older receiver
- **Partial serialization**: Bug in sender's JSON serialization
- **Schema evolution**: Field renamed or removed
- **Manual testing**: Incomplete test payloads

### Symptoms
- Events rejected with validation errors
- Specific field called out in error
- Pattern suggests sender bug
- Works for some events, fails for others

### How This Harness Handles It

**Field Validation**: Every required field is checked.

```javascript
function validateRequiredFields(payload) {
  const required = ['id', 'type', 'timestamp', 'data'];
  const errors = [];
  
  for (const field of required) {
    if (!(field in payload)) {
      errors.push(`Missing required field: ${field}`);
    } else if (payload[field] === null) {
      errors.push(`Field cannot be null: ${field}`);
    }
  }
  
  return errors.length === 0 
    ? { valid: true }
    : { valid: false, errors };
}
```

**Detection**:
- Check each required field exists
- Check field is not null
- Return specific field name in error

**Recovery**:
- Error message identifies missing field
- Sender can fix payload
- Contract test suite catches regressions

---

## 7. Invalid Event Type

### Description
Event type is not in the allowed list, indicating schema mismatch or typo.

### Real-World Examples
- **New event type**: Sender added type not yet supported
- **Typo**: `payment.succeded` instead of `payment.succeeded`
- **Case sensitivity**: `Payment.Succeeded` instead of `payment.succeeded`
- **Namespace change**: `payments.succeeded` instead of `payment.succeeded`

### Symptoms
- Events rejected with type error
- Error message shows allowed types
- Pattern suggests sender change
- May affect multiple events

### How This Harness Handles It

**Type Validation**: Event type must be in allowed list.

```javascript
const ALLOWED_TYPES = [
  'payment.succeeded',
  'payment.failed',
  'order.created',
  'order.shipped'
];

function validateType(type) {
  if (!ALLOWED_TYPES.includes(type)) {
    return {
      valid: false,
      error: `Invalid type: '${type}' not in allowed list`
    };
  }
  
  return { valid: true };
}
```

**Detection**:
- Exact string match against allowed types
- Case-sensitive comparison
- Return invalid type in error

**Recovery**:
- Error shows what was received
- Sender can fix typo or add new type
- Contract test suite validates all types

---

## Failure Mode Summary Table

| Failure Mode | Detection | Recovery | Simulation |
|--------------|-----------|----------|------------|
| Dropped Events | Timeout, no ACK | Replay queue | `POST /api/simulate/dropped` |
| Out-of-Order | Sequence check | Buffer and reorder | `POST /api/simulate/out-of-order` |
| Duplicate | Idempotency store | Skip processing | `POST /api/simulate/duplicate` |
| Timestamp Drift | Time comparison | Reject with drift amount | Contract validation |
| Invalid Signature | HMAC verification | Reject with mismatch | Contract validation |
| Missing Fields | Field presence check | Reject with field name | Contract validation |
| Invalid Type | Type allowlist | Reject with allowed types | Contract validation |

## Testing Failure Modes

Each failure mode has dedicated tests:

```bash
# Test contract validation (missing fields, invalid types, signatures)
npm run test:contract

# Test idempotency (duplicate handling)
npm run test:idempotency

# Test failure mode simulations
npm run test:failures
```

All tests verify:
- Failure is detected correctly
- Appropriate error is returned
- Metrics are updated
- No side effects for invalid events
