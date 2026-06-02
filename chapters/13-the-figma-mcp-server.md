# Chapter 13 — The Figma MCP Server

*The agent can see your design. Whether it can use your design system is a different question.*

---

The component request went into the coding agent at 2:47 PM. By 3:03 PM the engineer had a working React component — 127 lines, typed props, proper ref forwarding, a story file, unit tests. It looked like the future.

Then she compared it to the design system.

The generated component used `#3B82F6` as its primary color instead of `--color-brand-blue`. It imported `styled-components` even though the codebase had migrated to CSS Modules six months ago. The spacing was 8px, 16px, 24px — sensible numbers, but not the 4/8/12/24/40 scale the team had defined and documented in Figma. The variant naming bore no relationship to the actual variant names on the live component. Three prop names were synonyms for props that already existed in the component library under different keys.

The code was not wrong. It was well-written generic React. It was precisely as useful as a component written by a contractor who had never seen the codebase, was working from a verbal description of the design, and had very good instincts about modern React patterns.

That is the problem Model Context Protocol is supposed to solve. Whether it solves it — and under what conditions, and to what degree — is what this chapter is actually about.

---

## What MCP Is, and What It Is Not

Model Context Protocol is an open standard for connecting AI coding agents to external data sources and tools. [verify — current as of writing] It defines how a host application — Claude Code, Cursor, Windsurf, Copilot — can communicate with a server that exposes resources, tools, and prompts in a structured way. The Figma MCP server sits between your AI coding agent and your Figma file. When the agent needs to know about a component, the server fetches structured information from Figma and provides it as context. The agent then uses that context when generating code.

The correct mental model is this: MCP is a structured context layer, not a code generator. The agent generates code. MCP supplies the design system information that makes the generation less generic. The quality of the output is bounded by two things: the quality of the information the server can retrieve, and the quality of the design file underneath it.

This second bound is the one most teams discover later than they should. A poorly structured Figma file — ambiguous names, empty description fields, no Code Connect mappings — produces poor MCP context. Poor context produces generic code. The work in Chapters 4 through 7 — naming discipline, audit, remediation, machine-readiness — is not preliminary to MCP. It is the precondition for MCP being useful at all.

<!-- → [FIGURE: Architecture diagram showing AI coding agent → MCP protocol → Figma MCP server → Figma REST API → design file. A second track shows the CLI context package (audit.json, spec.json, tokens.json) feeding directly into the agent alongside MCP. Caption: MCP is one delivery mechanism for design system context. The CLI pipeline is another. Both depend on the same file quality.] -->

As of writing, the Figma MCP server surfaces design context from a selected frame or component — layout properties, style information, component metadata — to the coding agent. [verify — current as of writing] What it surfaces is constrained by what the file makes available. A component with no description, unnamed styles, and inconsistent slash naming produces minimal useful context regardless of server configuration.

What the server does not do is worth being explicit about, because the product surface changes faster than any book can track. It does not write code to your codebase. It does not make design decisions. It does not resolve ambiguities in the design file — if a spacing value is inconsistent, the agent sees the inconsistency. It does not replace a well-maintained component specification. It does not guarantee that generated code is correct, accessible, or idiomatic for your codebase. These are not deficiencies to work around. They are the correct scope of a context layer.

---

## Code Connect: The Difference Between Seeing and Knowing

The clearest way to understand what MCP actually changes is to run the same component request twice — once with Code Connect published for the target component, once without.

**Request in both cases:** "Generate a React component for the Primary Button, medium size, with the label 'Save changes', using the design system."

Without Code Connect, the agent receives layout and style data: a rectangle, 16px vertical padding, 24px horizontal padding, `#2563EB` background, white text, 6px border radius, 16px font size. It has to infer everything about the code surface from this geometry and color.

```tsx
// Generated without Code Connect [illustrative]
import React from 'react'

interface ButtonProps {
  label: string
  onClick?: () => void
}

const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: '#2563EB',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '6px',
        fontSize: '16px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export default Button
```

This code works. It does not use tokens. It does not use the component library. It will not update when the design system changes. It is new debt, introduced in sixteen minutes.

With Code Connect, the agent receives the same layout data plus a mapping: `import { Button } from '@acme/components'`, props include `variant` (enum: primary/secondary/destructive), `size` (enum: sm/md/lg), `children`, `disabled`, `onClick`.

```tsx
// Generated with Code Connect [illustrative]
import { Button } from '@acme/components'

export function SaveChangesButton() {
  return (
    <Button variant="primary" size="md">
      Save changes
    </Button>
  )
}
```

Six lines. Correct import. Correct props. Correct variant names. Updates automatically when `@acme/components` updates. No new debt.

The difference is not the agent's capability. The difference is what information the agent had when it generated the code. Code Connect is the mechanism that makes that information available.

<!-- → [TABLE: Side-by-side output comparison — without Code Connect vs. with Code Connect. Columns: hardcoded values, library usage, prop accuracy, maintainability, lines of new code. Caption: The agent's capability is constant. The context determines the output.] -->

Setting up Code Connect requires installing the CLI, creating a configuration file per component that maps the Figma node ID to the real component and its prop mappings, and publishing the mappings to Figma. [verify — current as of writing: `npm install --save-dev @figma/code-connect`, then `figma connect publish`] Here is a minimal example:

```typescript
// ButtonConnected.figma.ts [illustrative — verify current Code Connect API]
import { figma } from '@figma/code-connect'
import { Button } from '@acme/components'

figma.connect(Button, 'https://www.figma.com/file/FILE_KEY?node-id=NODE_ID', {
  props: {
    variant: figma.enum('Variant', {
      Primary:     'primary',
      Secondary:   'secondary',
      Destructive: 'destructive',
    }),
    size: figma.enum('Size', {
      Small:  'sm',
      Medium: 'md',
      Large:  'lg',
    }),
    label:    figma.string('Label'),
    disabled: figma.boolean('Disabled'),
  },
  example: ({ variant, size, label, disabled }) => (
    <Button variant={variant} size={size} disabled={disabled}>
      {label}
    </Button>
  ),
})
```

The Code Connect coverage problem is real: a design system with 200 components and 15 Code Connect files means 185 components will produce generic code when the agent encounters them. Prioritize coverage for the most frequently used components first — buttons, inputs, cards, navigation — and for components where the Figma variant naming is most different from the prop naming. That gap is where the most harmful inferences happen.

---

## Prerequisites

The Figma MCP server requires Dev Mode. [verify — current as of writing: available on Professional and Organization plans; check the Figma Help Center for current seat requirements before investing setup time] If you are on a Starter plan, you will encounter an authorization wall before the MCP server is reachable. That is a plan decision, not a configuration problem.

Before starting any MCP session, run `figma-ping.js` — introduced in Chapter 2 — against the file you intend to use:

```bash
node figma-ping.js
```

Expected output on a healthy session:

```
figma-ping v1.0
Token:        OK (PAT, read scope)
File key:     OK (resolves to "Acme Design System — v4.1")
File access:  OK (editor seat)
Dev Mode:     OK [verify — endpoint name may change]
Rate limit:   OK (requests remaining: 4950)
Endpoint:     GET /v1/files/:key → 200

Session ready. Proceed to MCP setup.
```

If any line prints `FAIL`, resolve it before configuring the MCP server. `Token: FAIL (403)` means the token scope is wrong for the resource type — regenerate with read access. `Dev Mode: FAIL (plan)` means the seat is not on a plan that includes Dev Mode. `File access: FAIL (403)` means the token owner does not have editor access to the file. These are not mysteries. They are access control failures with direct remediation.

Dev Mode provides the inspection layer that surfaces component annotations, style values, and code snippets. The MCP server draws from the same layer. Without Dev Mode, the agent can receive raw node data via the REST API, but this is unstructured from the agent's perspective: large, nested, without component intent, without Code Connect mappings. Building an MCP workflow without Dev Mode means building a slower, less informative version of the machine-readable specification workflow from Chapter 12.

---

## Setup

**The specific steps documented here are current as of writing. MCP is evolving rapidly. Verify the current setup process at the Figma help documentation before following them.** [verify — current as of writing: https://help.figma.com/hc/en-us/articles/32132100833559]

The Figma MCP server can run locally — as a process on your machine — or remotely as a hosted service. [verify — current as of writing] For most design systems work involving proprietary design files, unreleased products, or sensitive brand specifications, the local server is the appropriate choice. The remote server introduces network transmission of design data; verify your organization's data governance policy before using it.

```bash
# Install the MCP server package [verify — package name may change]
npm install -g @figma/mcp-server

# Configure environment
export FIGMA_TOKEN=fig_xxxxxxxxxxxxxxxx
export FIGMA_FILE_KEY=your_file_key_here

# Start the server [verify — command syntax may change]
figma-mcp-server --port 3845
```

In your coding agent's MCP configuration, point it to `http://localhost:3845`. [verify — configuration format varies by agent; see your agent's documentation]

---

## The Governance File

This is the most important section of the chapter. The MCP server gives the agent access to structured design information. The governance file defines what the agent is authorized to do with that information.

Without a governance file, the agent's behavior during an MCP session is bounded only by its general training and your prompts. With one, it is bounded by an explicit, reviewable, version-controlled specification of agent authority — one the whole team can read, debate, and update. The governance file is not bureaucracy. It is the difference between "the agent generates whatever seems reasonable" and "the agent generates what we have decided it should generate, within boundaries we can defend."

`FIGMA.md` lives at the root of your project or design system repository and declares four things: what the agent may read, what it may infer, what it may generate, and what it must refuse or escalate to a human.

```markdown
# FIGMA.md — AI Agent Governance for Figma MCP Sessions
# Project: Acme Design System
# Last updated: 2026-06-01
# Owner: Design Systems team (design-systems@acme.com)

## Authorized File
FILE_KEY: abc123def456
File name: Acme Design System — v4.1
Pages in scope:     Core Components, Foundation Tokens
Pages out of scope: WIP, Archive, Explorations (do not read, do not cite)

## What the Agent May Read
- Published component definitions and variant properties
- Published token values (colors, typography, spacing, radius, elevation)
- Component descriptions from the Figma description field
- Code Connect mappings for components where published

## What the Agent May Infer
- Token alias chains (color/brand/primary → color/primitive/blue-600 → #2563EB)
- Spacing arithmetic within the 4px base-unit scale
- Responsive behavior documented in component descriptions

## What the Agent May Generate
- Component markup using tokens and Code Connect mappings
- CSS using the token system's CSS custom property names
- TypeScript props that match Code Connect prop mappings
- Import statements for @acme/components packages
- Storybook stories using the documented variant properties

## What the Agent Must Refuse or Escalate

REFUSE without human instruction:
- Hardcoded color values (always use tokens)
- Hardcoded spacing values not in the defined scale
- Imports from libraries other than @acme/components
- New component variants not documented in the Figma file
- Any component from WIP or Explorations pages

ESCALATE if:
- A component has no Code Connect mapping (flag, do not infer props)
- A token has conflicting values across modes (flag, do not resolve)
- The description field is empty and intent is ambiguous (flag, do not guess)
- A requested component does not exist in the published library

## Human Gate
All generated code requires human review before merge.
No generated code is automatically committed.

## Version
Governance version: 1.2
Review cycle: On every major design system release
```

<!-- → [FIGURE: Decision tree for an agent encountering a component without Code Connect — branches: component has mapping (generate with correct props), component has no mapping and description is clear (escalate to human), component has no mapping and description is empty (refuse and explain). Caption: The governance file determines which branch the agent takes. Without it, the agent chooses for itself.] -->

Before each significant MCP working session, generate a preflight report that verifies the conditions declared in `FIGMA.md` are actually met:

```bash
node figma-audit.js --mcp-check > figma-mcp-check.md
```

The report surfaces session health, governance file age, Code Connect coverage with specific gaps called out, and token health. It is committed to the repository so the whole team can see the session conditions without running the audit themselves.

```markdown
# figma-mcp-check.md — MCP Session Preflight
# Generated: 2026-06-01T14:22:09Z

## Session Health
  figma-ping:   PASS
  File access:  PASS (Acme Design System — v4.1)
  Dev Mode:     PASS [verify]
  Token scope:  PASS (read)

## Governance
  FIGMA.md:           FOUND (version 1.2, updated 2026-04-15)
  Authorized pages:   Core Components, Foundation Tokens
  Out-of-scope pages: WIP, Archive, Explorations

## Code Connect Coverage
  Total components:  247
  Code Connect:       89
  Coverage:           36%

  High-priority gaps (most-used without Code Connect):
    - DataTable         (no mapping — agent will flag)
    - NavigationDrawer  (no mapping — agent will flag)
    - ComboBox          (no mapping — agent will flag)

## Token Health
  Broken aliases:    0
  Missing modes:     3 (see figma-audit output)
  Unresolved tokens: 0

## Readiness
  Session safe to proceed: YES
  Warnings:
    - Code Connect coverage is 36%. Expect agent escalations for
      unmapped components.
    - 3 tokens missing dark mode values. Runtime fallback to light
      mode; verify dark mode output manually.
```

---

## The CLI-to-Agent Handoff

One of the most effective patterns for MCP-backed sessions is passing verified, pre-processed context from your CLI pipeline directly to the agent alongside the live MCP retrieval. Instead of relying solely on real-time server fetches, the agent gets a stable, fixture-based context layer that was validated before the session started.

```bash
# Generate the context package before the MCP session
node figma-audit.js  --output json > .figma-context/audit.json
node build-spec.mjs  --output json > .figma-context/spec.json
node extract-tokens.mjs --output json > .figma-context/tokens.json
node figma-audit.js  --mcp-check    > .figma-context/mcp-check.md
```

In the agent session:

```
Before generating any code, read:
- .figma-context/mcp-check.md   (session preflight and Code Connect coverage)
- .figma-context/spec.json      (machine-readable component specifications)
- .figma-context/tokens.json    (current token values)
- FIGMA.md                      (what you are authorized to do)

Do not generate hardcoded color or spacing values. Do not import component
libraries other than @acme/components. If a component has no Code Connect
mapping, flag it and ask for guidance rather than inferring prop names.
```

The combination works because the two context sources have different strengths. The MCP server provides real-time, component-specific layout and style data for the exact frame or component being worked on. The CLI context package provides a stable, validated, comprehensive view of the design system that does not require additional API calls during the session and does not vary between runs. Together they cover what either approach misses alone.

---

## Failure Modes

**Large frame timeouts.** Requesting context for a full-page layout, a dense dashboard, or a deeply nested modal can exceed the MCP server's response time threshold. [verify — timeout values and behavior may change] The symptom is the agent reporting that the context request timed out or returned incomplete data. The remediation is to work at the component level, not the page level. If page-level context is necessary, use `build-spec.mjs` to generate a pre-processed specification rather than real-time MCP retrieval.

**Rate limit exhaustion.** MCP sessions make API requests through your personal access token. Intensive sessions — many context requests, large files, multiple engineers sharing a token — can exhaust rate limits mid-session. [verify — limits are plan-dependent and subject to change] Run `figma-ping.js` before each session to check headroom. The CLI context package pattern reduces mid-session API calls by front-loading context as static files.

**Missing Code Connect mappings.** When the agent encounters a component without a mapping, it defaults to inference from layout and style data. This produces the contractor-without-a-codebase output. The governance file's REFUSE clause handles this correctly: the agent flags the missing mapping and asks for guidance rather than inferring. If it is not doing this, the governance prompt needs strengthening. Track coverage with `figma-audit.js --check code-connect-coverage`.

**Write-to-canvas instability.** Some MCP configurations include tools that allow the agent to write back to the Figma canvas. [verify — availability and behavior of write-to-canvas tools is currently unstable] This is a high-risk capability in a production design system file. The REFUSE clause in `FIGMA.md` should explicitly prohibit it unless your team has specifically evaluated and approved it in a governance review.

**Stale governance files.** `FIGMA.md` is a document. Like all documents, it becomes wrong over time. An outdated governance file that permits access to deprecated components, references old token names, or lists the wrong file key is worse than no governance file — it misleads both the agent and the team members who rely on it as a source of truth. Tie `FIGMA.md` updates to the design system release process. The `figma-mcp-check.md` report should surface governance file age and flag it when it is more than ninety days old without a review.

---

## When MCP Is Not Available

Not every team has Dev Mode access. Not every file is ready for live agent sessions. Not every project justifies the setup overhead.

The work from Chapters 8 through 12 — token extraction, asset export, documentation sync, compliance monitoring, machine-readable specification — produces most of the value that MCP promises, on any plan, without requiring a live server connection. The agent can read `tokens.json`, `spec.json`, and `audit.json` from the filesystem as static context files. The governance file still applies. The human gate still applies. The output will be less real-time but not fundamentally different in quality for most component generation tasks.

The MCP server is not the destination. The extraction layer — audited file, clean tokens, complete specification, Code Connect mappings — is the destination. MCP is one delivery mechanism for that context. Build the layer. Choose the delivery mechanism that fits your plan and your team's working style. A team with excellent CLI pipelines and no MCP access will consistently outperform a team with MCP access and a poorly structured file.

---

## The Context That Made This Necessary

MCP was introduced as an open standard by Anthropic in November 2024. Within months, Figma, GitHub, Slack, and dozens of other platforms had shipped server implementations. The pattern represented a shift from bespoke, proprietary AI integrations to a common protocol that any agent and any server could use to exchange structured context.

The earliest Figma MCP integrations were simple: retrieve a frame, get style data, pass it to the agent. What made the combination of MCP and Code Connect significant was that it changed the question the design-to-code workflow was trying to answer. Before Code Connect, the question was "can the agent see the design?" — a retrieval problem. After Code Connect, the question became "is the design system structured well enough to be seen?" — a quality problem. The bottleneck moved from the agent to the file.

This is the same movement that happened when design tokens went from a nice-to-have to a pipeline requirement. The tool got better and exposed a different constraint. Teams that had invested in naming discipline, audit automation, and component documentation discovered that the investment paid off in the MCP era in ways they had not anticipated when they made it. Teams that had not made that investment found that a faster retrieval mechanism for a poorly structured file is still a fast path to the wrong output.

For readers consulting this chapter after the book's publication: verify whether MCP has since been superseded by a higher-level abstraction. The structural pattern — agent, protocol, server, governed context, human gate — is likely durable even if the specific protocol evolves.

---

**LLM Exercises**

*Use these with Claude or any capable language model to deepen your understanding of the concepts in this chapter.*

**1. Generate and examine.** Ask the agent to generate a React component for a button in your design system — first with only a verbal description, then with your `tokens.json` and a Code Connect mapping file provided as context. Compare the two outputs. Identify every specific difference that the context produced. Then trace each difference back to a specific piece of information in the context files.

**2. Apply to known context.** Describe your current design system setup — plan tier, whether you have Dev Mode, Code Connect coverage percentage, and the state of your Figma file's naming and documentation. Ask the model to assess whether an MCP session would produce meaningfully better output than the CLI context package approach alone, and to explain its reasoning. Push back if the assessment seems optimistic or pessimistic given what you know about your file.

**3. Stress-test a specific claim.** This chapter argues that Code Connect coverage is the primary determinant of MCP output quality — more important than the agent's capability or the MCP server's retrieval speed. Present this claim to the model and ask it to construct the strongest counterargument: a scenario where low Code Connect coverage still produces high-quality generated code. Evaluate whether the counterargument applies to your team's situation.

**4. Draft or audit a professional deliverable.** Write a `FIGMA.md` governance file for your actual project. Include specific component names from your design system in the escalation conditions. Ask the model to review it for completeness and edge cases — specifically, to identify three scenarios that your current REFUSE and ESCALATE clauses would handle incorrectly. Revise based on the findings.
