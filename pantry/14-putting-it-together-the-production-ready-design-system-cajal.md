# CAJAL Figure Plans — Chapter 14: Putting It Together: The Production-Ready Design System

Source: `chapters/14-putting-it-together-the-production-ready-design-system.md`
Mode: /scan silent
Domain: Design systems engineering, CI/CD governance, extraction layer architecture

---

## Density Recommendation

3 figures. Mixed density (mechanistic + annotated structure). This is the capstone chapter; it assembles all prior concepts into a governed production system. Three distinct figure concepts are warranted:

1. The full extraction-stack architecture as a high-level systems diagram (≤8 top-level nodes — see split note below)
2. The CLI command / audit cadence table as a structured annotated figure (the command-to-trigger mapping that the architecture diagram cannot contain without overloading)
3. The runbook cadence as a timeline showing the five recurring checkpoints: PR / merge / weekly / pre-release / MCP-session

**SPLIT NOTE — Figure 14.1:** The full extraction stack lists Figma File + 8 named scripts + MCP server + CI/CD + Production as top-level items — 12+ if laid out individually. This exceeds the 8-component threshold. The split follows the chapter's own two-level structure: the high-level architecture collapses the 8 CLI scripts into three functional layers (Audit/Remediation, Extraction, Governance/Delivery) while preserving the Figma File source, CI/CD, Human Gate, and Production as distinct nodes. The CLI command details move to Figure 14.2, which is an annotated table figure rather than a process diagram. This is the correct split point; the chapter itself uses exactly this two-level presentation (the ASCII stack diagram followed by the `package.json` CLI listing).

---

## Zone Map

- MC: Full extraction stack — source, pipeline, CI/CD, human gate, production — 5+ interdependent layers with explicit sequencing rules.
- MC: Audit cadence — five distinct trigger conditions (PR, merge, weekly, pre-release, MCP session) each with specific command sequences and human review requirements.
- VG: The human gate as a structural node — the chapter explicitly states the PR is the human gate, but its position in the flow (between automated pipeline and production merge) cannot be verified from prose alone without a diagram.
- VG: The three-layer CLI grouping — the chapter groups scripts into functional categories implicitly; the figure makes that grouping explicit and verifiable.

---

## Figure 14.1 — Extraction Stack: High-Level System Architecture

**Suggested filename:** `14-extraction-stack-architecture.svg`

**Figure type:** Systems diagram

**One-sentence concept:** The production design system is a five-layer governed stack: a Figma file source feeds three pipeline layers (audit/remediation, extraction, governance/delivery) that run through CI/CD and terminate at a human-review gate before any artifact reaches production.

**S — Specification:** Full-column textbook figure; canvas 700 × 480px; 300 DPI equivalent; vector SVG. Brutalist D3 palette. Flat, no gradients, no rounded corners (rx="0").

**C — Content:** Eight labeled top-level nodes, drawn from the chapter's extraction stack and governance model:

1. **Figma File** — source node at top; labeled as "source of truth"; sub-label: "audited, versioned, governed"
2. **Audit + Remediation** — pipeline layer 1; collapses `figma-ping.js`, `figma-read.mjs`, `figma-audit.js`, `figma-fix-plugin/` — labeled with chapter reference "Ch 2–6"
3. **Extraction** — pipeline layer 2; collapses `extract-tokens.mjs`, `validate-tokens.mjs`, `export-assets.mjs`, `sync-docs.mjs`, `monitor-brand.mjs`, `build-spec.mjs` — labeled "Ch 8–12"; sub-label: "tokens / assets / docs / brand / spec"
4. **MCP + Governance** — pipeline layer 3; collapses MCP server, FIGMA.md, figma-mcp-check.md — labeled "Ch 13"; sub-label: "agent context + permission matrix"
5. **CI/CD** — automation node; GitHub Actions triggers labeled by cadence: "PR / merge / weekly / pre-release"; not a pipeline layer but a horizontal runner across layers 1–3
6. **Human Gate** — mandatory review node; labeled with the chapter's explicit rule: "agent surfaces; engineer decides; pipeline proposes; engineer merges"
7. **Production** — terminal node; artifacts delivered: CSS custom properties, exported assets, component spec, documentation
8. **FIGMA.md** — shown as a governance label spanning layers 2–3 and the Human Gate, emphasizing it bounds all pipeline activity (not a separate box — a spanning annotation band)

Note: FIGMA.md is rendered as a spanning governance band rather than a standalone box, keeping the node count at 7 standalone nodes + 1 spanning annotation = 8 labeled items total, within the CAJAL limit.

Arrow semantics: solid → for data flow (Figma File → pipeline layers → CI/CD → Human Gate → Production); dashed → for governance constraint (FIGMA.md spanning band); ⊣ blocker on the Human Gate → Production path if review is not approved (shown as a conditional fork: "approved → Production / rejected → pipeline re-run").

**O — Organization:** Vertical top-to-bottom flow. Figma File at top. Three pipeline layers stacked vertically beneath (Audit/Remediation → Extraction → MCP/Governance). CI/CD shown as a horizontal bar on the right side spanning all three pipeline layers, with trigger labels at each layer's level. Human Gate sits between the bottom of the pipeline stack and Production. Production at the bottom. FIGMA.md governance band spans from Extraction layer through Human Gate as a vertical left-border accent, labeled "governance scope." The overall visual grammar is: source at top → governed pipeline flowing down → human decision point → production at bottom.

**P — Presentation:** Per Brutalist D3 / DESIGN.md palette:
- Canvas: `#FFFFFF`
- Figma File node: fill `#F5F5F5`, border `#2a1a0e` (ink, heaviest border — source authority), label in `#2a1a0e`
- Pipeline layer nodes (Audit/Remediation, Extraction, MCP/Governance): fill `#F5F5F5`, border `#D4D4D4`, labels in `#2a1a0e`; chapter reference sub-labels in `#545454` (secondary)
- CI/CD bar: fill `#FFFFFF`, left-border `#D4D4D4` 1px, trigger labels in `#545454` (secondary); rendered as a slim sidebar, not a full block
- Human Gate node: fill `#FFFFFF`, border `#C8102E` (red — the one node that must not be missed), label in `#2a1a0e`; the red border signals the mandatory human decision
- Production node: fill `#F5F5F5`, border `#D4D4D4`, label in `#2a1a0e`
- FIGMA.md governance band: left-border `#C8860E` (ochre, decorative), dashed, spanning Extraction through Human Gate; label in `#545454`
- Approved flow arrows: `#2a1a0e`, 1.5pt solid; Rejection branch: `#545454`, 1pt dashed with ⊣
- Grayscale check: Human Gate (red border, L*~25) is the darkest accent; Figma File (ink border, L*~10) is the structural anchor; all layers read as mid-gray (#F5F5F5, L*~96) distinguishable from the white canvas

**E — Exclusions:**
- Do not show individual script names (figma-ping.js, extract-tokens.mjs, etc.) — those belong in Figure 14.2's command table
- Do not show the package.json CLI command syntax
- Do not show the GitHub Actions YAML structure — the figure shows the CI/CD trigger relationship, not the workflow file
- Do not show the Webhook-triggered export path — out of scope for the architecture overview; covered in chapter prose
- Do not show the adoption path timeline (Week 1 / Month 1 / Month 2) — that is a progression sequence, not part of the steady-state architecture
- Do not show environment variables or secret injection — implementation detail below the figure's scope
- Do not show specific token formats (DTCG JSON, CSS custom properties) — level of detail belongs in chapter prose and earlier chapters

**Caption (draft):** The production-ready design system is a five-layer governed stack: the Figma file feeds audit, extraction, and MCP/governance pipelines running through CI/CD, with a mandatory human review gate before any artifact reaches production.

**Accuracy check (figure-checker):** The three-layer pipeline grouping (Audit/Remediation Ch 2–6, Extraction Ch 8–12, MCP/Governance Ch 13) maps directly to the chapter's ASCII extraction stack diagram and its chapter-reference annotations. The Human Gate is confirmed as a structural requirement throughout Chapter 14: "Every automated pipeline in this book opens a pull request. The PR is not a formality. It is the human gate." The five CI/CD triggers (PR, merge, weekly, pre-release, MCP session) are stated explicitly in the "When to Run the Audit" section. FIGMA.md as a spanning governance constraint is confirmed: "FIGMA.md — AI Agent Governance for Figma MCP Sessions" bounds all agent activity across layers. The rejection branch at the Human Gate is confirmed: "Blocking errors prevent merge." The Production terminal reflects the chapter's closing example (color change flows from Figma through pipeline to production). No fabricated relationships; the split from Figure 14.2 is explicitly named.

---

## Figure 14.2 — CLI Commands and Audit Cadence Table

**Suggested filename:** `14-cli-command-cadence-table.svg`

**Figure type:** Annotated example (structured table rendered as a figure)

**One-sentence concept:** The eight production CLI commands map to five recurring trigger events — pull request, merge to main, weekly schedule, pre-release, and MCP session — with each trigger indicating which commands run, whether human review is required, and what output is produced.

**S — Specification:** Full-column textbook figure; canvas 700 × 420px; 300 DPI equivalent; vector SVG table. Brutalist D3 palette. Flat, no gradients. Table structure with column headers and row-level semantic coloring limited to the Human Review column.

**C — Content:** Table with rows for each of the five trigger events from the chapter's "When to Run the Audit" section, and columns for: Trigger / Commands Run / Output Artifact / Human Review Required. Eight CLI commands assigned across the five triggers:

- PR: `figma:preflight` (ping + audit) → audit.json; Human review: blocking errors only
- Merge to main: `figma:preflight` + `figma:tokens` + `figma:assets` + `figma:spec` + `figma:docs` → token PR, asset PR, spec artifact; Human review: always (PR diff)
- Weekly scheduled: `figma:audit` + `figma:brand` → audit report, brand-compliance report; Human review: errors only
- Pre-release: `figma:full` (all commands) → full pipeline output; Human review: every blocking error + every warning triaged
- MCP session: `figma:mcp-check` → figma-mcp-check.md; Human review: Code Connect coverage gaps reviewed, output committed

The "Human Review Required" column is the semantic anchor of the table: three levels — Always / Blocking errors only / Coverage review — differentiated by the fill of that cell.

**O — Organization:** Five-row table (one row per trigger event), four columns. Column headers in EB Garamond (display face per DESIGN.md). Trigger column left-aligned. Commands Run column uses JetBrains Mono for command names. Human Review Required column uses fill to encode the three review levels. Table sits inside a `#F5F5F5` chart-area background with `#D4D4D4` 1px border. Row dividers at `#D4D4D4` 0.75pt dashed.

**P — Presentation:** Per Brutalist D3 / DESIGN.md palette:
- Table background: `#F5F5F5` (fill)
- Table border: `#D4D4D4` 1px
- Header row: fill `#2a1a0e` (ink), header text `#FFFFFF`, EB Garamond 13px
- Body rows: fill `#FFFFFF`, alternating with `#F5F5F5` for every other row
- Trigger column: `#2a1a0e` (ink), Inter 12px, font-weight 600
- Commands Run column: `#545454` (secondary), JetBrains Mono 11px
- Output Artifact column: `#545454`, Inter 11px
- Human Review Required — "Always": cell fill `#C8102E` (red), text `#FFFFFF`, Inter 11px font-weight 600 — signals the mandatory human step
- Human Review Required — "Blocking errors only": cell fill `#F5F5F5`, text `#2a1a0e`, Inter 11px
- Human Review Required — "Coverage review": cell fill `#F5F5F5`, text `#545454`, Inter 11px
- Grayscale check: "Always" red cell (L*~25) clearly distinguished from blocking-errors (#F5F5F5, L*~96) without color; the luminance contrast is sufficient

**E — Exclusions:**
- Do not show the GitHub Actions YAML syntax — the table captures the trigger-to-command mapping, not the workflow file structure
- Do not show environment variables, secrets injection, or authentication steps
- Do not show the adoption path / progressive rollout (Week 1 / Month 1 / Month 2 / Month 3) — that is a separate pedagogy frame, not the steady-state cadence
- Do not show warning escalation rules (the 3-audit-cycle / 20-object thresholds) — too granular for a figure; belongs in chapter prose
- Do not show the specific content of output artifacts (token JSON keys, spec schema) — covered in prior chapters
- Do not show the Webhook-triggered path — edge case, not part of the five canonical trigger events

**Caption (draft):** The five audit trigger events — pull request, merge, weekly schedule, pre-release, and MCP session — each map to a defined set of CLI commands, output artifacts, and human-review requirements; "Always" cells mark decisions that cannot be automated.

**Accuracy check (figure-checker):** All five trigger events are confirmed in the chapter's "When to Run the Audit" section, with explicit command assignments. The `figma:full` pre-release command is defined in the `package.json` scripts block. The three Human Review levels ("always requires human review before merge," "requires human review when findings are blocking," "can be automated without review") are drawn directly from the chapter's "What Requires Human Review" section. The red fill on "Always" cells uses red as brand accent per DESIGN.md rules, not as a danger/alert encoding — consistent with palette governance. No fabricated trigger events or command assignments.

---

## Figure 14.3 — Runbook Cadence: Five Recurring Checkpoints

**Suggested filename:** `14-runbook-cadence-timeline.svg`

**Figure type:** Timeline / progression

**One-sentence concept:** The extraction layer's five recurring checkpoints — PR review, merge pipeline, weekly audit, pre-release gate, and MCP session preflight — form a repeating governance rhythm that keeps the design system honest between releases.

**S — Specification:** Full-column textbook figure; canvas 700 × 340px; 300 DPI equivalent; vector SVG. Brutalist D3 palette. Horizontal timeline. Flat, no gradients, no rounded corners (rx="0").

**C — Content:** Five checkpoint nodes on a horizontal time axis, drawn from the chapter's runbook and cadence sections:

1. **PR review** — event-triggered; runs `figma:preflight`; human reviews audit output before approving PR
2. **Merge pipeline** — event-triggered on merge to main; runs `figma:tokens`, `figma:assets`, `figma:spec`; opens token PR + asset PR; human reviews and merges diffs
3. **Weekly scheduled audit** — time-triggered (Monday 9am UTC per chapter's cron example); runs `figma:audit` + `figma:brand`; output is informational; human reviews errors
4. **Pre-release gate** — event-triggered before major release; runs `figma:full`; every blocking error must be resolved; every warning triaged
5. **MCP session preflight** — event-triggered before each agent session; runs `figma:mcp-check`; output committed to repo; human reviews Code Connect coverage gaps

Each checkpoint node shows: trigger type (event vs. scheduled), commands, and review level (indicated by node border weight or a small annotation).

**O — Organization:** Single horizontal left-to-right timeline axis representing recurring time (not a one-time sequence — it loops). The five checkpoints are positioned as nodes above or below the axis, with vertical drop lines to the axis. Event-triggered checkpoints (PR, merge, pre-release, MCP session) cluster toward the left; weekly scheduled sits in the middle to signal its time-based cadence. The timeline loops back (a right-to-left return arrow beneath the axis) to signal this is a recurring rhythm, not a one-time pipeline. Each node has a two-line label: checkpoint name (Inter, 12px, ink) and trigger type (Inter, 11px, secondary gray). The Human Gate annotation appears as a small red indicator on the PR review, merge pipeline, and pre-release nodes — the three checkpoints where human review is always required.

**P — Presentation:** Per Brutalist D3 / DESIGN.md palette:
- Canvas: `#FFFFFF`
- Timeline axis: `#2a1a0e` (ink), 1.5pt stroke, horizontal
- Return loop arrow beneath: `#D4D4D4` (border), dashed, with arrowhead — signals recurring cadence
- Event-triggered checkpoint nodes: fill `#FFFFFF`, border `#D4D4D4` 1px; drop line `#D4D4D4` 0.75pt
- Weekly scheduled checkpoint: fill `#F5F5F5`, border `#D4D4D4` — fill differentiates time-triggered from event-triggered
- Human Gate indicator (on PR review, merge, pre-release nodes): small square or left-border accent in `#C8102E` (red), labeled "human review" in Inter 10px
- MCP session preflight: fill `#FFFFFF`, border `#D4D4D4`; ochre `#C8860E` left-border accent to connect visually to the MCP/Governance layer from Figure 14.1
- Checkpoint name labels: `#2a1a0e`, Inter 12px, font-weight 600
- Trigger type sub-labels: `#545454`, Inter 10px
- Grayscale check: Human Gate red accent (L*~25) distinguishable from all other node fills; weekly fill (#F5F5F5, L*~96) distinguishable from event-triggered white (#FFFFFF, L*~100) — marginal but sufficient given the trigger-type text label

**E — Exclusions:**
- Do not show specific command syntax on the timeline — the figure shows checkpoints and review levels, not commands (those are in Figure 14.2)
- Do not show the GitHub Actions workflow file structure or cron syntax
- Do not show the adoption path (Week 1 / Month 1 progression) — the figure shows steady-state cadence, not onboarding sequence
- Do not show warning escalation thresholds (the 3-cycle / 20-object rules) — too granular for the cadence overview
- Do not show individual script outputs (audit.json, spec.json) — artifact details belong in Figure 14.2
- Do not show a clock, calendar, or calendar-grid visual — a timeline axis with loop arrow is sufficient and cleaner
- Do not show the Webhook-triggered export as a sixth checkpoint — it is an optional extension, not a canonical cadence event

**Caption (draft):** The five recurring governance checkpoints — PR review, merge pipeline, weekly audit, pre-release gate, and MCP session preflight — form a repeating rhythm; red markers indicate checkpoints where human review is always required before any artifact advances.

**Accuracy check (figure-checker):** The five checkpoints correspond exactly to the chapter's "When to Run the Audit" section headings: "On every pull request," "On every merge to main," "Weekly, scheduled," "Before any MCP session," "Before a major release." The trigger types (event vs. scheduled) are confirmed by the GitHub Actions configuration in the chapter (push/pull_request triggers vs. cron schedule). The three "always requires human review" checkpoints (PR, merge, pre-release) are confirmed in the chapter's "What Requires Human Review" section. The recurring loop is confirmed by the chapter's framing: "The audit is not a one-time event. It is a recurring check that keeps the file honest." No fabricated checkpoints or trigger conditions. The MCP session preflight is correctly shown as event-triggered (not recurring on a schedule) per chapter: "Before any MCP session."

---

## Video Candidate Pass

**Figure 14.1 (Extraction Stack Architecture):** STATIC SUFFICIENT. The five-layer stack is a structural hierarchy, not a dynamically unfolding process. The learning target is recognizing the layer relationships and the position of the human gate — both are well-served by a static systems diagram. No video candidate.

**Figure 14.2 (CLI Command Cadence Table):** STATIC SUFFICIENT. A structured table. No motion adds instructional value. No video candidate.

**Figure 14.3 (Runbook Cadence Timeline):** STATIC SUFFICIENT. The cadence's learning target is recognizing which checkpoints require human review and which are automated — a structural distinction that a static timeline with Human Gate annotations communicates clearly. The recurring loop is indicated by the return arrow; animation would add no instructional meaning beyond what the arrow conveys. No video candidate.
