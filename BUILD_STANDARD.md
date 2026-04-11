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

## Portfolio Integration Requirement (MANDATORY)

This repo is **not complete** when the app/repo itself is done.
It is only complete when it also has:

1. a **project demo page** in the portfolio website
2. a **landing-page project card** added to the portfolio homepage
3. a matching **SVG project-card artwork** in the same design family as the existing cards
4. a **portfolio-ready README** with screenshots/GIFs and business framing

### Required standard
The quality bar must match **SUP_incident-intelligence-fastpath**.
That is the minimum accepted standard for:
- runtime quality
- operator UX quality
- simulation/demo quality
- documentation quality
- portfolio presentation quality

### Mandatory outputs after repo build
After the repo itself works, the builder must also create:
- `PORTFOLIO_INTEGRATION.md` inside the repo root describing:
  - project title
  - short portfolio pitch
  - one-line card description
  - badge/tag list
  - recommended screenshot/GIF shots
  - SVG card artwork direction
- a portfolio project detail/demo page
- a landing-page card entry
- a local SVG card asset for the landing page

### Card artwork rule
Do not leave the landing-page card without artwork.
If artwork does not exist yet, create a new SVG in the same visual family as the existing generated cards.

### Anti-copy rule (CRITICAL)
You are **NOT ALLOWED** to copy a UI 1:1 from another repo, product, or open-source app.

Allowed:
- research multiple UIs from the internet for inspiration
- borrow interaction ideas, hierarchy ideas, information architecture ideas, and visual patterns
- synthesize a new UI that fits this repo and Martin's portfolio system

Not allowed:
- cloning another dashboard or product screen 1:1
- copying layout/component composition so closely that it reads as the same product
- lifting exact visual structure from another repo with only colors changed

### UI quality standard
The new repo UI must feel:
- original
- role-aligned
- operator-credible
- portfolio-polished
- at least as strong as repo 1's final quality bar

### Portfolio verification requirement
A repo is not considered done until a reviewer can:
1. run the repo
2. click a simulation/demo control
3. inspect generated artifacts
4. open the project demo page in the portfolio
5. see the project card on the landing page with proper artwork

If any of these are missing, the repo is incomplete.
