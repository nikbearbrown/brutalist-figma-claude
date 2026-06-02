# Chapter 3 — Reading a Figma File Programmatically

*Before you build a pipeline, you need to be able to read what the pipeline will consume.*

---

## What This Chapter Lets You Do

After this chapter you can: fetch a Figma file via the REST API and understand the shape of the response; navigate the node tree to find components, variables, and styles; write the response to a local fixture so you can develop and test without hammering the API; and produce a component inventory, a variable inventory, and a missing-description report from the raw JSON.

This chapter introduces the second named CLI artifact: `figma-read.mjs`.

---

## The Failure

You have `figma-ping.js` passing. You run your first full file fetch:

```bash
node -e "
  const res = await fetch('https://api.figma.com/v1/files/abc123XYZdef456', {
    headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
" 2>/dev/null | head -50
```

The output begins:

```json
{
  "document": {
    "id": "0:0",
    "name": "Document",
    "type": "DOCUMENT",
    "children": [
      {
        "id": "0:1",
        "name": "Page 1",
        "type": "CANVAS",
        "children": [
          {
            "id": "1:2",
            "name": "Frame 1",
            "type": "FRAME",
            "children": [
```

You pipe it to `wc -l`. The file is 47,000 lines. You search for a component you know exists — `Button / Primary / Default`. It is in there, somewhere, nested at depth seven. You search for the color token you want. The value is there, but it is stored as `{ "r": 0.082, "g": 0.337, "b": 0.855, "a": 1 }` — not `#1558D6`. You search for variables. They are not in the main document response. [verify — variables location in response structure current as of writing]

You have the data. You cannot find anything in it. You do not know what to look for or where.

This chapter is the map.

---

## Diagnosis: The Document Graph

### The node tree

A Figma file is a tree of nodes. Every visible object on the canvas is a node. Every invisible container is a node. The document itself is a node — the root.

The tree has a consistent shape at the top:

```
DOCUMENT (the root node, id "0:0")
  └── CANVAS (one per page)
        └── FRAME | COMPONENT | COMPONENT_SET | GROUP | ...
              └── (any node type, recursively)
```

**Node types you will encounter most often:**

| Type | What it is |
|---|---|
| `DOCUMENT` | The file root. Has one child per page. |
| `CANVAS` | A Figma page. Children are top-level frames and components. |
| `FRAME` | A layout container. Screens, sections, artboards. |
| `COMPONENT` | A component definition. Reusable. Has a `componentId`. |
| `COMPONENT_SET` | A variant group. Contains `COMPONENT` children. |
| `INSTANCE` | A placed instance of a component. Has `componentId` pointing to the source. |
| `GROUP` | An informal grouping. No layout constraints. |
| `TEXT` | A text layer. Has `characters`, `style`, and `styleOverrideTable`. |
| `RECTANGLE` | A rectangle. Also used for image fills. |
| `VECTOR` | A vector path. Used for icons and complex shapes. |
| `ELLIPSE` | A circle or ellipse. |
| `BOOLEAN_OPERATION` | A combined vector operation (union, subtract, intersect, exclude). |
| `LINE` | A line. |

**Every node has these properties:**

- `id` — unique within the file, stable for the lifetime of the node (deletions aside)
- `name` — the layer name, as shown in the Layers panel
- `type` — one of the types above
- `children` — an array of child nodes (absent on leaf nodes)
- `visible` — boolean, default true

**Most nodes also have:**

- `fills` — array of fill objects (colors, gradients, images)
- `strokes` — array of stroke objects
- `effects` — array of effect objects (shadows, blurs)
- `constraints` — layout constraint relative to the parent
- `absoluteBoundingBox` — position and size on the canvas
- `boundVariables` — which properties have variable bindings

Understanding `boundVariables` is critical. A fill that looks like a solid color in the `fills` array may actually be resolved from a variable. The `fills` array gives you the resolved value; `boundVariables` tells you which variable produced it. For pipeline purposes, you almost always want the variable reference, not the resolved value — because the variable is the token, and the token is what you maintain.

### Variables in the response

Variables are not embedded in the node tree. [verify — current location of variable data in the GET /v1/files/:key response] They appear at the top level of the file response, alongside the document:

```json
{
  "document": { ... },
  "components": { ... },
  "componentSets": { ... },
  "styles": { ... },
  "name": "My Design System File",
  "lastModified": "2026-05-28T14:22:00Z",
  "version": "1234567890",
  "variables": {
    "variables": {
      "VariableID:12:45": {
        "id": "VariableID:12:45",
        "name": "color/brand/primary",
        "resolvedType": "COLOR",
        "valuesByMode": {
          "12:0": { "r": 0.082, "g": 0.337, "b": 0.855, "a": 1 },
          "12:1": { "r": 0.031, "g": 0.243, "b": 0.624, "a": 1 }
        },
        "description": "Primary brand color. Use for CTAs, links, and focus rings.",
        "hiddenFromPublishing": false,
        "variableCollectionId": "VariableCollectionId:12:0"
      }
    },
    "variableCollections": {
      "VariableCollectionId:12:0": {
        "id": "VariableCollectionId:12:0",
        "name": "Brand Colors",
        "modes": [
          { "modeId": "12:0", "name": "Light" },
          { "modeId": "12:1", "name": "Dark" }
        ],
        "defaultModeId": "12:0"
      }
    }
  }
}
```

**The critical points:**

- Variables live in collections. A collection has one or more modes (Light/Dark, Mobile/Desktop, Brand A/Brand B).
- Each variable has a value per mode. If you want the dark-mode value of `color/brand/primary`, you look up mode ID `12:1` in `valuesByMode`.
- Variable values can be alias references — one variable pointing to another. An alias looks like `{ "type": "VARIABLE_ALIAS", "id": "VariableID:11:30" }` instead of a raw value. Follow the alias chain to resolve the final value.
- The `variables` field in the file response may not appear on non-Enterprise plans, or may appear empty. [verify — current behavior by plan tier] This is why `figma-ping.js` checks the variables endpoint separately.

### Components and styles in the response

Components appear in two places:

1. In the `components` top-level map — a flat index of all component definitions in the file, keyed by component ID. Each entry has `name`, `description`, `key` (a stable library key), `nodeId`, and `componentSetId` if it belongs to a variant group.

2. In the document tree — the actual `COMPONENT` and `COMPONENT_SET` nodes, with their full property trees.

The `components` map is what you use for a component inventory. The document tree is what you traverse when you need the full property graph of a component — its fills, text layers, constraints, and variable bindings.

Styles appear similarly in a top-level `styles` map: an index of all style definitions (color styles, text styles, effect styles, grid styles) with names, descriptions, and keys.

**The difference between styles and variables:** Figma has two token-like systems. Styles are the older system — named, reusable fills, text properties, effects. Variables are the newer system, introduced as Figma's answer to design tokens, with multi-mode support and alias chains. Most design systems are migrating from styles to variables. Many still use both. Your extraction code needs to handle both.

### What is NOT in the response

This is as important as what is in it.

**Prototype interactions and flow logic.** The connections between frames, interaction triggers, animation types, and smart animate settings are not returned in the standard file response. [verify — whether prototype data is in a separate endpoint or omitted from REST entirely] They are visible in Figma's prototype panel but are not part of the document graph exposed by `GET /v1/files/:key`.

**Font files.** Figma does not distribute font files via API. You can see which font families and weights are in use (from the `style` properties on `TEXT` nodes), but you cannot download the fonts through the Figma API. If your pipeline needs fonts, source them separately.

**Component usage counts.** The REST API tells you a component exists and where it is defined; it does not tell you how many times it is used across a file or team. Usage counts are available in the Figma UI but not programmatically via REST. [verify — current REST capabilities for usage data]

**Plugin-private data.** Data stored in plugin storage (the `setPluginData` / `getPluginData` Plugin API methods) is not accessible via REST. If a plugin stores token metadata in plugin storage, you cannot read it without the plugin.

**The current user's active selection or view state.** The API returns the document state, not the editor state.

---

## Building `figma-read.mjs`

`figma-read.mjs` is the foundational reading tool. It fetches the file, writes a local fixture, and produces three outputs: a component inventory, a variable inventory, and a missing-description report.

The `.mjs` extension means it runs as an ES module. Node.js has supported top-level `await` in ES modules since version 14. Use it.

### The full script

```javascript
#!/usr/bin/env node
// figma-read.mjs — Figma file reader, fixture writer, and inventory reporter
// Illustrative. Review and adapt before use in production.
// Usage: FIGMA_TOKEN=... FIGMA_FILE_KEY=... node figma-read.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY;
const BASE_URL = 'https://api.figma.com'; // [verify — current base URL]

if (!FIGMA_TOKEN || !FIGMA_FILE_KEY) {
  console.error('Error: FIGMA_TOKEN and FIGMA_FILE_KEY must be set.');
  process.exit(1);
}

// ── 1. Fetch the file ─────────────────────────────────────────────────────────

async function fetchFile(fileKey) {
  const url = `${BASE_URL}/v1/files/${fileKey}`;
  console.log(`Fetching: ${url}`);

  const res = await fetch(url, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN }, // [verify — header name current]
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10);
    console.warn(`Rate limited. Wait ${retryAfter}s before retrying.`);
    process.exit(2);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`Figma API error: ${res.status} — ${body.err || 'unknown'}`);
    process.exit(1);
  }

  return res.json();
}

// ── 2. Write a local fixture ──────────────────────────────────────────────────

function writeFixture(data, fileKey) {
  const dir = path.join(__dirname, '.figma-fixtures');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${fileKey}-${new Date().toISOString().slice(0, 10)}.json`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Fixture written: ${filepath}`);
  return filepath;
}

// ── 3. Walk the node tree ─────────────────────────────────────────────────────

function walk(node, visitor, depth = 0) {
  visitor(node, depth);
  if (node.children) {
    for (const child of node.children) {
      walk(child, visitor, depth + 1);
    }
  }
}

// ── 4. Extract component inventory ───────────────────────────────────────────

function extractComponents(data) {
  const inventory = [];
  const componentMap = data.components || {};

  for (const [id, meta] of Object.entries(componentMap)) {
    inventory.push({
      id,
      name: meta.name,
      description: meta.description || '',
      key: meta.key,
      componentSetId: meta.componentSetId || null,
      hasDescription: Boolean(meta.description && meta.description.trim()),
    });
  }

  return inventory.sort((a, b) => a.name.localeCompare(b.name));
}

// ── 5. Extract variable inventory ────────────────────────────────────────────

function hexFromColor(color) {
  // Convert Figma's 0–1 float RGBA to hex string.
  // Alpha is omitted if 1.
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  const hex = `#${r}${g}${b}`.toUpperCase();
  if (color.a !== undefined && color.a < 1) {
    const a = Math.round(color.a * 255).toString(16).padStart(2, '0');
    return `${hex}${a}`;
  }
  return hex;
}

function resolveValue(value, variables) {
  // Follow alias chains to terminal values.
  if (value && value.type === 'VARIABLE_ALIAS') {
    const target = variables[value.id];
    if (!target) return { type: 'UNRESOLVED_ALIAS', id: value.id };
    // Return first mode's value of target for display purposes
    const firstModeId = Object.keys(target.valuesByMode)[0];
    return resolveValue(target.valuesByMode[firstModeId], variables);
  }
  if (value && typeof value === 'object' && 'r' in value) {
    return { type: 'COLOR', hex: hexFromColor(value), raw: value };
  }
  return { type: 'SCALAR', raw: value };
}

function extractVariables(data) {
  const variablesData = data.variables;
  if (!variablesData || !variablesData.variables) {
    return { available: false, variables: [], collections: [] };
  }

  const rawVars = variablesData.variables;
  const rawCollections = variablesData.variableCollections || {};

  const collections = Object.entries(rawCollections).map(([id, col]) => ({
    id,
    name: col.name,
    modes: col.modes,
    defaultModeId: col.defaultModeId,
  }));

  const variables = Object.entries(rawVars).map(([id, v]) => {
    const collection = rawCollections[v.variableCollectionId];
    const modes = collection ? collection.modes : [];
    const valuesByMode = {};
    for (const { modeId, name } of modes) {
      const raw = v.valuesByMode[modeId];
      valuesByMode[name] = resolveValue(raw, rawVars);
    }
    return {
      id,
      name: v.name,
      resolvedType: v.resolvedType,
      description: v.description || '',
      collectionName: collection ? collection.name : 'unknown',
      hiddenFromPublishing: v.hiddenFromPublishing,
      valuesByMode,
    };
  });

  return { available: true, variables, collections };
}

// ── 6. Reports ────────────────────────────────────────────────────────────────

function reportComponents(components) {
  const total = components.length;
  const withDescription = components.filter((c) => c.hasDescription).length;
  const missing = components.filter((c) => !c.hasDescription);

  console.log(`\n── Component inventory ──`);
  console.log(`  Total components: ${total}`);
  console.log(`  With description: ${withDescription}`);
  console.log(`  Missing description: ${missing.length}`);

  if (missing.length > 0) {
    console.log(`\n  Components missing descriptions:`);
    for (const c of missing.slice(0, 10)) {
      console.log(`    - ${c.name} (${c.id})`);
    }
    if (missing.length > 10) {
      console.log(`    ... and ${missing.length - 10} more`);
    }
  }

  return {
    total,
    withDescription,
    missingDescription: missing.length,
    components,
    missingDescriptionComponents: missing,
  };
}

function reportVariables(variableData) {
  console.log(`\n── Variable inventory ──`);
  if (!variableData.available) {
    console.log('  Variables API not available (likely non-Enterprise plan).');
    console.log('  Use Tokens Studio or Plugin API for token extraction (Chapter 8).');
    return variableData;
  }

  const { variables, collections } = variableData;
  console.log(`  Collections: ${collections.length}`);
  console.log(`  Variables: ${variables.length}`);

  for (const col of collections) {
    const colVars = variables.filter((v) => v.collectionName === col.name);
    console.log(`\n  Collection: ${col.name} (${col.modes.map((m) => m.name).join(', ')})`);
    console.log(`    Variables: ${colVars.length}`);
    for (const v of colVars.slice(0, 5)) {
      console.log(`    - ${v.name} [${v.resolvedType}]`);
    }
    if (colVars.length > 5) {
      console.log(`    ... and ${colVars.length - 5} more`);
    }
  }

  return variableData;
}

function reportPages(data) {
  const pages = data.document.children || [];
  console.log(`\n── Page / frame structure ──`);
  console.log(`  Pages: ${pages.length}`);

  for (const page of pages) {
    const topLevel = page.children || [];
    console.log(`\n  Page: "${page.name}"`);
    console.log(`    Top-level objects: ${topLevel.length}`);
    const types = {};
    for (const node of topLevel) {
      types[node.type] = (types[node.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(types)) {
      console.log(`      ${type}: ${count}`);
    }
  }
}

// ── 7. Write machine-readable output ─────────────────────────────────────────

function writeOutput(components, variableData, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  // Component inventory JSON
  const componentInventoryPath = path.join(outputDir, 'component-inventory.json');
  fs.writeFileSync(
    componentInventoryPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      fileKey: FIGMA_FILE_KEY,
      total: components.total,
      withDescription: components.withDescription,
      missingDescription: components.missingDescription,
      components: components.components,
    }, null, 2),
    'utf-8'
  );
  console.log(`\nOutput written: ${componentInventoryPath}`);

  // Missing description report
  if (components.missingDescriptionComponents.length > 0) {
    const missingPath = path.join(outputDir, 'missing-descriptions.md');
    const lines = [
      '# Components Missing Descriptions',
      '',
      `Generated: ${new Date().toISOString()}`,
      `File key: ${FIGMA_FILE_KEY}`,
      '',
      `${components.missingDescriptionComponents.length} components have no description field.`,
      '',
      '| Name | ID |',
      '|---|---|',
      ...components.missingDescriptionComponents.map(
        (c) => `| ${c.name} | ${c.id} |`
      ),
    ];
    fs.writeFileSync(missingPath, lines.join('\n'), 'utf-8');
    console.log(`Output written: ${missingPath}`);
  }

  // Variable inventory JSON (if available)
  if (variableData.available) {
    const variablesPath = path.join(outputDir, 'variable-inventory.json');
    fs.writeFileSync(
      variablesPath,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        fileKey: FIGMA_FILE_KEY,
        collections: variableData.collections,
        variables: variableData.variables,
      }, null, 2),
      'utf-8'
    );
    console.log(`Output written: ${variablesPath}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('=== figma-read: reading file and building inventory ===');

const data = await fetchFile(FIGMA_FILE_KEY);
const fixturePath = writeFixture(data, FIGMA_FILE_KEY);

reportPages(data);
const components = reportComponents(extractComponents(data));
const variableData = reportVariables(extractVariables(data));

const outputDir = path.join(__dirname, 'figma-output');
writeOutput(components, variableData, outputDir);

console.log('\n=== figma-read complete ===');
console.log(`Fixture: ${fixturePath}`);
console.log(`Output: ${outputDir}/`);
```

### Running it

```bash
# Install nothing — uses native Node.js fetch (Node 18+)
# Requires: FIGMA_TOKEN and FIGMA_FILE_KEY in environment or .env

node figma-read.mjs
```

**Expected output (truncated):**

```
=== figma-read: reading file and building inventory ===
Fetching: https://api.figma.com/v1/files/abc123XYZdef456
Fixture written: .figma-fixtures/abc123XYZdef456-2026-06-01.json

── Page / frame structure ──
  Pages: 3

  Page: "Components"
    Top-level objects: 12
      FRAME: 8
      COMPONENT_SET: 4

  Page: "Foundations"
    Top-level objects: 6
      FRAME: 6

  Page: "_Archive"
    Top-level objects: 3
      FRAME: 3

── Component inventory ──
  Total components: 147
  With description: 23
  Missing description: 124

  Components missing descriptions:
    - Badge / Default (102:45)
    - Badge / Error (102:46)
    - Badge / Success (102:47)
    - Banner / Info (103:12)
    - Banner / Warning (103:13)
    ... and 119 more

── Variable inventory ──
  Collections: 3
  Variables: 89

  Collection: Primitives (Light, Dark)
    Variables: 32
    - color/primitive/blue-100 [COLOR]
    - color/primitive/blue-200 [COLOR]
    - color/primitive/blue-300 [COLOR]
    - color/primitive/blue-400 [COLOR]
    - color/primitive/blue-500 [COLOR]
    ... and 27 more

Output written: figma-output/component-inventory.json
Output written: figma-output/missing-descriptions.md
Output written: figma-output/variable-inventory.json

=== figma-read complete ===
Fixture: .figma-fixtures/abc123XYZdef456-2026-06-01.json
Output: figma-output/
```

The missing-description count of 124 out of 147 is not unusual for a real design system file. It is a finding, not a failure. Chapter 5 will turn findings like this into structured audit output.

---

## The Local Fixture Pattern

The fixture written by `figma-read.mjs` is one of the most valuable practices in this book.

**Why it matters:** A full file fetch on a large design system file takes several seconds and consumes rate-limit quota. If you are writing extraction code — iterating on a traversal function, debugging a variable resolver, testing an output format — you do not want to hit the API on every run. The fixture is a local snapshot of the file response that lets you develop and test offline.

**How to use it:**

```javascript
// In development / test mode, load from fixture instead of API
const FIXTURE_PATH = process.env.FIGMA_FIXTURE_PATH;

const data = FIXTURE_PATH
  ? JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))
  : await fetchFile(FIGMA_FILE_KEY);
```

**What the fixture is:**

The fixture is a snapshot, not a live source. It has the same limitation as any snapshot: it becomes stale when the file changes. Update the fixture when you need to test against the current state of the file. Treat it as a test artifact, not a production artifact.

**Fixture hygiene:**

- Add `.figma-fixtures/` to `.gitignore`. Fixtures contain your file structure, which may include unpublished design work. Do not commit them to a public repository.
- Name fixtures with the file key and date so you know when they were generated.
- Consider a `make-fixture` script in `package.json` that regenerates the fixture explicitly: `"figma:fixture": "node figma-read.mjs --write-fixture-only"`.

---

## Navigating the Node Tree

The walk function in `figma-read.mjs` is the foundation of every traversal you will write. Let's look at what you can do with it.

### Finding all instances of a component

```javascript
// Find all instances of a specific component
function findInstances(document, componentId) {
  const instances = [];
  walk(document, (node) => {
    if (node.type === 'INSTANCE' && node.componentId === componentId) {
      instances.push(node);
    }
  });
  return instances;
}
```

### Finding all nodes with hardcoded colors (not bound to variables)

```javascript
// Find fills that are hardcoded colors (not variable-bound)
function findHardcodedColors(document) {
  const findings = [];
  walk(document, (node) => {
    if (!node.fills) return;
    for (const fill of node.fills) {
      if (fill.type !== 'SOLID') continue;
      const isBound = node.boundVariables &&
        node.boundVariables.fills &&
        node.boundVariables.fills.some((b) => b);
      if (!isBound) {
        findings.push({
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          fill,
        });
      }
    }
  });
  return findings;
}
```

This is the beginning of the audit logic that Chapter 5 formalizes. Understanding the traversal here means you can extend it to any check you need.

### The depth trap

The full file response for a large design system file can be 50,000+ lines of JSON. Walking the entire tree for every check is slow. Two strategies:

1. **`GET /v1/files/:key?depth=N`** — fetch only the top N levels of the tree. Useful for page and frame structure; not useful for deep property inspection. [verify — depth parameter behavior current as of writing]

2. **`GET /v1/files/:key/nodes?ids=ID1,ID2`** — fetch specific nodes and their subtrees. Use when you know which nodes you need. Much more efficient for targeted extraction.

For full audits, you will typically need the full tree. For targeted reads — "give me the component with this ID" — use the nodes endpoint.

---

## The Output Shape

`figma-read.mjs` produces three machine-readable outputs. These are designed to be the stable interface for downstream tools:

**`component-inventory.json`** — a flat list of all component definitions with names, IDs, descriptions, and description presence. Used by: documentation sync (Chapter 10), audit tooling (Chapter 5), spec generation (Chapter 12).

```json
{
  "generatedAt": "2026-06-01T11:00:00.000Z",
  "fileKey": "abc123XYZdef456",
  "total": 147,
  "withDescription": 23,
  "missingDescription": 124,
  "components": [
    {
      "id": "102:45",
      "name": "Badge / Default",
      "description": "",
      "key": "abc...",
      "componentSetId": "102:40",
      "hasDescription": false
    }
  ]
}
```

**`variable-inventory.json`** — a flat list of all variables with their collection, type, description, and resolved values per mode. Used by: token extraction (Chapter 8), audit tooling (Chapter 5).

**`missing-descriptions.md`** — a markdown table of components without descriptions. Useful as a human-readable work item list for design system maintainers.

---

## Failure Modes of `figma-read.mjs`

### The large-file timeout

For files with hundreds of components and deep nesting, the `GET /v1/files/:key` call can be slow — sometimes tens of seconds. If it times out at the network level, your script will receive an error rather than a partial response. The mitigation: use a timeout with retry logic for the initial fetch, and consider using the `?depth=N` parameter for structural reads and the `/nodes` endpoint for deep property reads.

### The partial variable response

On some plan configurations, the variables field in the file response may be present but empty, or the variables endpoint may return a 200 with an empty collection. This is not the same as the Enterprise gate (which returns a 403). If your variable inventory reports zero variables but you know variables exist in the file, check: (1) are the variables published? Local-only variables may not appear in all API contexts [verify — current behavior]; (2) are you reading from the correct endpoint?

### Stale node IDs

Node IDs in Figma are stable for the lifetime of a node — deletion and recreation produce a new ID. But if a designer deletes a component and recreates it, all downstream references by node ID break. Fixtures written before the recreation will have the old IDs. This is a fundamental property of the data model, not a bug. Your code should treat node IDs as stable within a session, not across file refactors.

### Component instance vs. definition confusion

The `components` top-level map contains component definitions (the source). Instances of those components appear in the document tree with type `INSTANCE`. A common confusion is iterating the document tree looking for `COMPONENT` nodes when you want all usages — you should be looking for `INSTANCE` nodes with the relevant `componentId`. And the reverse: looking for `INSTANCE` nodes when you want the definition.

### The `_Archive` page problem

Most real design system files have an archive page where old or deprecated components live. The `figma-read.mjs` inventory includes everything in the file, including archived content. If your component count seems high, check for an archive page and decide whether to exclude it from inventory generation.

```javascript
// Example: exclude archive pages
const EXCLUDED_PAGES = ['_Archive', 'Archive', '🗑️ Archive'];

function extractComponents(data) {
  // Filter to non-excluded pages first
  const activePages = data.document.children.filter(
    (page) => !EXCLUDED_PAGES.some(
      (excluded) => page.name.toLowerCase().includes(excluded.toLowerCase())
    )
  );
  // Then extract components only from active page nodes...
}
```

---

## Decision Rules: When to Use Each Read Strategy

**Use `GET /v1/files/:key` (full fetch) when** you need the complete document tree — for full audits, compliance checks, or any analysis that requires traversing all nodes. Accept that this is slow on large files. Write the fixture.

**Use `GET /v1/files/:key?depth=N` when** you need structural information only — page names, top-level frame names, the presence or absence of certain node types. Much faster for large files.

**Use `GET /v1/files/:key/nodes?ids=...` when** you know which nodes you need and can provide their IDs from a previous read or a stored index. Use this for targeted property inspection in audit scripts that already have a list of node IDs from a structural pass.

**Use the local fixture when** you are developing or testing extraction code. Never test against the live API on every iteration — you will exhaust your rate limit and slow development to a crawl.

**Re-fetch the full file when** the fixture is more than a day old, or when you know the file has changed (for example, after a library publish event). The fixture is a development tool, not a production cache.

---

## Try This

**Exercise 1: Read your own file.**

Run `figma-read.mjs` against a Figma file you work with. Look at the component inventory output. How many components have descriptions? How many are missing them? Pick three components that are missing descriptions and write a one-sentence description for each in the Figma file. Re-run the script. Confirm the descriptions appear in the new output.

**Exercise 2: Find a hardcoded color.**

Using the fixture from Exercise 1, write a short Node.js script (10–15 lines) that walks the document tree and prints the names and types of any nodes where `fills` contains a `SOLID` fill that is not bound to a variable. If you have zero findings — congratulations, your file is disciplined. If you have findings, note which nodes they are on. Chapter 5 will build this into a formal audit check.

---

## The AI Wayback Machine: DOM Traversal and the Figma Graph

If you have written JavaScript for the web, you have already traversed a document graph. The DOM — the Document Object Model — is a tree of nodes (elements, text nodes, comments), each with properties and children. `document.querySelectorAll('.button')` is a tree traversal that finds all nodes matching a selector.

The Figma document graph is structurally similar. The node types are different (FRAME, COMPONENT, TEXT rather than div, span, p), and the property schemas are different (fills, constraints, boundVariables rather than className, style, href), but the traversal pattern is identical: start at the root, visit each node, collect the ones that match your criteria.

The same is true of any AST (Abstract Syntax Tree): TypeScript's compiler, Babel's transform pipeline, ESLint's rule engine. All of them traverse tree structures with recursive walkers and visitor patterns.

The `walk(node, visitor)` function in `figma-read.mjs` is the same pattern you would write for any of these. If you have written an ESLint rule or a Babel transform, you already understand the Figma document graph. If you have not, the Figma graph is a gentle introduction: the node types are visually intuitive, and the structure is only two or three levels deep in most real files before you hit the interesting content.

---

## What Comes Next

You can now read any Figma file programmatically. You have a fixture for offline development. You have a component inventory, a variable inventory, and a missing-description report.

The next part of the book is about the file itself: whether it is structured in a way that a pipeline can trust. Chapter 4 covers naming as an API contract — why the names your designer gives to variables and components determine what your pipeline produces. Chapter 5 builds the audit tool that checks a file systematically before you bet a production pipeline on it.

You know what the file contains. Now let's find out whether it is ready to be consumed.

---

*Tags: document-graph, node-tree, figma-read, fixture, component-inventory, variable-inventory, traversal*
