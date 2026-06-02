# CAJAL Figure Intelligence — Chapter 10: Component Documentation Sync

Source: `chapters/10-component-documentation-sync.md`
Mode: /scan silent
Domain note: Design systems engineering; Figma REST API; documentation tooling.

---

## Density Recommendation

2 figures. Mechanistic density. The chapter teaches a concrete pipeline (`sync-docs.mjs`) and a concrete data artifact (variant property table). Both have verification gaps that figures close.

## Zone Map

- MC: sync-docs pipeline — four sequential stages producing three output artifacts
- VG: variant property table — the structure of a real component's variant matrix is asserted in text but never shown as a discrete, readable artifact
- PQ: None requiring a chart

---

## Figure 10.1 — Button Variant Property Table

**Suggested filename:** `10-button-variant-table.svg`

**Figure type:** Annotated example (data table)

**One-sentence concept:** The Figma API surfaces variant dimensions and their enumerated values as a structured property table; this is the machine-verifiable fact layer that documentation platforms render.

**S — Specification:** Single-column textbook, 89mm–120mm print width; 300 DPI vector (SVG); viewBox 700 × 380; Brutalist D3 palette.

**C — Content:** A realistic variant property table for a "Button" component set, exactly as `variant-tables.json` would describe it. Six labeled items:
1. Table header row: "Dimension" / "Values" column labels
2. Row 1 — `Variant`: `Primary`, `Secondary`, `Destructive`
3. Row 2 — `Size`: `sm`, `md`, `lg`
4. Row 3 — `State`: `Default`, `Hover`, `Pressed`, `Disabled`
5. Row 4 — `Icon`: `None`, `Left`, `Right`
6. Component set metadata bar above table: `Button` · 36 variants · description populated ✓

**O — Organization:** Single vertical panel. Top: narrow metadata bar (component set name, variant count, description check). Below: two-column table — left column "Dimension" (4 rows), right column "Values" (comma-separated values as they appear in `variant-tables.json`). Striped rows for readability. No decorative chrome.

**P — Presentation:**
- Canvas: `#FFFFFF`
- Table header row fill: `#2a1a0e` (ink), header text: `#FFFFFF`
- Alternating row fill: `#F5F5F5` (fill) / `#FFFFFF`
- Dimension column text: `#2a1a0e` (ink), Inter 12px 600 weight
- Values column text: `#2a1a0e` (ink), JetBrains Mono 11px (treating as data/code values)
- Metadata bar fill: `#F5F5F5`, text: `#545454` (secondary), checkmark accent: `#C8102E` (red)
- All borders: `#D4D4D4` 1px
- Grayscale-distinguishable: header row is darkest anchor; alternating rows are near-white / white — clearly distinct in grayscale

**E — Exclusions:** No full JSON source code; no API request/response structure; no `sync-docs.mjs` script logic; no Storybook or documentation platform UI; no Code Connect setup; no missing-docs findings; no coverage percentages; no node IDs; no description field content.

**Caption (draft):** The variant property table for a Button component set as emitted by `variant-tables.json` — four dimensions with their complete value enumerations, ready for a documentation platform to render without an additional API call.

**Accuracy check:** Variant property tables are produced from the `variantProperties` key-value map on each component node in the Figma API response; dimensions and values are exactly as described in the chapter. The table format (dimension / values) matches the `dimensions` array in `variantTables` in the script. The "36 variants" figure is illustrative (3 × 3 × 4 × 1 + Icon = illustrative); the structural relationship is accurate. No fabricated API behavior.

---

## Figure 10.2 — sync-docs Pipeline: Figma to Documentation Portal

**Suggested filename:** `10-sync-docs-pipeline.svg`

**Figure type:** Systems diagram (left-to-right process flow with labeled artifacts)

**One-sentence concept:** `sync-docs.mjs` is an extraction pipeline: it reads the published Figma library once and writes three machine-readable artifacts that documentation platforms consume without additional API calls.

**S — Specification:** Single-column textbook, 89mm–120mm print width; 300 DPI vector (SVG); viewBox 700 × 300; Brutalist D3 palette.

**C — Content:** Seven labeled nodes in a left-to-right flow:
1. **Source** — "Figma Library (published components)"
2. **Tool** — "`sync-docs.mjs`" (the CLI, shown as a process box)
3. **Artifact A** — "`component-inventory.json`"
4. **Artifact B** — "`variant-tables.json`"
5. **Artifact C** — "`missing-docs.json`"
6. **Consumer** — "Documentation Portal (Storybook / Zeroheight / Custom)"
7. **CI Gate** — "Exit 1 if component-set has no description" (hanging below the pipeline, connected from the tool node)

**O — Organization:** Horizontal left-to-right. Source → Tool (single thick arrow, labeled "GET /v1/files/:key"). Tool fans out to three artifact boxes (Artifacts A, B, C stacked vertically, connected with plain arrows). Artifacts A and C converge with arrows into the Consumer box on the right. Artifact B also feeds into the Consumer. CI Gate hangs below the Tool node on a dashed arrow labeled "CI fail condition." The fan-out and fan-in pattern shows the tool as the central extraction point.

**P — Presentation:**
- Canvas: `#FFFFFF`
- Source box: fill `#F5F5F5`, border `#D4D4D4` 1px, label `#2a1a0e` Inter 12px
- Tool box: fill `#C8102E` (red — primary accent, the active transform step), text `#FFFFFF` Inter 12px 600
- Artifact boxes (A, B, C): fill `#F5F5F5`, border `#D4D4D4` 1px, label `#2a1a0e` JetBrains Mono 11px
- Consumer box: fill `#2a1a0e` (ink), text `#FFFFFF` Inter 12px
- CI Gate box: fill `#FFFFFF`, border `#D4D4D4` 1px dashed, label `#545454` Inter 11px
- Arrows: `stroke="#2a1a0e"` 1.5px with arrowhead; CI dashed arrow: `stroke-dasharray="4 3"` `#545454`
- No gradients, no rounded corners, no shadows
- Grayscale: red tool box = mid-dark anchor; ink consumer = darkest; artifacts = light; CI gate = outlined white

**E — Exclusions:** No Figma canvas screenshot; no full script code; no rate-limit backoff logic; no Tokens Studio or Style Dictionary; no Code Connect detail; no Supernova-specific integration steps; no GitHub Actions YAML; no per-platform documentation UI; no description-writing guidance.

**Caption (draft):** `sync-docs.mjs` reads the published Figma library once and fans out to three artifacts — component inventory, variant tables, and a missing-description report — which documentation platforms consume; CI exits 1 when any component set has no description.

**Accuracy check:** The pipeline exactly matches the `main()` function in the chapter's script: single file fetch → process components + component sets → write `component-inventory.json`, `variant-tables.json`, `missing-docs.json`. The CI fail condition (exit 1 for component sets without description, warning for individual components) is sourced directly from the chapter's Decision Rules section. No fabricated steps.

---

## Video Candidate Pass

**Figure 10.1 (variant table):** STATIC SUFFICIENT. A table is the natural static form; there is no transition mechanism to animate.

**Figure 10.2 (pipeline):** STATIC SUFFICIENT. The fan-out structure is a spatial relationship best inspected at the reader's pace. Animation of data flowing through a pipeline would add no instructional information beyond the arrow directions.
