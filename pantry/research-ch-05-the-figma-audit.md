# Research: Chapter 05 — The Figma Audit
## Brutalist Figma + Claude

**Chapter one-line:** Audit a Figma file programmatically before trusting it as a pipeline source.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma file endpoints. Source: https://developers.figma.com/docs/rest-api/file-endpoints/
2. Figma variables endpoints. Source: https://developers.figma.com/docs/rest-api/variables-endpoints/
3. WCAG contrast and accessibility guidelines. Source: https://www.w3.org/WAI/standards-guidelines/wcag/
4. Figma rate limits documentation. Source: https://developers.figma.com/docs/rest-api/rate-limits/
5. Design Tokens Community Group format.
6. Style Dictionary validation patterns.
7. axe/accessibility audit concepts.
8. Design system governance sources.
9. JSON report design and CI linting practices.
10. Anthropic Claude Code docs for audit workflow handoffs.

## 2. Core Concept — State of the Field

An audit turns a design file into a set of machine-checkable findings: naming, token hygiene, component hygiene, brand compliance, accessibility risks, and structural completeness.

Good audit output is both human-readable and machine-readable, with severity levels that distinguish pipeline-breaking errors from improvement opportunities.

## 3. Application Domain Examples

1. Missing token descriptions.
2. Hardcoded off-brand color.
3. Low text/background contrast.
4. Component without variant documentation.
5. Export layer missing stable name.

## 4. Book's Thesis Connection

The audit is the bridge from "Figma is the source of truth" to "this file is trustworthy enough for machines."

## 5. AI Wayback Machine — Candidate Figures

1. Linters.
2. Accessibility scanners.
3. CI test reports.
4. Design system health dashboards.

## 6. Pedagogical Delivery Research

Run the audit before and after fixes. Let readers see that the pipeline is built on file quality, not hope.

## 7. Representation and Display Research

Checklist:

- Audit categories defined?
- Findings actionable?
- Severity levels useful?
- JSON and markdown output generated?
- Limitations stated?

## 8. Open Questions and Research Gaps

1. Define exact audit rule set for first implementation.
2. Add examples of false positives/false negatives.
3. Decide whether to include a CI gate.
