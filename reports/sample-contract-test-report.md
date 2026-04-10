# Webhook Contract & Idempotency Report — 2026-04-10

**Generated**: 2026-04-10T08:00:00Z
**Period**: Last 24 hours

## Summary

| Metric | Value |
|--------|-------|
| Total Events | 1,247 |
| Valid Events | 1,198 |
| Invalid Events | 49 |
| Success Rate | 96.1% |
| Duplicates Detected | 12 |
| Replay Queue Size | 3 |

## Contract Violations

### By Field

**timestamp**: 23 events
   - Example: "Timestamp too old: 301 seconds drift"

**signature**: 15 events
   - Example: "Signature verification failed"

**type**: 8 events
   - Example: "Invalid type: 'payment.refunded' not in allowed list"

**id**: 3 events
   - Example: "Missing required field: id"

## Idempotency Metrics

| Metric | Value |
|--------|-------|
| Total Unique Events | 1,235 |
| Duplicates Skipped | 12 |
| Double Processing Incidents | 0 |
| Idempotency Score | 100.0% |

## Replay Queue Status

| Event ID | Type | Age | Status |
|----------|------|-----|--------|
| evt_dropped_001 | payment.succeeded | 3600s | pending |
| evt_dropped_002 | order.created | 1800s | pending |
| evt_dropped_003 | payment.failed | 7200s | aged |

## Recommended Actions

1. **Timestamp Drift**: 23 events rejected due to timestamp issues. Consider increasing tolerance or synchronizing clocks.

2. **Signature Failures**: 15 events had invalid signatures. Verify secret configuration across services.

3. **Invalid Types**: 8 events had invalid types. Update allowed types list for new event types.

4. **Missing IDs**: 3 events missing required ID field. Ensure all events have unique identifiers.

5. **Replay Queue**: 3 events pending replay. Review and manually replay aged events.
