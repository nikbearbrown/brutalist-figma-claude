# Chapter 13 — The Figma MCP Server

*Connecting a Figma file to an AI coding agent so it produces code that matches your actual design system.*

---

## The Failure This Chapter Is About

The component request went into Claude Code at 2:47 PM. By 3:03 PM the engineer had a working React component — 127 lines, typed props, proper ref forwarding, a story file, and unit tests. It looked like the future.

Then she compared it to the design system.

The generated component used `#3B82F6` as its primary color instead of `--color-brand-blue`. It imported `styled-components` even though the codebase had migrated to CSS Modules six months ago. The spacing was 8px, 16px, 24px — sensible, but not the 4/8/12/24/40 scale the team had defined in Figma. The variant naming bore no relationship to the actual variant names on the component. Three prop names were synonyms for props that already existed in the live component library under different keys.

The code was not wrong. It was well-written generic React. It was precisely as useful as a component written by a contractor who had never seen the codebase, was working from a verbal description of the design, and had very good instincts about modern React patterns.

That is the problem MCP is supposed to solve. Whether it solves it — and under what conditions, and to what degree — is what this chapter is actually about.

---

## What This Chapter Lets You Do

After this chapter you can:

- Understand what the Figma MCP server is and what it does not do
- Set up a local MCP session with a real design system file and an AI coding agent [verify — current as of writing]
- Configure `FIGMA.md` as a governance file that bounds what the agent may read, infer, generate, or refuse
- Understand where Code Connect fits and why it determines the quality of the generated output
- Run `figma-ping.js` as the MCP session health check before any agent work begins
- Identify the five most common failure modes and their remediation patterns

This chapter is the highest aging-risk chapter in the book. The Figma MCP server is evolving rapidly. Specific configuration steps, tool names, and server capabilities may change after publication. This chapter therefore prioritizes the durable governance pattern over tool-specific mechanics. Every product-specific MCP behavior is flagged with `[verify — current as of writing]`.

---

## What MCP Is — and What It Is Not

Model Context Protocol (MCP) is an open protocol for connecting AI agents to external data sources and tools. It defines how a host application (Claude Code, Cursor, Windsurf, Copilot) can communicate with a server that exposes resources, tools, and prompts in a structured way. [verify — current as of writing]

The Figma MCP server sits between your AI coding agent and your Figma file. When the agent asks about a component, the server fetches structured information from Figma and provides it as context. The agent can then use that context when generating code.

This is the correct mental model: **MCP is a structured context layer, not a code generator.** The agent generates code. MCP supplies the design system information the agent uses to make that generation less generic. The quality of the output is bounded by two things: the quality of the information the server can retrieve, and the quality of the design file underneath it.

A poorly structured Figma file produces poor MCP context. Poor MCP context produces generic code. The work done in Chapters 4 through 7 — naming discipline, audit, remediation, machine-readiness — is not preliminary to MCP. It is the precondition for MCP being useful.

### What the Figma MCP Server Exposes

As of writing, the Figma MCP server surfaces design context from a selected frame or component to the AI agent — including layout properties, style information, and component metadata [verify — current as of writing]. What it exposes is constrained by what the Figma file makes available: a component with no description field, unnamed styles, and inconsistent naming produces minimal useful context regardless of the server configuration.

Code Connect substantially improves what the server can surface. When a Figma component is linked to a real codebase component via Code Connect, the MCP server can tell the agent which component to import, what its props are named, and how to use it. Without Code Connect, the agent is working from layout and style data only — it has to infer the component library structure, and inference is where the contractor-without-a-codebase problem lives.

### What the Figma MCP Server Does Not Do

It does not:

- Write code directly to your codebase
- Make design decisions
- Resolve ambiguities in the design file (if a spacing value is inconsistent, the agent sees the inconsistency)
- Replace a well-maintained component specification
- Guarantee that generated code is correct, accessible, or idiomatic in your codebase

These are not deficiencies to work around. They are the correct scope of a context layer. The agent produces code. The human reviews it. The governance file defines what the agent is authorized to attempt.

---

## Prerequisites: Before the MCP Session

### Plan and Seat Requirements

The Figma MCP server requires Dev Mode [verify — current as of writing]. Dev Mode is available on Professional and Organization plans; the exact seat requirements and feature availability may have changed since this was written. Check the Figma Help Center for current access requirements before investing setup time.

If you are on a Starter plan, you will hit the wall before the MCP server is reachable. That is an architecture decision, not a configuration problem.

### Run the Preflight Check

Before starting any MCP session, run `figma-ping.js` (introduced in Chapter 2) against the file you intend to use:

```bash
node figma-ping.js
```

Expected output on success:

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

If any line prints `FAIL`, resolve that before configuring the MCP server. Common failures at this stage:

- `Token: FAIL (403)` — token scope is read-only on the wrong resource type; regenerate
- `Dev Mode: FAIL (plan)` — seat not on a plan that includes Dev Mode
- `File access: FAIL (403)` — the token owner does not have editor access to the file

### The Dev Mode Requirement

Dev Mode provides the inspection panel that surfaces component annotations, style values, and code snippets. The MCP server draws from the same layer — it needs Dev Mode access to retrieve structured design data rather than raw document graph JSON. [verify — current as of writing]

Without Dev Mode, the agent can still receive raw node data via the REST API, but this is unstructured from the agent's perspective: large, nested, without component intent, and without Code Connect mappings. In practice, building an MCP workflow without Dev Mode means building a poorer version of the machine-readable specification workflow from Chapter 12.

---

## Setting Up the MCP Server

**Important:** The specific setup steps documented here are current as of writing. MCP is evolving rapidly. Verify the current setup process at https://help.figma.com/hc/en-us/articles/32132100833559 before following these steps. [verify — current as of writing]

### Local vs. Remote Server

The Figma MCP server can run locally (on your machine) or remotely (as a hosted service). [verify — current as of writing]

**Local server:** Runs as a process on your machine. The AI coding agent connects to it via a local socket or HTTP. Setup requires Node.js, the Figma MCP server package, and your personal access token configured as an environment variable. Communication stays on your machine.

**Remote server:** The Figma-hosted version of the server. The agent connects via the network. Requires an authorization step. Fewer local dependencies.

For most design systems work — especially work involving proprietary design files, unreleased products, or sensitive brand specifications — the local server is the appropriate choice. The remote server introduces network transmission of design data; verify your organization's data governance policy before using it.

### Local Server Setup (Illustrative — Verify Before Use)

```bash
# Install the MCP server package [verify — package name may change]
npm install -g @figma/mcp-server

# Configure environment
export FIGMA_TOKEN=fig_xxxxxxxxxxxxxxxx
export FIGMA_FILE_KEY=your_file_key_here

# Start the server [verify — command syntax may change]
figma-mcp-server --port 3845
```

In your AI coding agent's MCP configuration, point it to `http://localhost:3845`. [verify — configuration format varies by agent]

For Claude Code specifically, the MCP server is configured in the project's MCP settings. [verify — current as of writing; see Anthropic Claude Code documentation at https://docs.anthropic.com/en/docs/claude-code/overview]

---

## Code Connect: The Multiplier

Code Connect is the mechanism that maps Figma components to real codebase components. Without it, the MCP server can tell the agent what a component looks like. With it, the server can tell the agent what to import, how to use it, and which props correspond to which variant properties.

This is the difference between "there is a button here with 16px padding and blue background" and "use `<Button variant='primary' size='md'>` from `@acme/components`."

### How Code Connect Works

You create a Code Connect file that links a Figma component (by its node ID or key) to a codebase component. The file specifies:

- Which Figma component it connects
- Which import path to use
- How Figma variant properties map to component props
- Optional: example usage

```typescript
// ButtonConnected.figma.ts [illustrative — verify current Code Connect API]
import { figma } from '@figma/code-connect'
import { Button } from '@acme/components'

figma.connect(Button, 'https://www.figma.com/file/FILE_KEY?node-id=NODE_ID', {
  props: {
    variant: figma.enum('Variant', {
      Primary: 'primary',
      Secondary: 'secondary',
      Destructive: 'destructive',
    }),
    size: figma.enum('Size', {
      Small: 'sm',
      Medium: 'md',
      Large: 'lg',
    }),
    label: figma.string('Label'),
    disabled: figma.boolean('Disabled'),
  },
  example: ({ variant, size, label, disabled }) => (
    <Button variant={variant} size={size} disabled={disabled}>
      {label}
    </Button>
  ),
})
```

When Code Connect is published and the MCP server retrieves context for this component, the agent receives the import path, prop mapping, and usage example rather than raw style data.

### The Code Connect Coverage Problem

Code Connect is only as useful as its coverage. A design system with 200 components and 15 Code Connect files means 185 components will produce generic code when the agent encounters them.

Prioritize Code Connect coverage for:

1. The most frequently used components (buttons, inputs, cards, navigation)
2. Components where the Figma variant naming is most different from the prop naming
3. Components that are most often misimplemented by agents working without context

Track coverage:

```bash
# figma-mcp-check.md will surface this; see the governance section below
node figma-audit.js --check code-connect-coverage
```

---

## The Governance File: `FIGMA.md` and `figma-mcp-check.md`

This is the most important section of the chapter. The MCP server gives the agent access to structured design information. The governance file defines what the agent is authorized to do with that information.

Without a governance file, the agent's behavior during an MCP session is bounded only by its general training and your prompts. With a governance file, it is bounded by an explicit, reviewable, version-controlled specification of agent authority — one that the whole team can read, debate, and update.

### What the Governance File Contains

Create `FIGMA.md` at the root of your project (or your design system repository). This file declares:

1. **What the agent may READ** — which files, which frames, which components, which token collections
2. **What the agent may INFER** — what it is allowed to derive from the design data (spacing calculations, color derivations)
3. **What the agent may GENERATE** — which categories of code it is authorized to produce (component markup, token usage, style application)
4. **What the agent must REFUSE** — what it must not do, even if asked, and what it must flag for human review

### Example `FIGMA.md`

```markdown
# FIGMA.md — AI Agent Governance for Figma MCP Sessions
# Project: Acme Design System
# Last updated: 2026-06-01
# Owner: Design Systems team (design-systems@acme.com)

## Authorized File

FILE_KEY: abc123def456
File name: Acme Design System — v4.1
Authorized scope: All published components and published token collections only.
Pages in scope: Core Components, Foundation Tokens
Pages out of scope: WIP, Archive, Explorations (do not read, do not cite)

## What the Agent May Read

- Published component definitions and their variant properties
- Published token values (colors, typography, spacing, radius, elevation)
- Component descriptions from the Figma description field
- Code Connect mappings for components where published

## What the Agent May Infer

- Token alias chains (color/brand/primary → color/primitive/blue-600 → #2563EB)
- Spacing arithmetic within the defined scale (multiples of 4px base unit)
- Responsive behavior documented in component descriptions

## What the Agent May Generate

- Component markup using tokens and Code Connect mappings
- CSS/SCSS using the token system's CSS custom property names
- TypeScript component props that match Code Connect prop mappings
- Import statements for @acme/components packages
- Storybook stories using the documented variant properties

## What the Agent Must Refuse or Escalate

REFUSE without human instruction:
- Hardcoded color values (always use tokens)
- Hardcoded spacing values not in the defined scale
- Importing component libraries other than @acme/components
- Creating new component variants not documented in the Figma file
- Generating components for WIP or Explorations pages (not production)

ESCALATE to human if:
- A component has no Code Connect mapping (flag, do not infer props)
- A token has conflicting values across modes (flag, do not resolve)
- The Figma description field is empty and intent is ambiguous (flag, do not guess)
- A requested component does not exist in the published library (flag, do not approximate)

## Human Gate

All generated code requires human review before merge. The agent surfaces;
the engineer decides. No generated code is automatically committed.

## Audit Commands

Before any MCP session:
  node figma-ping.js            # Verify session health
  node figma-audit.js           # Verify file readiness
  node figma-audit.js --check code-connect-coverage  # Surface unmapped components

## Version

Governance version: 1.2
Review cycle: On every major design system release
```

### `figma-mcp-check.md` — The Session Report

Where `FIGMA.md` declares the rules, `figma-mcp-check.md` is the pre-session report that verifies the conditions are met. Generate it before each significant MCP working session:

```bash
node figma-audit.js --mcp-check > figma-mcp-check.md
```

The output surfaces:

```markdown
# figma-mcp-check.md — MCP Session Preflight
# Generated: 2026-06-01T14:22:09Z

## Session Health
  figma-ping:         PASS
  File access:        PASS (Acme Design System — v4.1)
  Dev Mode:           PASS [verify]
  Token scope:        PASS (read)

## Governance
  FIGMA.md:           FOUND (version 1.2, updated 2026-04-15)
  Authorized pages:   Core Components, Foundation Tokens
  Out-of-scope pages: WIP, Archive, Explorations

## Code Connect Coverage
  Total components:   247
  Code Connect files: 89
  Coverage:           36%
  
  High-priority gaps (most-used components without Code Connect):
    - DataTable           (no mapping — agent will flag)
    - NavigationDrawer    (no mapping — agent will flag)
    - ComboBox            (no mapping — agent will flag)

## Token Health
  Broken aliases:     0
  Missing modes:      3 (see figma-audit output)
  Unresolved tokens:  0

## Readiness
  Session safe to proceed: YES
  Warnings:
    - Code Connect coverage is 36%. Expect agent escalations for 
      unmapped components.
    - 3 tokens with missing dark mode values. Resolved at runtime 
      to light mode fallback; verify dark mode output manually.
```

This file gets committed to the repository. It gives the whole team visibility into the session conditions without requiring everyone to run the audit themselves.

---

## The CLI-to-Agent Handoff

One of the most effective patterns for MCP-backed sessions is passing verified, machine-readable context from your earlier CLI tools directly to the agent. Instead of relying solely on the MCP server's real-time retrieval, you give the agent a stable, pre-verified context layer.

```bash
# Generate the context package before starting the MCP session
node figma-audit.js --output json > .figma-context/audit.json
node build-spec.mjs --output json > .figma-context/spec.json
node extract-tokens.mjs --output json > .figma-context/tokens.json
node figma-audit.js --mcp-check > .figma-context/mcp-check.md
```

In the agent session, reference this context:

```
You are working on the Acme design system. Before generating any code, read:
- .figma-context/mcp-check.md (session preflight and Code Connect coverage)
- .figma-context/spec.json (machine-readable component specifications)
- .figma-context/tokens.json (current token values)
- FIGMA.md (what you are authorized to do)

Do not generate hardcoded color or spacing values. Do not import 
component libraries other than @acme/components. If a component 
has no Code Connect mapping, flag it and ask for guidance rather 
than inferring prop names.
```

This handoff pattern combines the real-time context retrieval of MCP with the verified, fixture-stable context from your CLI pipeline. The agent gets both.

---

## Worked Example: With and Without Code Connect

The clearest way to see what Code Connect adds is to run the same component request twice against the same MCP session — once with Code Connect published, once without.

**Request:** "Generate a React component for the Primary Button, medium size, with the label 'Save changes', using the design system."

### Without Code Connect

The agent receives layout and style data: a rectangle, 16px vertical padding, 24px horizontal padding, #2563EB background, white text, 6px border radius, 16px font size. It has to infer everything about the code surface from this.

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

This code works. It does not use tokens. It does not use the component library. It will not update when the design system changes. It is new debt.

### With Code Connect

The agent receives the same layout data plus the Code Connect mapping: `import { Button } from '@acme/components'`, props include `variant` (enum: primary/secondary/destructive), `size` (enum: sm/md/lg), `children`, `disabled`, `onClick`.

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

The difference is not the agent's capability. The difference is what information the agent had when it generated the code.

---

## Failure Modes

### Large Frame Timeouts

Requesting context for a large, complex frame — a full-page layout, a dense dashboard, a modal with many nested components — can exceed the MCP server's response time threshold. [verify — timeout values and behavior may change]

**Symptom:** The agent reports that the context request timed out or returned incomplete data.

**Remediation:** Work at the component level, not the page level. Request context for individual components. If you need page-level context, use `build-spec.mjs` to generate a pre-processed specification (Chapter 12) rather than real-time MCP retrieval.

### Rate Limits

MCP sessions make API requests through your token. Intensive sessions — many context requests, large files — can exhaust rate limits. [verify — rate limit values are plan-dependent and subject to change]

**Symptom:** `figma-ping.js` shows low remaining requests mid-session; the agent starts receiving 429 responses.

**Remediation:** Run `figma-ping.js` before each session to check headroom. Use the CLI context package pattern to front-load context as static files rather than making repeated API calls during the session.

### Missing Code Connect Mappings

When the agent encounters a component without a Code Connect mapping, it defaults to inference from layout and style data. This produces the "contractor without a codebase" output.

**Symptom:** Generated code uses hardcoded values or imports generic libraries instead of `@acme/components`.

**Remediation:** The governance file's REFUSE clause handles this correctly — the agent should flag the missing mapping and ask for guidance rather than inferring. If it is not doing this, strengthen the governance prompt. Track coverage with `figma-audit.js --check code-connect-coverage`.

### Write-to-Canvas Instability

Some MCP configurations include tools that allow the agent to write back to the Figma canvas. This is a high-risk capability. [verify — availability and behavior of write-to-canvas tools is currently unstable]

**Do not enable write-to-canvas in a production design system file without explicit governance controls.** The REFUSE clause in `FIGMA.md` should explicitly prohibit this unless your team has specifically evaluated and approved it.

### Stale Governance Files

`FIGMA.md` is a document. Like all documents, it becomes wrong over time if it is not maintained. An outdated governance file that permits access to deprecated components, uses old token names, or references wrong file keys is worse than no governance file — it misleads both the agent and the team members who rely on it.

**Remediation:** Tie `FIGMA.md` updates to the design system release process. Add a governance file check to `figma-audit.js`. The `figma-mcp-check.md` report should surface governance file age and flag it when it is more than 90 days old.

---

## Decision Rules

**When to use the Figma MCP server:**

- You have a Professional or Organization plan with Dev Mode access [verify]
- The Figma file has passed `figma-audit.js` with no blocking errors
- You have Code Connect mappings for the components you are generating
- `FIGMA.md` is current and has been reviewed by the design systems team
- A human engineer will review all generated code before it merges

**When not to use the Figma MCP server:**

- The file has not been audited or has blocking audit errors
- Code Connect coverage is below 25% for the components you need
- You are working in a WIP or exploratory section of the file
- The work requires the agent to make design decisions, not implement documented ones
- Your plan does not include Dev Mode

**When to use the CLI context package instead of (or in addition to) MCP:**

- You need stable, reproducible context across multiple sessions
- The file is large enough that real-time retrieval is unreliable
- You want the context to be version-controlled alongside the code
- You are running the agent in CI where interactive MCP sessions are impractical

---

## AI Wayback Machine — Figure 13.1

**Model Context Protocol as a Design Pattern (circa 2024–2025)**

MCP was introduced as an open standard by Anthropic in November 2024. Within months, Figma, GitHub, Slack, and dozens of other platforms had shipped MCP server implementations. The pattern represented a shift from "AI integrations" — bespoke, proprietary connections — to a common protocol that any agent and any server could use to speak the same language.

The earliest MCP integrations for design tools were simple: retrieve a frame, get style data, pass it to the agent. What made the Figma implementation significant was the combination of MCP with Code Connect — a design tool that could not only describe what something looked like, but also tell the agent what to import and how to use it. This was the moment the design-to-code workflow stopped being a context-retrieval problem and started being a design-system-completeness problem. The bottleneck moved from "can the agent see the design" to "is the design system structured well enough to be seen."

Future readers consulting this figure: verify whether MCP has since been superseded by a higher-level abstraction. The structural pattern — agent, protocol, server, governed context — is likely durable even if the specific protocol evolves.

---

## Try This

**Exercise 1 — Session preflight.**
Run `figma-ping.js` against a Figma file you have access to. Does it reach Dev Mode? What does the rate-limit headroom look like? Fix any failures before proceeding.

**Exercise 2 — Write `FIGMA.md` for a real file.**
Draft a governance file for a design system file you work with. Define the authorized scope, what the agent may and may not do, and the escalation conditions. Have a colleague read it: would they know, from this file alone, what an AI coding agent is allowed to do in an MCP session?

**Exercise 3 — Code Connect gap analysis.**
Run `figma-audit.js --check code-connect-coverage` against a file. What percentage of components have mappings? Which high-priority components are missing? Write a Code Connect file for one of them.

**Exercise 4 — With and without context.**
Make the same component request to an AI coding agent twice — once without any Figma context, once with `FIGMA.md`, the spec JSON, and the token JSON provided. Compare the outputs. What changed? What did not change?

**Exercise 5 — Generate `figma-mcp-check.md`.**
Run the MCP preflight check before a working session. Commit the output file. In two weeks, check whether the governance file is still current.

---

## What to Do When MCP Is Not Available

Not every team has Dev Mode access. Not every file is ready for MCP. Not every project justifies the setup overhead. The work done in Chapters 8–12 — token extraction, asset export, documentation sync, compliance monitoring, machine-readable specification — produces most of the value that MCP promises, on any plan, without requiring a live agent connection.

If MCP is not available or not yet ready, pass the outputs of those pipelines to the agent as static context files. The agent can read `tokens.json`, `spec.json`, and `audit.json` from the filesystem without an MCP connection. The governance file still applies. The human gate still applies. The output will be less real-time but not fundamentally different in quality.

The MCP server is not the destination. The extraction layer — audited file, clean tokens, complete spec, Code Connect mappings — is the destination. MCP is one delivery mechanism for that context. Build the layer. Choose the mechanism that fits your plan and your team.

---

*Sources: Figma MCP server guide (help.figma.com/hc/en-us/articles/32132100833559); Figma Code Connect overview (help.figma.com/hc/en-us/articles/23920389749655); Figma Dev Mode guide (help.figma.com/hc/en-us/articles/15023124644247); Anthropic Claude Code documentation (docs.anthropic.com/en/docs/claude-code/overview); Model Context Protocol specification.*
