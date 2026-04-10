# PROJECT_DIRECTION.md

## Family
QA (QA/SDET flagship repo)

## Canonical Name
QA_webhook-contract-idempotency

## Reference Implementation
Use `C:\Users\marti\Desktop\Projects\SUP_incident-intelligence-fastpath` as the runtime/operator quality bar, but adapt artifacts and UI to integration reliability.

## Product Direction
This repo is a **webhook reliability harness** proving contract validation, duplicate detection, replay safety, and ordering correctness.

## Keep These Priorities
1. contract validation
2. idempotency guarantees
3. replay / dropped-event handling
4. integration-quality dashboard

## Do NOT Drift Into
- webhook receiver toy app
- schema-only checks
- no duplicate/replay logic
