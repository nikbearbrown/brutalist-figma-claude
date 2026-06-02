# CAJAL Figure Intelligence — Chapter 12: Figma as a Machine-Readable Specification

Source: `chapters/12-figma-as-a-machine-readable-specification.md`
Mode: /scan silent
Domain note: Design systems engineering; JSON Schema; code generation; AI agent tooling.

---

## Density Recommendation

2 figures. Mechanistic + annotated-example density. The chapter's keystone artifact is the `components.json` schema — a machine-readable structure that a code generator or AI agent consumes. This schema is complex enough to have a verification gap (readers cannot verify it from text alone) and is the thesis of Part Three made explicit. A second figure showing what the machine spec contains that human documentation omits grounds the human/machine consumer distinction.

## Zone Map

- VG: the component spec schema (`component-spec-schema.json`) is described in detail but its field relationships — required vs. optional, nested structure, alias chain linkage — cannot be verified from prose
- VG: the human-doc vs. machine-spec comparison table exists in the chapter as a markdown table; a figure version reveals the structural contrast more clearly and is more memorable
- MC: None requiring a standalone pipeline figure (the pipeline for Ch 12 is `build-spec.mjs`, which feeds Ch 13; that pipeline is better placed in Ch 13's figures)

Note on scope: the chapter's build-spec pipeline was considered for a third figure but declined — the pipeline is a forward-reference to Ch 13 (MCP integration) and would either duplicate that chapter's figure or front-load a concept not yet established. Two figures is the correct density; splitting would produce a third figure with only ~5 components and insufficient conceptual weight.

---

## Figure 12.1 — Component Spec Schema: Annotated Field Map

**Suggested filename:** `12-component-spec-schema.svg`

**Figure type:** Annotated example (structured schematic of a JSON object's top-level fields with nested callouts)

**One-sentence concept:** The machine-readable component spec is a complete, uncompressed JSON object whose fields divide into four groups — identity, geometry, style references, and code linkage — each required by a code generator or AI agent for a different reason.

**S — Specification:** Single-column textbook, 89mm–120mm print width; 300 DPI vector (SVG); viewBox 700 × 480; Brutalist D3 palette. Structured schematic layout: one central object box with four labeled field-group callout zones radiating from it.

**C — Content:** Eight labeled items (at the field-group level, not individual field level):

1. **Central object box** — labeled "`ComponentSpec`" (the top-level JSON object from `component-spec-schema.json`)
2. **Group A — Identity** (upper left callout) — fields: `nodeId`, `key`, `name`, `specVersion`; annotation: "stable across file versions — key is preferred over nodeId for downstream identity"
3. **Group B — Geometry** (lower left callout) — fields: `dimensions` (width, height, widthSizing, heightSizing), `layout` (mode, padding, itemSpacing), `constraints`; annotation: "layout constraints a code generator cannot infer from the canvas"
4. **Group C — Style + Token Chain** (upper right callout) — fields: `fills` → `styleId` → `styleName` → `tokenAlias`; annotation: "alias chain from raw color to CSS custom property — absent without Enterprise plan"
5. **Group D — Code Linkage** (lower right callout) — fields: `codeConnect` → `importPath`, `componentName`, `propMappings`; annotation: "maps Figma variant dimensions to code prop names"
6. **Cross-cutting field** — `variantProperties` shown as a horizontal band across the central box; annotation: "complete variant dimension map — not compressed for human readability"
7. **Required fields marker** — `nodeId`, `key`, `name`, `specVersion`, `generatedAt` marked with a solid dot indicator; others unmarked
8. **Graceful degradation note** — small annotation on the Style + Token Chain group: "null on non-Enterprise plans; fallback: style-name convention"

**O — Organization:** Central rectangle (ComponentSpec) occupies the middle of the canvas. Four callout zones radiate into the four quadrants. Each callout zone is a smaller rectangle connected to the central box by a 1.5px arrow. The `variantProperties` field appears as a horizontal band bisecting the central box vertically, visually distinct from the four corner groups. Required-field dots appear as small filled circles (3px radius) adjacent to their field labels. The graceful-degradation note is a small aside annotation in the Style + Token Chain quadrant, smaller text size.

**P — Presentation:**
- Canvas: `#FFFFFF`
- Central ComponentSpec box: fill `#2a1a0e` (ink — the primary structural anchor), text `#FFFFFF` Inter 12px 600
- variantProperties band within central box: fill `#C8102E` (red — primary accent, the keystone field the chapter emphasizes), text `#FFFFFF` Inter 11px
- Group A (Identity) callout box: fill `#F5F5F5`, border `#D4D4D4` 1px, header `#2a1a0e` Inter 11px 600, field names JetBrains Mono 11px `#545454`
- Group B (Geometry) callout box: same as Group A
- Group C (Style + Token Chain) callout box: same as Group A; graceful-degradation note in `#545454` Inter 10px italic
- Group D (Code Linkage) callout box: same as Group A
- Connecting arrows: `#2a1a0e` 1.5px with arrowhead pointing from central box outward
- Required-field markers: `#C8102E` filled circle 3px — distinct from the arrow ink color; uses red as the emphasis color for critical fields
- All borders: `#D4D4D4` 1px; no rounded corners; no gradients; no shadows
- Grayscale: ink central box = darkest anchor; callout boxes = light; red variantProperties band and required-field dots become mid-dark in grayscale, still distinguishable from both the ink box and the white callout boxes

**E — Exclusions:** No full JSON listing of the schema (the chapter already has this in code blocks); no `build-spec.mjs` script internals; no token alias formula derivation; no Style Dictionary configuration; no Tokens Studio JSON format; no DTCG format details; no `children` recursive structure; no `effects` or `cornerRadius` fields; no contract-test code; no manifest.json structure; no per-component file naming convention.

**Caption (draft):** The `ComponentSpec` object groups its fields into four zones — identity, geometry, style-to-token chain, and code linkage — with `variantProperties` as the cross-cutting field a code generator uses to emit TypeScript prop types; required fields are marked; the token alias chain degrades gracefully to `null` on non-Enterprise plans.

**Accuracy check:** Field names and types sourced directly from `component-spec-schema.json` in the chapter. Required fields (`nodeId`, `key`, `name`, `specVersion`, `generatedAt`) match the `"required"` array in the schema definition. The four groups (Identity, Geometry, Style + Token Chain, Code Linkage) are the chapter's own organizational structure from the "What the Figma API Provides" and "Defining the Component Specification Schema" sections. The graceful degradation note (null on non-Enterprise) is explicitly stated in both the Variables API section and the Failure Modes section. No fabricated fields.

---

## Figure 12.2 — Human Documentation vs. Machine Specification: What Each Omits

**Suggested filename:** `12-human-vs-machine-consumer.svg`

**Figure type:** Comparison panels (side-by-side columns showing what each consumer type requires, mapped to a shared axis of information types)

**One-sentence concept:** The human documentation consumer wants compression; the machine specification consumer requires completeness — the same component information is present in both, but what each omits reveals the purpose of `build-spec.mjs`.

**S — Specification:** Single-column textbook, 89mm–120mm print width; 300 DPI vector (SVG); viewBox 700 × 400; Brutalist D3 palette. Two-column comparison panel sharing a center row axis.

**C — Content:** Eight labeled rows (information types), two columns (Human doc / Machine spec), forming a 2 × 8 grid:

| Row | Information type |
|-----|-----------------|
| 1 | Component name |
| 2 | Description |
| 3 | Variant dimensions |
| 4 | Token alias chain |
| 5 | Node ID |
| 6 | Layout constraints |
| 7 | Spacing values |
| 8 | Code Connect path |

Each cell: PRESENT (checkmark-equivalent filled box) or OMITTED (dash, hollow box). Status:
- Human doc: rows 1–3 PRESENT; rows 4–8 OMITTED (with brief reason notes: "resolved value", "not needed", "16px not token name", "maybe")
- Machine spec: all 8 rows PRESENT (with brief annotation on rows 4–8 noting what the machine needs: "full alias path", "required for code identity", "raw + token ref", "required import")

**O — Organization:** Two-column grid. Left column header: "Human documentation". Right column header: "Machine specification (`components.json`)". Shared row axis runs vertically with row labels in a narrow center spine between the two columns. Each cell shows a status mark (solid box = present, hollow box = omitted). The center label spine clearly connects the two columns to the same information type. A caption line at the bottom reads: "Same component. Different omissions."

**P — Presentation:**
- Canvas: `#FFFFFF`
- Left column header: fill `#F5F5F5`, border `#D4D4D4` 1px, text `#2a1a0e` Inter 12px 600
- Right column header: fill `#2a1a0e` (ink), text `#FFFFFF` Inter 12px 600 — the machine spec is the featured column, the subject of the chapter
- Row label spine: `#545454` Inter 11px, background `#FFFFFF`
- PRESENT cells (Human doc): fill `#F5F5F5`, center mark `#2a1a0e` solid 8×8px square — positive state, neutral gray
- OMITTED cells (Human doc): fill `#FFFFFF`, center mark `#D4D4D4` hollow 8×8px square — absent, light
- PRESENT cells (Machine spec): fill `#F5F5F5`, center mark `#C8102E` solid 8×8px square — red as primary emphasis/brand; the machine spec's completeness is the point
- Brief reason notes inside cells: `#545454` Inter 10px (where they fit without clutter — limited to rows 4–8 in Human doc column and rows 4–8 in Machine spec column)
- Dividing rules between rows: `#D4D4D4` 0.75px horizontal
- Bottom caption: `#545454` Inter 11px italic
- Grayscale: right-column ink header = darkest; Machine-spec PRESENT marks = mid (they are the active-emphasis color that becomes mid-dark in grayscale); Human-doc PRESENT marks = near-same; OMITTED marks = lightest — the presence/absence contrast is luminance-encoded, color adds clarity not critical information

**E — Exclusions:** No full JSON schema; no `build-spec.mjs` code; no API endpoint listings; no Tokens Studio or Style Dictionary; no DTCG format; no Code Connect setup steps; no token alias formula; no typography field detail; no `children` recursive structure; no contract-test logic; no manifest.json fields; no per-component file output.

**Caption (draft):** The same eight information types about a component are present in both artifacts, but human documentation compresses or omits rows 4–8 as tacit knowledge — a code generator consuming those omissions will guess, and guessing produces wrong code.

**Accuracy check:** The 8-row information taxonomy is sourced directly from the chapter's comparison table ("Information / Human doc / Machine spec"). PRESENT/OMITTED status matches the table exactly: human doc gets name, description, variant dimensions (as examples, not complete enumerations); machine spec requires all eight rows. The token alias chain availability note (null on non-Enterprise) is acknowledged in the chapter's Variable Alias Chain section. No fabricated rows or status values.

---

## Video Candidate Pass

**Figure 12.1 (schema field map):** STATIC SUFFICIENT. A structured schematic is a spatial reference artifact — readers need to inspect field groupings at their own pace. Animation of fields appearing in sequence would not add instructional meaning.

**Figure 12.2 (human vs. machine comparison):** STATIC SUFFICIENT. The comparison is a two-state spatial contrast, not a transition mechanism. Side-by-side panels are the correct static representation; animation would not clarify the concept.
