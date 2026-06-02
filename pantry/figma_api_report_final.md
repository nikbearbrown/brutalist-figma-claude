# Figma API Ecosystem — Technical Research Report
*Current as of June 1, 2026. Sources: Figma developer documentation, official changelogs, Figma Forum, GitHub, and three independent research documents synthesized and reconciled.*

---

## 1. API Overview and Architecture

Figma's developer platform is best understood as five overlapping API surfaces, each engineered for distinct runtime environments and execution contexts.

**REST API** — External systems, CI/CD pipelines, backend services, design-token sync, audit workflows. Runs out-of-band against Figma's cloud storage via standard HTTP. Figma does not need to be open. Base URL: `https://api.figma.com/v1/`. Government/compliance customers route through `https://api.figma-gov.com/v1/`.

**Plugin API** — In-editor automation. Runs inside an open Figma file in a sandboxed QuickJS WebAssembly runtime (replaced the earlier Realms API in 2019 after security vulnerabilities). The plugin background thread has direct read/write access to the document node tree but no DOM, `fetch`, or `localStorage`. To use browser APIs or render UI, a plugin calls `figma.showUI()`, which creates an isolated `<iframe>` inside the Chromium/Electron container. The two threads communicate via a serialized JSON `postMessage` bridge.

**Widget API** — Persistent, multiplayer interactive objects on the Figma/FigJam canvas. React-like JSX syntax with specialized hooks (`useSyncedState`, `useSyncedMap`) for real-time state synchronization across all file viewers. Widgets are visible to everyone; plugins are ephemeral and single-user. Most non-trivial widgets also use the Plugin API for external data or node manipulation.

**Variables API** — Spans both REST and Plugin contexts. REST endpoints handle bulk token read/write; Plugin API handles in-file collection creation and variable-to-node binding. Enterprise gating applies to the REST side only.

**Webhooks API** — Event-driven HTTP POST callbacks. No Figma UI for webhook management; all configuration must go through the API.

### Authentication

Three mechanisms, with distinct use cases:

- **OAuth 2.0** — Recommended for public apps acting on behalf of users. Authorization code grant flow. Mandatory manual security and scope review before public listing on Figma Community. Rate limits tracked per-user per-app, so usage of App A doesn't affect App B for the same user.
- **Personal Access Tokens (PATs)** — Per-user, scoped to that user's account. Passed via `X-Figma-Token` header. Rate limits tracked per-user per-plan. Sharing a PAT across a team means all requests count against one user's limit — a common production mistake.
- **Plan Access Tokens (beta)** — Enterprise/Organization-level tokens decoupled from individual accounts. Supports IP allowlisting and configurable expiration up to one year. Rate limits tracked per-token per-plan. Eliminates pipeline breakage when employees leave.

### Scopes (post-November 2025)

The older broad `files:read` / `file_read` scopes were deprecated and replaced with granular scopes. All OAuth apps created before September 23, 2025 had to re-publish with new scope declarations by November 17, 2025 or face suspension. Current scopes include:

- `file_content:read` — traverse design node trees
- `file_metadata:read` — file metadata
- `file_variables:read` / `file_variables:write` — design token manipulation
- `file_dev_resources:read` / `file_dev_resources:write` — developer-contributed URLs
- `file_comments:read` / `file_comments:write` — comments
- `webhooks:read` / `webhooks:write` — webhook administration

**MCP authentication is separate.** The Figma MCP server handles its own OAuth flow. Developers do not configure REST API scopes for it.

---

## 2. REST API — Endpoints and Capabilities

### Endpoint categories

Files · Comments · Users · Version history · Projects · Components & Styles · Variables · Webhooks · Activity logs · Developer logs · Discovery · Payments · Dev Resources · Library Analytics · SCIM · oEmbed

### Key endpoint: `GET /v1/files/:key`

Returns the full document as JSON. A file key is parseable from any Figma file URL. Representative response shape:

```json
{
  "name": "Design System",
  "lastModified": "2026-05-20T14:12:00Z",
  "editorType": "figma",
  "thumbnailUrl": "https://...",
  "version": "123456",
  "document": {
    "id": "0:0",
    "name": "Document",
    "type": "DOCUMENT",
    "children": []
  },
  "components": {
    "1:12": {
      "key": "257c3beb257a13cba14",
      "name": "Button / Primary",
      "description": "Primary action button",
      "componentSetId": "1:10"
    }
  },
  "componentSets": {},
  "styles": {
    "1:3": {
      "key": "style_blue_primary",
      "name": "Brand / Blue",
      "styleType": "FILL"
    }
  },
  "schemaVersion": 0
}
```

For large files, this endpoint returns an enormous deeply nested tree. Fetching the full file is a Tier 1 call (expensive rate-limit-wise). Use `GET /v1/files/:key/nodes` to fetch specific node subtrees rather than the whole document.

### Write surface

The REST API is largely read-only. Write endpoints are:

- Comments: POST/DELETE comments, POST comment reactions
- Variables: POST bulk create/update/delete (Enterprise only)
- Dev Resources: POST bulk create, PUT bulk update, DELETE by ID
- Webhooks: POST/PUT/DELETE

### Rate limits (effective November 17, 2025)

Limits are calculated dynamically from three factors: **user seat type**, **endpoint tier**, and **the plan of the workspace containing the targeted file** — not the token owner's plan.

| Tier | Endpoints | View/Collab (any plan) | Dev/Full — Professional | Dev/Full — Organization | Dev/Full — Enterprise |
|------|-----------|------------------------|-------------------------|-------------------------|-----------------------|
| **Tier 1** | GET file, GET file nodes, GET image | 6/month | 10/min | 15/min | 20/min |
| **Tier 2** | Comments, Dev Resources, Discovery, Image fills, Projects, Variables GET, Version history, Webhooks | 5/min | 25/min | 50/min | 100/min |
| **Tier 3** | Activity logs, Components/Styles, Developer logs, File metadata, Library Analytics, Users, Variables POST | 10/min | 50/min | 100/min | 150/min |

**The Starter plan trap:** Even an Enterprise Full-seat token hitting a file in a personal Starter workspace is capped at 6 GET file calls per month. `Retry-After` under low-tier lockouts can exceed 300,000 seconds (~4.5 days). This is the single most common unexpected production failure.

Rate limiting uses a leaky bucket algorithm. `429` responses include:

```
Retry-After: <seconds>
X-Figma-Plan-Tier: enterprise | org | pro | starter | student
X-Figma-Rate-Limit-Type: low | high
X-Figma-Upgrade-Link: <url>
```

### Pagination

Cursor-based pagination for high-volume list endpoints (e.g., `GET /v2/webhooks`), returning `next_page` and `prev_page` cursor strings. Offset-based `page_size` for others, with hard caps — the GET team components endpoint caps `page_size` at 1,000.

---

## 3. Variables API (Design Tokens)

Launched at Figma Config 2023. Stable as of 2025–2026.

### Supported variable types

`COLOR` · `FLOAT` (spacing, radius, sizing) · `STRING` · `BOOLEAN`

Also supports typography variable bindings: `fontFamily`, `fontStyle`, `fontWeight`, `lineHeight`, `letterSpacing`, `paragraphSpacing`, `paragraphIndent`.

The 2025 Schema update added Composite/Array types for grouped values (shadow, border, animation states). Expression/computed variables (conditional, e.g., `if(is-dark, #FFF, #111)`) are in 2026 preview/beta.

### Structure

Variables are organized into **Variable Collections**, each containing variables grouped by **modes** (e.g., a semantic color collection with Light and Dark modes). Variables can alias other variables within the same or different collections, enabling tiered token architectures:

- **Primitive tokens** — raw values (`blue-500 → #0072FF`)
- **Semantic tokens** — alias primitives (`button-primary-background → blue-500`)
- **Component-specific tokens** — alias semantics (`btn-submit-bg → button-primary-background`)

**Mode cascade limitation:** Modes do not cascade across distinct collections. If a team defines a primitive collection and a semantic collection, modes must be defined and applied at each level independently.

### REST endpoints

```
GET  /v1/files/:file_key/variables/local
GET  /v1/files/:file_key/variables/published
POST /v1/files/:file_key/variables
```

**Enterprise-only for REST.** Both read and write via REST require a Full seat in an Enterprise organization. Error responses may include `Limited by Figma plan`, `Incorrect account type`, or `Invalid scope`.

**Published vs. local:** The published endpoint omits mode data. To inspect mode values for published variables, cross-reference the local endpoint in the same source file. Published responses include a `subscribed_id` field; local responses do not.

Local variables response shape:

```json
{
  "meta": {
    "variables": {
      "VariableID:1:7": {
        "id": "VariableID:1:7",
        "name": "color/background/default",
        "resolvedType": "COLOR",
        "variableCollectionId": "VariableCollectionId:1:2",
        "valuesByMode": {
          "1:0": { "r": 1, "g": 1, "b": 1, "a": 1 }
        },
        "remote": false,
        "hiddenFromPublishing": false,
        "scopes": [],
        "codeSyntax": {}
      }
    },
    "variableCollections": {
      "VariableCollectionId:1:2": {
        "id": "VariableCollectionId:1:2",
        "name": "Theme",
        "modes": [{ "modeId": "1:0", "name": "Light" }],
        "defaultModeId": "1:0",
        "variableIds": ["VariableID:1:7"]
      }
    }
  }
}
```

POST write payloads must be 4MB or less and follow strict evaluation order: collection mutations → modes → variables → mode values. Temporary IDs link objects within the same request.

### Plugin API (all plans)

The Plugin API provides variable access on all plans (Free, Pro, Organization, Enterprise), making it the practical workaround for non-enterprise token automation:

```typescript
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const variables = await figma.variables.getLocalVariablesAsync("COLOR");

const collection = figma.variables.createVariableCollection("Brand Collection");
const primaryColor = figma.variables.createVariable("primary-brand", collection, "COLOR");

// Bind a variable to a node property
const node = await figma.getNodeByIdAsync("1:4");
node.setBoundVariable("width", widthVariable);
// Bound variables appear in node.boundVariables as variable aliases
```

### W3C Design Token alignment

The W3C Design Tokens Format Module reached stable 1.0 in October 2025. Figma announced native import/export of variables aligned to this spec around the same time. However:

- Native W3C import/export UI is rolling out, with extended collections (multi-brand variable grouping) locked to Enterprise
- Figma's internal variables JSON is Figma-specific, not a native DTCG export
- Production token pipelines still require a translation layer (Style Dictionary, Tokens Studio, or community plugins) for cross-tool or platform-specific output
- Non-enterprise teams rely on community plugins (TokenForge, PRISM Tokens) for W3C-format workflows

**Sync lag:** REST variable changes must be manually published in the file before they become available in external libraries. This does not happen automatically.

**Unpublished cross-file limitation:** Unpublished variables cannot be applied to nodes in other files via API, even though the Figma UI allows it (confirmed June 2025, unresolved).

---

## 4. Plugin and Widget APIs

### Plugin API runtime architecture

```
+-------------------------------------------------------+
| Figma Desktop App / Browser Shell (Chromium/Electron) |
|                                                       |
|   +-----------------------------------------------+   |
|   | Background Thread (QuickJS WASM Sandbox)      |   |
|   | - Direct read/write access to Figma node tree |   |
|   | - No window, document, fetch, or localStorage |   |
|   +-----------------------------------------------+   |
|                           ^                           |
|                           | postMessage bridge        |
|                           | (serialized JSON)         |
|                           v                           |
|   +-----------------------------------------------+   |
|   | Frontend Thread (HTML/CSS UI iframe)          |   |
|   | - Standard browser APIs (DOM, fetch, canvas)  |   |
|   | - Sandboxed; no direct Figma scene access     |   |
|   +-----------------------------------------------+   |
+-------------------------------------------------------+
```

The QuickJS WASM runtime lacks several modern ES6 features including standard object destructuring. Plugin code must be transpiled to ES5 — a common CI/build gotcha. The runtime also uses regex checks to detect `import` statements, which can cause false positives during Webpack bundling.

### Plugin API vs. REST API capabilities

The Plugin API can do things the REST API cannot: direct node mutation, selected-node operations, UI injection, editing live local file state, binding variables to node properties. Conversely, plugins cannot access comments, version history, file permissions, or certain metadata — Figma directs developers to the REST API for those.

### Manifest structure

```json
{
  "name": "Enterprise Pipeline Connector",
  "id": "737805260747778092",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma", "figjam"],
  "documentAccess": "dynamic-page",
  "permissions": ["currentuser", "activeusers"],
  "networkAccess": {
    "allowedDomains": ["https://api.github.com"],
    "reasoning": "Synchronizes local variables to GitHub repositories.",
    "devAllowedDomains": ["http://localhost:3000"]
  }
}
```

`documentAccess: "dynamic-page"` is required to access pages other than the current page asynchronously. Some APIs require explicit permission declarations: `payments` requires the `payments` permission; `currentUser` requires `currentuser`.

### Widget API

Widget manifests include `widgetApi` and `containsWidget` and omit some plugin-only options. Widgets use a JSX-like component syntax and specialized hooks for multiplayer state. They persist on canvas between sessions, are visible to all file viewers, and can be interacted with by any viewer in real time — unlike plugins, which are single-user and ephemeral.

### Plugin API changelog (2024–2026)

- **Update 86 (Feb 2024):** `figma.createComponentFromNode` added
- **Update 91 (Apr 2024):** Typography variable bindings for text properties
- **Update 97 (Jun 2024):** Multiple pages in FigJam; `DevStatus` value `COMPLETED`
- **Update 120 (Nov 2025):** Deprecated `resetOverrides` on `InstanceNode` in favor of `removeOverrides`
- **Update 123 (Jan 2026):** Figma Draw support — `figma.createTextPath`, variable stroke width on vector nodes
- **Update 126 (May 2026):** CSS-grid auto-track generation and track reordering

---

## 5. Webhooks

Webhooks are at `/v2/webhooks` (note v2, not v1). No Figma UI for management — all CRUD via API. Require admin access to the team and a paid plan; Starter plan does not support webhooks.

### Events

| Event | Behavior |
|-------|----------|
| `FILE_UPDATE` | Fires after 30 minutes of editing inactivity — not a real-time event. Not suitable for instant pipeline triggers. |
| `FILE_VERSION_UPDATE` | Fires when a named version is saved. |
| `FILE_DELETE` | Fires on file deletion. |
| `LIBRARY_PUBLISH` | Fires when a component or variable library is published. May split across multiple events for large libraries — treat payloads as partial. |
| `FILE_COMMENT` | Fires instantly on comment creation. |
| `DEV_MODE_STATUS_UPDATE` | Fires when a design section is marked "Ready for Dev" — useful for triggering build pipelines. |
| `PING` | For endpoint testing. |

Example payload:

```json
{
  "event_type": "LIBRARY_PUBLISH",
  "webhook_id": 987654,
  "file_key": "abcd1234efgh",
  "file_name": "Core Design System",
  "passcode": "secure_verifier_string",
  "triggered_by": {
    "id": "usr_9981",
    "handle": "Jane Doe"
  },
  "timestamp": "2026-06-01T20:00:00Z",
  "created_components": [],
  "modified_components": [],
  "deleted_components": []
}
```

### Plan limits

| | Professional | Organization | Enterprise |
|-|-------------|--------------|------------|
| Max webhooks per plan | 150 | 300 | 600 |
| Per team context | 20 | 20 | 20 |
| Per project context | 5 | 5 | 5 |
| Per file context | 3 | 3 | 3 |

### Delivery and retry

Endpoints must return `200 OK` within timeout. Retry schedule on failure:

- Retry 1: 5 minutes after initial failure
- Retry 2: 30 minutes after second failure
- Retry 3: 3 hours after third failure

Verify the `passcode` field on every incoming request. Inspect delivery history via `GET /v2/webhooks/:webhook_id/requests`.

### Production pattern

Treat webhook payloads as event signals, not authoritative state. The canonical production pattern:

1. Verify passcode/signature
2. Persist event ID or hash for idempotency
3. Queue the event for async processing
4. Re-fetch authoritative state from REST API after receiving the event
5. Never assume the payload contains the complete current object graph

---

## 6. Dev Mode and Dev Resources API

**Dev Mode** is Figma's developer handoff surface — a read-only inspection mode that simplifies the layers panel and exposes implementation-oriented information: CSS box model, spacing, typography, component specs, variable code syntax. Requires a Dev or Full seat on a paid plan; Starter plan files cannot use Dev Mode.

Dev Mode plugins can extend or replace the Inspect panel, pulling context from external tools (Jira, GitHub, internal APIs, custom code-generation systems) and surfacing it alongside design properties.

In Dev Mode, plugins can track the active selection via:

```typescript
const activeFocusNode = figma.currentPage.focusedNode;
```

### Dev Resources API

Dev Resources attach external URLs (Storybook pages, Jira tickets, GitHub PRs, implementation docs) directly to Figma nodes. They appear in Dev Mode and support bidirectional linking — Figma's Jira integration uses this pattern: a Figma dev resource can create a Jira link and vice versa.

**Dev Resources do not require publishing.** Changes propagate immediately, including to published components used in other files. This distinguishes them from variables and components, which must be published.

Endpoints (Tier 2, require `file_dev_resources:read` or `file_dev_resources:write`):

```
GET    /v1/files/:file_key/dev_resources          — resources on specific nodes
POST   /v1/dev_resources                          — bulk-create across multiple files
PUT    /v1/dev_resources                          — bulk-update
DELETE /v1/files/:file_key/dev_resources/:id      — remove a resource
```

**Code Connect** links Figma components to actual codebase components. When a developer or AI agent generates code from a design, Code Connect ensures it reuses real components from the codebase rather than generating generic code. Generally available as of 2025.

---

## 7. Figma MCP Server (2025–2026)

### Release and status

Beta announced June 4, 2025. Write-to-canvas capability announced March 2026 ("Agents, Meet the Figma Canvas"). Actively evolving; still in beta as of June 2026.

### Architecture

```
+-------------------------------------------------------+
| Developer IDE (VS Code, Cursor, Claude Code CLI)      |
|                                                       |
|   +-----------------------------------------------+   |
|   | AI Coding Agent                               |   |
|   | - Interprets design context                   |   |
|   | - Generates production-ready code             |   |
|   +-----------------------------------------------+   |
|                           ^                           |
|                           | Model Context Protocol    |
|                           | (MCP tool calls)          |
|                           v                           |
|   +-----------------------------------------------+   |
|   | Figma MCP Server                              |   |
|   | Remote: https://mcp.figma.com/mcp (OAuth)     |   |
|   | Desktop: http://127.0.0.1:3845/mcp (PAT)      |   |
|   +-----------------------------------------------+   |
+---------------------------+---------------------------+
                            |
                            | Figma REST API + Dev Mode
                            v
+-------------------------------------------------------+
| Figma Developer Platform / Cloud Storage              |
+-------------------------------------------------------+
```

The MCP server is an integration layer that translates MCP tool calls into Figma API requests, packaging design context in an agent-optimized format. It is not just a REST proxy — it adds semantic structure that raw REST JSON lacks.

### Two deployment modes

**Remote (cloud):** Runs at `https://mcp.figma.com/mcp`. OAuth authentication. Supports all features including write-to-canvas. Requires the client to be listed in the Figma MCP Catalog — access requires applying and waiting for approval.

**Desktop (local):** Runs at `http://127.0.0.1:3845/mcp` via the Figma desktop app's Dev Mode sidebar. PAT authentication. For Enterprise/Organization customers with strict security requirements. No write-to-canvas.

### Key tools

- `get_design_context` — layout, variables, styles, component usage for a selected frame
- `get_screenshot` — rendered image of a frame
- `get_variable_defs` — variable definitions and code syntax
- `get_code_connect_map` — Code Connect mappings from Figma components to codebase components
- `use_figma` — write to canvas: create/modify frames, components, variables, auto layout (remote only; currently free during beta, will become usage-based paid)

**Figma Skills** are guided workflow templates that help agents call tools in the correct order. For example, a skill ensures agents apply auto layout properties correctly when creating elements. Skills can be shared via the Figma Community.

### What MCP adds beyond REST

- Semantic, agent-optimized design context (vs. raw node JSON)
- Dev Mode-aware access patterns
- Code Connect integration — REST API doesn't expose this
- Write-to-canvas from an AI agent
- Agent can reference the selected frame interactively rather than requiring manual node ID lookup

### What MCP does not replace

Full REST API integrations, webhook-driven automation, Enterprise audit workflows, bulk token pipelines, plugin-based in-editor manipulation.

### Rate limits for MCP

Read tools follow Tier 1 REST API limits. View/Collab seats and all Starter plan users: 6 tool calls per month. Dev/Full seat on paid plans: per-minute limits matching Tier 1. Write-to-canvas tools are currently rate-limit-exempt during beta.

### Current limitations

- Must explicitly select a Figma frame to provide design context; without selection the agent has no reference
- Write-to-canvas is remote server only
- VS Code usage requires an active GitHub Copilot subscription
- Large/complex frames can cause timeouts
- Beta instability; feature set is changing rapidly

---

## 8. SDKs, Tooling, and Ecosystem

### Official

- `figma/rest-api-spec` (GitHub) — OpenAPI 3.1.0 specification with TypeScript types; beta announced February 2024
- `@figma/rest-api-spec` (npm) — TypeScript types generated from the OpenAPI spec

```typescript
import { type GetFileResponse } from '@figma/rest-api-spec';
import axios from 'axios';

const response = await axios.get<GetFileResponse>('https://api.figma.com/v1/files/abcd1234', {
  headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN }
});
```

- `@figma/plugin-typings` (npm) — TypeScript types for Plugin API development
- `figma/plugin-samples` and `figma/widget-samples` (GitHub) — official samples, provided as-is
- Figma MCP Catalog — approved MCP client directory (apply for access)

### Community

- `figma-api` (npm) — popular community REST client; maintenance inconsistent; the OpenAPI spec is generally preferred for new projects
- `figma-console-mcp` — routes Plugin API calls via bridge for non-enterprise variable management
- `figma-mcp-go` — open-source Go MCP server using Plugin API bridge to bypass REST rate limits

### Common pipeline patterns

- **Design token sync:** Variables API (REST, Enterprise) or Plugin API (all plans) → Style Dictionary/Tokens Studio → CSS/SCSS/Swift/Compose/JSON
- **Asset export:** `GET /v1/images` with batching; cache aggressively to avoid Tier 1 rate limits
- **Visual regression:** Export frames → Chromatic/Percy/Storybook integration
- **Spec generation:** REST file JSON + Dev Mode metadata
- **Ticket integration:** Dev Resources API + Jira/GitHub/Linear
- **Design-system analytics:** Library Analytics API (Enterprise, beta)
- **AI code generation:** MCP server + Dev Mode + Code Connect

### Design-to-code tools

Anima, Locofy, Builder.io, DhiWise all rely on combinations of REST file access, Plugin API, node metadata, and proprietary code-generation logic. The Figma API provides the design graph; the hard part is interpretation — layout semantics, responsive intent, component meaning, accessibility, and production framework conventions.

---

## 9. Practical Limits and Pain Points

### Data not accessible via REST API

- Prototype interactions, expressions, conditions, and variable-driven logic
- Real-time/unsaved file state (REST reflects saved state only)
- Font files (only font metadata)
- Plugin-specific storage data
- Comment edit histories and unresolved thread context
- Document metadata such as project movements, user seat changes, workspace paths
- Exact pixel rendering (requires the images endpoint, which renders via Figma's engine)

### Rate limit failure modes

- **Starter workspace trap:** Enterprise Full-seat token + Starter-plan file = 6 GET file calls per month with potential 4.5-day lockouts. File plan governs the limit, not token owner's plan.
- **Shared PATs:** Multiple users/services sharing one PAT all drain one user's limit. Use OAuth per-user-per-app scoping in production.
- **Large file traversal:** Even within per-minute limits, enormous node trees can trigger 429s due to response payload size/complexity, not just request frequency.
- **Caching gaps:** `GET /v1/files/:key` fetches the full tree on every call if not cached. Repeated imports (e.g., DhiWise-style integrations) commonly exhaust limits.

### Variables limitations

Full REST token pipeline automation requires: Enterprise plan + Full seat + correct scopes + manual publish after changes + careful mode mapping + alias cycle prevention + naming governance + W3C DTCG translation layer. Non-enterprise teams must use Plugin API or community tools.

### Webhook limitations

- `FILE_UPDATE` fires only after 30 minutes of inactivity — not real-time
- `LIBRARY_PUBLISH` may split across multiple events for large libraries
- Project-context webhooks appear non-functional as of mid-2025 (no official resolution)
- Payloads must be treated as partial event signals, not complete state snapshots

### Plugin limitations

- QuickJS runtime lacks some ES6 features; transpile to ES5
- Webpack bundling can have false-positive `import` detection issues
- Cannot access comments, version history, file permissions, or workspace metadata — use REST API for those
- Cannot access external libraries unless their components/styles are imported into the open file

### Breaking changes 2024–2025

- **Dec 2024:** HTTP requests blocked (HTTPS required; previously auto-redirected)
- **Nov 2025:** Full OAuth scope restructuring; all apps required to re-publish
- **Nov 2025:** Rate limits formally published and enforced
- **May 2025:** Webhooks promoted from experimental to stable API version
- **Jun 2025:** Experimental webhook endpoint deprecated; `asset.*` events split into `file.*` + `folder.*`
- **Nov 2025:** `resetOverrides` deprecated on `InstanceNode` in favor of `removeOverrides`

---

## 10. Competitive and Strategic Context

### Figma vs. Penpot

| Area | Figma | Penpot |
|------|-------|--------|
| Core strength | Mature collaborative platform, enterprise adoption, Dev Mode, MCP | Open source, self-hostable, standards-forward |
| API architecture | REST API + Plugin API + Webhooks + Variables + Dev Resources + MCP | Dual system: RPC API (server-side) + Plugin API (canvas) |
| API stability | Stable REST semantics, versioned | RPC-style backend; internal methods may change without notice — historical disadvantage for third-party integrations |
| Design tokens | Native variables with modes, REST/Plugin API, Figma-specific JSON format | Native W3C DTCG format with sets, themes, aliases, equations, JSON import/export — no translation layer needed |
| Token REST gating | Enterprise only for REST write | No comparable Enterprise paywall |
| AI/code workflow | Official MCP server, Dev Mode, Code Connect, Figma Make | Emerging community and official MCP activity |
| Enterprise governance | Strong: SCIM, Activity logs, plan access tokens, IP allowlisting, Governance+ | Self-hosting appeals to data-sovereignty requirements; GDPR advantage (Spanish company, MPL-2.0 license) |
| Pricing | Per-seat (up to ~$90/month/user Enterprise) | Flat: $175/month for teams, $950/month enterprise, unlimited seats |
| Format lock-in | Proprietary binary + Figma-specific JSON | SVG, CSS, HTML — human-readable, version-controllable without vendor permission |

### Post-Adobe trajectory

Adobe's acquisition was blocked in December 2023. Since then Figma has shipped at notably higher velocity: Variables API write support, Library Analytics API, Code Connect, MCP server, Figma Sites (web publishing), Figma Make (prompt-to-code), Figma Draw, Figma Buzz, native W3C design token import/export, full OAuth developer platform overhaul, and write-to-canvas for AI agents.

### 2025–2026 roadmap signals

- **AI agents writing to canvas** is the dominant strategic direction. The `use_figma` write tool (currently free beta, becoming usage-based paid) is the primary commercial signal.
- **MCP as platform:** The partner catalog and client approval process signals Figma positioning MCP as a curated platform, not just a feature.
- **Design systems as AI context:** Code Connect + MCP + design tokens as the enterprise value proposition — the more mature your design system, the better AI code generation works.
- **Expression/computed variables** (2026 preview) signal the Variables system moving toward programmatic logic.
- **Figma Make** (prompt-to-code) + MCP integration suggests bidirectional AI workflows: code → Figma and Figma → code.
- **Flat-fee competitive pressure from Penpot** may influence pricing and feature accessibility decisions, particularly around Enterprise-gated API features.

---

## Summary: When to Use What

| Need | Right tool |
|------|-----------|
| External automation, CI/CD, background sync | REST API |
| In-editor node manipulation, live file editing | Plugin API |
| Persistent multiplayer canvas objects | Widget API |
| Design token read/write (Enterprise) | Variables REST API |
| Design token automation (non-Enterprise) | Plugin API + community tools |
| Event-driven pipeline triggers | Webhooks (`DEV_MODE_STATUS_UPDATE` for dev handoff; `LIBRARY_PUBLISH` for library changes) |
| Linking design nodes to tickets/PRs/docs | Dev Resources API |
| AI coding agent code generation | MCP server + Code Connect |
| Design-system usage analytics | Library Analytics API (Enterprise) |
| Org user provisioning | SCIM API (Enterprise) |
