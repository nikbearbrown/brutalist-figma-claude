# Research: Chapter 03 — Reading a Figma File Programmatically
## Brutalist Figma + Claude

**Chapter one-line:** Learn to navigate the raw Figma file graph before building a pipeline on top of it.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma file endpoints. Source: https://developers.figma.com/docs/rest-api/file-endpoints/
2. Figma REST API types and file response docs. Source: https://developers.figma.com/docs/rest-api/
3. Figma variables endpoints. Source: https://developers.figma.com/docs/rest-api/variables-endpoints/
4. Figma components and styles endpoints.
5. Figma rate limits docs. Source: https://developers.figma.com/docs/rest-api/rate-limits/
6. JSON schema and API client design references.
7. Node.js fetch documentation.
8. TypeScript type generation / validation references.
9. Design system component inventory examples.
10. Figma Dev Mode guide.

## 2. Core Concept — State of the Field

The file response is a nested document graph: document, canvases/pages, frames, component sets, components, layers, properties, variables, styles, and metadata.

Useful extraction starts with graph traversal, filtering, and stable reporting before transformation.

## 3. Application Domain Examples

1. Component inventory.
2. Variable inventory.
3. Style inventory.
4. Page/frame structure report.
5. Missing-description report.

## 4. Book's Thesis Connection

The book's pipelines rely on readers understanding what the raw file response contains and what it omits.

## 5. AI Wayback Machine — Candidate Figures

1. DOM tree analogy.
2. AST traversal analogy.
3. Component inventory reports.
4. JSON graph explorers.

## 6. Pedagogical Delivery Research

Start with a small file and walk the JSON tree manually before showing traversal code.

## 7. Representation and Display Research

Checklist:

- File key parsed?
- Auth checked?
- Node tree traversed?
- Variables/components/styles separated?
- Missing data acknowledged?

## 8. Open Questions and Research Gaps

1. Add example response snippets from a safe public/test file.
2. Include schema-validation step.
3. Clarify what prototype/interactions are unavailable through REST.
