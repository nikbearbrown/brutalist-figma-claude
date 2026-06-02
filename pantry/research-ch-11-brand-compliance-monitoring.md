# Research: Chapter 11 — Brand Compliance Monitoring
## Brutalist Figma + Claude

**Chapter one-line:** Monitor large Figma files for brand, token, and accessibility drift with actionable reports.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma file endpoints. Source: https://developers.figma.com/docs/rest-api/file-endpoints/
2. Figma variables endpoints. Source: https://developers.figma.com/docs/rest-api/variables-endpoints/
3. WCAG contrast and accessibility guidance. Source: https://www.w3.org/WAI/standards-guidelines/wcag/
4. Brand/design system governance literature.
5. Color contrast algorithms and APCA/WCAG discussions.
6. Design token taxonomy sources.
7. CI report formatting practices.
8. NIST AI RMF for monitoring and governance.
9. Accessibility testing tools concepts.
10. Anthropic Claude Code docs for audit/report workflow.

## 2. Core Concept — State of the Field

Compliance monitoring scales design review by detecting hardcoded colors, off-scale typography, spacing drift, contrast failures, and missing metadata.

The report must be actionable: grouped, severity-coded, and diffable across runs.

## 3. Application Domain Examples

1. Off-brand color.
2. Non-token font size.
3. Contrast failure.
4. Interactive target too small.
5. Thousands-object summary with prioritized errors.

## 4. Book's Thesis Connection

Machine-readable Figma enables governance, not just export. The file can be monitored like code.

## 5. AI Wayback Machine — Candidate Figures

1. Brand guideline checklists.
2. Accessibility audits.
3. Lint reports.
4. Design system health metrics.

## 6. Pedagogical Delivery Research

Run before/after compliance reports and compare the diff so readers see measurable improvement.

## 7. Representation and Display Research

Checklist:

- Brand rules encoded?
- Contrast checked?
- Findings grouped by page/object?
- Severity meaningful?
- Report actionable at scale?

## 8. Open Questions and Research Gaps

1. Decide how much WCAG algorithm detail to include.
2. Add sample report format.
3. Include caveat: audits cannot infer all design intent.
