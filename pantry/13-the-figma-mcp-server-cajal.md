# CAJAL Figure Plans — Chapter 13: The Figma MCP Server

Source: `chapters/13-the-figma-mcp-server.md`
Mode: /scan silent
Domain: Design systems engineering, AI coding agent governance, MCP protocol

---

## Density Recommendation

2 figures. Mechanistic density. Both concepts involve multi-actor systems with explicit permission boundaries and a human approval gate — both meet the MC (Mechanism/Process Complexity) criterion and the VG (Verification Gap) criterion. Static figures are sufficient; neither concept's learning target is the transition mechanism, so no video candidates are recommended.

---

## Zone Map

- MC: MCP session governance loop (AI agent ↔ Figma MCP server ↔ FIGMA.md permission matrix ↔ human gate) — 4+ interdependent actors and explicit decision logic.
- MC: CLI-spec context package handoff (audit.json + spec.json + tokens.json + mcp-check.md feeding the agent session, bounded by FIGMA.md) — 5+ interdependent artifacts in a staged pre-session pattern.
- VG: The REFUSE/ESCALATE boundary within FIGMA.md governance — cannot be verified from prose alone; must be shown as a structural boundary with explicit routing.

---

## Figure 13.1 — MCP Session Governance Loop

**Suggested filename:** `13-mcp-session-governance-loop.svg`

**Figure type:** Systems diagram

**One-sentence concept:** The Figma MCP server is a structured context relay between an AI coding agent and a Figma file, governed by a FIGMA.md permission matrix that routes agent actions to one of four outcomes — READ, INFER, GENERATE, or REFUSE/ESCALATE — and requires a human review gate before any generated code merges.

**S — Specification:** Full-column textbook figure; canvas 700 × 460px; 300 DPI equivalent; vector SVG. Brutalist D3 palette. Flat, no gradients, no drop shadows, no rounded corners (rx="0").

**C — Content:** Seven labeled components drawn from the chapter:

1. **AI Coding Agent** (Claude Code or equivalent) — left anchor; initiates context requests and receives generation instructions
2. **Figma MCP Server** — center relay node; fetches structured design data from the Figma file and returns it as context
3. **Figma File + Dev Mode** — right source node; supplies component metadata, style values, Code Connect mappings
4. **FIGMA.md Governance** — a distinct layer above or below the relay node; four permission bands labeled READ / INFER / GENERATE / REFUSE-or-ESCALATE, derived verbatim from the chapter's governance file structure
5. **Code Connect** — annotated as a modifier on the Figma File node; its presence/absence determines context richness
6. **Generated Code Output** — exits the agent node downward; labeled "requires human review before merge"
7. **Human Gate** — terminal node on the generated-code path; labeled with the chapter's explicit rule: "agent surfaces; engineer decides"

Arrow semantics: solid → for context flow (MCP request/response); dashed → for governance constraints (FIGMA.md bounding the agent's authority); blocked ⊣ on the REFUSE path (agent must not proceed without escalation).

**O — Organization:** Horizontal left-to-right flow for the agent ↔ MCP server ↔ Figma file data path. FIGMA.md governance rendered as a horizontal band spanning the full width above the flow, with four labeled vertical zones (READ / INFER / GENERATE / REFUSE-or-ESCALATE) that cast downward to the relevant flow segment. Generated code path drops vertically from the agent node to the Human Gate, which sits below the main horizontal lane. The REFUSE/ESCALATE branch exits the agent node with a ⊣ symbol and routes back upward toward the Human Gate with a dashed arrow labeled "flag for human review."

**P — Presentation:** Per Brutalist D3 / DESIGN.md palette:
- Canvas: `#FFFFFF`
- Structural strokes and primary labels: `#2a1a0e` (ink), 1pt stroke-width
- FIGMA.md governance band background: `#F5F5F5` (fill), border `#D4D4D4`
- READ and INFER zones: left-border accent `#C8860E` (ochre, decorative only — not data encoding)
- GENERATE zone: left-border accent `#C8102E` (red — primary brand accent, marks the authorized generation boundary)
- REFUSE-or-ESCALATE zone: filled `#F5F5F5` with ink label; blocked arrow in `#2a1a0e`
- Human Gate node: border `#C8102E` (red) with fill `#FFFFFF`, label in ink — signals the required human decision point
- Code Connect modifier on Figma File node: ochre `#C8860E` left-border callout, not a separate fill
- Generated Code Output path: dashed `stroke-dasharray="4 3"` in `#545454` (secondary), labeled in secondary text
- All box borders: `#D4D4D4` 1px; fill `#FFFFFF`
- Grayscale check: governance band (#F5F5F5) distinguishes from canvas (#FFFFFF); Human Gate red border reads as darkest accent in grayscale (~L*25); REFUSE block readable in secondary gray at ~L*36

**E — Exclusions:**
- Do not show the specific MCP protocol wire format or HTTP/JSON envelope — this is transport detail below the figure's scope
- Do not show the local vs. remote server distinction — covered in chapter prose, not needed for the governance concept
- Do not show `figma-ping.js` preflight — that is the subject of Figure 13.2
- Do not show Code Connect file syntax or TypeScript API — the figure shows its presence/absence as a structural modifier, not its implementation
- Do not show specific Figma API endpoints or rate limits
- Do not show multiple agent types (Claude Code, Cursor, Windsurf) — one generic "AI Coding Agent" node sufficient
- Do not show the plan/seat requirement (Dev Mode) — out of scope for the governance diagram

**Caption (draft):** The Figma MCP server relays structured design context from a governed Figma file to an AI coding agent; the FIGMA.md permission matrix defines what the agent may read, infer, generate, or refuse, and every code output requires human review before it merges.

**Accuracy check (figure-checker):** Data-flow direction is confirmed by chapter: agent initiates context request → MCP server fetches from Figma → context returned to agent → agent generates code. The four-quadrant permission structure (READ / INFER / GENERATE / REFUSE-or-ESCALATE) is verbatim from the FIGMA.md example in the chapter. The Human Gate rule ("agent surfaces; engineer decides") is stated explicitly in the chapter's governance and closing sections. Code Connect's role as a context multiplier (presence/absence changes context richness) is confirmed in the "Code Connect: The Multiplier" section. No MCP behavior is fabricated; the REFUSE path correctly uses the chapter's own ESCALATE language rather than implying automatic blocking. The human-approval gate is shown at the terminal output node.

---

## Figure 13.2 — CLI-Spec Context Package: Pre-Session Handoff

**Suggested filename:** `13-cli-spec-context-handoff.svg`

**Figure type:** Process flowchart

**One-sentence concept:** Before an MCP session begins, four pre-verified CLI-generated files — audit.json, spec.json, tokens.json, and mcp-check.md — are assembled into a context package that feeds the AI agent alongside the live MCP server connection, with FIGMA.md bounding what the agent may do with that context.

**S — Specification:** Full-column textbook figure; canvas 700 × 380px; 300 DPI equivalent; vector SVG. Brutalist D3 palette. Flat, no gradients, no rounded corners (rx="0").

**C — Content:** Six labeled components drawn directly from the chapter's "CLI-to-Agent Handoff" section:

1. **CLI Pipeline** — left origin block; runs four commands in sequence: `figma-audit.js --output json`, `build-spec.mjs --output json`, `extract-tokens.mjs --output json`, `figma-audit.js --mcp-check`
2. **audit.json** — artifact 1; file health and naming violations
3. **spec.json** — artifact 2; machine-readable component specification
4. **tokens.json** — artifact 3; current token values
5. **mcp-check.md** — artifact 4; session preflight and Code Connect coverage
6. **AI Agent Session** — right destination block; receives all four artifacts as static context plus the live MCP server connection; FIGMA.md governs what the agent is authorized to do with the combined context

Arrow semantics: solid → for artifact delivery (CLI output → agent input); one additional dashed → from FIGMA.md entering the agent session node from above, labeled "governance bounds."

**O — Organization:** Left-to-right horizontal process flow. CLI Pipeline block on the far left, emitting four labeled artifact nodes in a vertical column. All four artifact arrows converge into the AI Agent Session block on the right. A separate "MCP Server (live)" node enters the agent session block from below (or from a right angle) to show it combines with the static artifacts. FIGMA.md enters from above as a dashed governance constraint. The flow reads: CLI runs → artifacts verified → agent session opens → FIGMA.md bounds the session → agent generates with combined context.

**P — Presentation:** Per Brutalist D3 / DESIGN.md palette:
- Canvas: `#FFFFFF`
- CLI Pipeline block: fill `#F5F5F5`, border `#D4D4D4`, label in `#2a1a0e`
- Four artifact nodes: fill `#FFFFFF`, border `#D4D4D4`, label in `#2a1a0e` (ink); monospace font (JetBrains Mono) for the filename labels
- AI Agent Session block: fill `#FFFFFF`, border `#C8102E` (red — primary block, the destination), label in `#2a1a0e`
- MCP Server (live) node: fill `#F5F5F5`, border `#D4D4D4`, secondary label in `#545454`
- FIGMA.md governance: dashed border box in `#C8860E` (ochre, decorative), entering from above; label in `#545454`
- Arrows: `#2a1a0e`, 1.5pt stroke; dashed `stroke-dasharray="4 3"` for governance constraint only
- Grayscale check: agent session block (red border, L*~25) is the darkest accent and serves as the visual destination anchor; all boxes distinguishable by fill (fill vs. white) in grayscale

**E — Exclusions:**
- Do not show the specific syntax of each CLI command — the figure labels the artifact, not the command string
- Do not show the content of the artifact files (JSON keys, token values, coverage percentages) — those belong in the chapter's code blocks
- Do not show the MCP wire protocol or HTTP layer
- Do not show a specific agent UI (Claude Code interface, terminal) — keep the agent block abstract
- Do not show the output of the agent session (generated code) — that is the domain of Figure 13.1
- Do not show Code Connect file authoring — this figure is about pre-session context delivery, not Code Connect maintenance
- Do not show error/failure paths — this figure shows the nominal pre-session setup; failure paths are in the chapter's Failure Modes section

**Caption (draft):** Before each MCP session, the CLI pipeline generates four pre-verified context files — audit, spec, tokens, and preflight report — that feed the agent alongside the live MCP connection; FIGMA.md governs what the agent is authorized to do with the combined context.

**Accuracy check (figure-checker):** The four artifact names (audit.json, spec.json, tokens.json, mcp-check.md) and their generating commands are verbatim from the chapter's "CLI-to-Agent Handoff" section. The pattern of combining static CLI artifacts with live MCP context is stated explicitly: "This handoff pattern combines the real-time context retrieval of MCP with the verified, fixture-stable context from your CLI pipeline. The agent gets both." The FIGMA.md governance constraint is confirmed as the authority-bounding document throughout the chapter. No fabricated MCP behavior appears; the figure shows the pre-session setup, not live MCP protocol interactions. The human-approval gate appears in Figure 13.1 (not duplicated here, which is correct — this figure is about input context, not output review).

---

## Video Candidate Pass

**Figure 13.1 (MCP Session Governance Loop):** STATIC SUFFICIENT. The governance loop's states (READ / INFER / GENERATE / REFUSE) are structurally distinct and learnable from a static systems diagram with clearly labeled boundaries. The transition mechanism (which permission band routes which agent action) is defined by policy, not by a dynamically unfolding process — static panels allow self-paced inspection. No video candidate.

**Figure 13.2 (CLI-Spec Context Handoff):** STATIC SUFFICIENT. The handoff is a pre-session preparation sequence with four stable artifacts and a single destination. The stages build left-to-right in a direction a static flowchart communicates clearly. No video candidate.
