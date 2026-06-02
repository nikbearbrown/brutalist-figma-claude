# CAJAL Figure Intelligence — Chapter 11: Brand Compliance Monitoring

Source: `chapters/11-brand-compliance-monitoring.md`
Mode: /scan silent
Domain note: Design systems engineering; WCAG 2.1 accessibility standards; brand governance; CI tooling.

---

## Density Recommendation

2 figures. Mechanistic + quantitative density. The chapter makes a precise quantitative claim (WCAG contrast thresholds) that requires a correctly-labeled reference figure, and a process claim (before/after diff) that benefits from a comparison panel.

## Zone Map

- PQ: WCAG 2.1 contrast thresholds — four distinct threshold values (3:1, 4.5:1, 7:1, and the implicit 4.5:1-for-large-AAA) with pass/fail regions; this is a quantitative figure with exact numeric values that must be correct
- MC: baseline → current → diff flow for compliance reporting; a three-stage pipeline where the diff is the output
- VG: the before/after compliance delta is asserted but never shown as a visual artifact

---

## Figure 11.1 — WCAG 2.1 Contrast Threshold Reference

**Suggested filename:** `11-wcag-contrast-thresholds.svg`

**Figure type:** Statistical / quantitative (annotated horizontal band chart showing pass/fail regions)

**One-sentence concept:** WCAG 2.1 defines four normative contrast-ratio thresholds that determine whether text passes or fails accessibility for normal-text AA, large-text AA, normal-text AAA, and large-text AAA — and `monitor-brand.mjs` checks against these exact values.

**S — Specification:** Single-column textbook, 89mm–120mm print width; 300 DPI vector (SVG); viewBox 700 × 380; Brutalist D3 palette. Horizontal axis: contrast ratio from 1:1 to 10:1. Y-axis: none (this is a band chart, not a bar chart). Two rows of bands for Normal Text and Large Text, each showing fail / partial / AA / AAA zones.

**C — Content:** Eight labeled elements:
1. Horizontal axis labeled "Contrast ratio (lighter + 0.05) / (darker + 0.05)" with tick marks at 1, 3, 4.5, 7, 10
2. Band row A — "Normal text (< 18pt regular; < 14pt bold)": FAIL zone 1:1–4.5, AA PASS zone 4.5–7, AAA PASS zone 7–10
3. Band row B — "Large text (≥ 18pt regular; ≥ 14pt bold)": FAIL zone 1:1–3, AA PASS zone 3–4.5, AAA PASS zone 4.5–10
4. Threshold tick annotation at 3:1 — "3:1 large AA"
5. Threshold tick annotation at 4.5:1 — "4.5:1 normal AA / large AAA"
6. Threshold tick annotation at 7:1 — "7:1 normal AAA"
7. Example marker on Normal row: "2.9:1 — example from chapter opening (fails AA)"
8. Source note: "WCAG 2.1 §1.4.3 — normative"

**O — Organization:** Two horizontal band rows stacked vertically, sharing a single x-axis at the bottom. Each row is a labeled ribbon divided into colored zones by vertical dividers at 3, 4.5, and 7. The x-axis runs full width below both rows. Threshold annotations drop from the shared axis with short vertical tick marks and labels. The example marker (2.9:1) appears as a vertical dashed rule crossing the Normal row, positioned left of the 3:1 divider.

**P — Presentation:**
- Canvas: `#FFFFFF`
- FAIL zone fill: `#F5F5F5` (lightest gray — neutral, not red; red is brand only per DESIGN.md rule)
- AA PASS zone fill: `#D4D4D4` (border gray — mid-gray, clearly distinguishable from FAIL in grayscale)
- AAA PASS zone fill: `#2a1a0e` at 15% opacity or `#ADADAD` (mid-dark gray — distinct from both other zones)
- Zone boundary dividers: `#2a1a0e` 1px vertical rules at x = 3, 4.5, 7
- Row labels (left margin): `#2a1a0e` Inter 12px
- Threshold annotations: `#545454` Inter 11px, JetBrains Mono for the ratio values
- Example marker (2.9:1): `#C8102E` (red — brand accent, calling attention to the failing value) dashed vertical rule, `stroke-dasharray="4 3"`
- Axis line: `#2a1a0e` 1px; tick marks: `#2a1a0e` 0.75px
- Source note: `#545454` Inter 10px ALL CAPS
- Grayscale check: FAIL (lightest) / AA (mid) / AAA (darker) form a clear three-step luminance ladder; the red example marker becomes darkest element in grayscale — still readable and distinct

**E — Exclusions:** No APCA / WCAG 3.0 algorithm; no non-text contrast (1.4.11); no touch-target size; no color-blind simulation; no luminance formula derivation; no sRGB linearization math; no monitor-brand.mjs code; no brand-rules.json; no full API node-walker logic; no comparison to the chapter's illustrative RGBA palette.

**Caption (draft):** WCAG 2.1 §1.4.3 defines two text categories (normal and large) and two conformance levels (AA and AAA), producing four normative thresholds; `monitor-brand.mjs` checks every text node against these exact ratios, with 2.9:1 — the chapter's opening failure — shown as a reference point in the fail zone.

**Accuracy check:** Thresholds sourced directly from WCAG 2.1 §1.4.3 and confirmed in the chapter text: normal text AA = 4.5:1, normal text AAA = 7:1, large text AA = 3:1, large text AAA = 4.5:1. Large text definition: 18pt (24px) or larger for regular weight; 14pt (approximately 18.67px) or larger for bold (700+). The chapter's example failure (2.9:1) is stated explicitly in the opening paragraph. WCAG 2.2 made no changes to §1.4.3 contrast requirements. No fabricated thresholds.

---

## Figure 11.2 — Compliance Diff: Baseline vs. Current Run

**Suggested filename:** `11-compliance-diff-panels.svg`

**Figure type:** Comparison panels (before/after mapped to a shared axis)

**One-sentence concept:** Running `monitor-brand.mjs` twice and diffing the outputs shows whether the design file is getting cleaner or dirtier — new findings appear in one column, resolved findings in the other.

**S — Specification:** Single-column textbook, 89mm–120mm print width; 300 DPI vector (SVG); viewBox 700 × 400; Brutalist D3 palette. Two-panel layout sharing a vertical center divider.

**C — Content:** Seven labeled elements across two panels:
1. **Left panel header** — "Baseline run" with timestamp placeholder
2. **Right panel header** — "Current run" with timestamp placeholder
3. **Left panel content** — Summary row: "47 findings / 12 errors / 28 warnings / 7 info"; three representative finding rows (contrast-failure, hardcoded-unapproved-color, off-scale-spacing) with severity tags
4. **Right panel content** — Summary row: "31 findings / 4 errors / 22 warnings / 5 info"
5. **Diff callout (center spine)** — "16 resolved ↑ / 0 new" labeled at the divider
6. **Resolved indicator** — green-equivalent (gray in grayscale) arrow or badge on resolved findings in the right panel
7. **Key artifact label** — "`compliance-diff.json`" labeled below the diff callout

**O — Organization:** Two equal-width vertical panels side by side, separated by a 2px ink divider. Panel headers sit at the top of each panel. Within each panel, a compact summary row then three finding-row items. The center divider has a two-directional annotation showing resolved count and new count — this is the "diff spine." The artifact label appears at the bottom of the divider. Shared x-reference is the finding categories (contrast / color / spacing), which appear in both panels aligned horizontally.

**P — Presentation:**
- Canvas: `#FFFFFF`
- Panel backgrounds: `#F5F5F5` (fill) — both panels same background to emphasize the diff, not the state
- Panel header bars: `#2a1a0e` (ink) fill, `#FFFFFF` text, Inter 12px 600
- Center divider: `#2a1a0e` 2px vertical rule
- Finding rows: alternating `#FFFFFF` / `#F5F5F5`, border `#D4D4D4` 1px bottom
- Severity tags: ERROR — `#2a1a0e` fill, `#FFFFFF` text; WARNING — `#545454` fill, `#FFFFFF` text; INFO — `#D4D4D4` fill, `#2a1a0e` text (all brand-neutral — red is NOT used for error state per DESIGN.md)
- Resolved indicator on right-panel rows: `#C8102E` (red) left-border accent 3px — this is the brand's primary accent, indicating the "current" state is the highlighted data series
- Diff callout: `#C8102E` red badge for resolved count, `#2a1a0e` ink badge for new count
- Artifact label: `#545454` JetBrains Mono 11px
- Grayscale: ink headers = darkest; mid-gray tags = mid; light rows = near-white; distinguishable throughout

**E — Exclusions:** No GitHub Actions YAML; no full JSON diff output; no node-level finding details; no brand-rules.json content; no API node-walker code; no WCAG threshold detail (that is Figure 11.1); no Figma canvas screenshot; no CI webhook configuration; no per-page breakdown; no touch-target findings.

**Caption (draft):** Diffing two compliance runs reveals 16 resolved findings and 0 new ones — the design is measurably cleaner; `compliance-diff.json` encodes this delta as the machine-readable record that CI stores alongside the compliance report.

**Accuracy check:** The diff mechanism is accurately described: findings keyed by `nodeId::category::issue`; a finding is resolved when the key disappears between runs; it is new when it appears without prior presence. The summary numbers (47 → 31) are illustrative but arithmetically consistent (47 − 16 = 31). The severity taxonomy (error / warning / info) matches the chapter's Decision Rules section exactly. No fabricated API behavior.

---

## Video Candidate Pass

**Figure 11.1 (WCAG threshold chart):** STATIC SUFFICIENT. The thresholds are fixed reference values, not a transition mechanism. A static band chart is the correct representation.

**Figure 11.2 (compliance diff panels):** STATIC SUFFICIENT. The before/after comparison is a spatial relationship. The concept is the delta, not the process of change — static panels communicate this correctly. A video simulating findings disappearing between runs would add motion without instructional meaning.
