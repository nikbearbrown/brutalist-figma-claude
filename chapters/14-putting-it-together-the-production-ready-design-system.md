# Chapter 14 — Putting It Together: The Production-Ready Design System

*What does a complete, machine-ready design system look like? This chapter assembles the full picture.*

---

## The Failure This Chapter Is About

The design system had been "done" for eight months. Tokens, components, documentation — everything in Figma. A CI pipeline that "synced" tokens on every push. An asset export script someone had written and tested once. A Notion page describing how everything was supposed to work.

Then a new engineer joined the team and was asked to implement a redesigned checkout flow.

She spent three days piecing together what the design system actually contained. The token JSON in the repository did not match the values in Figma — the sync had broken silently six weeks earlier when someone changed a variable collection name. The icon she needed existed in the Figma file but not in the exported assets; the export script had been checking for nodes by a name that no longer existed. The Notion documentation described the component API as it had existed before the Q3 refactor. The MCP session she tried to set up failed because the FIGMA_TOKEN in the repository secrets had expired.

Three days to answer a question that a well-governed extraction layer should have answered in fifteen minutes: what is in this design system, what state is it in, and is it safe to build on?

That is the failure this chapter addresses. Not "the design system doesn't have the right components" — the failure of knowing whether what you have is actually safe to use.

---

## What This Chapter Lets You Do

After this chapter you can:

- Understand the full extraction stack as a governed system, not a collection of scripts
- Wire `figma:ping`, `figma:audit`, `figma:tokens`, `figma:assets`, `figma:docs`, `figma:brand`, `figma:spec`, and `figma:mcp-check` into a single `package.json` CLI
- Configure GitHub Actions to run the audit on pull request, tokens and assets on merge, and the scheduled audit weekly
- Define governance ownership — who owns what, what requires human review, what can be automated
- Apply the Brutalist principle: maximally informed, minimally autonomous
- Close the book with a design system the team can actually trust

---

## The Full Extraction Stack

Every chapter in this book introduced one piece of the extraction layer. Here is the complete picture of what those pieces do and how they connect.

```
FIGMA FILE
    │
    ├── figma-ping.js          CH 2  Session health: token, file key, plan, rate limit
    ├── figma-read.mjs         CH 3  File graph: pages, components, variable inventory
    │
    ├── figma-audit.js         CH 5  Naming, tokens, components, brand, accessibility
    ├── figma-fix-plugin/      CH 6  Staged Plugin API remediation with human approval
    │
    ├── extract-tokens.mjs     CH 8  Variables API → DTCG JSON → Style Dictionary builds
    ├── validate-tokens.mjs    CH 8  Alias checks, malformed values, missing modes
    ├── export-assets.mjs      CH 9  Batched image export, SVGO post-process, manifest
    ├── sync-docs.mjs          CH 10 Component inventory, variant tables, stale-doc diffs
    ├── monitor-brand.mjs      CH 11 Color, type, spacing, contrast compliance report
    ├── build-spec.mjs         CH 12 Machine-readable component spec for CLIs + agents
    │
    └── MCP server             CH 13 Real-time design context for AI coding agents
         + FIGMA.md                  Agent governance: read, infer, generate, refuse
         + figma-mcp-check.md        Session preflight report
```

The Figma file is the source. The extraction layer converts its decisions into machine-readable artifacts. The governance layer defines what happens to those artifacts and who is accountable for each step.

---

## The Production CLI

All of these tools are worth nothing if they are not run. The production CLI makes them runnable — locally, in CI, and by AI coding agents — with single commands that return predictable output.

Add the following to `package.json`:

```json
{
  "scripts": {
    "figma:ping":      "node scripts/figma-ping.js",
    "figma:read":      "node scripts/figma-read.mjs",
    "figma:audit":     "node scripts/figma-audit.js",
    "figma:tokens":    "node scripts/extract-tokens.mjs && node scripts/validate-tokens.mjs",
    "figma:assets":    "node scripts/export-assets.mjs",
    "figma:docs":      "node scripts/sync-docs.mjs",
    "figma:brand":     "node scripts/monitor-brand.mjs",
    "figma:spec":      "node scripts/build-spec.mjs",
    "figma:mcp-check": "node scripts/figma-audit.js --mcp-check > figma-mcp-check.md",
    "figma:preflight": "npm run figma:ping && npm run figma:audit",
    "figma:full":      "npm run figma:preflight && npm run figma:tokens && npm run figma:assets && npm run figma:docs && npm run figma:brand && npm run figma:spec"
  }
}
```

**Environment variables required for all commands:**

```bash
# .env (never commit this file)
FIGMA_TOKEN=fig_xxxxxxxxxxxxxxxx
FIGMA_FILE_KEY=your_file_key_here

# Optional — for team/project scoped operations
FIGMA_TEAM_ID=your_team_id
FIGMA_PROJECT_ID=your_project_id
FIGMA_LIBRARY_FILE_KEY=your_shared_library_key
```

The `.env` file goes in `.gitignore`. The CI environment uses secrets injected at runtime. No hardcoded credentials, anywhere, ever.

### The Stable CLI Contract

Every command in this CLI follows the same contract introduced in Chapter 2:

1. **Reads** from the environment (`FIGMA_TOKEN`, `FIGMA_FILE_KEY`)
2. **Declares** what it is about to do before doing it
3. **Outputs** both human-readable markdown and machine-readable JSON
4. **Fails explicitly** with a non-zero exit code on any blocking error
5. **States** what it read, what it wrote, and what requires human review

A command that silently succeeds with wrong data is more dangerous than a command that fails loudly. Build for loud failure.

---

## The Governance Model

The extraction layer is a system. Systems without governance drift. Governance means: named owners, explicit review requirements, defined cadences, and documented decisions about what can be automated and what cannot.

### Who Owns What

```
FIGMA.md                    Design Systems team
figma-audit.js rules        Design Systems team + Engineering lead
Token pipeline output       Design Systems team (review) → release engineer (merge)
Asset pipeline output       Design Systems team (review) → release engineer (merge)
Documentation sync          Design Systems team
Brand compliance report     Brand team + Design Systems team
Component spec JSON         Engineering (consumer); Design Systems (producer)
MCP governance (FIGMA.md)   Design Systems team
CI/CD configuration         Engineering + Design Systems team
```

Write this down. Put it in `CONTRIBUTING.md` or the design system wiki. "Someone" owns these things — that means no one does. Name the team, and within the team, name the rotation.

### What Requires Human Review

**Always requires human review before merge:**

- Token changes (the diff is the design-development conversation)
- Asset changes (new assets, renamed assets, removed assets)
- Changes to `FIGMA.md` governance
- Any code generated by an AI coding agent via MCP

**Requires human review when findings are blocking:**

- Audit output with error-level findings
- Broken token aliases
- Brand compliance errors (not warnings)
- Missing Code Connect mappings for components in the current sprint

**Can be automated without review (with monitoring):**

- Scheduled audit reports (informational, no merge required)
- Brand compliance warning-level reports
- Documentation inventory updates (description, variant tables)
- MCP preflight checks

### The Deferred-Action Principle

The extraction layer surfaces, transforms, and validates. It does not decide. The principle running throughout this book is: **maximally informed, minimally autonomous.** The tools make the decision easier to make correctly. The human still makes it.

This is not a limitation. It is the correct architecture for a system where the consequences of a wrong decision — shipping a token that breaks a color scheme, removing an asset that is in production, generating code with the wrong prop names — are real and sometimes difficult to reverse.

The goal is not to remove the human from the loop. The goal is to make the human's judgment more reliable by giving them better information.

---

## The Audit Cadence

The audit is not a one-time event. It is a recurring check that keeps the file honest.

### When to Run the Audit

**On every pull request to the design system file:** The CI workflow runs `figma:audit` and posts the output to the PR as a comment. Blocking errors prevent merge. Warnings are reported but do not block.

**On every merge to main:** Run the full pipeline — `figma:preflight`, then `figma:tokens`, `figma:assets`, `figma:docs`, and `figma:spec`. Each step posts its output as a CI artifact. The release engineer reviews the diffs before approving the merge to the distribution branch.

**Weekly, scheduled:** The scheduled audit runs `figma:audit` and `figma:brand` against the live file, regardless of recent changes. Designers change files without triggering CI pipelines. The weekly audit catches drift that happens between merges.

**Before any MCP session:** Run `figma:mcp-check` and commit the output. This gives the team a record of the state of the file and the MCP configuration at the time each agent session was conducted.

**Before a major release:** Run `figma:full` and treat the output as the release checklist. Every blocking error must be resolved. Every warning must be triaged — closed, deferred with a written rationale, or converted to a ticket.

### When a Warning Becomes a Blocking Error

Warnings that are not addressed become technical debt that accumulates silently until something breaks. Define escalation rules:

```
If a naming warning has existed for 3+ audit cycles → escalate to error
If a brand compliance warning appears in more than 20 objects → escalate to error
If Code Connect coverage drops below 50% for core components → escalate to error
If a token alias is unresolvable in any mode → error immediately, never warning
```

Write these rules into `figma-audit.js` or into its configuration file. Make them reviewable and adjustable by the team.

---

## CI/CD Wiring

The following GitHub Actions configuration implements the audit cadence described above. Adapt paths and trigger conditions to your repository structure.

```yaml
# .github/workflows/figma-audit.yml
name: Figma Audit

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * 1'  # Weekly Monday 9am UTC

env:
  FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
  FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}

jobs:
  preflight:
    name: Preflight Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Ping Figma
        run: npm run figma:ping
      - name: Audit file
        run: npm run figma:audit -- --output json --output-file .figma-artifacts/audit.json
      - name: Upload audit artifact
        uses: actions/upload-artifact@v4
        with:
          name: figma-audit
          path: .figma-artifacts/

  token-pipeline:
    name: Token Pipeline
    runs-on: ubuntu-latest
    needs: preflight
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Extract and validate tokens
        run: npm run figma:tokens
      - name: Open PR if tokens changed
        uses: peter-evans/create-pull-request@v6
        with:
          title: 'chore: sync design tokens from Figma'
          body: |
            Automated token sync from Figma.
            Review the diff before merging.
            See .figma-artifacts/audit.json for file state at time of extraction.
          branch: figma/token-sync
          commit-message: 'chore: sync design tokens from Figma'

  asset-pipeline:
    name: Asset Pipeline
    runs-on: ubuntu-latest
    needs: preflight
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Export assets
        run: npm run figma:assets
      - name: Open PR if assets changed
        uses: peter-evans/create-pull-request@v6
        with:
          title: 'chore: sync design assets from Figma'
          body: |
            Automated asset sync from Figma.
            Review new, changed, and removed assets before merging.
          branch: figma/asset-sync
          commit-message: 'chore: sync design assets from Figma'

  spec-build:
    name: Build Component Spec
    runs-on: ubuntu-latest
    needs: preflight
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Build machine-readable spec
        run: npm run figma:spec
      - uses: actions/upload-artifact@v4
        with:
          name: component-spec
          path: dist/spec.json

  scheduled-audit:
    name: Scheduled Audit
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Full audit
        run: npm run figma:audit
      - name: Brand compliance
        run: npm run figma:brand
```

### The Webhook-Triggered Export

For teams using Figma webhooks (Chapter 9), add a trigger that runs the asset pipeline when a library is published:

```yaml
on:
  repository_dispatch:
    types: [figma-library-publish]
```

Configure the Figma webhook to POST to your GitHub repository dispatch endpoint with event type `figma-library-publish`. This closes the loop: when a designer publishes the library, the asset pipeline runs automatically, a PR is opened, and the release engineer reviews and merges. The asset export is now fully automated from designer action to PR — the only human step is the merge decision.

---

## The Human Gate

Every automated pipeline in this book opens a pull request. The PR is not a formality. It is the human gate.

The PR diff is the design-development conversation, made concrete:

- A token PR shows every value that changed — old value, new value, which mode, which platform
- An asset PR shows every file that is new, modified, or removed — with size and format
- A spec PR shows every component property that changed — variant additions, prop renames, deprecated variants

The engineer reviewing this PR is making a real decision: "Yes, these changes are correct and safe to ship." Not "the machine said it was fine." The machine produced the information. The engineer made the call.

This is the human gate. It does not slow the process down. It makes the process auditable. It is the difference between a pipeline you can trust and a pipeline you can only hope.

---

## The Runbook

A production design system needs a runbook — a short, practical document that tells any team member how to use the extraction layer. Put this in your repository as `FIGMA-RUNBOOK.md`.

```markdown
# Figma Extraction Layer — Runbook

## Required Environment

FIGMA_TOKEN        — Personal access token with read scope
FIGMA_FILE_KEY     — Key from the Figma file URL (?file-key=...)
FIGMA_TEAM_ID      — Optional; needed for team-scoped operations

For local use: copy .env.example to .env and fill in your values.
For CI: variables are injected from GitHub Secrets (contact engineering lead).

## Before Any Work: Run the Preflight

  npm run figma:ping      — verify token, file access, rate limit
  npm run figma:audit     — verify file readiness (blocking errors = stop; warnings = review)

If preflight fails, stop. Fix the failure before proceeding.

## Token Sync

  npm run figma:tokens

Output: tokens/ directory with DTCG JSON and platform builds.
When to run: after any variable change in Figma; CI runs this on merge to main.
Human step: review the token PR diff before merging to the distribution branch.

## Asset Export

  npm run figma:assets

Output: public/assets/ directory (or as configured in export-assets.mjs).
When to run: after any icon or asset change; CI runs this on library publish.
Human step: review the asset PR before merging. Check for removed assets in use.

## Documentation Sync

  npm run figma:docs

Output: docs/ directory with component inventory and variant tables.
When to run: after any component or documentation change.
Human step: review for completeness. The sync generates structure; humans write guidance.

## Brand Compliance Report

  npm run figma:brand

Output: reports/brand-compliance.md and reports/brand-compliance.json.
When to run: before major releases; CI runs this weekly.
Human step: review errors (blocking) and warnings (tracked, scheduled for remediation).

## Component Spec

  npm run figma:spec

Output: dist/spec.json — machine-readable component specification.
When to run: on merge to main; before any MCP session; before major releases.
Human step: review breaking changes to the spec schema if downstream tools consume it.

## MCP Session Preflight

  npm run figma:mcp-check

Output: figma-mcp-check.md — session readiness report.
When to run: before every AI coding agent session using MCP.
Human step: commit the output file. Review Code Connect coverage gaps.

## Full Pipeline (Use Before Major Releases)

  npm run figma:full

Runs preflight, tokens, assets, docs, brand, and spec in sequence.
Stops on any blocking error. Review all output before proceeding to release.

## Contacts

Design system questions:  design-systems@acme.com
CI/pipeline issues:       engineering-lead@acme.com
Figma access/seats:       design-ops@acme.com
FIGMA.md governance:      design-systems@acme.com
```

---

## Adoption Path for Small Teams

The full stack described in this chapter is designed for a design system that multiple teams are building on. Not every team needs it all on day one.

**Week 1 — The minimum:**
Run `figma:ping` and `figma:audit` manually before any pipeline work. Fix blocking errors. These two commands tell you whether the file is trustworthy.

**Month 1 — Add the token pipeline:**
Set up `figma:tokens` with `validate-tokens.mjs`. Manual run on demand; commit the output. This is the highest-value automation: it eliminates the most common source of production drift.

**Month 2 — Add asset export:**
Set up `figma:assets` with the manifest and SVGO config. Manual run after library publishes. Eliminates "who forgot to re-export the icon" as a category of error.

**Month 3 — Add CI:**
Wire the audit to PRs and the token/asset pipelines to merge. Add the weekly scheduled audit. At this point the extraction layer is running without manual intervention.

**Month 4 and beyond — Add MCP and spec:**
Set up Code Connect, write `FIGMA.md`, and configure the MCP server. Build the component spec for downstream consumers. Add brand compliance monitoring.

Small teams should not feel that the absence of the full stack means their design system is broken. It means it is at an earlier stage of automation. The progression is real and achievable. The first two steps alone — audit and token pipeline — eliminate most of the silent failures that made that new engineer's three-day orientation necessary.

---

## Failure Modes of the Production System

### Silent Drift Between Scheduled Audits

The weekly audit catches drift, but drift happens in real time. A designer changes a color on a Tuesday; the next audit runs on Monday. Five days of uncaught deviation.

**Mitigation:** Figma webhooks (Chapter 9) can trigger the audit on library publish events. This does not cover all changes — only published changes — but it substantially reduces the window.

### Token Sync Breaks Without Anyone Noticing

The token sync CI step exits 0 (success) but produces output that is out of sync with the file. This happens when the variable collection name changes in Figma but the extraction script still uses the old name — the script runs without error but extracts nothing, or extracts from the wrong collection.

**Mitigation:** `validate-tokens.mjs` with fixture tests. If you have a known-good set of tokens, test that the extracted output matches it within defined tolerances. A sync that produces zero tokens when yesterday's sync produced 847 should fail.

### The Governance File Is Wrong

`FIGMA.md` says one thing; the actual design system file has evolved past it. The MCP agent operates under outdated authority.

**Mitigation:** Include a governance file check in `figma-audit.js`. Flag files older than 90 days. Tie governance review to every major design system release. The governance file should version with the design system.

### The Pipeline Becomes a Liability

A pipeline that runs unreliably, produces noisy output, or requires constant maintenance is worse than no pipeline. Teams start ignoring the audit output. CI failures become normal. The human gate stops working because PRs are approved without review.

**Mitigation:** Monitor the pipeline itself. Track: what percentage of audit runs find blocking errors? What is the average time to merge a token PR? How often does the asset export fail? If the numbers are moving in the wrong direction, address the root cause — usually a design file structural problem that the audit should catch and the plugin fix workflow should address.

### The API Changes and Breaks the Extraction

The Figma API is evolving. An endpoint is renamed. A response field disappears. The Variables API behavior changes. A script written against the current API may break in six months without warning.

**Mitigation:** Pin the API version where possible. Write fixture-based tests against saved API responses so that a change in the live API produces a test failure, not a silent wrong output. Subscribe to Figma developer changelog notifications. Build `figma-ping.js` to verify endpoint availability on every session — not just the first.

---

## Decision Rules

**Is the file ready for automated pipelines?**

Run `figma:audit`. If it exits with blocking errors, the answer is no. Fix the errors first. The pipeline built on an unaudited file inherits the file's structural problems — naming violations become token extraction failures become production bugs become "why doesn't the design system work."

**Which pipeline to build first?**

Token pipeline. Always. Tokens are the highest-value, lowest-risk automation. They are the most likely source of silent production drift. They have the clearest output format (DTCG JSON). They have the clearest validation surface (alias resolution, mode completeness). Start there.

**When to add MCP?**

When the file passes the audit cleanly, Code Connect coverage is above 50% for core components, `FIGMA.md` has been written and reviewed, and you have an engineer who will actually review MCP-generated code before it merges. Not before.

**When is the design system "done"?**

It is not done. It is in a production state — audited, governed, with working pipelines and defined ownership — or it is not. The design system is a living artifact. The extraction layer's job is to keep it honest as it evolves.

---

## What the API Cannot Replace

This book has been about making the Figma file machine-readable. Before closing, it is worth being precise about what machine-readability does not give you.

**Design judgment.** The audit can tell you that a color is not in the brand palette. It cannot tell you whether a decision to deviate from the brand palette is correct. That requires a human who understands brand strategy.

**Brand intent.** The extraction layer captures decisions that have already been made. It cannot capture why they were made. The design principles, the brand story, the reasoning behind the token structure — these belong in documentation that humans write, not in JSON that machines extract.

**Accessibility expertise.** `figma-audit.js` checks contrast ratios. It cannot check whether a complex interactive component is understandable to a screen reader user, whether the focus order makes sense, or whether the error state is clear to someone with cognitive differences. Those are human judgments.

**The decision about what ships.** Every PR opened by the extraction layer — tokens, assets, documentation — requires a human to review and approve. Not because the machine cannot merge a branch. Because the decision about what enters production belongs to the people accountable for it.

The extraction layer's job is to make those human decisions better-informed and less error-prone. It does not replace them. The goal of this entire book — the audit, the pipeline, the MCP governance, the CI wiring — is to ensure that when a human makes a decision about the design system, they are working with accurate, current, verified information rather than stale exports and manual guesswork.

That is the extraction layer. That is what this book is about.

---

## AI Wayback Machine — Figure 14.1

**Human-in-the-Loop Agentic Workflows (circa 2025–2026)**

In the period this book describes, the design industry was navigating the early phase of AI-assisted implementation workflows. The dominant pattern, crystallized in the MCP chapter and formalized in the governance file, was: agent reads and surfaces, human decides and approves.

This pattern was neither accidental nor timid. It reflected a genuine assessment of where AI agents were reliable (structured retrieval, code generation from explicit context) and where they were not (resolving ambiguous design intent, making brand decisions, catching accessibility failures invisible in visual inspection). The human gate was not a workaround for AI limitations — it was a recognition that some decisions are accountability-bearing in ways that cannot be delegated to a system that has no stake in the outcome.

Future readers may find this pattern familiar or may find it archaic. If agentic systems have become more reliable, the gate may have moved — more automation, less human review, different escalation thresholds. But the underlying structure — what can be automated, what requires judgment, who is accountable — is not a temporary constraint. It is the permanent question for any system that acts on the world on behalf of people who are responsible for what happens next.

The extraction layer described in this book is one answer to that question, for design systems, in this moment. The answer will evolve. The question does not.

---

## Try This — The Capstone Exercise

This is not a single exercise. It is a complete system-readiness evaluation you can run against any existing design system, or use as the specification for building one.

**Step 1 — Preflight.**
Run `figma:ping` and `figma:audit` against the file. How many blocking errors? How many warnings? Can you name the category of each finding? Could you fix three of them today?

**Step 2 — Governance.**
Does a `FIGMA.md` file exist? Is it current? Does it name owners, authorized scope, and agent authority? Could a new team member read it and understand what an AI coding agent is authorized to do?

**Step 3 — Token pipeline.**
Run `figma:tokens`. Does it complete without error? Does the output match what you expect to see in the Figma file? Can you trace a specific token value from the Figma variable through the DTCG JSON to the CSS custom property?

**Step 4 — Asset pipeline.**
Run `figma:assets`. Are all assets present? Are the names deterministic? Can you find the icon the designer added last week?

**Step 5 — Component spec.**
Run `figma:spec`. Open `dist/spec.json`. Find a component. Does its variant structure match what is in the Figma file? Does it have a Code Connect mapping?

**Step 6 — MCP preflight.**
Run `figma:mcp-check`. What is the Code Connect coverage percentage? What are the high-priority gaps? What would the governance file say an AI agent should do if asked to implement one of the unmapped components?

**Step 7 — The release question.**
Stand in front of the pipeline output and ask: if I had to stake the next release on the accuracy of this data, would I? What would I need to fix first?

If you can answer step 7 clearly — "yes, I would" or "no, because X" — the extraction layer is working. The point was never automation for its own sake. The point was to make the answer to that question easier to get right.

---

## Closing

The designer changed a color on a Tuesday in the Figma file.

On Thursday, the token pipeline detected the change, extracted the new value, validated it against the token schema, and opened a pull request with the diff. The engineer reviewed the PR — one token changed, `color/brand/primary`, from `#2563EB` to `#1D4ED8`, correctly captured, alias chains intact, both light and dark modes updated. She approved and merged. Style Dictionary ran. The CSS custom property in the design system package updated. The component library picked it up in the next build. The marketing site picked it up from the component library.

By Monday, the change the designer made on Tuesday was in production across every platform. No manual export. No Slack message asking "did someone update the tokens?" No three-week lag.

That is the extraction layer working. It did not make any decisions. The designer decided what color to use. The engineer decided whether the PR was correct. The pipeline just moved information from where it was created to where it needed to go, accurately and without a human carrying it by hand.

That is the goal. Build the layer. Run the audit. Govern the agents. Keep the human in the loop for the decisions that matter. Let the pipeline handle the rest.

---

*Sources: Figma REST API documentation (developers.figma.com/docs/rest-api/); Figma MCP server guide (help.figma.com/hc/en-us/articles/32132100833559); Figma Code Connect overview (help.figma.com/hc/en-us/articles/23920389749655); Design Tokens Community Group format (design-tokens.github.io); Style Dictionary documentation (styledictionary.com); WCAG 2.1 accessibility guidance (w3.org/TR/WCAG21/); GitHub Actions documentation (docs.github.com/actions); Anthropic Claude Code documentation (docs.anthropic.com/en/docs/claude-code/overview).*
