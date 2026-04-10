# Verification — Webhook Contract & Idempotency Harness

This file is the final gate before pushing the repo publicly.

## 1. Install and Start

```bash
npm install
npm run reset
npm run start:all
```

This should start:
- Mock webhook provider on port 3001
- Webhook consumer on port 3002
- Support console on port 3003

## 2. Unit Tests

```bash
npm test
```

Target: 15+ unit tests passing.

Tests should cover:
- Contract validator (field validation)
- Signature verification (HMAC-SHA256)
- Idempotency store (add/check/mark)
- Replay queue (add/retry/age)
- Out-of-order handling

## 3. Integration Tests

```bash
npm run test:integration
```

Target: 15+ integration tests passing.

Tests should cover:
- Full webhook receive → validate → process flow
- Duplicate detection and skipping
- Out-of-order event handling
- Dropped event → replay queue flow
- Contract test suite execution

## 4. Manual UI Verification

Open `http://localhost:3003`

### Scenario A — Valid Webhook

1. Click `Send Valid Webhook`
2. Confirm event appears in queue with green "valid" badge
3. Click on the event
4. Confirm center pane shows:
   - All contract fields with green checkmarks
   - Processing status: "processed"
   - Payload preview visible

### Scenario B — Duplicate Webhook

1. Click `Reset Demo Data`
2. Click `Send Duplicate Webhook (3x)`
3. Confirm 3 events appear in queue
4. Click on first event
5. Confirm:
   - Processing status: "processed"
   - Receive count: 3
   - Duplicate count: 2
6. Click on second/third events
7. Confirm:
   - Processing status: "skipped (duplicate)"
   - First processed timestamp shown
8. Confirm idempotency score shows 100%

### Scenario C — Out-of-Order Events

1. Click `Reset Demo Data`
2. Click `Send Out-of-Order Events`
3. Confirm 2 events appear
4. Click on events
5. Confirm:
   - Event B (sequence 2) was held
   - Event A (sequence 1) arrived second
   - Both processed in correct order
   - Final state is correct

### Scenario D — Dropped Event

1. Click `Reset Demo Data`
2. Click `Simulate Dropped Event`
3. Confirm event appears in replay queue (right rail)
4. Confirm event shows:
   - Status: "pending" or "retrying"
   - Original timestamp
   - Age indicator
5. Click on the event
6. Confirm replay status is visible

### Scenario E — Contract Violations

1. Click `Reset Demo Data`
2. Manually send invalid webhook (or use test script)
3. Confirm event appears with red "invalid" badge
4. Click on the event
5. Confirm:
   - Specific field shows red X
   - Error message is specific (not generic)
   - Contract validation breakdown visible

### Scenario F — Full Pipeline

1. Click `Reset Demo Data`
2. Click all simulation buttons
3. Click `Run Contract Tests`
4. Confirm test results appear
5. Click `Generate Report`
6. Confirm report appears in reports list
7. Click report link
8. Confirm markdown report renders correctly

## 5. Critical Bug Check

**Reset → Simulate flow**

This is a mandatory check:
1. Click `Reset Demo Data`
2. Confirm all events cleared
3. Confirm idempotency store is empty
4. Confirm replay queue is empty
5. Click `Send Valid Webhook`
6. Confirm NEW event appears
7. Click `Send Duplicate Webhook (3x)`
8. Confirm NEW duplicate detection works

If this fails, the repo is not ready.

## 6. Idempotency Verification

After running duplicate simulation:
1. Confirm idempotency-store.json exists
2. Confirm `processed_count` is 1 for duplicate events
3. Confirm `receive_count` matches number sent
4. Confirm `double_processing_incidents` is 0
5. Confirm idempotency score is 100%

## 7. Signature Verification

Test HMAC signature:
1. Send a webhook with known payload
2. Verify signature in X-Webhook-Signature header
3. Confirm signature matches expected SHA-256 HMAC
4. Test with wrong secret — should fail validation

## 8. Browser Console

Open devtools and confirm:
- no uncaught JS errors
- no duplicate declaration errors
- no 404s for artifacts or reports
- API calls return expected JSON structure

## 9. Mock Provider Verification

The mock provider must:
- Generate realistic events
- Sign payloads correctly
- Support simulation modes (drop, delay, duplicate)

Test manually:
```bash
curl -X POST http://localhost:3001/simulate/drop
```

Should trigger a dropped event scenario.

## 10. README Review

Read README from top to bottom as if you are a hiring manager.

Ask:
- Can I understand what this repo solves in 60 seconds?
- Is the idempotency guarantee explained clearly?
- Do the commands actually work?
- Is the contract validation explained?

If any answer is no, fix it first.

## 11. Report Quality Check

Open generated report and verify:
- Summary with contract pass rate
- Violation breakdown by type
- Idempotency metrics (should show 100%)
- Replay queue status
- Recommended actions are specific

If report is empty or generic, the report generator needs fixes.

## 12. Out-of-Order Edge Cases

Test edge cases:
1. Send event B first, then A
2. Confirm A is processed before B
3. Send events with same timestamp
4. Confirm deterministic ordering (by sequence number)
5. Send events with no sequence number
5. Confirm fallback to timestamp ordering
