# Chapter 14 — Putting It Together: The Production-Ready Design System

*The extraction layer does not make decisions. It moves information from where it was created to where it needs to go, accurately, without a human carrying it by hand.*

---

The design system had been "done" for eight months. Tokens, components, documentation — everything in Figma. A CI pipeline that synced tokens on every push. An asset export script someone had written and tested once. A Notion page describing how everything was supposed to work.

Then a new engineer joined and was asked to implement a redesigned checkout flow.

She spent three days piecing together what the design system actually contained. The token JSON in the repository did not match the values in Figma — the sync had broken silently six weeks earlier when someone changed a variable collection name. The icon she needed existed in the Figma file but not in the exported assets; the export script had been looking for nodes by a name that no longer existed. The documentation described the component API as it had existed before the Q3 refactor. The MCP session she tried to set up failed because the `FIGMA_TOKEN` in the repository secrets had expired.

Three days to answer a question that a well-governed extraction layer should have answered in fifteen minutes: what is in this design system, what state is it in, and is it safe to build on?

That is the failure this chapter addresses. Not "the design system doesn't have the right components." The failure of knowing whether what you have is actually safe to use.

---

## The Full Stack

Every chapter in this book introduced one piece of the extraction layer. Before assembling them, it is worth seeing them as a whole — what each piece does and why its position in the sequence is not arbitrary.

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
    ├── build-spec.mjs         CH 12 Machine-readable component spec for CLIs and agents
    │
    └── MCP server             CH 13 Real-time design context for AI coding agents
         + FIGMA.md                  Agent governance: read, infer, generate, refuse
         + figma-mcp-check.md        Session preflight report
```

The Figma file is the source. The audit determines whether the file is structurally sound enough to extract from. The extraction tools — tokens, assets, docs, brand, spec — convert the file's decisions into machine-readable artifacts. The MCP layer makes those artifacts available to AI coding agents operating under explicit governance rules. The CI layer runs all of this automatically and opens pull requests for human review.

The sequencing matters. A token extraction script run against an unaudited file inherits whatever structural problems the file has — naming violations become extraction failures become production bugs become "why doesn't the design system work." The audit comes first because everything downstream depends on what it finds.

<!-- → [FIGURE: Full extraction stack diagram — Figma file at top, arrows flowing through audit gate (blocking errors stop flow), then branching to tokens/assets/docs/brand/spec in parallel, converging to CI layer and PR gate, human review at bottom; annotated with chapter numbers at each node] -->

---

## The Production CLI

All of these tools are worth nothing if they are not run. The production CLI makes them runnable — locally, in CI, and by AI coding agents — with single commands that return predictable output.

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

Every command in this CLI follows the same contract introduced in Chapter 2: read from the environment, declare what is about to happen, output both human-readable markdown and machine-readable JSON, fail explicitly with a non-zero exit code on any blocking error, and state what was read, what was written, and what requires human review.

A command that silently succeeds with wrong data is more dangerous than a command that fails loudly. The system is designed for loud failure. Silent success is the failure mode that cost the new engineer three days.

Environment setup:

```bash
# .env (never commit this file)
FIGMA_TOKEN=fig_xxxxxxxxxxxxxxxx
FIGMA_FILE_KEY=your_file_key_here

# Optional — for team and project scoped operations
FIGMA_TEAM_ID=your_team_id
FIGMA_PROJECT_ID=your_project_id
FIGMA_LIBRARY_FILE_KEY=your_shared_library_key
```

The `.env` file belongs in `.gitignore`. The CI environment injects values from secrets at runtime. No hardcoded credentials, anywhere, ever.

---

## The Governance Model

The extraction layer is a system. Systems without governance drift. The six-week token sync failure that preceded the new engineer's three-day orientation was not a technology failure — it was a governance failure. Nobody was watching the output. Nobody was notified when it changed. Nobody owned the responsibility.

Governance means named owners, explicit review requirements, defined cadences, and documented decisions about what can be automated and what cannot.

### Who Owns What

```
FIGMA.md                       Design Systems team
figma-audit.js rules           Design Systems team + Engineering lead
Token pipeline output          Design Systems team (review) → release engineer (merge)
Asset pipeline output          Design Systems team (review) → release engineer (merge)
Documentation sync             Design Systems team
Brand compliance report        Brand team + Design Systems team
Component spec JSON            Engineering (consumer); Design Systems (producer)
MCP governance (FIGMA.md)      Design Systems team
CI/CD configuration            Engineering + Design Systems team
```

Write this down. Put it in `CONTRIBUTING.md` or the design system wiki. "Someone" owns these things means no one does. Name the team. Within the team, name the rotation.

### What the Human Gate Is Actually For

Every automated pipeline in this book opens a pull request. The PR is not a formality. It is the human gate — and it is worth being precise about what the gate is doing.

The token PR diff is the design-development conversation, made concrete. A token PR shows every value that changed: old value, new value, which mode, which platform. An asset PR shows every file that is new, modified, or removed. A spec PR shows every component property that changed. The engineer reviewing the PR is making a real decision: "Yes, these changes are correct and safe to ship." Not "the machine said it was fine." The machine produced the information. The engineer made the call.

This is not a limitation. It is the correct architecture for a system where the consequences of a wrong decision — shipping a token that breaks a color scheme, removing an asset that is in production, generating code with the wrong prop names — are real and sometimes difficult to reverse.

The goal is not to remove the human from the loop. The goal is to make the human's judgment more reliable by giving them better information.

<!-- → [TABLE: What requires human review vs. what can be automated — columns: operation, review requirement, why — rows for token changes, asset changes, compliance errors, compliance warnings, spec changes, MCP-generated code, scheduled audit reports] -->

---

## The CI Wiring

The following GitHub Actions configuration implements an audit cadence that catches what manual runs miss.

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
  FIGMA_TOKEN:    ${{ secrets.FIGMA_TOKEN }}
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
      - uses: actions/upload-artifact@v4
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
      - uses: peter-evans/create-pull-request@v6
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
      - uses: peter-evans/create-pull-request@v6
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
      - run: npm run figma:spec
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
      - run: npm run figma:audit
      - run: npm run figma:brand
```

The `needs: preflight` dependency on token and asset pipelines means that neither runs if the preflight fails. This enforces the audit-first principle in CI the same way the CLI does locally: a file with blocking errors does not get extracted from.

The weekly scheduled audit catches something the PR-triggered audit cannot: drift that happens between merges. Designers change files without triggering CI pipelines. A designer who edits a variable and saves without publishing, then edits it again a week later and publishes both changes at once, has produced a week of drift that the token pipeline only captures at the second publish. The weekly audit catches the structural accumulation — naming violations that appeared incrementally, accessibility problems that were introduced one component at a time.

For teams using Figma webhooks, add the repository dispatch trigger that closes the loop completely:

```yaml
on:
  repository_dispatch:
    types: [figma-library-publish]
```

When this is wired, a designer who publishes the library triggers the asset pipeline automatically. A pull request opens. The release engineer reviews and merges. The export is fully automated from designer action to PR — the only human step is the merge decision.

---

## When a Warning Becomes Blocking

Warnings that are not addressed become technical debt that accumulates silently. Define escalation rules and put them in the audit configuration:

```
Naming warning present for 3+ audit cycles → escalate to error
Brand compliance warning in more than 20 objects → escalate to error
Code Connect coverage drops below 50% for core components → escalate to error
Token alias unresolvable in any mode → error immediately, never warning
```

These rules exist so that "we'll fix it later" has a defined expiration date rather than living forever as a warning that everyone has learned to ignore.

---

## The Runbook

A production design system needs a runbook — a document that tells any team member how to use the extraction layer. Put this in the repository as `FIGMA-RUNBOOK.md`.

```markdown
# Figma Extraction Layer — Runbook

## Required Environment

FIGMA_TOKEN        — Personal access token with read scope
FIGMA_FILE_KEY     — Key from the Figma file URL

For local use: copy .env.example to .env and fill in your values.
For CI: variables are injected from GitHub Secrets.

## Before Any Work: Run the Preflight

  npm run figma:ping      — verify token, file access, rate limit
  npm run figma:audit     — verify file readiness

If preflight fails, stop. Fix the failure before proceeding.

## Token Sync

  npm run figma:tokens
Output: tokens/ directory with DTCG JSON and platform builds.
Human step: review the token PR diff before merging.

## Asset Export

  npm run figma:assets
Output: public/assets/ directory.
Human step: review the asset PR. Check for removed assets in use.

## Documentation Sync

  npm run figma:docs
Output: docs/ directory with component inventory and variant tables.
Human step: review for completeness. The sync generates structure; humans write guidance.

## Brand Compliance Report

  npm run figma:brand
Output: reports/brand-compliance.md and .json
Human step: review errors (blocking) and warnings (scheduled for remediation).

## Component Spec

  npm run figma:spec
Output: dist/spec.json
Human step: review breaking changes to the spec schema.

## MCP Session Preflight

  npm run figma:mcp-check
Output: figma-mcp-check.md — session readiness report.
Human step: commit the output file before starting any agent session.

## Full Pipeline (Before Major Releases)

  npm run figma:full
Stops on any blocking error. Review all output before proceeding.

## Contacts

Design system questions:  design-systems@acme.com
CI/pipeline issues:       engineering-lead@acme.com
Figma access/seats:       design-ops@acme.com
FIGMA.md governance:      design-systems@acme.com
```

---

## Adoption Path for Small Teams

The full stack is designed for a design system that multiple teams build on. Not every team needs it all on day one.

**Week 1:** Run `figma:ping` and `figma:audit` manually before any pipeline work. Fix blocking errors. These two commands tell you whether the file is trustworthy. This alone prevents the new engineer's three-day orientation from happening.

**Month 1:** Add the token pipeline. Set up `figma:tokens` with `validate-tokens.mjs`. Manual run on demand, commit the output. This is the highest-value automation in the stack — it eliminates the most common source of production drift.

**Month 2:** Add asset export. Set up `figma:assets` with the manifest and SVGO configuration. Manual run after library publishes. Eliminates "who forgot to re-export the icon" as a category of error.

**Month 3:** Wire CI. Audit on PRs, token and asset pipelines on merge, weekly scheduled audit. At this point the extraction layer runs without manual intervention.

**Month 4 and beyond:** Add MCP and spec. Set up Code Connect, write `FIGMA.md`, configure the MCP server. Build the component spec for downstream consumers. Add brand compliance monitoring.

The first two steps alone — audit and token pipeline — eliminate most of the silent failures that made that three-day orientation necessary. The progression is real and achievable without building everything at once.

---

## Failure Modes of the Production System

### Silent Drift Between Scheduled Audits

The weekly audit catches drift, but drift happens in real time. A designer changes a color on Tuesday; the next audit runs Monday. Five days of uncaught deviation.

**Mitigation:** Figma webhooks trigger the audit on library publish events. This does not cover all changes — only published ones — but it substantially reduces the window.

### Token Sync Breaks Without Anyone Noticing

The token sync CI step exits zero (success) but produces output that is out of sync with the file. This happens when a variable collection name changes in Figma but the extraction script still uses the old name — the script runs without error but extracts nothing, or extracts from the wrong collection.

**Mitigation:** `validate-tokens.mjs` with fixture tests. A sync that produces zero tokens when yesterday's sync produced 847 should fail. That failure should be loud.

### The Governance File Drifts From Reality

`FIGMA.md` describes a design system that no longer exists. The MCP agent operates under outdated authority — told it can use components that have been deprecated, or refused access to patterns that are now stable.

**Mitigation:** Include a governance file check in `figma-audit.js`. Flag files older than 90 days. Tie governance review to every major design system release.

### The Pipeline Becomes a Liability

A pipeline that runs unreliably, produces noisy output, or requires constant maintenance is worse than no pipeline. Teams start ignoring the audit output. CI failures become normal. The human gate stops working because PRs are approved without review.

**Mitigation:** Monitor the pipeline itself. Track what percentage of audit runs find blocking errors, average time to merge a token PR, how often the asset export fails. If the numbers move in the wrong direction, the root cause is usually a design file structural problem that the audit should catch and the plugin fix workflow should address.

### The API Changes and Breaks Extraction

The Figma API is evolving. An endpoint is renamed. A response field disappears. The Variables API behavior changes. A script written against the current API may break in six months.

**Mitigation:** Write fixture-based tests against saved API responses so that a change in the live API produces a test failure rather than silent wrong output. Subscribe to Figma developer changelog notifications. `figma-ping.js` already verifies endpoint availability on every session — that verification is also the first alarm.

<!-- → [TABLE: Failure mode reference — columns: failure, where it manifests, detection method, mitigation — rows for silent drift, broken sync, governance drift, pipeline liability, API changes] -->

---

## What the API Cannot Replace

This book has been about making the Figma file machine-readable. Before closing, it is worth being precise about what machine-readability does not give you.

**Design judgment.** The audit can tell you that a color is not in the brand palette. It cannot tell you whether the decision to deviate from the palette is correct. That requires a human who understands brand strategy.

**Brand intent.** The extraction layer captures decisions that have already been made. It cannot capture why they were made. The design principles, the brand story, the reasoning behind the token structure — these belong in documentation that humans write, not in JSON that machines extract.

**Accessibility expertise.** The audit checks contrast ratios. It cannot check whether a complex interactive component is understandable to a screen reader user, whether focus order makes sense, or whether an error state is legible to someone with cognitive differences. Those are human judgments that require testing with real users.

**The decision about what ships.** Every PR opened by the extraction layer requires a human to review and approve. Not because the machine cannot merge a branch. Because the decision about what enters production belongs to the people who are accountable for it.

The extraction layer's job is to make those human decisions better-informed and less error-prone. The goal of the audit, the pipeline, the MCP governance, the CI wiring — the entire book — is to ensure that when a human makes a decision about the design system, they are working with accurate, current, verified information rather than stale exports and manual guesswork.

---

## The Agentic Handoff

In the period this book describes, the design industry was navigating the early phase of AI-assisted implementation workflows. The dominant pattern — crystallized in the MCP chapter and formalized in the governance file — was: agent reads and surfaces, human decides and approves.

This pattern was neither accidental nor timid. It reflected a genuine assessment of where AI agents were reliable and where they were not. Agents were reliable at structured retrieval: find all components in this file, list the token values in this collection, generate code that implements this component based on these props. They were not reliable at resolving ambiguous design intent, making brand decisions, or catching accessibility failures that were invisible in visual inspection. The human gate was not a workaround for AI limitations — it was a recognition that some decisions are accountability-bearing in ways that cannot be delegated to a system that has no stake in the outcome.

Future practitioners may find this pattern familiar or archaic. If agentic systems become more reliable, the gate may move — more automation, less human review, different escalation thresholds. But the underlying structure — what can be automated, what requires judgment, who is accountable — is not a temporary constraint. It is the permanent question for any system that acts on the world on behalf of people who are responsible for what happens next.

The extraction layer described in this book is one answer to that question, for design systems, in this moment. The answer will evolve. The question does not.

---

## The Capstone

This is not a single exercise. It is a complete system-readiness evaluation you can run against any existing design system, or use as the specification for building one.

**Step 1 — Preflight.** Run `figma:ping` and `figma:audit` against the file. How many blocking errors? How many warnings? Can you name the category of each finding? Could you fix three of them today?

**Step 2 — Governance.** Does a `FIGMA.md` file exist? Is it current? Does it name owners, authorized scope, and agent authority? Could a new team member read it and understand what an AI coding agent is authorized to do?

**Step 3 — Token pipeline.** Run `figma:tokens`. Does it complete without error? Does the output match what you expect from the Figma file? Can you trace a specific token value from the Figma variable through the DTCG JSON to the CSS custom property?

**Step 4 — Asset pipeline.** Run `figma:assets`. Are all assets present? Are the names deterministic? Can you find the icon the designer added last week?

**Step 5 — Component spec.** Run `figma:spec`. Open `dist/spec.json`. Find a component. Does its variant structure match what is in the Figma file? Does it have a Code Connect mapping?

**Step 6 — MCP preflight.** Run `figma:mcp-check`. What is the Code Connect coverage percentage? What are the high-priority gaps? What does the governance file say an AI agent should do when asked to implement an unmapped component?

**Step 7 — The release question.** Stand in front of the pipeline output and ask: if I had to stake the next release on the accuracy of this data, would I? What would I need to fix first?

If you can answer step 7 clearly — "yes, I would" or "no, because X" — the extraction layer is working. The point was never automation for its own sake. The point was to make the answer to that question easier to get right.

---

## Closing

The designer changed a color on a Tuesday in the Figma file.

On Thursday, the token pipeline detected the change, extracted the new value, validated it against the token schema, and opened a pull request with the diff. The engineer reviewed the PR — one token changed, `color/brand/primary`, from `#2563EB` to `#1D4ED8`, correctly captured, alias chains intact, both light and dark modes updated. She approved and merged. Style Dictionary ran. The CSS custom property in the design system package updated. The component library picked it up in the next build. The marketing site picked it up from the component library.

By Monday, the change the designer made on Tuesday was in production across every platform. No manual export. No Slack message asking whether someone had updated the tokens. No three-week lag.

That is the extraction layer working. It did not make any decisions. The designer decided what color to use. The engineer decided whether the PR was correct. The pipeline moved information from where it was created to where it needed to go, accurately, without a human carrying it by hand.

Build the layer. Run the audit. Govern the agents. Keep the human in the loop for the decisions that matter. Let the pipeline handle the rest.

---

## LLM Exercises

**Exercise 1 — Generate and examine**

Paste the full CLI script list from `package.json` into a conversation with an LLM. Ask it to trace what happens — step by step, at the file system and API level — when `npm run figma:full` is run against a file that has one blocking naming error. At which step does the pipeline stop? What exit code does that step produce? What does the operator see in the terminal? Verify the model's answer against the actual behavior of `figma-audit.js`.

**Exercise 2 — Apply to known context**

Describe your current design system to an LLM: how mature it is, which extraction steps exist, what is manual versus automated. Ask it to identify the single highest-risk gap — the thing most likely to cause a production incident in the next six months — and to explain its reasoning. Compare the diagnosis to your own assessment. Where do they agree? Where do they diverge, and why?

**Exercise 3 — Stress-test a specific claim**

The chapter claims that the weekly scheduled audit is necessary even with PR-triggered audits because designers change files between merges. Ask an LLM to argue the opposing position: that PR-triggered audits plus webhook-triggered pipeline runs are sufficient, and the weekly scheduled audit is redundant overhead. Evaluate the argument carefully. Is there a category of change that the webhook-and-PR approach would miss that the weekly audit catches? What is it?

**Exercise 4 — Draft or audit a professional deliverable**

The new engineer's three-day orientation failure needs a post-mortem and a remediation plan. Ask an LLM to draft a two-page document covering: what the root causes were (broken sync, expired token, stale documentation, absent governance), what the extraction layer built in this book would have prevented and how, what the adoption path looks like for the team given their current state, and what the success metric is at 90 days. Then audit the draft: does it correctly identify the sync failure as a governance problem rather than a technology problem? Does the adoption path reflect the sequencing recommended in this chapter?
