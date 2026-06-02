# Research: Chapter 04 — Naming as an API Contract
## Brutalist Figma + Claude

**Chapter one-line:** Names in Figma become downstream identifiers, so naming is an API contract.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma variables endpoints and variable naming docs. Source: https://developers.figma.com/docs/rest-api/variables-endpoints/
2. Figma component/property documentation.
3. Design Tokens Community Group format. Source: https://tr.designtokens.org/format/
4. Style Dictionary documentation. Source: https://styledictionary.com/
5. Tokens Studio documentation. Source: https://docs.tokens.studio/
6. Nathan Curtis on token naming and design systems.
7. Brad Frost on design systems and component naming.
8. Material Design token naming references.
9. W3C CSS custom properties docs.
10. Platform naming conventions for Swift/Kotlin/Android XML.

## 2. Core Concept — State of the Field

Names are not labels for humans only. Token, component, style, and layer names are transformed into CSS variables, code identifiers, documentation paths, and AI context.

The slash naming convention supports hierarchy, transformation, and cross-platform output, but only if it is applied consistently.

## 3. Application Domain Examples

1. `color/brand/primary` to CSS custom property.
2. Primitive, semantic, and component token tiers.
3. Component variant naming.
4. Layer names for export targets.
5. Bad names producing garbage output.

## 4. Book's Thesis Connection

Machine-readable Figma starts with naming discipline. Claude can help audit names, but the team must decide the naming contract.

## 5. AI Wayback Machine — Candidate Figures

1. CSS naming conventions.
2. BEM and design system naming.
3. Design token taxonomy.
4. API contract thinking.

## 6. Pedagogical Delivery Research

Show one good and one bad token name flowing into CSS, Swift, and Android outputs.

## 7. Representation and Display Research

Checklist:

- Token tier clear?
- Slash hierarchy consistent?
- Names stable and meaningful?
- Platform transformations predictable?
- Designer/engineer ownership explicit?

## 8. Open Questions and Research Gaps

1. Pick one canonical naming system for examples.
2. Add migration advice for existing messy files.
3. Include Claude prompt for naming audit.
