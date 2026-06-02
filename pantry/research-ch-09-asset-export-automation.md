# Research: Chapter 09 — Asset Export Automation
## Brutalist Figma + Claude

**Chapter one-line:** Export icons and graphics from Figma to code without relying on humans to remember every update.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma image/file endpoints. Source: https://developers.figma.com/docs/rest-api/file-endpoints/
2. Figma rate limits docs. Source: https://developers.figma.com/docs/rest-api/rate-limits/
3. Figma webhooks docs. Source: https://developers.figma.com/docs/rest-api/webhooks/
4. SVGO documentation.
5. GitHub Actions documentation.
6. Octicons or similar icon pipeline examples.
7. SVG accessibility guidance.
8. Web performance guidance for SVG/assets.
9. Design system asset governance sources.
10. Node.js stream/fetch/file handling docs.

## 2. Core Concept — State of the Field

Asset export automation uses stable node IDs, image endpoints, batching, SVG cleanup, and event triggers. Current Figma docs place image endpoints in rate-limit tiers and generated image links may expire, so pipelines must download and store assets promptly.

## 3. Application Domain Examples

1. Icon export to repository.
2. SVG post-processing.
3. Webhook-triggered export on library publish.
4. Batch export under rate limits.
5. Asset diff PR.

## 4. Book's Thesis Connection

Manual export is snapshot drift. Automated export makes Figma's asset decisions flow into production.

## 5. AI Wayback Machine — Candidate Figures

1. Icon font pipelines.
2. SVG optimization tools.
3. CI asset builds.
4. GitHub Octicons workflow.

## 6. Pedagogical Delivery Research

Use one icon update and trace it from Figma node to optimized SVG in the repo.

## 7. Representation and Display Research

Checklist:

- Export targets named?
- Node IDs stable?
- Batch limits handled?
- SVG optimized?
- PR diff reviewed?

## 8. Open Questions and Research Gaps

1. Verify current image-link expiry details in final draft.
2. Add node-refactor failure mode.
3. Include accessibility check for exported SVGs.
