# CAJAL Figure Plans — Chapter 6: Fixing the File with the Plugin API

Source: `chapters/06-fixing-the-file-with-the-plugin-api.md` + `pantry/research-ch-06-fixing-the-file-with-the-plugin-api.md`
Mode: /scan silent
Domain: Figma Plugin API, design system remediation, human-in-the-loop automation

---

## Density Recommendation

1 figure. Mechanistic density. The staged remediation flow is the chapter's central structural claim — Load → Preview → Human Approval gate → Apply — and it requires a figure because the approval gate is not a metaphor but an architectural feature whose position in the flow determines what can and cannot be undone. The Plugin API two-process model (sandbox ↔ UI iframe) is a second candidate but is adequately covered by the prose diagram and would require a second figure that stays below 8 components only by omitting the message-passing detail that makes it useful. Flagged below.

---

## Zone Map

- MC: The staged Plugin API remediation flow — four phases in strict sequence with a blocking gate between Preview and Apply. The gate is the mechanism, not the UI. Three-plus interdependent stages.
- VG: The two-process Plugin API model (sandbox ↔ UI iframe via postMessage) — a spatial and architectural claim about what code runs where, asserted in prose but not shown. Borderline: the ASCII diagram in the chapter partially grounds it. Assessed as SUPPLEMENTARY; omitted from this plan (see note below).
- PQ: None. No quantitative data.

---

## Complexity note — two-process model

The Plugin API sandbox ↔ UI iframe communication model is a genuine verification gap (the chapter's ASCII art is functional but not publication-quality). However, a figure showing sandbox, iframe, `figma.ui.postMessage()`, `parent.postMessage()`, figma.* API access, and browser API access would require 7–8 labeled items before adding the message payloads (`APPLY_FIXES`, `APPLY_RESULTS`) that make it useful. Adding those payloads pushes the count to 10+. The natural split point is: (a) a topology figure showing just the two processes and their communication channel, and (b) a message-sequence figure showing the three-phase payload flow. Neither alone is as useful as both together, and producing two figures for one supporting concept violates the chapter's density. Decision: do not plan this figure. The prose ASCII diagram is sufficient for the architectural point; the remediation flow figure (5.1) is where the chapter's teaching energy belongs.

---

## Figure 6.1 — The Staged Plugin Remediation Flow

**Suggested filename:** `06-plugin-remediation-flow.svg`
**Figure type:** Process flowchart
**One-sentence concept:** The fix plugin enforces a strict three-phase sequence — Load, Preview, and Apply — where the Human Approval gate between Preview and Apply is an architectural requirement, not a UX choice, because Figma provides no batch-undo for plugin writes.

**S — Specification:** Full-bleed textbook width (170mm), 300 DPI, vector SVG. viewBox 700 × 460. Canvas: white `#FFFFFF`. 32px margin all sides.

**C — Content:** Seven labeled components. Left-to-right horizontal flow.

1. **Load** — "Read `audit-report.json`. Parse fix proposals. No writes."
2. **Preview** — "Render proposed changes per finding. Approve / Reject each. No writes."
3. **Human Approval Gate** — "User clicks 'Apply Approved Changes'. Explicit confirmation dialog." (visually emphasized — see Presentation)
4. **Apply** — "Write approved changes to canvas via `figma.variables.*` and `figma.getNodeByIdAsync()`. Immediate. Multiplayer-visible."
5. **Results** — "Log applied / failed counts. Emit fix-log JSON."

Two branches off the Human Approval Gate:
6. **Approved → Apply** (forward arrow, solid)
7. **Rejected → end / close** (a short downward branch with a terminal node: "Rejected changes discarded. Plugin closes.")

Total labeled components: 7 (5 main nodes + 2 gate outcomes).

Arrow semantics:
- Solid `→` for progression through Load → Preview → Gate → Apply → Results
- Gate-to-Apply: double-width solid arrow, labeled "Approved" — the approved path is the critical path
- Gate-to-discard: thin solid arrow pointing downward with ⊣ terminator, labeled "Rejected" — blocked/terminal

**O — Organization:** Five primary nodes in a strict horizontal left-to-right sequence. The Human Approval Gate is the center node and occupies 1.5× the horizontal width of the other nodes — it is the largest element on the canvas. The Rejected branch drops vertically downward from the gate to a small terminal node below the main flow line. The Approved path continues rightward. All five main nodes sit on a single horizontal baseline. The gate node's enlarged size is the primary visual signal of its importance; no additional visual decoration beyond border treatment.

**P — Presentation:**
- Load and Preview nodes: `fill="#F5F5F5"` `stroke="#D4D4D4"` `stroke-width="1"` — neutral read-only phases
- Human Approval Gate node: `fill="#FFFFFF"` `stroke="#C8102E"` `stroke-width="2.5"` — brand-red border, heavier stroke weight (2.5px vs 1px elsewhere), 1.5× width — visually dominant; this is the architectural pivot of the chapter
- Apply and Results nodes: `fill="#F5F5F5"` `stroke="#2a1a0e"` `stroke-width="1.5"` — slightly emphasized to indicate these nodes are the write phase; darker border than read-phase nodes
- Approved arrow (Gate → Apply): `stroke="#2a1a0e"` `stroke-width="2"` — heavier than other arrows, label "Approved" in Inter 11px `#2a1a0e`
- Rejected branch arrow: `stroke="#2a1a0e"` `stroke-width="1"` with ⊣ terminator; label "Rejected" in Inter 11px `#545454`
- Phase labels below each node ("Phase 1 — Load", "Phase 2 — Preview", etc.): Inter, 10px, `#545454`
- Node header text: Inter, 12px, `#2a1a0e`
- Node sub-label text: Inter, 10px, `#545454`
- "No writes" annotation appears in both Load and Preview nodes as a sub-label — same 10px Inter `#545454`; this is the negative contract the figure makes explicit
- Grayscale check: brand-red gate border at L* ~25, ink Apply/Results borders at L* ~10, neutral Load/Preview borders at L* ~84 — three distinct luminance bands; all distinguishable without color

**E — Exclusions:**
- The Plugin API two-process model (sandbox ↔ iframe) — a separate architectural concept, not part of the remediation flow; see complexity note above
- The `generateFixes()` logic (which ruleIds are auto-fixable vs. manual) — internal to Preview, not a flow stage
- The backup pattern (version history snapshot before running) — a prerequisite, not a stage in the plugin flow itself; prose covers it in the Decision Rules section
- The `APPLY_FIXES` and `APPLY_RESULTS` postMessage payload shapes — message-level detail, not flow topology
- The multiplayer collision failure mode — a risk annotation, not a flow stage
- Any representation of the Figma canvas or editor UI — the plugin operates on the document model, not the visual canvas

**Caption (draft):** The fix plugin enforces three phases in order — Load, Preview, Apply — with a Human Approval gate that cannot be bypassed: no variable is renamed, no description is set, and no canvas state changes until a user explicitly confirms the approved list.

**Accuracy check (figure-checker):**
- "No writes" must be asserted in both Load and Preview nodes — the chapter states explicitly that "No write happens in Phase 1 or Phase 2"; a figure that omits this annotation implies writes might occur in those phases
- The Apply phase writes via `figma.variables.*` (for variable renames and descriptions) and `figma.getNodeByIdAsync()` (for component descriptions) — the node label should reflect both write paths without inventing a third one
- The gate is triggered by a user click on "Apply Approved Changes" plus an explicit `confirm()` dialog — the figure's gate node must reflect that two user interactions are required (button click + dialog confirmation), not one
- The Rejected outcome is a terminal state (changes discarded, plugin can be closed or reused) — the figure must not show Rejected looping back to Preview as if rejection triggers a re-edit cycle; the chapter does not describe that behavior
- The Results node emits a fix-log JSON — this is a write to the UI layer (download), not a write to the Figma canvas; the figure must distinguish these by labeling Results as "log emit" rather than a canvas write

---

## Video Candidate Pass

**Figure 6.1 — The Staged Plugin Remediation Flow**
Status: VIDEO CANDIDATE (assessed; not recommended for production)
Criterion met: Three sequential causal stages where the gate transition — a user action that enables the Apply phase — could benefit from showing the state change animated: the Apply button becoming active, the confirmation dialog appearing, the canvas nodes updating. The transition from Preview to Apply is the learning target.

However: the chapter's pedagogical goal is to make the reader understand the gate as an architectural requirement, not to demonstrate the UI interaction. The gate is a design constraint, not a user experience moment. Static panels with "No writes" labels and the emphasized gate node communicate the constraint more durably than an animation of the UI state change. Animation here risks teaching the interaction pattern (button → dialog → changes) rather than the architectural reason (write is consequential, preview is the only safe review surface).

Recommendation: Static sufficient for the book. If a supplementary media asset is produced, a looping animation showing Preview → Gate activation → Apply with "No writes" annotation fading out on Apply is the right format. Not recommended as the chapter's one video slot.

Video candidates identified: 1 (assessed, not recommended for production). No video production recommended for Chapter 6.
