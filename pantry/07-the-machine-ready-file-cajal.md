# CAJAL Figure Intelligence — Chapter 7: The Machine-Ready File

Source: `chapters/07-the-machine-ready-file.md`
Research: `pantry/research-ch-07-the-machine-ready-file.md`
Mode: /scan silent
Domain note: Design systems engineering, Figma API, CI pipeline governance.

## Density Recommendation

2 figures. Chapter 7 is a contract-definition chapter: it establishes the five-category readiness criteria and the file-to-pipeline gate. Two figures cover the two distinct cognitive loads — what the contract contains (structured schematic) and how it sits in the pipeline sequence (process flowchart). A third would overlap.

## Zone Map

- **MC (mechanism complexity):** The five-category preflight contract — Naming, Variable Architecture, Publication State, Component Documentation, Export Targets — each with blocking vs. advisory severity.
- **VG (verification gap):** The causal chain from file state → preflight gate → downstream pipelines. Students need to see that the gate is structural (CI `&&` chain), not advisory.
- **PQ (process/quantitative):** Before/after preflight output (14 blocking → 0 blocking / 3 advisory) is a strong before/after candidate but is better rendered as a comparison panel than a chart; the numbers themselves appear verbatim in the chapter text.

---

## Figure 7.1 — The Five-Category Machine-Readiness Contract

**Suggested filename:** `07-machine-readiness-contract.svg`

**Figure type:** Structural schematic (annotated table/grid with severity coding)

**One-sentence concept:** The machine-readiness contract organizes five categories of preflight criteria into blocking and advisory severity classes, giving the reader a scannable reference for what the `figma-preflight.mjs` script checks and why each matters.

**S — Specification:** Single-column textbook width (170mm / ~680px at 96dpi); 300 DPI vector output; portrait orientation; designed to read clearly at 65ch body-text column.

**C — Content:** Five rows, one per category. Each row contains:
1. Category name: Naming Contract / Variable Architecture / Publication State / Component Documentation / Export Targets
2. Representative criterion (one line, exact language from chapter): e.g., "All variables follow slash-separated hierarchy with ≥2 levels"
3. Default severity: BLOCKING or ADVISORY (drawn from chapter's explicit ruling per category)
4. Consequence if failed: one-clause plain-language note

Header row labels: CATEGORY / KEY CRITERION / SEVERITY / CONSEQUENCE IF FAILED

Severity column uses two distinct fills (not red/green — see Presentation).

**O — Organization:** Horizontal grid table, five data rows plus header. Severity column is the narrowest; Category column is leftmost and bold. A thin vertical rule separates Severity from Consequence. Row alternation via subtle fill (white / border-tint), not color. No nested panels.

**P — Presentation:** 
- Canvas: `--color-white` (#FFFFFF)
- Header row fill: `--color-ink` (#121212); header text: `--color-white`
- BLOCKING severity cell: `--color-red` (#C8102E) fill, `--color-white` text — brand red signals primacy, not danger (per DESIGN.md role rules)
- ADVISORY severity cell: `--color-secondary` (#545454) fill, `--color-white` text
- Category label text: `--color-ink`, Inter 14px/600
- Criterion and Consequence text: `--color-ink`, Inter 13px/400
- Row dividers: 1px `--color-border` (#D4D4D4)
- Outer border: 1px `--color-border`
- Grayscale-distinguishable: BLOCKING = dark fill, ADVISORY = medium gray fill — distinguishable without color

**E — Exclusions:**
- Do not show the `figma-preflight.mjs` script code or any code snippet
- Do not show the full set of sub-criteria per category (chapter lists several per category; one representative criterion per row only)
- Do not show the FIGMA.md governance document (that is Figure 7.2's subject)
- Do not show the before/after preflight output numbers (14 blocking → 0)
- Do not show the non-Enterprise Variables API caveat
- Do not show the "What the Preflight Cannot Catch" section content
- No decorative icons or status badge graphics

**Caption (draft):** The five categories of the machine-readiness contract, with their default severity classification; BLOCKING findings cause the preflight script to exit non-zero and halt all downstream pipeline steps.

**Accuracy check:** Category names, severity defaults, and consequence descriptions are drawn verbatim from the chapter's "Machine-Readiness Contract" section. Naming violations are blocking (stated explicitly); broken aliases are always blocking (stated explicitly); empty descriptions are advisory by default but may become blocking for documentation pipelines (stated explicitly). No fabricated criteria. Severity color assignment uses --color-red for BLOCKING per DESIGN.md brand-primary role, not as a data-alert encoding.

---

## Figure 7.2 — The Preflight Gate in the Pipeline Sequence

**Suggested filename:** `07-preflight-gate-flow.svg`

**Figure type:** Process flowchart

**One-sentence concept:** The preflight script is the mandatory first step in a three-step CI pipeline chain; a non-zero exit from the preflight halts token extraction and asset export before they run, enforcing the machine-readiness contract structurally rather than by convention.

**S — Specification:** Single-column textbook width (170mm); 300 DPI vector output; landscape-friendly horizontal layout; left-to-right flow.

**C — Content:** Six labeled nodes in sequence:

1. **Figma File** — source artifact (rectangle, left anchor)
2. **figma:preflight** — script node; two exit paths:
   - Exit 0 → proceeds right (arrow labeled "PASSED")
   - Exit 1 → drops down to HALT node (arrow labeled "BLOCKING FOUND, exit 1")
3. **figma:tokens** — token extraction step (rectangle)
4. **figma:assets** — asset export step (rectangle)
5. **CI Pipeline Proceeds** — terminal success node (right anchor)
6. **HALT** — terminal failure node, below the preflight node (distinct fill)

The `&&` operator label appears on the connector between figma:preflight → figma:tokens and between figma:tokens → figma:assets, making the enforcement mechanism explicit.

**O — Organization:** Left-to-right horizontal main flow on a single horizontal axis: Figma File → figma:preflight → figma:tokens → figma:assets → CI Pipeline Proceeds. The HALT node drops vertically below figma:preflight. The blocking-exit arrow uses ⊣ (blockage) semantics per CAJAL convention, pointing down to HALT. All other arrows use → (progression). Labels on arrows are Inter 11px `--color-secondary`.

**P — Presentation:**
- Canvas: `--color-white`
- Script/step nodes (figma:preflight, figma:tokens, figma:assets): `--color-white` fill, `--color-ink` 1px border, `--color-ink` label text (Inter 13px/600)
- Figma File source node: `--color-border` (#D4D4D4) fill, `--color-ink` text — visually lighter to signal input artifact
- CI Pipeline Proceeds terminal: `--color-ink` (#121212) fill, `--color-white` text — success anchor
- HALT terminal: `--color-red` (#C8102E) fill, `--color-white` text — brand primary marks the one active/critical path
- `&&` operator labels: `--color-secondary`, JetBrains Mono 11px, positioned on connectors
- Arrow strokes: 1.5px `--color-ink`; blockage arrow to HALT: 1.5px `--color-red`
- Grayscale-distinguishable: HALT is darkest non-black fill; source node is lightest; script nodes are white; CI Proceeds is black — distinguishable in monochrome

**E — Exclusions:**
- Do not show the full bash command (`npm run figma:preflight && npm run figma:tokens && npm run figma:assets`) as a code block inside the figure
- Do not show the advisory-vs-blocking distinction within the flow (that is Figure 7.1's subject)
- Do not show the FIGMA.md governance document content
- Do not show preflight sub-checks or individual finding categories
- Do not show GitHub Actions YAML structure
- Do not show the rate-limit or plan-gate failure modes
- No swimlanes or actor columns

**Caption (draft):** The preflight script sits at the head of the CI pipeline chain; a blocking exit halts token extraction and asset export before they run, making the machine-readiness contract structurally enforced rather than advisory.

**Accuracy check:** The three pipeline commands and their `&&` chaining are quoted verbatim from the chapter ("npm run figma:preflight && npm run figma:tokens && npm run figma:assets"). Exit code 0 = proceed, non-zero = halt is stated explicitly. The preflight does not modify the Figma file; it is read-only. No fabricated pipeline steps. HALT node represents exit code 1 (blocking findings), which is the chapter's explicit behavior. Exit code 2 (rate-limit exhaustion) is a separate case mentioned in the chapter's rate-limit section and is correctly omitted from this flow-level figure.

---

## Video Candidate Pass

- **Figure 7.2** is a weak video candidate. The pipeline sequence could be animated (nodes illuminating left-to-right, then the red HALT branch triggering), but the static figure communicates the structure fully. Recommend static only unless a course companion video is planned.
- **Figure 7.1** is not a video candidate. Static table.
