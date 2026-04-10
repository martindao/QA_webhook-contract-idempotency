# Webhook Contract Specification

This document defines the contract that all webhooks must satisfy. Any deviation results in rejection with a specific error message.

## Required Fields

Every webhook payload must contain these fields at the root level:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the event (e.g., `evt_001`) |
| `type` | string | Yes | Event type from allowed list |
| `timestamp` | string | Yes | ISO 8601 timestamp of when event occurred |
| `data` | object | Yes | Event-specific payload |

### Field Validation Rules

#### `id`
- Must be present
- Must be a non-empty string
- Must be unique across all events
- Example valid: `evt_001`, `evt_payment_abc123`
- Example invalid: `null`, `""`, `123`

#### `type`
- Must be present
- Must be a string
- Must match one of the allowed event types
- Case-sensitive matching
- Example valid: `payment.succeeded`
- Example invalid: `payment.processed`, `PAYMENT.SUCCEEDED`

#### `timestamp`
- Must be present
- Must be a valid ISO 8601 string
- Must be within tolerance of current time
- Example valid: `2026-04-10T08:00:00.000Z`
- Example invalid: `null`, `"yesterday"`, `1681234567`

#### `data`
- Must be present
- Must be an object (can be empty)
- Contents are event-type specific
- Example valid: `{ "payment_id": "pay_123" }`
- Example invalid: `null`, `"string"`, `[]`

## Allowed Event Types

The following event types are recognized:

| Event Type | Description |
|------------|-------------|
| `payment.succeeded` | Payment completed successfully |
| `payment.failed` | Payment failed |
| `order.created` | New order created |
| `order.shipped` | Order shipped |

Any event with a type not in this list will be rejected with error:
```
Invalid type: '<type>' not in allowed list
```

## Signature Format

All webhooks must include an HMAC-SHA256 signature in the `X-Webhook-Signature` header.

### Header Format
```
X-Webhook-Signature: sha256=<hex_encoded_signature>
```

### Signature Generation
1. Concatenate: `timestamp + "." + JSON.stringify(payload)`
2. Compute HMAC-SHA256 using shared secret
3. Encode result as hexadecimal string
4. Prefix with `sha256=`

### Example
```javascript
const crypto = require('crypto');

function generateSignature(timestamp, payload, secret) {
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  return `sha256=${signature}`;
}
```

### Verification
The consumer verifies signatures by:
1. Extracting signature from header
2. Recomputing HMAC with shared secret
3. Comparing using timing-safe comparison
4. Rejecting if signatures do not match

## Timestamp Tolerance

Webhooks with timestamps too far from current time are rejected.

### Tolerance Window
- **Maximum drift**: 300 seconds (5 minutes)
- **Direction**: Both past and future

### Rejection Examples
- Timestamp 301 seconds in the past: `"Timestamp too old: 301 seconds drift"`
- Timestamp 301 seconds in the future: `"Timestamp in future: 301 seconds drift"`

### Rationale
- Prevents replay attacks from old webhooks
- Catches clock synchronization issues
- Allows for reasonable network latency

## Required Headers

Every webhook request must include:

| Header | Format | Example |
|--------|--------|---------|
| `X-Webhook-Signature` | `sha256=<hex>` | `sha256=abc123...` |
| `X-Webhook-Timestamp` | ISO 8601 | `2026-04-10T08:00:00.000Z` |
| `X-Webhook-Event-Id` | String | `evt_001` |
| `Content-Type` | MIME type | `application/json` |

### Header Validation
- Missing `X-Webhook-Signature`: `"Missing required header: X-Webhook-Signature"`
- Missing `X-Webhook-Timestamp`: `"Missing required header: X-Webhook-Timestamp"`
- Missing `X-Webhook-Event-Id`: `"Missing required header: X-Webhook-Event-Id"`
- Wrong `Content-Type`: `"Invalid content type: expected application/json"`

## Contract Validation Flow

```
1. Check required headers
   └─ Missing? Reject with specific header name

2. Parse JSON body
   └─ Invalid JSON? Reject with parse error

3. Check required fields
   └─ Missing? Reject with specific field name

4. Validate field types
   └─ Wrong type? Reject with expected vs actual

5. Validate event type
   └─ Not in list? Reject with allowed types

6. Validate timestamp
   └─ Out of tolerance? Reject with drift amount

7. Verify signature
   └─ Mismatch? Reject with signature error

8. All checks pass
   └─ Accept webhook for processing
```

## Error Response Format

When contract validation fails, the response includes:

```json
{
  "received": true,
  "event_id": "evt_001",
  "contract_valid": false,
  "validation_details": {
    "id_present": true,
    "type_valid": false,
    "type_error": "Invalid type: 'payment.processed' not in allowed list",
    "timestamp_valid": true,
    "signature_valid": true,
    "timestamp_fresh": true
  }
}
```

This allows the sender to understand exactly what failed and fix it.
