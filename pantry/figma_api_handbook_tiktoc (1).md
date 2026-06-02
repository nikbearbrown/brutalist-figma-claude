# Tik TOC — Practitioner Handbook
*The Figma API: From Canvas to Production*
*Generated: June 2026 · Book type: Practitioner handbook · Deployment: Design engineers, design systems teams, designers with technical fluency*

---

## Book concept summary

"This book teaches design engineers and design systems practitioners how to make Figma the reliable source of truth for production systems — by structuring the canvas correctly, auditing it programmatically, and extracting its design decisions as machine-readable artifacts that CLIs, build tools, and AI agents can consume without a human in the loop."

The book succeeds if the reader can, after completing it: run a programmatic audit of a Figma file and know exactly what to fix before building any pipeline on top of it; build a token extraction and transformation pipeline that runs without manual intervention; configure an asset export workflow that survives rate limits and file changes; and connect a Figma file to an AI coding agent via MCP in a way that produces code the team would actually ship.

**Central thesis:** Designers design in Figma. That is not changing. The Figma file is the source of truth for visual decisions. Every problem in the design-to-code workflow is a problem of extraction — getting those decisions out reliably, keeping them in sync with production, and making them structured enough that machines can consume them. This book is about the extraction layer.

**The gap this fills:** No existing practitioner resource addresses the full extraction stack end-to-end: naming discipline, programmatic audit, token pipeline, asset automation, MCP integration, and what it means for a Figma file to be machine-ready. Existing resources either cover the Figma UI (for designers) or individual API endpoints (for developers). Nothing bridges them from the perspective of making a real file production-ready.

---

## Learner profile

**Primary reader:** A design systems engineer, design engineer, or technically fluent designer who has been using Figma for product work and now needs to connect it to production systems. They know Figma well. They can write or read JavaScript. They have hit the wall where manual handoff is breaking down at scale.

**Secondary reader:** A front-end developer who has been handed a Figma file and told to "just build it" — and who wants to understand how to make that process systematic rather than ad-hoc.

**What they know:** Figma components, variants, variables, styles. Basic Node.js. Git. The concept of a CI/CD pipeline. They do not need to be experts in any of these.

**What they cannot do yet:** Build a reliable automated pipeline from Figma to production. Audit a file programmatically. Know what "machine-ready" means for a design file and how to get there. Connect a Figma file to an AI coding agent in a way that produces useful output.

**Motivation:** Professional necessity. Manual handoff is not scaling. Things break silently. Designers and developers are out of sync. The reader has felt this pain and wants to solve it systematically.

---

## Sequencing model

**Problem to solution, task-organized.** Each chapter opens with a specific failure mode — the thing that breaks in production — and builds toward the diagnostic and the fix. Chapters are self-contained: a reader working on token pipelines reads Part Two without needing Part One. A reader debugging MCP goes directly to Part Four.

Within each chapter: failure first, then diagnosis, then the working solution, then the failure modes of the solution itself.

---

## Three-act structure

**Act One — Why the canvas is not enough (Chapters 1–3)**
Establishes the gap between the Figma file and the production system. The reader understands why manually exporting is a scaling failure, what "machine-readable" means for a design file, and what the API actually exposes. Ends with: the reader can read any Figma file programmatically and understand what they are looking at.

**Act Two — Making the file extraction-ready (Chapters 4–7)**
The audit and naming layer. The reader builds a programmatic audit tool, understands naming conventions as API contracts, fixes the common structural failures, and produces a file that a pipeline can trust. Ends with: the reader has a file they would bet a production pipeline on.

**Act Three — Building the extraction pipelines (Chapters 8–14)**
The four major extraction use cases: design tokens, asset export, documentation sync, and AI-assisted workflows via MCP. Each is a self-contained task chapter. Ends with: the reader has at least one working pipeline connecting their Figma file to something that runs in production.

---

## Chapter specifications

---

### Part One — The gap

**Chapter 1 — Why your Figma file is lying to you**
*The designer changes a color. Three weeks later production still has the old blue. This chapter is about why.*

When to use this chapter: you need to understand why manual handoff fails at scale before building anything automated.

Problem it solves: The designer-developer gap is framed as a communication problem. It is actually a synchronization problem. This chapter makes the distinction and shows why the distinction matters for everything that follows.

Core content:
- The synchronization problem: one source of truth, two diverging copies
- What the Figma file actually is: a document graph, not a picture
- Why manual export is inherently a one-time operation
- The three failure modes: silent drift, version chaos, broken trust
- What "the pipeline" means and why it is the only solution

Worked example: the `tokens_final_v3_really_final.json` workflow — documented before/after.

Decision rules: when manual export is acceptable (small team, single platform, infrequent changes) and when it is not.

---

**Chapter 2 — What the API actually exposes**
*The API does not export your design. It exposes a document graph. Understanding the difference is the prerequisite for everything else.*

When to use this chapter: before writing your first API call or configuring any pipeline tool.

Problem it solves: Most practitioners treat the Figma API as an export tool. It is a document query interface. This chapter explains what the document graph contains, what it does not contain, and why that distinction determines what your pipeline can and cannot do.

Core content:
- The five API surfaces: REST, Plugin, Variables, Webhooks, MCP
- What each surface exposes and to whom
- The rate limit architecture: tiers, plans, the Starter-plan trap
- Authentication: PATs vs. OAuth vs. Plan Access Tokens
- The Enterprise gate: what it blocks and the workarounds that exist

`figma-ping.js` introduced here as the session health check.

Decision rules: which API surface to use for which task.

---

**Chapter 3 — Reading a Figma file programmatically**
*Before you build a pipeline, you need to be able to read what the pipeline will consume.*

When to use this chapter: your first time calling the Figma API against a real file.

Problem it solves: The raw API response for a complex Figma file is thousands of lines of nested JSON. This chapter teaches the reader to navigate it — finding the nodes, variables, components, and styles that matter — without getting lost.

Core content:
- `GET /v1/files/:key` and what it returns
- The node tree: document → canvas → page → frame → component → layer
- Variables: collections, modes, types, alias chains
- Components and styles: the difference between local and published
- What is NOT in the response: prototype logic, font files, interaction states

Worked example: reading a real design system file and extracting a component inventory from the raw JSON.

---

### Part Two — Making the file extraction-ready

**Chapter 4 — Naming as an API contract**
*A variable named `Color 3` becomes garbage at the other end. A variable named `color/brand/primary` becomes `--color-brand-primary` in CSS, `colorBrandPrimary` in Swift, and `color_brand_primary` in Android XML. The designer's naming decision is the API contract.*

When to use this chapter: before setting up any pipeline, or when debugging why a pipeline is producing unexpected output.

Problem it solves: Practitioners treat naming conventions as aesthetic preferences. They are structural decisions with downstream consequences. This chapter makes the consequences explicit and gives practitioners a naming system they can enforce.

Core content:
- The slash convention: `category/subcategory/name` and why it matters
- Primitive → semantic → component tiers: the three-level token hierarchy
- What bad naming produces downstream: the garbage-in failure mode
- Naming conventions for components, styles, and layers
- The naming decisions that belong to designers vs. engineers

Decision rules: a naming convention checklist — what passes, what fails, what breaks a pipeline.

---

**Chapter 5 — The Figma audit**
*Run this before building anything on top of a file. It tells you exactly what is broken before it becomes a pipeline problem.*

When to use this chapter: before building any pipeline on an existing file, or when a pipeline is producing unexpected output and you need to find the source.

Problem it solves: Pipelines fail silently when the underlying file is not structured correctly. The audit surfaces the problems before the machine sees them.

Core content:
- What the audit checks: naming, brand compliance, WCAG, token hygiene, component hygiene, structural completeness
- Building `figma-audit.js`: reading the file, checking against rules, reporting findings
- Audit output formats: human-readable markdown report, machine-readable JSON
- Severity levels: error (breaks the pipeline), warning (deviates from brand), info (improvement opportunity)
- The Walker principle: rename and restructure before building on top

Worked example: running the audit against a real file — hundreds of findings, categorized, prioritized.

Failure modes of the audit itself: what it cannot catch (designer intent, semantic meaning, accessibility of complex interactions).

---

**Chapter 6 — Fixing the file with the Plugin API**
*The REST API reads the file. The Plugin API writes it. This is how you apply the audit findings programmatically.*

When to use this chapter: you have audit findings that need to be applied at scale — renaming hundreds of variables, adding descriptions to components, restructuring collections.

Problem it solves: Manually fixing hundreds of naming violations in a large Figma file is impractical. The Plugin API can do it in seconds.

Core content:
- The Plugin API runtime: QuickJS WASM sandbox, postMessage bridge, ES5 constraint
- What the Plugin API can do that REST cannot: write to nodes, rename, restructure
- Building a rename plugin: apply the audit findings automatically
- The review pattern: stage changes, present them to the designer, confirm before applying
- What to never automate: decisions that require designer judgment

Decision rules: what belongs in an automated fix vs. what requires a human.

---

**Chapter 7 — The machine-ready file**
*What does a Figma file look like when it is ready for a reliable pipeline? This chapter defines the standard.*

When to use this chapter: you are setting up a new design system file, onboarding a team to structured Figma practices, or defining what "done" means for a file before pipeline work begins.

Problem it solves: There is no existing standard for what a machine-ready Figma file looks like. This chapter defines one.

Core content:
- The machine-ready checklist: naming, structure, documentation, publication state
- Variable collection architecture: primitives, semantics, components
- Component documentation: description fields as searchable metadata
- Publication state: what must be published before the pipeline sees it
- The `FIGMA.md` governing file: declaring what the pipeline is authorized to do

---

### Part Three — The extraction pipelines

**Chapter 8 — Design token pipelines**
*From Figma variables to production CSS in five steps — with real code at each stage.*

When to use this chapter: you need to automate the connection between Figma variables and your production codebase.

Problem it solves: Design decisions made in Figma drift out of sync with production because the extraction is manual. This chapter makes it automatic.

Core content:
- The standard architecture: declare → extract → transform → distribute → compile
- `extract-tokens.mjs`: calling the Variables API, handling the Enterprise gate, transforming floats to hex
- The non-Enterprise path: Tokens Studio plugin as the extraction layer
- Style Dictionary: the transform config, CSS output, Swift output, Android output
- GitHub Actions: the workflow that runs on merge, commits generated files, opens the PR
- `validate-tokens.mjs`: catching broken aliases and malformed values before Style Dictionary runs
- The PR diff as the design-development conversation

Failure modes: the UID wrench problem, the sync lag problem, the Starter-plan trap.

---

**Chapter 9 — Asset export automation**
*Icons, illustrations, and graphics from Figma to your repository — without a human in the loop.*

When to use this chapter: you are manually exporting icons or other assets from Figma and the process is breaking down at scale.

Problem it solves: Manual asset export is a one-time operation. Every time a designer updates an icon, someone has to remember to re-export it. This chapter automates the entire cycle.

Core content:
- The asset export architecture: Figma file → API → GitHub Action → repository
- `GET /v1/images`: the endpoint, the parameters, the 14-day link expiry
- Batching: grouping node IDs to stay under rate limits
- SVG post-processing with SVGO: why raw Figma SVG is not production-ready
- Webhook-triggered export: `LIBRARY_PUBLISH` as the trigger event
- The GitHub case study: Octicons as the canonical pattern

Failure modes: rate limits on image endpoints, render timeouts on complex vectors, SVG output quirks, node ID instability after file refactors.

---

**Chapter 10 — Component documentation sync**
*Keeping living documentation in sync with the Figma file — without manually updating it every time a component changes.*

When to use this chapter: your design system documentation is drifting out of sync with the actual components in Figma.

Problem it solves: Documentation written once becomes stale. This chapter connects the documentation to the file so it stays current.

Core content:
- What the API exposes for documentation: component names, descriptions, variants, published state
- The documentation platform landscape: Zeroheight, Supernova, Storybook, custom portals
- Building a component inventory from the API: names, descriptions, variant properties
- Code Connect: linking Figma components to real codebase components
- What the API cannot give you: usage guidance, accessibility notes, do/don't examples — these are still human work

Failure modes: the description field is empty (most common), components not published, Code Connect setup overhead.

---

**Chapter 11 — Brand compliance monitoring**
*A programmatic report of every object in the file that deviates from brand guidelines — run on demand or on every commit.*

When to use this chapter: you need to enforce brand compliance across large Figma files with hundreds or thousands of objects, or you need to audit a file before a major release.

Problem it solves: In large files, brand drift happens silently. A color is hardcoded here, a font size is off-scale there. Manual review does not scale. This chapter builds an automated compliance report.

Core content:
- Brand compliance as an audit category: approved palette, type scale, spacing grid
- WCAG compliance checks: contrast ratios for text/background pairs, interactive element sizing
- Building the compliance report: structured output per object, severity levels, page organization
- The before/after pattern: run before fixing, run after fixing, compare diffs
- Thousands of objects: formatting a report that is actionable, not overwhelming

Worked example: running a compliance report on a real marketing file — 847 objects checked, 63 findings, 12 errors.

---

**Chapter 12 — Figma as a machine-readable specification**
*When the output is not for a human but for a CLI to build from — more detail is better, not less.*

When to use this chapter: you are building automated tooling that consumes Figma data as input — a code generator, a design-to-code pipeline, a custom CLI.

Problem it solves: Most API usage is designed for human-readable output. When the consumer is a machine, the design goals are opposite: completeness and structure over compression and curation. This chapter addresses the machine-consumer case explicitly.

Core content:
- The two consumer types: human (wants compression) vs. machine (wants completeness)
- What a machine consumer needs that human documentation omits: full alias chains, every mode value, variant property mappings, Code Connect annotations
- Structuring output for downstream CLIs: the schema design decisions
- Using the full file response as a specification: node IDs, constraint values, layout rules
- W3C DTCG as the interchange format: what it enables across tool boundaries

Worked example: generating a complete component specification JSON from a design system file — the input a code generator would need to produce a React component library.

---

**Chapter 13 — The Figma MCP server**
*Connecting a Figma file to an AI coding agent so it produces code that matches your actual design system.*

When to use this chapter: you are using or evaluating AI coding tools (Claude Code, Cursor, Copilot, Windsurf) and want them to produce code that reflects your design system rather than generic approximations.

Problem it solves: AI coding agents produce code that looks right but uses none of your actual components, tokens, or naming conventions. The MCP server gives the agent structured access to your design system so it can generate code that your team would actually ship.

Core content:
- What the MCP server is and is not: a structured context layer, not a code generator
- Local vs. remote server: when to use each, authentication, rate limits
- The setup: `figma-ping.js` as the session check, MCP Catalog access, Dev Mode requirement
- Code Connect: why it matters and how to configure it
- `FIGMA.md` as the governing file for MCP sessions: what the agent is authorized to do
- The deferred-action principle: the agent reads and surfaces, the human decides

Failure modes: large frame timeouts, Starter-plan rate caps, write-to-canvas instability, missing Code Connect mappings.

Worked example: connecting a design system file to Claude Code, generating a component with Code Connect, comparing output with and without structured context.

---

**Chapter 14 — Putting it together: the production-ready design system**
*What does a complete, machine-ready design system look like? This chapter assembles the full picture.*

When to use this chapter: you are architecting a new design system from scratch, or auditing an existing one for machine-readiness.

Problem it solves: The preceding chapters address individual pipeline tasks. This chapter connects them into a coherent whole — what a team actually needs to have in place for the full design-to-production loop to work reliably.

Core content:
- The full stack: `FIGMA.md` + `figma-ping.js` + `figma-audit.js` + token pipeline + asset pipeline + MCP configuration
- The governance model: who owns what, what requires human review, what can be automated
- The audit cadence: when to run the audit, what triggers a re-audit
- The Brutalist principle applied to design systems: maximally informed, minimally autonomous
- What the API cannot replace: design judgment, brand intent, accessibility expertise, the human decision about what ships

---

## Out of scope

- Figma UI design techniques (covered by existing Figma documentation and the Fedorenko book)
- Figma prototyping and animation
- Plugin development beyond the audit and rename use cases (a book in itself)
- Widget API
- SCIM and enterprise user provisioning
- Figma Sites, Figma Make, Figma Buzz (too new, too unstable at time of writing)
- Non-Figma design tools (Penpot, Sketch) — referenced comparatively but not covered as workflows

---

## Adoption risk register

**Risk 1 — API surface instability.** The Figma API is changing rapidly. The MCP server is in beta. The Variables API is actively evolving. Chapters covering specific endpoints or tools may need updates within 12 months of publication. Mitigation: separate stable architectural concepts from current-state tooling within each chapter. The "why" will not change; the "how" might.

**Risk 2 — Enterprise gate frustration.** The Variables REST API requires Enterprise. A significant portion of the target readership is on Professional plans. Every chapter covering the Variables API must document the non-Enterprise path (Tokens Studio, Plugin API) with equal clarity. A reader who hits the Enterprise gate without a clear alternative will put the book down.

**Risk 3 — The book exists before the field is stable.** The MCP server, Code Connect, and write-to-canvas are all beta or recently GA. A book that treats them as settled will age badly. Mitigation: frame Part Three explicitly as current best practice, not canonical standard — and structure chapters so the stable architectural layer survives even if specific tools change.

---

## Comparable works

- *Designing in Figma* (Fedorenko, 2020) — covers the Figma UI. Does not address the API. Complementary, not competitive.
- Figma developer documentation — reference, not narrative. Does not address end-to-end workflows, naming conventions, or machine-readiness as concepts.
- Style Dictionary documentation — covers transformation but not extraction or audit.
- No existing book addresses the full extraction stack from canvas to production.

---

*Version 0.1 · Generated by Tik TOC · June 2026*
*Next step: /g2 critique or /p1 proposal draft*
