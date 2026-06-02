<!--
    outline.md
    TABLE OF CONTENTS — your chapter-level planning document.

    This is NOT the auto-generated TOC that appears in the EPUB
    (pandoc handles that via --toc in build.sh). This file is YOUR
    working outline: chapter titles, one-line descriptions, and the
    order of arguments before you start drafting.

    Keep it in sync with the actual chapter files in chapters/.
    When the outline diverges from the drafts, update one or the other —
    don't let them drift.
-->

# The Figma API: From Canvas to Production — Outline

**Author:** Nik Bear Brown  
**Publisher:** Bear Brown LLC

---

## Front Matter

- **Copyright** — Bear Brown LLC, 2026
- **Dedication** *(optional)*
- **Preface** — why this book exists: the extraction-layer problem, the CLI operating spine, and the reader it is written for

## Introduction

Establishes the synchronization problem (not a communication problem), introduces the extraction-layer thesis, maps the four parts and fourteen chapters, and explains what "machine-ready" means — the lens every subsequent chapter applies.

---

## Part One — The Gap

1. **Why Your Figma File Is Lying to You** — the designer-developer gap is a synchronization failure, not a communication failure; introduces the pipeline as the only durable solution.
2. **What the API Actually Exposes** — the five API surfaces, rate-limit architecture, authentication, Enterprise gates, and `figma-ping.js` as the session health check.
3. **Reading a Figma File Programmatically** — navigating the raw document graph, writing local fixtures, extracting a component inventory with `figma-read.mjs`.

## Part Two — Making the File Extraction-Ready

4. **Naming as an API Contract** — the slash convention, primitive-semantic-component token hierarchy, and naming decisions that belong to designers vs. engineers.
5. **The Figma Audit** — building `figma-audit.js`: naming, brand compliance, WCAG, token hygiene, component hygiene, CI exit codes, and human-readable + machine-readable output.
6. **Fixing the File with the Plugin API** — the Plugin API runtime, the staged rename pattern, and what to never automate.
7. **The Machine-Ready File** — defining the standard: naming, structure, documentation, publication state, the `FIGMA.md` governing file, and a CLI preflight checklist.

## Part Three — The Extraction Pipelines

8. **Design Token Pipelines** — `extract-tokens.mjs`, the non-Enterprise path via Tokens Studio, Style Dictionary transforms, GitHub Actions CI, and `validate-tokens.mjs`.
9. **Asset Export Automation** — batching image endpoint requests, SVG post-processing with SVGO, webhook-triggered export, and the GitHub Octicons canonical pattern.
10. **Component Documentation Sync** — building a component inventory, Code Connect, CLI-generated documentation fragments, and what the API cannot give you.
11. **Brand Compliance Monitoring** — building a programmatic compliance report: approved palette, type scale, WCAG contrast, severity levels, before/after diffs.
12. **Figma as a Machine-Readable Specification** — the human vs. machine consumer distinction, W3C DTCG format, `build-spec.mjs`, and contract tests for downstream code generators.

## Part Four — AI-Assisted Workflows

13. **The Figma MCP Server** — connecting a design system file to an AI coding agent; `FIGMA.md` as the governance file; the deferred-action principle; CLI-to-agent handoff; agent refusal rules.
14. **Putting It Together: The Production-Ready Design System** — assembling the full stack (`figma-ping`, `figma-audit`, token pipeline, asset pipeline, MCP config), CI/CD wiring, and the governance model.

---

## Back Matter

- **Acknowledgments**
- **About the Author** — Nik Bear Brown / Bear Brown LLC
- **Notes** — organized by chapter
- **References** — full bibliography after fact-checking
- **Glossary** — key terms defined
- **No Index** — designed for digital reading; search supersedes a static index

---

## Notes on Order

<!-- Why are the chapters in THIS order? What does each chapter
     assume the reader has already read? If you can swap two chapters
     without breaking anything, ask whether the order is doing real work. -->

**Failure-first, self-contained, problem→solution.** Each chapter opens with a specific failure mode — the thing that breaks in production — and builds toward the diagnostic and the fix. This is the primary sequencing model throughout.

**Part One** must come first: the reader cannot evaluate naming conventions (Part Two) or build token pipelines (Part Three) without understanding what the API actually exposes and what a document graph is. Chapters 1–3 are load-bearing prerequisites.

**Part Two** chapters (4–7) are ordered by the natural workflow sequence: name first (Ch 4), then audit (Ch 5), then fix (Ch 6), then certify the result as machine-ready (Ch 7). Chapter 7 defines the standard that all Part Three pipelines assume.

**Part Three** chapters (8–12) are self-contained. A reader working exclusively on token pipelines can read Chapter 8 after Chapters 1–7 without reading 9–12. The ordering follows the most common pipeline priority in practice: tokens first, assets second, docs third, compliance fourth, machine-spec fifth.

**Part Four** (13–14) depends on Part Three outputs: the MCP chapter (13) references `figma-audit.js` output, `build-spec.mjs`, and token pipeline JSON as verified context passed to the coding agent. Chapter 14 assembles all prior CLI artifacts into the capstone.

**Readable non-linearly:** A reader debugging MCP can go directly to Chapter 13. A reader auditing an existing file can go directly to Chapters 4–5. The dependency graph is: Ch 1–3 unlock everything; Ch 4–7 unlock Part Three and Part Four; Part Three chapters are independent of each other; Ch 13 benefits from but does not require all of Part Three; Ch 14 assumes all prior chapters.
