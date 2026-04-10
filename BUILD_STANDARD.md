# Cross-Repo Build Standard — 6 SSS-Tier Portfolio Repos

This document is the shared quality bar for repos 02–06. Any AI building a repo must read:

1. the repo's `INSTRUCTIONS.md`
2. the repo's `PROJECT_DIRECTION.md`
3. `C:\Users\marti\Desktop\Projects\BUILD_STANDARD_DESIGN.md`
4. the repo's `RESEARCH_PLAYBOOK.md`
5. the repo's `docs/API_CONTRACT.md`
6. the repo's `docs/ARTIFACT_SCHEMA.md`
7. the repo's `docs/UI_SPEC.md`
8. the repo's `docs/VERIFICATION.md`
9. the repo's `docs/ANTI_PATTERNS.md`

## Golden Reference

Use `SUP_incident-intelligence-fastpath` as the runtime and operator-console template.

## Mandatory Quality Rules

### 1. Repo must be runnable
- `npm install`
- `npm run start:all`
- browser opens and the tool works

### 2. Live simulation is mandatory
Every repo with UI must have visible simulate buttons.
The reviewer must not need CLI commands to see the project work.

### 3. Reset must not break simulate
After reset, triggering a simulation again must work.

### 4. Shared runtime store only
No process-local shared JS state across multiple node processes.

### 5. Artifact-first design
Every repo must generate inspectable proof artifacts.

### 6. README is part of the product
README must sell the repo to a hiring manager in under 60 seconds.

### 7. UI must be support/operator/infra quality
No generic admin-template look.
Use `C:\Users\marti\Desktop\Projects\BUILD_STANDARD_DESIGN.md` for color tokens, layout, spacing, and component patterns.

### 8. Do not partially edit large inline scripts
If `index.html` has a large embedded script, rewrite the whole file when changing major behavior.

### 9. Cache-busting headers required
Without this, reviewers will see stale UIs and think the repo is broken.

### 10. Tests are mandatory
Each repo must have:
- unit tests
- integration tests
- manual verification checklist in `docs/VERIFICATION.md`

## Minimum Deliverables Per Repo

- public `README.md`
- `package.json`
- working UI
- simulate buttons
- reset button
- runtime store
- artifacts
- runbooks or equivalent operator docs
- tests
- screenshots (before public publish)

## Public Framing Rules

- original work framing only
- no “inspired by” credits in public docs
- no fake production claims
- frame as: “This repo demonstrates the ability to handle...”

## Final Rule

If the reviewer opens the repo and still needs imagination to believe it, the repo is not done.
