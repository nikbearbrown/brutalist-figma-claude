<!--
    book.md
    BOOK DESCRIPTION & HIGH-LEVEL OUTLINE — your planning document.

    This file is for YOU, not the reader. It does not get compiled into
    the EPUB. Use it to think clearly about what the book is before you
    write it, and to keep yourself honest as you draft.

    Update freely as the book takes shape. Earlier versions belong in
    git history, not in this file.
-->

# The Figma API: From Canvas to Production

**Author:** Nik Bear Brown  
**Publisher:** Bear Brown LLC

---

## One-Sentence Pitch

<!-- If you can't say what the book is in one sentence, you don't
     yet know what the book is. Force the constraint. -->

A practitioner handbook for design engineers and design systems teams who need to make Figma the reliable, machine-readable source of truth for production systems — by structuring the canvas correctly, auditing it programmatically, and extracting its design decisions as artifacts that CLIs, build tools, and AI agents can consume without a human in the loop.

## The Argument

<!-- What does this book claim that isn't already obvious or settled?
     What changes in the reader's head between page one and the end?
     2–4 paragraphs. -->

Designers design in Figma — that is not changing. The Figma file is the source of truth for visual decisions. The problem is getting those decisions out reliably, keeping them in sync with production, and making them machine-readable enough that CLIs, build tools, and AI agents can consume them without a human in the loop. The designer-developer gap is not a communication problem. It is a synchronization problem. Solving it requires an extraction layer: the audit layer, the token pipeline, the asset export automation, the MCP workflows, and the file discipline required for a CLI to build from the canvas.

Most practitioners treat the Figma API as an export tool. It is a document query interface. Understanding that distinction determines what your pipeline can and cannot do — and why every failed or frustrating handoff traces back to a structural decision made (or not made) in the file itself. Naming conventions are not aesthetic preferences; they are API contracts. Component descriptions are not optional metadata; they are the governance layer an AI coding agent reads. The canvas is not a picture; it is a document graph that a machine will try to read.

The book succeeds when the reader can run a programmatic audit of a Figma file and know exactly what to fix before building any pipeline; build a token extraction and transformation pipeline that runs without manual intervention; configure an asset export workflow that survives rate limits and file changes; and connect a Figma file to an AI coding agent via MCP in a way that produces code the team would actually ship.

## The Gap

<!-- Why does this book need to exist? What does it do that no other
     book in the field already does? Name 2–3 books in the same space
     and say briefly how yours differs. -->

No existing practitioner resource addresses the full extraction stack end-to-end. *Designing in Figma* (Fedorenko, 2020) covers the Figma UI for designers — it does not address the API, naming discipline, or what a machine-ready file looks like. The official Figma developer documentation covers individual endpoints as reference material — it does not address end-to-end workflows, programmatic audit, or the architectural decisions that make a file pipeline-safe. Style Dictionary documentation covers the transformation step but not extraction or audit. Nothing in print bridges the full stack from the perspective of making a real file production-ready: naming discipline, programmatic audit, token pipeline, asset automation, machine-readable component specs, MCP integration, and CLI governance.

## The Reader

<!-- Who is this book FOR? Be specific — not "anyone interested in X."
     What do they already know? What are they trying to do?
     What will they be able to do after reading it? -->

**Primary reader:** A design systems engineer, design engineer, or technically fluent designer who has been using Figma for product work and now needs to connect it to production systems. They know Figma components, variants, variables, and styles. They can write or read JavaScript. They have hit the wall where manual handoff is breaking down at scale.

**Secondary reader:** A front-end developer who has been handed a Figma file and told to "just build it" — and who wants to make that process systematic rather than ad-hoc.

**What they cannot do yet:** Build a reliable automated pipeline from Figma to production. Audit a file programmatically. Know what "machine-ready" means for a design file and how to get there. Design a CLI contract around Figma data. Connect a Figma file to an AI coding agent in a way that produces useful output.

**What they will be able to do after reading:** Run `npm run figma:audit` against a real file and understand the output; build and run a token pipeline from Figma variables to platform-specific CSS/Swift/Android; automate asset export with integrity checks; and configure an MCP-backed AI coding session governed by an explicit `FIGMA.md` file.

## High-Level Outline

<!-- Three to five acts / parts / movements. Not chapters yet — those
     live in outline.md. This is the shape of the argument at altitude. -->

**Part One — The Gap (Chapters 1–3)**
Establishes why manually exporting from Figma is a scaling failure, what the API actually exposes (a document graph, not an export surface), and how to read a real file programmatically. Ends with: the reader can navigate the raw API response and extract a component inventory.

**Part Two — Making the File Extraction-Ready (Chapters 4–7)**
The audit and naming layer. The reader builds a programmatic audit tool, understands naming conventions as API contracts, fixes structural failures with the Plugin API, and defines what a machine-ready file looks like. Ends with: the reader has a file they would bet a production pipeline on.

**Part Three — The Extraction Pipelines (Chapters 8–12)**
The four major extraction use cases: design tokens, asset export, component documentation sync, and brand compliance monitoring — plus the machine-readable specification output. Each chapter is self-contained. Ends with: the reader has at least one working pipeline connecting their Figma file to something in production.

**Part Four — AI-Assisted Workflows (Chapters 13–14)**
Connecting the extraction layer to AI coding agents via MCP, and assembling the full production-ready design system — tokens, assets, documentation, compliance reports, and AI-agent context governed by `FIGMA.md`. Ends with: the reader has a complete, governed, automated design-to-production loop.

## Open Questions

<!-- Things you don't yet know how to handle. Update as you draft.
     Don't pretend they're solved. -->

- [ ] The Variables REST API requires an Enterprise Figma plan. The non-Enterprise path (Tokens Studio, Plugin API) must be documented with equal clarity in every relevant chapter — the right balance between these two paths is still being calibrated.
- [ ] The MCP server, Code Connect, and write-to-canvas are beta or recently GA. The book should frame Part Three and Part Four as current best practice, not canonical standard — but the line between stable architecture and current-state tooling needs to be drawn explicitly per chapter.
- [ ] Figma Sites, Figma Make, and Figma Buzz are excluded as too new and unstable. Reopen condition: if any of these stabilizes before publication and becomes relevant to the extraction layer, revisit.
- [ ] Market sizing: how many design systems teams are on Professional vs. Enterprise plans? This affects how prominently the non-Enterprise paths should be featured. [NEEDS HUMAN INPUT]
