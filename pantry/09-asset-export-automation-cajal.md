# CAJAL Figure Intelligence — Chapter 9: Asset Export Automation

Source: `chapters/09-asset-export-automation.md`
Research: `pantry/research-ch-09-asset-export-automation.md`
Mode: /scan silent
Domain note: Design systems engineering, Figma image export endpoint, SVG optimization, CI pipeline.

## Density Recommendation

2 figures. Chapter 9 has one dominant pipeline narrative (the full export flow with its four hazards) and one structural concept that benefits from visualization (the asset manifest as a stable contract between Figma node IDs and repository paths). A third figure for the SVGO plugin list or the integrity-check code would be redundant with code already in the chapter.

## Zone Map

- **MC (mechanism complexity):** The export pipeline sequence — batch image request → expiring-URL download → SVGO post-processing → integrity check → write → PR — with the four operational hazards (expiring URLs, rate limits, node ID instability, raw SVG not production-ready) embedded as warning points. This is the highest-value figure in the chapter.
- **VG (verification gap):** The expiring-URL hazard is the single most counterintuitive behavior in the chapter ("Download immediately — the URL is not a file"). Students who have only worked with stable file-download endpoints will not anticipate this. The process flowchart must make "download immediately" visible as a structural constraint, not a footnote.
- **PQ:** No strong quantitative figure candidate. Batch size (50 nodes per request), delay (1000ms between batches), and retry count (3) are operational parameters in the code, not data to visualize.

---

## Figure 9.1 — The Asset Export Pipeline with Operational Hazards

**Suggested filename:** `09-asset-export-pipeline.svg`

**Figure type:** Process flowchart

**One-sentence concept:** The asset export pipeline moves from a manifest of node IDs through batched image requests, immediate expiring-URL downloads, SVGO post-processing, and integrity verification to deterministic repository writes — with four operational hazards marked at the steps where they apply.

**S — Specification:** Single-column textbook width (170mm); 300 DPI vector output; vertical top-to-bottom flow with hazard annotations on the right side of the main flow; portrait orientation.

**C — Content:** Eight labeled nodes in the main flow, plus four hazard annotations:

Main flow nodes (top to bottom):
1. **asset-manifest.json** — source artifact; sub-label: "node IDs · formats · output paths"
2. **Batch image request** — API call; sub-label: "GET /v1/images — 50 nodes/batch"
3. **Receive expiring URLs** — API response; sub-label: "{ [nodeId]: url | null }"
4. **Download immediately** — critical action; sub-label: "URL expires — no deferred download"
5. **SVGO post-process** (conditional — only for SVG assets); sub-label: "if svgo: true in manifest"
6. **Integrity check** — verification; sub-label: "empty? malformed? wrong magic bytes?"
7. **Write to output path** — file write; sub-label: "mkdir -p + writeFileSync"
8. **Open PR** — terminal; sub-label: "pr branch: figma/asset-update"

Hazard annotation labels (right-aligned callouts, connected to the relevant node by a leader line):
- H1 on "Receive expiring URLs": "HAZARD: URL expires — download in same execution, not later"
- H2 on "Batch image request": "HAZARD: Rate-limited separately from file API — batch to 50, delay 1s between batches"
- H3 on "asset-manifest.json": "HAZARD: Node ID changes on copy-paste — null render signals stale manifest entry"
- H4 on "SVGO post-process": "HAZARD: Raw Figma SVG not production-ready — IDs conflict, viewBox may be stripped"

Null render branch: from "Receive expiring URLs", if url === null → side branch labeled "Null render" → "Log warning · skip asset · continue" (not a hard failure).

Retry/backoff loop: from "Batch image request", if 429 response → small loop arrow labeled "429 → wait Retry-After → retry (max 3)"

**O — Organization:** Vertical main flow, top to bottom. Nodes are rectangles with rounded corners. Conditional SVGO node has a small diamond before it labeled "SVG + svgo:true?" with YES path continuing down, NO path bypassing to Integrity check. Null-render branch exits right from "Receive expiring URLs" and terminates at a small "LOG · SKIP" box. Retry loop is a curved arrow back from "Batch image request" to itself, labeled "429 retry". Hazard callouts are right-aligned annotation boxes connected by 0.75px hairlines. The overall flow reads cleanly top-to-bottom even without the hazard annotations.

**P — Presentation:**
- Canvas: `--color-white`
- Main flow nodes (steps 2–7): `--color-white` fill, 1px `--color-border` border, `--color-ink` text (Inter 13px/600 for node label, `--color-secondary` Inter 11px/400 for sub-label)
- Source artifact node (asset-manifest.json): `--color-border` (#D4D4D4) fill, `--color-ink` text — lighter fill signals input/source
- Terminal PR node: `--color-ink` (#121212) fill, `--color-white` text — black terminal anchors the bottom
- Hazard annotation boxes: `--color-white` fill, 1.5px `--color-red` left-border (ochre-rule treatment from DESIGN.md applied with red per hazard severity), `--color-ink` text Inter 11px/400
- Null render box: `--color-secondary` (#545454) fill, `--color-white` text Inter 11px/400 — subordinate terminal, not failure
- Hazard leader hairlines: 0.75px `--color-red`
- Main flow arrows: 1.5px `--color-ink`, → style
- Retry loop arrow: 1.5px `--color-secondary`, curved, dashed stroke
- SVGO conditional diamond: `--color-white` fill, 1px `--color-ink` border
- Grayscale-distinguishable: source = gray fill; steps = white outlined; terminal = black fill; null branch = dark gray fill; hazard boxes = white with left-border — five distinguishable states without color

**E — Exclusions:**
- Do not show the `export-assets.mjs` script code or the `figmaGet()` function internals
- Do not show the SVGO plugin configuration list (14+ plugins in the chapter — omit entirely)
- Do not show the integrity check code (`verifyAsset()` function)
- Do not show the GitHub Actions YAML workflow
- Do not show the duplicate-filename collision check
- Do not show PNG magic bytes or SVG content validation details
- Do not show the `--dry-run` flag or dry-run behavior
- Do not show the asset-manifest.json JSON schema in the figure (it appears in the chapter's manifest section)
- No swimlane or role separation

**Caption (draft):** The asset export pipeline reads a stable manifest of Figma node IDs, requests batched image renders, downloads the resulting expiring URLs immediately, post-processes SVGs with SVGO, and verifies integrity before writing to deterministic repository paths — with the four operational hazards marked at the steps where they apply.

**Accuracy check:** All eight pipeline steps derive directly from the chapter's `export-assets.mjs` code and surrounding prose. The four hazards are the chapter's explicit "Four Operational Hazards" section: (1) URLs expire, (2) rate limits apply to image requests, (3) node IDs change on copy-paste, (4) raw Figma SVG is not production-ready. Batch size of 50 nodes is the chapter's `BATCH_SIZE` constant. Retry limit of 3 is `MAX_RETRIES`. Delay of 1s is `BATCH_DELAY_MS`. The null render path (url === null from the image endpoint) is explicitly handled in the chapter: "Log it as a null render and continue." The PR branch reflects the GitHub Actions workflow final step. No fabricated steps or failure modes.

---

## Figure 9.2 — The Asset Manifest as Stability Contract

**Suggested filename:** `09-asset-manifest-contract.svg`

**Figure type:** Structural schematic (annotated example)

**One-sentence concept:** The asset manifest maps stable Figma node IDs to deterministic repository paths, insulating the pipeline from designer renames while surfacing node-ID changes (caused by copy-paste) as explicit null renders rather than silent overwrites.

**S — Specification:** Single-column textbook width (170mm); 300 DPI vector output; compact portrait layout; approximately one-third page height; two-column structure.

**C — Content:** One manifest entry rendered as a schematic JSON block with five callout annotations, plus a second panel showing what happens when the node ID is stale.

**Manifest entry (from chapter verbatim):**
```json
{
  "nodeId": "1:234",
  "name": "icon-close",
  "outputPath": "src/assets/icons/icon-close.svg",
  "format": "svg",
  "scale": 1,
  "svgo": true
}
```

Five callout annotations:
1. `"nodeId": "1:234"` → "Stable across renames and moves; changes only on delete-and-recreate or copy-paste"
2. `"name": "icon-close"` → "Human-readable label — not used by the pipeline to locate the node"
3. `"outputPath"` → "Deterministic repo path — human decision, not inferred from Figma name"
4. `"format": "svg"` + `"scale": 1` → "Render format and scale passed to GET /v1/images"
5. `"svgo": true` → "Post-processing flag — false for complex illustrations"

**Stale ID panel** (right side or below, compact):
- Small two-node schematic: manifest entry with nodeId "1:234" (left node) → image endpoint returns `null` (right node, dashed border)
- Label below: "Designer copy-pasted icon → new ID created → old manifest entry → null render in export log"

**O — Organization:** JSON block left-aligned, occupying approximately 55% of width. Five annotation boxes right-aligned or bracketed to the right, connected by hairline leaders. Stale-ID panel sits below the main JSON block, separated by a 1px horizontal rule. Compact and scannable — the figure functions as a reference card, not a narrative diagram.

**P — Presentation:**
- Canvas: `--color-white`
- JSON panel background: `--color-border` at 30% opacity tint
- JSON key text (`"nodeId"`, `"outputPath"`, etc.): `--color-ink`, JetBrains Mono 13px
- JSON value text (`"1:234"`, `"icon-close"`, etc.): `--color-secondary`, JetBrains Mono 13px
- `"nodeId"` key: `--color-red` (#C8102E) — the one field the pipeline uses as the stable anchor; brand red signals primary-emphasis per DESIGN.md
- Annotation boxes: `--color-white` fill, 1px `--color-border` border, Inter 12px/400 `--color-ink`
- Stale-ID panel: null-return node uses dashed `--color-secondary` border and `--color-secondary` text; "null" value in `--color-secondary`; explanatory label in `--color-secondary` Inter 11px/400 italic
- Leader hairlines: 0.75px `--color-border`
- Horizontal rule between panels: 1px `--color-border`
- Grayscale-distinguishable: nodeId key = darkest (red/ink); values = secondary gray; stale node = dashed gray — three distinguishable states

**E — Exclusions:**
- Do not show the full manifest JSON with all four example entries from the chapter — one entry only
- Do not show the PNG entry (`logo-primary@2x.png`) or the illustration entry — icon SVG entry only
- Do not show the manifest version field (`"version": 2`)
- Do not show the duplicate-path validation logic
- Do not show the `export-assets.mjs` script internals
- Do not show the SVGO optimization output or file-size reduction numbers
- Do not show the GitHub Actions PR workflow
- Do not show the `--manifest` command-line flag

**Caption (draft):** The asset manifest maps a stable Figma node ID to a deterministic repository path; a copy-pasted icon generates a new node ID, making the old manifest entry stale and producing a null render in the export log rather than silently overwriting the wrong asset.

**Accuracy check:** The manifest JSON entry is quoted verbatim from the chapter's "Asset Manifest" section. The stability rule ("stable as long as the node is not deleted and recreated; a copy-paste creates a new node with a new ID") is stated explicitly in the chapter, in the "Hazard 3" section and in the FIGMA.md governance document quotation. The null-render behavior for a stale ID is stated: "The pipeline logs it as a null render and continues." The `nodeId` as the lookup key (not the name) is explicit: "The export script reads it and trusts it." No fabricated behavior.

---

## Video Candidate Pass

- **Figure 9.1** is the strongest video candidate in this chapter. Animating the pipeline step-by-step — with the expiring URL countdown making "download immediately" visceral — would be high-value in a course companion. The hazard annotations appearing sequentially (rather than all at once) reduce cognitive load in video format.
- **Figure 9.2** is not a video candidate. Static annotated example.
