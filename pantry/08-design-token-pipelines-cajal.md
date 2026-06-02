# CAJAL Figure Intelligence — Chapter 8: Design Token Pipelines

Source: `chapters/08-design-token-pipelines.md`
Research: `pantry/research-ch-08-design-token-pipelines.md`
Mode: /scan silent
Domain note: Design systems engineering, W3C DTCG token format, Style Dictionary, Figma Variables API.

## Density Recommendation

3 figures. Chapter 8 has three cognitively distinct loads that each require a figure: (1) the five-stage pipeline architecture as a whole, (2) the DTCG JSON token structure as an annotated example, and (3) alias chain resolution as a dependency graph. A fourth for the Style Dictionary config or GitHub Actions YAML would overlap with code already in the chapter.

## Zone Map

- **MC (mechanism complexity):** The five-stage pipeline (Declare → Extract → Transform → Distribute → Compile) with Enterprise vs. non-Enterprise branch at Stage 2. Students need the full pipeline visible before the code makes sense.
- **VG (verification gap):** The alias resolution chain (semantic → primitive → raw value) is described in code but never visualized. A dependency graph makes broken-alias failure instantly legible.
- **PQ (process/quantitative):** The DTCG JSON token structure (`$value`, `$type`, `$description`) is an annotated-example candidate — not a chart, but a labeled schematic of a real JSON shape that anchors the transformation discussion.

---

## Figure 8.1 — The Five-Stage Token Pipeline Architecture

**Suggested filename:** `08-token-pipeline-stages.svg`

**Figure type:** Process flowchart

**One-sentence concept:** The token pipeline moves through five sequential stages — Declare, Extract, Transform, Distribute, Compile — with the Extract stage bifurcating into an Enterprise (Variables REST API) and a non-Enterprise (Tokens Studio) path that rejoin before validation.

**S — Specification:** Single-column textbook width (170mm); 300 DPI vector output; horizontal left-to-right flow with a two-row branch at Stage 2; fits within a portrait page without scaling.

**C — Content:** Eight labeled nodes:

1. **Declare** — Stage 1 label; sub-label: "Figma file / variable collections / naming contract"
2. **Extract (API)** — Stage 2 Enterprise path; sub-label: "Variables REST API / Enterprise plan"
3. **Extract (Studio)** — Stage 2 non-Enterprise path; sub-label: "Tokens Studio plugin export"
4. **Validate** — Stage 3a; sub-label: "validate-tokens.mjs"
5. **Transform** — Stage 3b; sub-label: "Style Dictionary"
6. **Distribute** — Stage 4; sub-label: "tokens/ in repo / private registry"
7. **Compile** — Stage 5; sub-label: "CSS · Swift · Android XML"
8. A branch label above the Stage 2 fork: "Enterprise plan?" with YES / NO routing

**O — Organization:** Single horizontal axis. Stages 1, 3a, 3b, 4, 5 are on the main axis. Stage 2 forks into two rows (upper = API path, lower = Studio path) and rejoins at Validate. The fork and rejoin are shown with diagonal connectors. All main-axis arrows use →. The Enterprise/non-Enterprise fork uses a diamond decision node labeled "Enterprise plan?" with YES branch going upper, NO branch going lower. Stage labels are eyebrow text (Inter 11px/700 all-caps `--color-secondary`) above each node.

**P — Presentation:**
- Canvas: `--color-white`
- Main-axis stage nodes (Declare, Validate, Transform, Distribute, Compile): `--color-white` fill, 1px `--color-border` border, `--color-ink` label (Inter 13px/600), `--color-secondary` sub-label (Inter 11px/400)
- Enterprise API path node: `--color-ink` (#121212) fill, `--color-white` text — primary/preferred path gets the anchor weight
- Non-Enterprise Studio path node: `--color-secondary` (#545454) fill, `--color-white` text — secondary/fallback path is visually subordinate
- Decision diamond: `--color-white` fill, 1px `--color-ink` border, `--color-ink` label (Inter 12px/400)
- Arrow strokes: 1.5px `--color-ink`
- Stage eyebrow labels: Inter 10px/700 all-caps, `--color-secondary`
- Grayscale-distinguishable: Enterprise node = black, Studio node = dark gray, stage nodes = white outlined — three distinguishable values without color

**E — Exclusions:**
- Do not show `extract-tokens.mjs` code or `sd.config.mjs` configuration
- Do not show GitHub Actions YAML structure
- Do not show DTCG JSON token structure (that is Figure 8.2's subject)
- Do not show alias resolution chains (that is Figure 8.3's subject)
- Do not show the `LIBRARY_PUBLISH` webhook trigger or PR mechanism
- Do not show the validate-tokens.mjs internal checks
- Do not show the `--source=studio` flag or normalizeTokensStudio() function
- No swimlane or role-actor separation

**Caption (draft):** The five-stage token pipeline, with the Extract stage branching into an Enterprise path (Variables REST API) and a non-Enterprise path (Tokens Studio); both paths rejoin at the Validate stage and proceed identically.

**Accuracy check:** Stage names (Declare, Extract, Transform, Distribute, Compile) match the chapter's "Five-Stage Architecture" section verbatim. The Enterprise gate at Stage 2 is an explicit chapter claim: "the Variables REST API requires an Enterprise plan" with a 403 response on lower plans. Tokens Studio is explicitly named as the non-Enterprise Stage 2 alternative. The two paths are stated to rejoin at validation: "The rest of the pipeline — validation, transformation, distribution, compilation — is identical either way." No fabricated stages or tools.

---

## Figure 8.2 — DTCG Token JSON Structure (Annotated Example)

**Suggested filename:** `08-dtcg-token-structure.svg`

**Figure type:** Annotated example

**One-sentence concept:** A single DTCG-format color token rendered as a labeled JSON structure, showing the relationship between the slash-separated key path, the three required fields (`$value`, `$type`, `$description`), and their meaning in the pipeline.

**S — Specification:** Single-column textbook width (170mm); 300 DPI vector output; portrait; compact vertical layout, approximately one-third page height.

**C — Content:** One complete DTCG token instance rendered as a schematic JSON block with six callout annotations:

JSON structure to render (from the chapter verbatim):
```
{
  "color": {
    "brand": {
      "primary": {
        "$value": "#2563EB",
        "$type": "color",
        "$description": "Primary brand interactive color"
      }
    }
  }
}
```

Six callout annotations (leader lines from JSON keys/values to annotation boxes):
1. `"color" / "brand" / "primary"` → "Slash-separated key path: `color/brand/primary`"
2. `"$value"` → "Resolved raw value — no alias references survive extraction"
3. `"#2563EB"` → "Hex string; DTCG `color` type uses hex"
4. `"$type"` → "W3C DTCG type: `color` · `dimension` · `number` · `string` · `boolean` · `duration`"
5. `"$description"` → "Populated from Figma variable description field"
6. Outer `{ }` nesting → "Nested object mirrors slash hierarchy: `color/brand/primary`"

**O — Organization:** JSON block left-aligned, rendered as a code-styled panel (JetBrains Mono). Six annotation boxes right-aligned or top/bottom of the code panel, connected by 1px hairline leader lines. Annotations use Inter 12px/400. No arrows on leaders — hairlines only. Numbers 1–6 as small circular eyebrow markers at the connection point on the JSON, matching the annotation sequence.

**P — Presentation:**
- Canvas: `--color-white`
- JSON panel background: `--color-border` (#D4D4D4) at 30% opacity tint — distinguishable from canvas without strong fill
- JSON key text (`"$value"`, `"$type"`, `"$description"`): `--color-red` (#C8102E), JetBrains Mono 13px — brand red on DTCG keys to mark the three canonical fields; this is the primary-emphasis role per DESIGN.md
- JSON nesting keys (`"color"`, `"brand"`, `"primary"`): `--color-ink`, JetBrains Mono 13px
- JSON value text (`"#2563EB"`, `"color"`, `"Primary brand..."`): `--color-secondary` (#545454), JetBrains Mono 13px
- Annotation boxes: `--color-white` fill, 1px `--color-border` border, Inter 12px/400 `--color-ink` text
- Leader hairlines: 0.75px `--color-border`
- Eyebrow marker circles: `--color-ink` fill, `--color-white` numeral, 14px diameter
- Grayscale-distinguishable: DTCG keys (darkest = ink/red), nesting keys (ink), values (secondary gray), annotation boxes (white on border) — four distinguishable values

**E — Exclusions:**
- Do not show the full `extract-tokens.mjs` output for multiple tokens — one token only
- Do not show the CSS output (`--color-brand-primary: #2563EB`) — that belongs in the Style Dictionary section of the chapter
- Do not show an alias/reference token (e.g., `{ type: 'VARIABLE_ALIAS' }`) — unresolved aliases are excluded by design
- Do not show multi-mode JSON (light/dark mode variants) — single mode only
- Do not show the DTCG specification URL or version status
- Do not show the `setNestedValue()` function logic
- Do not show spacing or typography token examples — color only for clarity

**Caption (draft):** A single DTCG-format color token as written by `extract-tokens.mjs`: the slash-separated nesting path mirrors the Figma variable name, and the three `$`-prefixed fields carry the resolved value, declared type, and Figma variable description.

**Accuracy check:** JSON structure is quoted verbatim from the chapter's "Style Dictionary Configuration" section. The DTCG `$value`/`$type`/`$description` field names are the W3C DTCG draft standard, explicitly cited in the chapter. The chapter states: "use `$value`, `$type`, and `$description` as key names." The type value `color` (lowercase) matches DTCG draft convention as stated in the chapter ("color", "dimension", "duration", "number", "string", "boolean"). The hex value `#2563EB` appears in the chapter as the canonical example. The description "Primary brand interactive color" appears verbatim. No fabricated fields.

---

## Figure 8.3 — Alias Chain Resolution (Dependency Graph)

**Suggested filename:** `08-alias-chain-resolution.svg`

**Figure type:** Systems diagram (small dependency graph)

**One-sentence concept:** A semantic token aliases a primitive token which resolves to a raw value; a broken alias — where the target variable has been deleted or renamed — creates a dangling reference that `resolveAlias()` throws on, which the preflight catches before extraction runs.

**S — Specification:** Single-column textbook width (170mm); 300 DPI vector output; compact horizontal dependency graph, approximately one-quarter page height; two states shown as comparison panels: healthy chain (left) and broken chain (right).

**C — Content:** Two side-by-side panels sharing the same node structure:

**Panel A — Healthy chain (3 nodes):**
- Node 1: `color/button/primary` (semantic token — label: "Semantic")
- Node 2: `color/brand/blue-600` (primitive token — label: "Primitive")  
- Node 3: `#2563EB` (raw value — label: "Raw value")
- Arrow: Node 1 → Node 2 (label: "aliases")
- Arrow: Node 2 → Node 3 (label: "resolves to")

**Panel B — Broken chain (3 nodes):**
- Node 1: `color/button/primary` (semantic token)
- Node 2: `[deleted variable]` (missing target — shown with dashed border, grayed text)
- Node 3: *(absent — no raw value reachable)*
- Arrow: Node 1 → Node 2 (label: "aliases", dashed stroke)
- Error label below Node 2: "Broken alias — exit non-zero"

Panel labels: "VALID" (above Panel A) and "BROKEN" (above Panel B), eyebrow style.

**O — Organization:** Two panels side by side, divided by a thin 1px vertical rule at center. Each panel is a left-to-right three-node chain. Nodes are rounded rectangles. Arrows are horizontal. Panel labels are centered above each half. Total width fits within single column. Compact: nodes are small (approximately 120px wide × 36px tall at 96dpi).

**P — Presentation:**
- Canvas: `--color-white`
- Panel A nodes (healthy): `--color-white` fill, 1px `--color-ink` border, `--color-ink` text (JetBrains Mono 11px for token names, Inter 10px/700 for role labels)
- Raw value node (Panel A): `--color-ink` (#121212) fill, `--color-white` text — terminal/resolved node gets anchor weight
- Panel B Node 1 (semantic, still valid): `--color-white` fill, 1px `--color-ink` border — same as Panel A
- Panel B Node 2 (missing variable): `--color-white` fill, 1px dashed `--color-secondary` border, `--color-secondary` text — visually absent/ghost
- Panel B error label: `--color-red` (#C8102E), Inter 11px/600 — brand red marks the one critical finding per figure
- Panel divider: 1px `--color-border`
- Panel eyebrow labels ("VALID" / "BROKEN"): Inter 10px/700 all-caps, `--color-secondary`
- Healthy arrows: 1.5px `--color-ink`, → style
- Broken arrow: 1.5px dashed `--color-secondary`
- Grayscale-distinguishable: resolved terminal node = black fill; healthy nodes = white outlined; missing node = dashed gray; two panels separated by rule — fully distinguishable without color

**E — Exclusions:**
- Do not show alias chains deeper than semantic → primitive → raw value (the chapter warns against >3 levels but the figure illustrates the 2-hop normal case only)
- Do not show the `resolveAlias()` function code
- Do not show multi-mode alias handling
- Do not show the `valuesByMode` JSON structure
- Do not show the variable ID (`variableId`) as a technical UUID — use the variable name only
- Do not show the `depth` counter or recursion logic
- Do not show the preflight script output format or finding message text

**Caption (draft):** A healthy alias chain (left) resolves a semantic token through a primitive to a raw hex value; a broken chain (right) references a variable that no longer exists, producing the broken-alias blocking finding that the preflight script catches before extraction runs.

**Accuracy check:** Alias chain topology (semantic → primitive → raw value) is stated explicitly in the chapter's "Variable Architecture" section: "semantic → primitive is normal; semantic → semantic → semantic → primitive is a sign of architectural confusion." The broken-alias scenario is the chapter's stated cause of the opening failure story (variable renamed during collection restructuring). The `resolveAlias()` function in the chapter throws on a missing variable ID: `throw new Error('Missing variable: ${variableId}')`. The preflight catching broken aliases before extraction is explicitly stated. No fabricated failure modes.

---

## Video Candidate Pass

- **Figure 8.1** is a moderate video candidate. The pipeline animated step-by-step (stages illuminating left-to-right, branch decision appearing, paths rejoining) would work in a course companion. The static figure is complete on its own.
- **Figure 8.2** is not a video candidate. Static annotated example.
- **Figure 8.3** is a weak video candidate. Animating the broken alias (Node 2 fading to dashed) adds minimal value over the static comparison panel.
