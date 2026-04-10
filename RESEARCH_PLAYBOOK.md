# RESEARCH_PLAYBOOK.md

## Why this file exists
This file teaches future AI **how to think** before building the repo.
Do not skip it. Read this after `INSTRUCTIONS.md` and before writing code.

## Golden Rule
Do not invent the repo from vibes.
Build it from:
1. real 2025-2026 incidents / engineering docs
2. real GitHub implementation ingredients
3. the proven runtime and UI patterns from `SUP_incident-intelligence-fastpath`

## Required Reading Order
1. `INSTRUCTIONS.md`
2. `PROJECT_DIRECTION.md`
3. `BUILD_STANDARD.md`
4. `C:\Users\marti\Desktop\Projects\BUILD_STANDARD_DESIGN.md`
5. this file (`RESEARCH_PLAYBOOK.md`)
6. everything in `docs/`
7. inspect `C:\Users\marti\Desktop\Projects\SUP_incident-intelligence-fastpath`

## Research Method (Mandatory)

### Step 1 — Identify the expensive failure
Ask:
- what breaks?
- why is it expensive?
- what gets noisy/confusing for support or QA?
- what would a Series A/B startup CTO care about?

### Step 2 — Extract source patterns
From the postmortems / blogs / docs, extract:
- failure mode
- detection gap
- recovery pattern
- operator pain
- business impact

Do NOT copy wording from the source. Extract the pattern only.

### Step 3 — Extract GitHub ingredients
Search for:
- runtime patterns
- workflow patterns
- fixture patterns
- reporting patterns
- UI/operator patterns

Borrow ingredients, not entire repos.

## Source Selection Rules

### Prefer these sources first
1. official postmortems
2. official engineering blogs
3. official docs from product/platform teams
4. high-quality open-source repos with exact file paths

### Reject or downgrade these
- SEO blogspam
- generic dashboard templates
- vendor marketing pages
- repos with pretty UI but no operational logic
- examples without exact file paths or real code

## GitHub Ingredient Selection Rules
When reading GitHub repos, extract only:
- patterns worth reusing
- files with exact paths
- runtime structures that make the repo believable
- UI patterns that support the operator flow

Do NOT copy:
- entire repos
- vendor branding
- large chunks of README prose
- exact workflows unrelated to the repo goal

## What must stay consistent across all 6 repos
- file-backed runtime store (unless explicitly justified otherwise)
- live simulation buttons in UI
- reset -> simulate must work
- artifact-first design
- no-cache headers on served UI and docs
- premium operator-style visual hierarchy
- README as portfolio proof document

## How to choose app shape
Choose the smallest system that still creates believable pain.

Good:
- queue + worker + DB
- auth + key rotation + tenant state
- webhook sender + consumer + replay store
- componentized UI + shadow DOM + intent locators

Bad:
- generic dashboard shell
- huge overbuilt microservice architecture for no reason
- toy Hello World app

## How to choose what to simulate
A simulation is good if:
- it is deterministic
- it produces realistic telemetry
- it creates real artifacts
- the UI can show it clearly
- the reviewer understands why it matters

A simulation is bad if:
- it is random nonsense
- it only changes colors in the UI
- it does not generate real evidence

## How to choose UI direction
The UI must answer:
1. what happened?
2. what is affected?
3. what should I do next?
4. what evidence do I have?

If the reviewer still needs raw JSON first, the UI is too weak.

## How to keep quality at repo-01 level
Before calling a repo done, ask:
- Does it work end-to-end?
- Does the reset ? simulate flow work?
- Does the UI feel like an operator tool?
- Does the README sell the repo in 60 seconds?
- Would a hiring manager believe this is real work?

If not, keep going.
