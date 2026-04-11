# UI Spec — Webhook Contract & Idempotency Harness

This repo must visually match the quality bar established by repo-01 after its UI upgrade, adapted for webhook reliability.

## Goal

The dashboard should make the reviewer understand that this repo catches integration failures before they become billing/support nightmares. The idempotency guarantee must be visible and verifiable.

## Layout

Use the same 3-column operator layout:
- **Left rail:** webhook event queue
- **Center pane:** event detail with contract/idempotency breakdown
- **Right rail:** live simulation + metrics + replay queue

## Required Panels

### Left Rail — Webhook Event Queue

Each event card must show:
- event ID
- type badge (payment.succeeded, order.created, etc.)
- contract status (valid/invalid)
- processing status (processed/duplicate/queued)
- timestamp
- source (provider name)

**Visual hierarchy:**
- Invalid contract events at top (red highlight)
- Duplicate events visually distinct (yellow)
- Replay queue events (blue border)
- Valid processed events (green)

### Center Pane — Event Detail

Must include inline sections:
1. **Header** — event ID, type, timestamps
2. **Contract Validation** — field-by-field status
   - ID present: check/X
   - Type valid: check/X with allowed values
   - Timestamp valid: check/X
   - Signature valid: check/X
   - Timestamp fresh: check/X
3. **Idempotency Status** — if duplicate
   - First processed timestamp
   - Receive count
   - Duplicate skipped confirmation
4. **Payload Preview** — JSON payload (truncated if large)
5. **Replay Status** — if in queue
   - Original timestamp vs current age
   - Retry count
   - Next retry time
6. **Raw Artifact Links** — links to JSON artifacts

### Right Rail — Context

Must include:
- **Contract Pass Rate** — large prominent percentage
- **Idempotency Score** — should always show 100%
- **Replay Queue Size** — with age indicator
- **Live Simulation buttons:**
 - Send Valid Webhook
 - Send Duplicate (3x)
 - Send Out-of-Order
 - Simulate Dropped
- **Control buttons:**
  - Run Contract Tests
  - Generate Report
- **Reset Demo Data button**

## Contract Validation Visualization

Must show field-by-field validation:

```
Contract Validation:
  [✓] ID present: evt_001
  [✓] Type valid: payment.succeeded
  [✗] Timestamp: MISSING
  [✓] Signature valid
  [✗] Timestamp fresh: Event is 6 hours old

Result: INVALID
```

**Visual requirements:**
- Green checkmarks for passing fields
- Red X for failing fields with specific error
- Overall result prominent (VALID/INVALID badge)

## Idempotency Visualization

For duplicate events, must show:

```
Idempotency Check:
  Event ID: evt_001
  First processed: 2026-04-06T08:00:00.000Z
  This receipt: 2026-04-06T08:00:05.000Z
  Receive count: 3
  Processed: NO (duplicate)
  
Result: SKIPPED (idempotency working)
```

## Replay Queue Panel

Must show:
- Queue size (number)
- Oldest event age (time)
- Events list with:
  - Event ID
  - Type
  - Status (pending/retrying)
  - Retry count
  - Age

**Visual requirements:**
- Events approaching max age should be highlighted
- Retry count visible
- Status badges (pending/retrying/succeeded/failed)

## Live Simulation Requirements

Buttons required:
- Send Valid Webhook
- Send Duplicate (3x)
- Send Out-of-Order
- Simulate Dropped
- Run Contract Tests
- Generate Report
- Reset Demo Data

Buttons must:
- be visible even when there are no events
- trigger scenarios without CLI use
- update the queue/detail panes automatically
- show loading state during execution

## Visual Style

Copy repo-01's final console style:
- dark operator console
- compact cards
- strong contract status emphasis
- dense but readable detail pane
- muted borders and professional spacing

**Webhook-specific colors:**
- Green: valid contract, processed
- Red: invalid contract
- Yellow: duplicate (skipped)
- Blue: in replay queue
- Gray: pending validation

## Hard Rules

1. Do not ship a UI that requires opening raw JSON first to understand contract validation.

2. The dashboard must show **idempotency working**. If it only shows "webhook received," it failed the repo goal.

3. The contract validation must be field-by-field, not just a pass/fail badge.

4. After running simulations, the UI must auto-refresh to show new events.

5. The replay queue must be visible at all times, not hidden in a modal.

## Required Interactions

1. **Click event card** → center pane shows event detail with contract breakdown
2. **Click "Send Duplicate (3x)"** → 3 events sent, only 1 processed
3. **Click "Simulate Dropped"** → event appears in replay queue
4. **Click "Run Contract Tests"** → full suite runs, results shown
5. **Click "Generate Report"** → report appears in reports list
6. **Click "Reset Demo Data"** → all events cleared

## Error States

- If contract validation fails: show specific field error, do not crash UI
- If no events: show empty state with "Send a webhook to see results" message
- If replay queue full: show warning indicator
