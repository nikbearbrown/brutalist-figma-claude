# CAJAL Figure Plans — Chapter 4: Naming as an API Contract

Source: `chapters/04-naming-as-an-api-contract.md` + `pantry/research-ch-04-naming-as-an-api-contract.md`
Mode: /scan silent
Domain: Figma API, design tokens, design-to-code pipeline

---

## Density Recommendation

2 figures. Mechanistic density. Both concepts require visual grounding: the transformation chain is a multi-step process that text cannot make concrete for a reader who has not yet run the pipeline; the three-tier hierarchy is a structural claim that a reader needs to see as a tree before the naming rules make sense.

---

## Zone Map

- MC: The slash-notation transformation chain (Figma name → Style Dictionary parse → CSS/Swift/Android outputs). Four interdependent stages, deterministic and sequential.
- VG: The three-tier token hierarchy (primitive / semantic / component). A nested structure asserted in prose but not shown — the reader cannot verify depth, alias direction, or ownership from text alone.
- PQ: None. No quantitative data in this chapter.

---

## Figure 4.1 — The Naming Transformation Chain

**Suggested filename:** `04-naming-transformation-chain.svg`
**Figure type:** Process flowchart
**One-sentence concept:** A Figma variable name travels through four deterministic transformation stages to produce platform-specific identifiers in CSS, Swift, and Android XML simultaneously.

**S — Specification:** Single-column, full-bleed textbook width (170mm), 300 DPI, vector SVG. viewBox 700 × 420. Canvas: white `#FFFFFF`. 32px margin all sides.

**C — Content:** Six labeled items across two rows.

Row 1 — the transformation pipeline (left to right, connected by arrows):
1. **Figma variable** — the source name string: `color/brand/primary` with value `#0066ff`
2. **REST API** — `name` property returned as-is; no transformation
3. **Style Dictionary parse** — slash path split into nested object `{ color: { brand: { primary: … } } }`
4. **Platform formatters** — three parallel branches fan out

Row 2 (three output branches below the platform formatter node):
5. **CSS** — `--color-brand-primary: #0066ff`
6. **Swift** — `colorBrandPrimary`
7. **Android XML** — `color_brand_primary`

Arrow semantics: solid arrows `→` for forward progression. The fan-out from Platform formatters to the three outputs uses three parallel arrows diverging downward.

**O — Organization:** Left-to-right horizontal flow for stages 1–4. Vertical fan-out at stage 4 into three parallel output nodes below. Stage labels sit above each node box. Output language labels (CSS / Swift / Android) sit inside or below each output node. Total width is divided into four equal columns for stages 1–4; the output column is subdivided into three stacked rows. No branching before stage 4.

**P — Presentation:**
- Node boxes: `stroke="#D4D4D4"` `stroke-width="1"` `fill="#F5F5F5"` (structural, neutral)
- Figma source node (stage 1): `fill="#F5F5F5"` with `stroke="#2a1a0e"` `stroke-width="1.5"` — primary structural anchor, slightly emphasized
- Platform output nodes (CSS / Swift / Android): `fill="#FFFFFF"` `stroke="#C8102E"` `stroke-width="1.5"` — brand-red border marks these as the contract endpoints, the reader's destination
- Arrows: `stroke="#2a1a0e"` `stroke-width="1.5"`, arrowhead polygon per SVG style guide
- Stage labels: Inter, 12px, `#2a1a0e`
- Code strings inside nodes: JetBrains Mono, 11px, `#545454`
- Grayscale check: red-border output nodes render as dark-gray border — distinguishable from neutral `#D4D4D4` border nodes at L* ~25 vs ~84

**E — Exclusions:**
- The bad-name parallel (e.g., `Brand Blue` → `--brand-blue`) — that belongs to a callout or prose, not this figure; showing both paths would require 12+ labeled items
- Token Studio, W3C DTCG format references — upstream ecosystem context, not part of this flow
- JavaScript/TypeScript dot-chained output — a fourth platform output would push labeled items to 8+ fan-out nodes; omit; prose covers it
- Alias resolution mechanics — this figure shows name transformation only, not value resolution
- The `naming.config.js` code structure — a code block, not a figure concept
- Any visual styling of the Figma UI or editor chrome

**Caption (draft):** A well-formed Figma variable name passes through four deterministic stages — REST API, parser, platform formatters — and lands as a valid, role-communicating identifier on every target platform simultaneously.

**Accuracy check (figure-checker):**
- The REST API returns the variable `name` field as-is — the figure must not show any transformation at the API stage; the arrow from Figma to REST API is pass-through with label "name property returned unchanged"
- Style Dictionary's parse step produces a nested JavaScript object, not a flat list; the node must show the nested object shape `{ color: { brand: { primary: { $value } } } }`, not a flat key-value pair
- CSS output uses double-dash prefix `--color-brand-primary` (CSS custom property syntax); Swift uses lowerCamelCase with no separator; Android XML uses `color_brand_primary` (snake_case in `<color name="">`) — all three must be exact, not approximated
- The fan-out from Platform formatters is simultaneous (one source, three outputs), not sequential — the figure must not imply a CSS → Swift → Android ordering

---

## Figure 4.2 — The Three-Tier Token Hierarchy

**Suggested filename:** `04-three-tier-token-hierarchy.svg`
**Figure type:** Hierarchy / tree
**One-sentence concept:** Design tokens occupy three tiers — primitive, semantic, component — where each tier aliases the one above it, and only the semantic tier is consumed by product code.

**S — Specification:** Single-column textbook width (170mm), 300 DPI, vector SVG. viewBox 700 × 480. Canvas: white `#FFFFFF`. 32px margin all sides.

**C — Content:** Three-tier vertical tree, top to bottom, with 2–3 example nodes per tier (≤8 total labeled items).

**Tier 1 — Primitive** (top):
- `color/palette/blue-500` → `#0066ff`
- `spacing/scale/8` → `8px`

**Tier 2 — Semantic** (middle):
- `color/brand/primary` → alias: `{color.palette.blue-500}`
- `spacing/component/gap` → alias: `{spacing.scale.8}`
- Label: "Product code consumes this tier"

**Tier 3 — Component** (bottom, optional tier noted):
- `color/button/background/default` → alias: `{color.brand.primary}`
- Label: "Per-component overrides only"

Alias arrows: dashed downward arrows from semantic nodes to their primitive targets, and from component nodes to their semantic targets. Alias direction is upward in the conceptual model (component → semantic → primitive), so arrows point upward to indicate "references."

**O — Organization:** Three horizontal bands, stacked vertically. Each band is labeled with the tier name and its role description (1–2 words). Within each band, nodes are laid out horizontally. Dashed upward-pointing arrows (alias references) connect component → semantic → primitive. A vertical dashed divider between Tier 2 (semantic) and Tier 3 (component) carries the annotation "Tier 3 optional." Labels sit above each tier band.

**P — Presentation:**
- Tier band backgrounds: Tier 1 `fill="#F5F5F5"` (primitive, neutral infrastructure); Tier 2 `fill="#FFFFFF"` with `stroke="#C8102E"` `stroke-width="1"` on tier border (brand-red marks semantic tier as the contract layer and product-code consumption point); Tier 3 `fill="#F5F5F5"` (component, neutral)
- Node boxes within tiers: `fill="#FFFFFF"` `stroke="#D4D4D4"` `stroke-width="1"` on all tiers
- Alias arrows: `stroke-dasharray="4 3"` `stroke="#2a1a0e"` `stroke-width="1"` with upward arrowhead
- Tier labels (e.g., "Tier 1 — Primitive"): EB Garamond, 14px, `#2a1a0e`
- Token name strings inside nodes: JetBrains Mono, 11px, `#545454`
- Role annotation on Tier 2 border ("Product code consumes this tier"): Inter, 11px, `#C8102E`
- Grayscale check: brand-red Tier 2 border renders at L* ~25 — clearly darker than `#D4D4D4` node borders at L* ~84

**E — Exclusions:**
- Multi-mode (light/dark) variable values — a mode-specific concern, not hierarchy structure
- The full list of approved categories (`color`, `spacing`, `typography`, etc.) — belongs in the naming config table, not this hierarchy figure
- Component names (`Button/Primary/Default`) — a separate naming system, not token hierarchy
- Style Dictionary parse mechanics — shown in Figure 4.1
- The alias chain problem failure mode — prose covers this; adding failure states to this figure would push item count above 8
- Any platform output (CSS/Swift/Android) — Figure 4.1 covers that

**Caption (draft):** Three tiers — primitive, semantic, component — form the token stack; alias references flow upward, product code consumes only the semantic tier, and a brand color change propagates automatically by updating a single primitive.

**Accuracy check (figure-checker):**
- Alias arrows must point from lower tier to upper tier (component → semantic → primitive), not downward; alias references in the DTCG model are upward references, not inheritance chains flowing down
- The semantic tier alias must show the `{color.palette.blue-500}` dot-notation format (DTCG format) rather than a slash path, since alias references use dot notation in Style Dictionary and the DTCG spec
- The Tier 3 "optional" annotation must be visually subdued relative to Tier 1 and Tier 2 to avoid implying all design systems require component tokens
- Primitive tokens must be shown as holding direct values (hex, px), not aliases — the figure must not show primitives aliasing anything

---

## Video Candidate Pass

**Figure 4.1 — The Naming Transformation Chain**
Status: STATIC SUFFICIENT
Criterion not met: the transformation is deterministic and the before/after states (source name → three output identifiers) are legible in a single static panel. The mechanism of change (string splitting and case conversion) does not require animation to understand — it is a rule, not a transition the reader needs to observe in motion.

**Figure 4.2 — The Three-Tier Token Hierarchy**
Status: STATIC SUFFICIENT
Criterion not met: the alias chain is a structural relationship, not a temporal process. A reader can inspect the tree at their own pace; animation adds no instructional value over a well-labeled static tree.

Video candidates identified: 0. Both figures are well-served by static treatment.
