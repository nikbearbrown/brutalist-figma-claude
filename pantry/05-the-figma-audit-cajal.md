# CAJAL Figure Plans — Chapter 5: The Figma Audit

Source: `chapters/05-the-figma-audit.md` + `pantry/research-ch-05-the-figma-audit.md`
Mode: /scan silent
Domain: Figma API, design system governance, CI/CD quality gates

---

## Density Recommendation

2 figures. Mechanistic density. The audit pipeline is a multi-stage systems diagram the reader needs to see before writing any check function; the JSON/markdown report structure is an annotated example the reader needs to see before they can act on audit output in CI.

---

## Zone Map

- MC: The audit pipeline — three stages (Fetch → Check modules → Report), with six parallel check categories fanning out from the Check stage. Multi-step, interdependent, directional.
- VG: The audit report structure — both JSON and markdown shapes are asserted in prose and code blocks but never shown as a unified output artifact. The reader cannot infer the severity / category / ruleId relationship from the prose alone.
- PQ: None. No quantitative data in this chapter.

---

## Figure 5.1 — The Audit Pipeline

**Suggested filename:** `05-audit-pipeline.svg`
**Figure type:** Systems diagram
**One-sentence concept:** `figma-audit.js` runs in three stages — Fetch, Check, and Report — where the Check stage fans out across six parallel rule categories that each return typed findings to a shared collector.

**S — Specification:** Full-bleed textbook width (170mm), 300 DPI, vector SVG. viewBox 700 × 460. Canvas: white `#FFFFFF`. 32px margin all sides.

**C — Content:** Eight labeled components (at the maximum permitted count).

Stage 1 — **Fetch** (left):
- Single node: "Fetch — REST API or local fixture"
- Sub-label: `GET /v1/files/:key` + `GET /v1/files/:key/variables/local`

Stage 2 — **Check** (center, fan-out):
Six parallel check module nodes arranged vertically in a column:
1. `check-naming.js`
2. `check-token-hygiene.js`
3. `check-component-hygiene.js`
4. `check-brand-compliance.js`
5. `check-accessibility.js`
6. `check-structure.js`

Stage 3 — **Report** (right):
- Single node: "Report — markdown + JSON"
- Sub-label: `audit-report.md` / `audit-report.json`

Arrow semantics: solid `→` from Fetch to each of the six Check modules (fan-out); solid `→` from each Check module to Report (fan-in). This makes a butterfly shape: one input, six parallel processors, one output.

**O — Organization:** Three-column layout. Fetch occupies the left column (single node, vertically centered). The six Check modules occupy the center column in a vertical stack with equal spacing. Report occupies the right column (single node, vertically centered). Fan-out arrows from Fetch to each Check module diverge from a single exit point on the right edge of the Fetch node. Fan-in arrows from each Check module converge to a single entry point on the left edge of the Report node. Column separation is wide enough that arrows do not overlap check module labels.

**P — Presentation:**
- Fetch and Report nodes: `fill="#F5F5F5"` `stroke="#2a1a0e"` `stroke-width="1.5"` — primary structural anchors, slightly emphasized to indicate pipeline start and end
- Six Check module nodes: `fill="#FFFFFF"` `stroke="#D4D4D4"` `stroke-width="1"` — neutral, parallel processors
- Fan-out and fan-in arrows: `stroke="#2a1a0e"` `stroke-width="1"` with arrowhead; all six arrows are the same weight — no single check is highlighted as primary
- `check-accessibility.js` node: `stroke="#C8102E"` `stroke-width="1"` — brand-red border marks this as the check that most commonly yields blocking errors (WCAG failures), reinforcing the chapter's severity-level discussion without adding extra text
- Node labels: Inter, 11px, `#545454` for check module names (monospace file names); Inter, 12px, `#2a1a0e` for stage labels
- Stage header labels ("Fetch", "Check", "Report") above their respective columns: EB Garamond, 14px, `#2a1a0e`
- Grayscale check: brand-red accessibility node border at L* ~25, neutral borders at L* ~84 — distinguishable

**E — Exclusions:**
- The `audit-diff.js` baseline comparison script — a downstream consumer of the report, not part of the audit pipeline itself
- Severity levels (error / warning / info) — shown in Figure 5.2's annotated example
- CI YAML integration — a prose and code-block concern, not a pipeline topology
- Rate limiting and fixture caching strategy — operational context, not structural
- The `Finding` interface fields (nodeId, ruleId, etc.) — shown in Figure 5.2
- Internal logic of any individual check function — each check is a black box in this diagram

**Caption (draft):** `figma-audit.js` fans six parallel rule categories across a single data fetch and collects all findings into dual-format output — a human-readable markdown report and a machine-readable JSON file for CI consumption.

**Accuracy check (figure-checker):**
- The REST API call uses two endpoints, not one: `GET /v1/files/:key` for file/component data and `GET /v1/files/:key/variables/local` for variables; the Fetch node must reflect both, not just one
- The six check modules are parallel, not sequential — no arrows should connect check modules to each other; each receives the full data object independently and returns an array of findings
- The Report node combines both outputs (markdown and JSON) in a single write step; the figure must not split Report into two separate nodes
- `check-accessibility.js` is noted in the chapter as computationally expensive and currently returning an empty array in the illustrative code — the figure must not imply it is more complete than it is; the red border is for emphasis of blocking potential, not for indicating it is the most implemented check

---

## Figure 5.2 — Audit Report Structure (Annotated Example)

**Suggested filename:** `05-audit-report-structure.svg`
**Figure type:** Annotated example
**One-sentence concept:** A single audit finding carries six fields — category, severity, nodeId, nodeName, message, and ruleId — and the JSON report wraps an array of findings in a meta envelope that CI reads to decide whether to block the pipeline.

**S — Specification:** Single-column textbook width (170mm), 300 DPI, vector SVG. viewBox 700 × 440. Canvas: white `#FFFFFF`. 32px margin all sides.

**C — Content:** Two annotated panels side by side (or stacked).

**Panel A — Single Finding (JSON object):**
One representative finding object, fully populated:
```
{
  "category": "naming",
  "severity": "error",
  "nodeId": "4:12",
  "nodeName": "Color 3",
  "message": "Unknown category \"color 3\".",
  "suggestion": "Rename to match convention.",
  "ruleId": "NAME001"
}
```
Six annotation callouts, one per field, with a short role description beside each:
- `category` → "which check module flagged it"
- `severity` → "error / warning / info — drives exit code"
- `nodeId` → "Figma deep-link target"
- `nodeName` → "human-readable label"
- `message` → "the finding text"
- `ruleId` → "stable ID for CI baseline"

**Panel B — Report envelope (abbreviated JSON):**
```
{
  "meta": { "counts": { "error": 12, "warning": 34, "info": 8 } },
  "findings": [ … ]
}
```
Two annotation callouts:
- `meta.counts` → "CI reads this to decide exit code"
- `findings` → "full array — one object per finding"

Total labeled items: 8 (six field callouts + two envelope callouts). At maximum.

**O — Organization:** Two panels arranged left-to-right or top-to-bottom depending on text density. Panel A (single finding) is larger — left or top. Panel B (envelope) is smaller — right or bottom. Callout lines extend from field names in the JSON to annotation labels in the margin. All callout lines are thin dashed rules, not solid arrows. No overlap of callout lines.

**P — Presentation:**
- Panel backgrounds: `fill="#F5F5F5"` `stroke="#D4D4D4"` `stroke-width="1"` for both panels — code block register
- JSON text: JetBrains Mono, 11px, `#545454`
- `"severity": "error"` value string: `#C8102E` — brand-red on the value text only, not the key, to mark the one field that triggers CI failure; no red-green combination
- Callout annotation labels: Inter, 11px, `#2a1a0e`
- Callout dashed lines: `stroke-dasharray="4 3"` `stroke="#D4D4D4"` `stroke-width="0.75"`
- Panel headers ("Finding object", "Report envelope"): EB Garamond, 13px, `#2a1a0e`
- Grayscale check: red `"error"` value at L* ~25, `#545454` JSON text at L* ~36 — distinguishable without color

**E — Exclusions:**
- The full markdown report format (`audit-report.md`) — shown as a prose code block in the chapter; duplicating it here adds no visual grounding
- The `audit-diff.js` baseline comparison logic — a follow-on script, not the report structure
- The `severity-overrides` configuration — an operational extension of the severity field, not a new field in the Finding shape
- The `page` field and `suggestion` field annotation callouts — including all seven Finding fields would exceed 8 labeled items across both panels; `page` and `suggestion` are self-explanatory from their names and are omitted from annotations (they remain visible in the JSON text)
- Real-world counts or fabricated file names — keep the meta.counts example values generic (not tied to a specific fictional file name)

**Caption (draft):** Every audit finding carries the six fields CI and the fix plugin both consume: `ruleId` for stable suppression, `nodeId` for deep-linking back to Figma, and `severity` for exit-code decisions.

**Accuracy check (figure-checker):**
- The Finding shape in the figure must match the TypeScript interface defined in the chapter exactly: `category`, `severity`, `nodeId`, `nodeName`, `page`, `message`, `suggestion`, `ruleId` — no invented fields, no omitted required fields (optional fields may be omitted from the visual but must not be shown as required)
- The JSON meta envelope must include `fileKey`, `fileName`, `auditDate`, and `counts` — the figure's Panel B shows an abbreviated version; the abbreviation must not imply these are the only fields in meta
- `severity` values are exactly `"error"`, `"warning"`, `"info"` — no other values; the figure must not show `"critical"` or `"high"`
- `ruleId` format in the example must be `"NAME001"` — matching the chapter's actual rule ID table, not a fabricated value

---

## Video Candidate Pass

**Figure 5.1 — The Audit Pipeline**
Status: STATIC SUFFICIENT
Criterion not met: the fan-out/fan-in topology is a structural relationship, not a temporal process. The six checks run in a single loop in the code — the reader does not need to watch them execute in sequence to understand the architecture. Static panels with clear fan-out arrows carry the concept fully.

**Figure 5.2 — Audit Report Structure**
Status: STATIC SUFFICIENT
Criterion not met: an annotated JSON object is the canonical static form for showing data structure. Animation adds no instructional value to field-level callout inspection.

Video candidates identified: 0. Both figures are well-served by static treatment.
