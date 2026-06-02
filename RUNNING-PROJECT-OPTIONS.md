# Running Project — Chapter Map & Options
### *The Figma API: From Canvas to Production* · Irreducibly Human series

*Step 1 (Chapter Map) and Step 2 (project options) of the Running Project Exercise Generator. **Select a project before I generate the per-chapter exercise blocks.***

---

## Step 1 — Chapter Map

**Chapter 1: Why Your Figma File Is Lying to You**
Core concepts: synchronization vs. communication problem; the document graph vs. the picture; three failure modes (silent drift, version chaos, broken trust).
New capabilities: diagnose why manual handoff fails; decide when manual export is acceptable vs. when a pipeline is required.
Key vocabulary: source of truth, synchronization, drift, the pipeline.
Series tier(s): **Tier 5 (causal)** — diagnosing *why* drift happens — with **Tier 4** framing.

**Chapter 2: What the API Actually Exposes**
Core concepts: the five API surfaces (REST, Plugin, Variables, Webhooks, MCP); rate-limit architecture and plan gates; auth (PAT vs. OAuth vs. plan tokens). CLI: `figma-ping.js`.
New capabilities: run a session health check; pick the right surface + auth for a task; diagnose a failed call.
Key vocabulary: document query interface, rate-limit tier, the Enterprise gate, `.env` hygiene.
Series tier(s): **Tier 4 (metacognitive)** — knowing the tool's limits.

**Chapter 3: Reading a Figma File Programmatically**
Core concepts: traversing the document graph; local fixtures; component inventory. CLI: `figma-read.mjs`.
New capabilities: fetch and walk a file; write a stable fixture; emit an inventory JSON.
Key vocabulary: node graph, fixture, normalization, inventory.
Series tier(s): **Tier 4**.

**Chapter 4: Naming as an API Contract**
Core concepts: naming conventions *are* contracts; slash convention; the three-tier token hierarchy (primitive → semantic → component).
New capabilities: apply a naming contract; audit a scheme and classify violations.
Key vocabulary: API contract, semantic token, alias, blocking vs. warning.
Series tier(s): **Tier 4 + Tier 6 (collective)** — shared team conventions.

**Chapter 5: The Figma Audit**
Core concepts: programmatic audit with severity classes; CI exit codes + baselines; *what the audit cannot catch* (intent, semantics, complex a11y). CLI: `figma-audit.js`.
New capabilities: build and run an audit; configure it for CI; name the audit's blind spots.
Key vocabulary: severity, baseline snapshot, blocking error, false positive.
Series tier(s): **Tier 4 (metacognitive)** — knowing the audit's blind spots.

**Chapter 6: Fixing the File with the Plugin API**
Core concepts: Plugin runtime constraints (QuickJS WASM, postMessage, ES5); the staged remediation workflow; the **human approval gate**. CLI: `figma-fix-plugin/`.
New capabilities: build a staged-rename plugin with review-before-write; classify findings as safe-to-automate vs. human-judgment.
Key vocabulary: approval gate, staged write, backup pattern, reversibility.
Series tier(s): **Tier 4 + Tier 7 (wisdom)** — judgment about what to never automate.

**Chapter 7: The Machine-Ready File**
Core concepts: the machine-readiness checklist; the `FIGMA.md` governance file; publication-state requirements.
New capabilities: produce a blocking/non-blocking readiness list; author a `FIGMA.md` declaring read/write/automate authority.
Key vocabulary: machine-readiness, governance file, publication state, preflight.
Series tier(s): **Tier 4 + Tier 6** — governance.

**Chapter 8: Design Token Pipelines**
Core concepts: Variables API vs. Tokens Studio path; alias resolution; DTCG JSON; Style Dictionary; CI on merge. CLI: `extract-tokens.mjs`, `validate-tokens.mjs`.
New capabilities: extract + validate tokens; transform to CSS/Swift/Android; wire a merge-triggered PR.
Key vocabulary: DTCG, alias chain, mode, transform, distribution.
Series tier(s): **Tier 4**.

**Chapter 9: Asset Export Automation**
Core concepts: the render endpoint is not a file download; the four hazards (expiring URLs, rate limits, null renders, nondeterminism); SVGO; webhook triggers. CLI: `export-assets.mjs`.
New capabilities: batch + download expiring assets; integrity-check exports; trigger on `LIBRARY_PUBLISH`.
Key vocabulary: expiring URL, batch, deterministic manifest, integrity check.
Series tier(s): **Tier 4**.

**Chapter 10: Component Documentation Sync**
Core concepts: inventory + variant tables + missing-doc reports; Code Connect; *what the API cannot provide* (usage guidance, a11y notes, do/don'ts). CLI: `sync-docs.mjs`.
New capabilities: generate doc coverage reports; link Code Connect; distinguish automatable docs from human-authored guidance.
Key vocabulary: doc coverage, Code Connect, variant table, usage guidance.
Series tier(s): **Tier 4 + Tier 7** — the human-authored guidance the machine can't supply.

**Chapter 11: Brand Compliance Monitoring**
Core concepts: checking color/type/spacing/contrast against approved rules; WCAG thresholds (3:1 / 4.5:1 / 7:1); diffable reports; before/after remediation. CLI: `monitor-brand.mjs`.
New capabilities: build a compliance monitor; make 1000-object findings actionable; verify remediation with a diff.
Key vocabulary: compliance rule, WCAG contrast, diff, actionable finding.
Series tier(s): **Tier 4 + Tier 7** — brand and accessibility *values* judgment.

**Chapter 12: Figma as a Machine-Readable Specification**
Core concepts: human-readable vs. machine-readable from the same data; the component spec schema (alias chains, every mode, variant→prop mappings, Code Connect); contract tests. CLI: `build-spec.mjs`.
New capabilities: emit a schema-validated spec; write a contract test that fails on missing/unresolved fields.
Key vocabulary: component spec, schema, contract test, unresolved reference.
Series tier(s): **Tier 4**.

**Chapter 13: The Figma MCP Server**
Core concepts: configuring MCP; the `FIGMA.md` agent-governance file (read/infer/generate/**refuse**); verified context vs. raw canvas; deferred-action principle. CLI: `figma-mcp-check.md` / `FIGMA.md`.
New capabilities: connect a file to an AI coding agent; govern what the agent may do; pass verified context and evaluate the code-quality difference.
Key vocabulary: MCP, governance, verified context, deferred action, refusal.
Series tier(s): **Tier 4 (metacognitive supervision)** — the book's core.

**Chapter 14: Putting It Together — The Production-Ready Design System**
Core concepts: the full CLI suite as npm scripts; complete CI/CD (local → PR check → scheduled audit → publish trigger → **human approval gate**); machine-readiness assessment.
New capabilities: assemble the suite; wire the full integration; assess and remediate a real system.
Key vocabulary: pipeline orchestration, approval gate, cadence, remediation plan, accountability.
Series tier(s): **Tier 4 + Tier 6 (collective) + Tier 7 (accountability)**.

**The arc:** diagnose the problem (1) → understand the surfaces and read the file (2–3) → make the file disciplined and auditable (4–7) → build the extraction pipelines (8–12) → hand the verified result to an AI agent and assemble the whole system under a human gate (13–14). The learner ends able to take any Figma file and make it safe for a CLI or AI agent to build from — and to know exactly where a human must stay in the loop.

---

## Step 2 — Running Project Options

### Project Option 1: `figma-tools` — Your Design System Extraction Toolkit
**What it is:** A real CLI toolkit the learner builds one command per chapter against their own (or a sample) Figma file, ending as a production-ready repo.
**Final deliverable:** A `figma-tools/` npm package with `figma:ping/read/audit/tokens/assets/docs/brand/spec/mcp-check` scripts, a `FIGMA.md`, CI workflows, and an MCP-connected agent that generates component code.
**Why it fits this book:** It *is* the book's CLI operating spine — every chapter introduces exactly one artifact, so the project and the table of contents are the same shape. Chapter 14 is literally "assemble it."
**Adaptability:** A fintech design-system engineer leans on audit + brand compliance + WCAG (regulated, strict brand); a consumer-brand engineer leans on asset export + docs; an OSS-library maintainer leans on tokens + spec + DTCG interchange.
**Tool path:** Claude Code primary (it's code-and-file heavy), with Claude chat for design/spec decisions and Cowork for assembling the final report/README.
**Validation opportunities:** Audit false positives vs. real violations (Ch 5); whether the plugin's proposed renames are safe (Ch 6); broken alias chains in token output (Ch 8); whether MCP-generated code actually matches the design system or hallucinates tokens/variants (Ch 13). Catching these requires reading the design file as a human, not trusting the tool's exit code.

### Project Option 2: The Design System Health Report (read-only, audit-first)
**What it is:** An automated, diffable "health report" for any Figma file — naming, audit, brand/WCAG compliance, doc coverage, and machine-readiness score — built up section by section.
**Final deliverable:** A single `figma-health` command + a generated multi-section report (markdown + JSON) you can run on any file and re-run to show drift over time.
**Why it fits this book:** Uses the read/audit/compliance/spec half of the toolchain without requiring write access to the file — ideal for learners auditing a system they don't own.
**Adaptability:** Finance → accessibility + regulated-brand scoring weighted heaviest; Branding → brand-consistency scoring; Engineering → machine-readiness-for-codegen scoring. Same report, different weights.
**Tool path:** Claude Code to build the checks; Cowork to assemble the cross-section report across files.
**Validation opportunities:** The central one — *is a flagged "violation" actually a violation, or intentional designer judgment?* The whole project trains the learner to separate machine-detectable rule-breaks from human-meaningful exceptions (Ch 5, 10, 11).

### Project Option 3: The Canvas-to-Code Agent Harness
**What it is:** A project focused on making one Figma file *safe for an AI coding agent to build from* — each chapter adds the piece (clean naming, audit, spec, governance) that makes agent output more trustworthy.
**Final deliverable:** A Figma file + `build-spec.mjs` output + `FIGMA.md` governance + a configured MCP connection where Claude Code reliably generates component code that matches the design system.
**Why it fits this book:** It treats the whole book as a build-up to Chapter 13 — every earlier artifact exists to make the agent's generated code trustworthy. Strong "human gate" thread throughout.
**Adaptability:** Choose the target framework/library — React fintech components, a Vue brand site, or an OSS component library — and the spec/governance adapt.
**Tool path:** Claude Code + the Figma MCP server, heavily.
**Validation opportunities:** The richest validation surface in the book — does the agent's generated code use the right tokens, the right variant props, the right disabled states, or does it confidently invent them? (Ch 12–13). Catching it requires knowing the design system independently of the agent.

### Project Option 4: Adopt-a-System — Machine-Readiness Assessment of a Real File
**What it is:** Pick a real public Figma Community file (or your team's), run the entire toolchain against it, and produce a chapter-by-chapter assessment ending in a written machine-readiness report + a forkable remediation repo.
**Final deliverable:** A `machine-readiness-assessment.md` (graded against the book's standard) plus the toolkit configured for that specific file.
**Why it fits this book:** Gives learners without their own design system a real artifact to work on, and turns Chapter 14's "evaluate an existing system" into the spine of the whole course.
**Adaptability:** Choose a fintech, consumer-brand, or open-source community file to match your field.
**Tool path:** Claude Code for the tools; Cowork to compile the assessment narrative across chapters.
**Validation opportunities:** Every audit/compliance finding must be triaged against *this real file's* intent — high rate of "the tool says violation, but is it?" moments, plus verifying that MCP-generated code against a file you didn't design actually holds up.

---

## Recommendation

**Option 1 (`figma-tools`)** is the tightest fit — the project and the book's CLI spine are the same object, so every chapter has a guaranteed concrete deliverable and Chapter 14 is the natural capstone. **Option 3** is the best choice if you want the human-gate / AI-supervision thesis to be the dramatic spine. **Option 2/4** are best when the learner is auditing a system they don't own.

*Pick one (or tell me to combine, e.g., Option 1 with Option 4's "use a real community file" framing) and I'll generate the full five-part exercise block at the bottom of all 14 chapter files.*
