# Anti-Patterns — Webhook Contract & Idempotency Harness

Do NOT let an AI drift into these mistakes.

## 1. Schema-Only Theater

Bad:
- checking payload fields but ignoring duplicate/replay/out-of-order behavior
- contract validation without idempotency
- only showing "webhook received"

Good:
- full event-lifecycle reliability
- contract validation + idempotency + replay + ordering
- field-by-field contract breakdown

## 2. No Idempotency Store

Bad:
- saying the system is idempotent without actual dedupe tracking
- no persistent store of processed event IDs
- idempotency that resets on restart

Good:
- persistent processed-event store
- tests that verify same event processed once
- idempotency score visible in UI
- store survives restarts (file-backed)

## 3. No Failure Simulation

Bad:
- only valid webhooks
- no dropped, delayed, or duplicate scenarios
- happy path only

Good:
- lost events (Ghost-inspired)
- delayed/out-of-order events (FedEx-inspired)
- duplicate events (PagerDuty-inspired)
- all failure modes clickable in UI

## 4. Generic Dashboard

Bad:
- counts only
- no contract field breakdown
- no idempotency visibility
- no replay queue

Good:
- contract results with field-by-field status
- idempotency metrics (duplicates detected/skipped)
- replay queue with age and retry status
- report links

## 5. Missing Signature Verification

Bad:
- no HMAC signature checking
- accepting any payload
- security bypass

Good:
- HMAC-SHA256 signature verification
- signature mismatch shows in contract validation
- uses Node.js crypto module (not hand-rolled)

## 6. No Replay Mechanism

Bad:
- dropped events are lost forever
- no retry logic
- no queue for failed deliveries

Good:
- replay queue for dropped/failed events
- retry with backoff
- age limits and alerting

## 7. Out-of-Order Ignorance

Bad:
- processing events as they arrive
- no sequence/timestamp ordering
- state corruption from race conditions

Good:
- detect out-of-order events
- hold and reorder by sequence/timestamp
- verify final state is correct

## 8. Fake Idempotency Score

Bad:
- hard-coded 100% score
- no actual duplicate detection
- score never changes

Good:
- score based on actual metrics
- updates when duplicates are detected
- shows double-processing incidents (should be 0)

## 9. Missing Timestamp Validation

Bad:
- no timestamp freshness check
- accepting events from hours ago
- replay attacks possible

Good:
- timestamp tolerance (e.g., 5 minutes)
- reject stale events
- show timestamp age in validation

## 10. Over-Engineering

Bad:
- real Kafka/RabbitMQ dependency
- production database for event store
- complex message broker setup

Good:
- lightweight mock provider
- file-backed state (no database)
- believable reliability without infrastructure

## 11. No Contract Test Suite

Bad:
- manual testing only
- no automated contract tests
- no negative test cases

Good:
- contract test suite with valid/invalid payloads
- tests for each violation type
- tests for idempotency, ordering, replay

## 12. Generic README

Bad:
- tutorial tone
- vague claims about "webhook reliability"
- no specific failure modes

Good:
- QA-first integration framing
- concrete scenarios (Ghost, FedEx, PagerDuty)
- clear explanation of idempotency guarantee
- specific contract validation fields
