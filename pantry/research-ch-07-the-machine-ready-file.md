# Research: Chapter 07 — The Machine-Ready File
## Brutalist Figma + Claude

**Chapter one-line:** Define what a Figma file must contain before a production pipeline can trust it.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma file endpoints. Source: https://developers.figma.com/docs/rest-api/file-endpoints/
2. Figma variables endpoints. Source: https://developers.figma.com/docs/rest-api/variables-endpoints/
3. Figma Code Connect overview. Source: https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect
4. Figma Dev Mode guide. Source: https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode
5. Design Tokens Community Group format.
6. Style Dictionary docs.
7. Design system governance sources.
8. WCAG accessibility guidance.
9. Documentation-as-code practices.
10. Anthropic Claude Code docs for project governance files.

## 2. Core Concept — State of the Field

A machine-ready file has consistent naming, documented components, published libraries, healthy variables, stable export targets, accessibility metadata where possible, and a governance document explaining what automation may do.

## 3. Application Domain Examples

1. Primitive/semantic/component variable collections.
2. Component descriptions.
3. Published component library.
4. Exportable icon frames.
5. `FIGMA.md` automation contract.

## 4. Book's Thesis Connection

This chapter defines the standard that makes the later extraction chapters possible.

## 5. AI Wayback Machine — Candidate Figures

1. Definition of done.
2. Design system readiness checklist.
3. README/governance file.
4. CI preflight checks.

## 6. Pedagogical Delivery Research

Give readers a before/after checklist: messy file, audited file, machine-ready file.

## 7. Representation and Display Research

Checklist:

- Naming contract passed?
- Variables organized?
- Components documented?
- Publication state correct?
- Automation permissions declared?

## 8. Open Questions and Research Gaps

1. Draft a canonical `FIGMA.md`.
2. Decide whether readiness score should be numeric.
3. Add onboarding workflow for designers.
