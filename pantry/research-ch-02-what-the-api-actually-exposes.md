# Research: Chapter 02 — What the API Actually Exposes
## Brutalist Figma + Claude

**Chapter one-line:** The Figma API exposes a document graph and related surfaces, not a finished production implementation.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma REST API docs. Source: https://developers.figma.com/docs/rest-api/
2. Figma file endpoints. Source: https://developers.figma.com/docs/rest-api/file-endpoints/
3. Figma variables endpoints. Source: https://developers.figma.com/docs/rest-api/variables-endpoints/
4. Figma webhooks documentation. Source: https://developers.figma.com/docs/rest-api/webhooks/
5. Figma rate limits documentation. Source: https://developers.figma.com/docs/rest-api/rate-limits/
6. Figma Plugin API reference. Source: https://developers.figma.com/docs/plugins/api/api-reference/
7. Figma Dev Mode guide. Source: https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode
8. Figma MCP server guide. Source: https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server
9. Figma Code Connect overview. Source: https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect
10. Anthropic MCP documentation. Source: https://docs.anthropic.com/

## 2. Core Concept — State of the Field

Figma now has multiple programmatic surfaces: REST endpoints, Plugin API, Variables API, webhooks, Dev Mode, Code Connect, and MCP. Each has different permissions, rate limits, and read/write capabilities.

Rate limits are plan, seat, endpoint-tier, and resource-location dependent. Current Figma docs warn that rate limits can change and may return `429` with retry metadata.

## 3. Application Domain Examples

1. REST reads file graph and images.
2. Variables endpoints expose local/published variables where plan and permissions allow.
3. Plugin API can write to the canvas from inside Figma.
4. Webhooks trigger sync work.
5. MCP gives AI coding tools structured design context.

## 4. Book's Thesis Connection

Extraction depends on choosing the right API surface for the job. The book must teach surface selection before pipeline design.

## 5. AI Wayback Machine — Candidate Figures

1. API surface map.
2. REST versus Plugin API.
3. Variables API and design tokens.
4. MCP as structured context layer.

## 6. Pedagogical Delivery Research

Use a decision table: read file, write file, export images, extract tokens, trigger automation, feed AI agent.

## 7. Representation and Display Research

Checklist:

- API surface selected?
- Auth model named?
- Rate limit tier checked?
- Plan/seat gate checked?
- Read/write boundary understood?

## 8. Open Questions and Research Gaps

1. Verify current plan gates before final draft.
2. Add `figma-ping.js` endpoint checklist.
3. Include a "Starter-plan trap" callout.
