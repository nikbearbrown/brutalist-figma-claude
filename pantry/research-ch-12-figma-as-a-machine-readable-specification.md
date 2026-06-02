# Research: Chapter 12 — Figma as a Machine-Readable Specification
## Brutalist Figma + Claude

**Chapter one-line:** Structure Figma data for machine consumers that need completeness rather than human-readable summaries.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma file endpoints. Source: https://developers.figma.com/docs/rest-api/file-endpoints/
2. Figma variables endpoints. Source: https://developers.figma.com/docs/rest-api/variables-endpoints/
3. Figma Code Connect docs/help. Source: https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect
4. Design Tokens Community Group format.
5. JSON Schema documentation.
6. Style Dictionary docs.
7. MCP specification/docs.
8. Anthropic Claude Code and MCP docs.
9. Code generation and schema design sources.
10. Design system component specification examples.

## 2. Core Concept — State of the Field

Human documentation compresses; machine specifications preserve structure. A CLI or coding agent needs complete alias chains, mode values, layout rules, variant mappings, node IDs, and code links.

## 3. Application Domain Examples

1. Component spec JSON.
2. Token alias graph.
3. Variant property schema.
4. Layout constraints.
5. Code Connect annotations.

## 4. Book's Thesis Connection

This is the thesis at its most explicit: the canvas becomes usable by machines only when extraction preserves structure.

## 5. AI Wayback Machine — Candidate Figures

1. API schemas.
2. OpenAPI/JSON Schema.
3. DTCG tokens.
4. Codegen specifications.

## 6. Pedagogical Delivery Research

Compare a human component page with a full machine spec for the same component.

## 7. Representation and Display Research

Checklist:

- Consumer identified?
- Schema defined?
- Alias chains complete?
- Variants mapped?
- Code generator requirements met?

## 8. Open Questions and Research Gaps

1. Draft example component spec schema.
2. Decide whether to use JSON Schema formally.
3. Include size/performance warnings for full-file specs.
