# SOURCE_SHORTLIST.md

## Official research sources
- Ghost webhook loss incident
- FedEx delayed / missed webhook notice
- GitHub webhook reliability discussion
- PagerDuty event backbone outage writeup

## GitHub / implementation inspiration
- reliable webhook servers / gateways (Hook0, Hookaido, similar)
- integration / relay repos with retries and DLQ concepts
- repo-01 runtime/artifact/UI patterns for reviewer proof

## What to borrow
- retry and replay patterns
- HMAC signature validation patterns
- event persistence / replay queue ideas
- operator dashboard layout for failures and metrics

## Do not copy literally
- entire webhook gateway products
- full vendor UIs
- overbuilt infrastructure features beyond repo scope

## Must invent ourselves
- contract validation UX
- idempotency evidence outputs
- portfolio-grade demo scenarios and reports
