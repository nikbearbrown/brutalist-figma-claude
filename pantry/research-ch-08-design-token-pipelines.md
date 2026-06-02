# Research: Chapter 08 — Design Token Pipelines
## Brutalist Figma + Claude

**Chapter one-line:** Extract Figma variables into production design tokens with validation and transformation.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma variables endpoints. Source: https://developers.figma.com/docs/rest-api/variables-endpoints/
2. Figma rate limits docs. Source: https://developers.figma.com/docs/rest-api/rate-limits/
3. Design Tokens Community Group format. Source: https://tr.designtokens.org/format/
4. Style Dictionary documentation. Source: https://styledictionary.com/
5. Tokens Studio documentation. Source: https://docs.tokens.studio/
6. W3C CSS custom properties.
7. Android resource documentation.
8. Apple design token / Swift naming conventions where applicable.
9. GitHub Actions documentation.
10. Design system token taxonomy sources.

## 2. Core Concept — State of the Field

Token pipelines usually move through declare, extract, transform, distribute, and compile. Figma variables are a strong source, but plan gates, alias chains, modes, data types, and rate limits shape the implementation.

## 3. Application Domain Examples

1. Color tokens to CSS custom properties.
2. Typography and spacing tokens.
3. Alias chain validation.
4. Multi-platform Style Dictionary output.
5. GitHub Action opening token-update PR.

## 4. Book's Thesis Connection

Token extraction is the clearest example of Figma as source of truth becoming production code.

## 5. AI Wayback Machine — Candidate Figures

1. Design token movement.
2. Style Dictionary.
3. DTCG format.
4. Tokens Studio as non-Enterprise extraction path.

## 6. Pedagogical Delivery Research

Use one token from Figma through every stage: variable, JSON, DTCG-ish token, CSS output, PR diff.

## 7. Representation and Display Research

Checklist:

- Variable access available?
- Alias chains valid?
- Modes handled?
- Values transformed correctly?
- Generated output reviewed?

## 8. Open Questions and Research Gaps

1. Verify current Enterprise/plan constraints before drafting.
2. Add non-Enterprise Tokens Studio path.
3. Include validation for malformed values.
