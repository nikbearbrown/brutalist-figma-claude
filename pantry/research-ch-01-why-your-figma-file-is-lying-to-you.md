# Research: Chapter 01 — Why Your Figma File Is Lying to You
## Brutalist Figma + Claude

**Chapter one-line:** Manual design handoff fails because production and Figma become unsynchronized copies of the same decision.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma Developer Docs, REST API overview and file endpoints. Source: https://developers.figma.com/docs/rest-api/
2. Figma file endpoints documentation. Source: https://developers.figma.com/docs/rest-api/file-endpoints/
3. Figma Dev Mode guide. Source: https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode
4. Figma Code Connect overview. Source: https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect
5. Design Tokens Community Group format. Source: https://tr.designtokens.org/format/
6. Style Dictionary documentation. Source: https://styledictionary.com/
7. Brad Frost, design systems and atomic design.
8. Nathan Curtis, design system governance and tokens writing.
9. Nielsen Norman Group, design system and handoff guidance.
10. Anthropic Claude Code overview for AI-assisted implementation context. Source: https://docs.anthropic.com/en/docs/claude-code/overview

## 2. Core Concept — State of the Field

The design-development gap is not only a communication failure. It is a synchronization failure between a design source of truth and production code.

The stable framing is: Figma is a structured document graph, while screenshots, exports, and copied token files are snapshots. Snapshots drift unless extraction and validation are automated.

## 3. Application Domain Examples

1. Color token changed in Figma but stale CSS remains in production.
2. Icon manually exported once and never updated.
3. Component variant renamed without downstream code mapping.
4. `tokens_final_v3_really_final.json` as unmanaged design-source copy.
5. AI coding agent generates plausible UI that ignores the real design system.

## 4. Book's Thesis Connection

This chapter grounds the book's extraction-layer thesis: if the file is the source of truth, the work is getting decisions out reliably.

## 5. AI Wayback Machine — Candidate Figures

1. Photoshop/Sketch handoff era.
2. Zeplin/Inspect-style handoff tools.
3. Early design-token pipelines.
4. Figma Dev Mode and Code Connect.

## 6. Pedagogical Delivery Research

Open with a drift story: a designer changes brand blue, production keeps the old blue, and nobody notices until a release review.

## 7. Representation and Display Research

Checklist:

- Source of truth identified?
- Snapshot copies named?
- Drift failure visible?
- Manual export boundary clear?
- Pipeline need motivated before code appears?

## 8. Open Questions and Research Gaps

1. Add one concrete team-scale drift case study.
2. Decide whether to include screenshots of Figma versus generated token files.
3. Clarify when manual export is still acceptable.
