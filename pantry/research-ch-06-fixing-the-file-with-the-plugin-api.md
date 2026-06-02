# Research: Chapter 06 — Fixing the File with the Plugin API
## Brutalist Figma + Claude

**Chapter one-line:** Use the Plugin API to apply scalable file fixes while preserving human review for design judgment.
**Research date:** 2026-06-01

---

## 1. Primary Sources

1. Figma Plugin API reference. Source: https://developers.figma.com/docs/plugins/api/api-reference/
2. Figma plugin development docs.
3. Figma variables Plugin API references.
4. Figma REST API file endpoints for audit input.
5. Figma desktop/editor plugin execution guidance.
6. JavaScript sandbox/runtime references for plugin constraints.
7. Design system governance sources.
8. Human-in-the-loop automation literature.
9. Accessibility remediation guidance.
10. NIST AI Risk Management Framework for automation boundaries.

## 2. Core Concept — State of the Field

REST reads Figma file data; the Plugin API can modify the file from inside Figma. That makes it appropriate for staged renames, metadata updates, and structural cleanup when a human confirms the change.

## 3. Application Domain Examples

1. Rename variables from audit findings.
2. Add missing component descriptions.
3. Normalize exportable layer names.
4. Flag but not auto-fix semantic design choices.
5. Stage changes for designer approval.

## 4. Book's Thesis Connection

Extraction-readiness sometimes requires file repair. Claude can help write tools, but the file owner approves design-affecting changes.

## 5. AI Wayback Machine — Candidate Figures

1. Refactoring tools.
2. Code linters with auto-fix.
3. Database migration scripts.
4. Design system governance boards.

## 6. Pedagogical Delivery Research

Use a staged rename plugin: preview proposed changes, require approval, apply, then re-run audit.

## 7. Representation and Display Research

Checklist:

- Fix derived from audit?
- Change previewed?
- Human approval required?
- Reversible or logged?
- Design judgment not automated?

## 8. Open Questions and Research Gaps

1. Verify current Plugin API constraints.
2. Add warning for destructive bulk edits.
3. Include rollback/export backup pattern.
