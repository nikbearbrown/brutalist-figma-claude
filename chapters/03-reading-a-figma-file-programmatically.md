# Chapter 3 — Reading a Figma File Programmatically

*The map you need before the territory will let you in.*

---

Forty-seven thousand lines. That is what you get when you pipe a medium-sized design system file through the Figma REST API and count what comes back. The data is all there — every component, every color value, every variable, every nested frame — and none of it is findable. You search for a component you know exists. It is in there, somewhere, nested at depth seven. You search for the color token you want. The value is there, but it is stored as `{ "r": 0.082, "g": 0.337, "b": 0.855, "a": 1 }`, not `#1558D6`. You search for variables. They are not in the main document response at all.

This is the gap between having access to data and understanding its shape. The API gave you everything. The API told you nothing.

This chapter is the map.

<!-- → [FIGURE: Annotated diagram of the top-level Figma file response structure — document, components, styles, variables — showing which keys exist at which level and what they contain, with arrows showing how node IDs cross-reference between sections] -->

---

## The Document Graph

A Figma file is a tree. Every visible object on the canvas is a node. Every invisible container — frames, groups, pages — is a node. The document itself is a node: the root.

The tree has a consistent shape at the top:

```
DOCUMENT (root, id "0:0")
  └── CANVAS (one per page)
        └── FRAME | COMPONENT | COMPONENT_SET | GROUP | ...
              └── (any node type, recursively)
```

Every node has four properties that are always present: `id`, which is unique within the file and stable for the life of the node; `name`, which is the layer name as shown in the Layers panel; `type`, which tells you what kind of node this is; and `children`, which is an array of child nodes if there are any, and absent entirely on leaf nodes.

<!-- → [TABLE: Node types and what they represent — columns: type name, what it is, when you encounter it, key properties to check — covering DOCUMENT, CANVAS, FRAME, COMPONENT, COMPONENT_SET, INSTANCE, GROUP, TEXT, RECTANGLE, VECTOR] -->

The types you will encounter most often are FRAME (layout containers — screens, sections, artboards), COMPONENT (a reusable component definition, with a `componentId`), COMPONENT_SET (a variant group containing COMPONENT children), INSTANCE (a placed usage of a component, with a `componentId` pointing back to the source definition), and TEXT (a text layer, with its `characters`, `style`, and `styleOverrideTable`).

Beyond those four universal properties, most nodes also carry `fills` (an array of fill objects — colors, gradients, images), `strokes`, `effects`, `absoluteBoundingBox` (position and size on canvas), and — critically — `boundVariables`.

That last one matters more than it looks. A fill that appears in the `fills` array as a solid color may actually be resolved from a variable. The `fills` array gives you the computed value; `boundVariables` tells you which variable produced it. For any pipeline that generates output a human will maintain, you almost always want the variable reference, not the resolved value. The variable is the token. The token is what you maintain. Chasing resolved values means chasing a moving target every time someone updates the design system.

---

## Where Variables Live

Variables are not embedded in the node tree. This surprises people. They appear at the top level of the file response, alongside the document, in their own section.

```json
{
  "document": { ... },
  "components": { ... },
  "styles": { ... },
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

Variables live in collections. A collection has one or more modes — Light and Dark, Mobile and Desktop, Brand A and Brand B. Each variable has a value per mode. If you want the dark-mode value of `color/brand/primary`, you look up mode ID `12:1` in `valuesByMode`. The value at that key is either a raw value (a color, a number, a string, a boolean) or an alias reference.

Aliases are where it gets interesting. A variable value that looks like `{ "type": "VARIABLE_ALIAS", "id": "VariableID:11:30" }` is a pointer to another variable. That target variable may itself be an alias. You follow the chain until you hit a terminal raw value. This indirection is intentional — it is how design systems implement semantic tokens that point at primitive tokens — and your extraction code needs to handle it explicitly or you will silently produce wrong output.

<!-- → [FIGURE: Diagram showing alias chain resolution — semantic token "color/brand/primary" pointing to primitive "color/primitive/blue-500", which holds the raw hex value — with arrows showing how valuesByMode is consulted at each level] -->

One more thing to know about variables before we move on: the `variables` field in the file response may not appear at all, or may appear empty, depending on your plan tier. [verify — current behavior by plan tier] This is not an error in your code. It is a gate Figma has placed between plan tiers and programmatic variable access. If your variable inventory comes back empty on a file where you know variables exist, check the plan before debugging the extraction logic.

---

## Components and Styles: Two Places Each

Components appear in two places in the response, for two different purposes.

At the top level, `components` is a flat index — a map from component ID to metadata. Each entry has the component's name, description, stable library key, and the ID of its component set if it belongs to a variant group. This is what you use for a component inventory: you iterate the map, you do not need to touch the document tree at all.

In the document tree, COMPONENT and COMPONENT_SET nodes are the actual definitions, with their full property graphs — fills, text layers, layout constraints, bound variables. This is what you need when you want to inspect a specific component's structure.

Figma has two token-like systems, and a fully instrumented file may use both. Styles are the older system: named, reusable fills, text properties, effects, grids. Variables are the newer system, introduced as Figma's answer to design tokens, with multi-mode support, alias chains, and a richer data model. Most design systems are somewhere in the middle of migrating from styles to variables. Your extraction code has to handle both or it will miss whichever system a given file happens to use.

---

## What Is Not in the Response

This matters as much as what is in it.

Prototype interactions are absent. The connections between frames, the trigger types, the animation settings, the smart-animate configurations — none of this is in the document graph returned by `GET /v1/files/:key`. [verify — whether prototype data is at a separate endpoint] It exists in the Figma editor, but it does not come through the REST surface this chapter works with.

Font files are absent. You can see which font families and weights are in use by inspecting the `style` properties on TEXT nodes. You cannot download the fonts through the Figma API. If your pipeline needs fonts, source them independently.

Component usage counts are absent. The REST API tells you that a component exists and where it is defined. It does not tell you how many times it has been placed across a file or a team. That number is visible in the Figma UI; it is not programmatically accessible via REST. [verify — current REST capabilities for usage data]

Plugin-private data is absent. Data stored through the Plugin API's `setPluginData` method is not accessible via REST. If a plugin is being used to store token metadata alongside components, you cannot reach it from outside Figma without the plugin itself.

<!-- → [TABLE: What is and is not in the GET /v1/files/:key response — rows: document tree, components index, styles index, variables, prototype interactions, font files, usage counts, plugin data — with a column for where to get it if not here] -->

---

## `figma-read.mjs`

The tool that makes this chapter concrete is `figma-read.mjs`. It fetches the file, writes a local fixture, and produces three outputs: a component inventory, a variable inventory, and a missing-description report. It is the second named CLI artifact in this book.

The `.mjs` extension signals ES module format. Node 18 and later support top-level `await` in ES modules — use it here rather than wrapping everything in an immediately-invoked async function.

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
  if (value && value.type === 'VARIABLE_ALIAS') {
    const target = variables[value.id];
    if (!target) return { type: 'UNRESOLVED_ALIAS', id: value.id };
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

  return { total, withDescription, missingDescription: missing.length, components, missingDescriptionComponents: missing };
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
    if (colVars.length > 5) console.log(`    ... and ${colVars.length - 5} more`);
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
    for (const node of topLevel) types[node.type] = (types[node.type] || 0) + 1;
    for (const [type, count] of Object.entries(types)) {
      console.log(`      ${type}: ${count}`);
    }
  }
}

// ── 7. Write machine-readable output ─────────────────────────────────────────

function writeOutput(components, variableData, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

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
      ...components.missingDescriptionComponents.map((c) => `| ${c.name} | ${c.id} |`),
    ];
    fs.writeFileSync(missingPath, lines.join('\n'), 'utf-8');
    console.log(`Output written: ${missingPath}`);
  }

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

Running it requires nothing beyond Node 18 — no dependencies, no package installation, no build step:

```bash
node figma-read.mjs
```

The expected output on a real design system file is not the tidy inventory you might hope for. A missing-description count of 124 out of 147 components is not unusual. That finding is not a failure of the script. It is a finding about the file — and Chapter 5 will turn findings like that into structured audit output that a team can act on.

---

## The walk Function

The `walk` function is three lines long and is the foundation of every traversal in this book:

```javascript
function walk(node, visitor, depth = 0) {
  visitor(node, depth);
  if (node.children) {
    for (const child of node.children) {
      walk(child, visitor, depth + 1);
    }
  }
}
```

It is a pre-order depth-first traversal. The visitor sees a parent node before any of its children. When the visitor is called, it receives the node and its depth in the tree — depth is useful when you need to limit traversal or format output hierarchically.

If you have written JavaScript for the DOM, you have written something functionally identical. `document.querySelectorAll('.button')` is a tree traversal with a built-in selector engine; `walk` exposes the same traversal as a general-purpose visitor so you can write any selector you need.

The same pattern appears in TypeScript's compiler (visiting AST nodes), Babel's transform pipeline (visiting and transforming AST nodes), and ESLint's rule engine (visiting AST nodes with a rule function as the visitor). The Figma document tree is a gentler introduction than any of those: the node types correspond to things you can see on the canvas, the structure is rarely more than ten levels deep, and there are no type narrowing puzzles. If you have never written a tree traversal before, this is a good place to start.

From `walk`, building specific queries is direct. Finding all instances of a component:

```javascript
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

Finding all fills that are hardcoded colors, not bound to variables:

```javascript
function findHardcodedColors(document) {
  const findings = [];
  walk(document, (node) => {
    if (!node.fills) return;
    for (const fill of node.fills) {
      if (fill.type !== 'SOLID') continue;
      const isBound = node.boundVariables &&
        node.boundVariables.fills &&
        node.boundVariables.fills.some((b) => b);
      if (!isBound) findings.push({ nodeId: node.id, nodeName: node.name, fill });
    }
  });
  return findings;
}
```

That second function is the embryo of the audit logic Chapter 5 formalizes. Understanding the traversal here — why it works, what it is actually checking — means you can write any variant you need.

<!-- → [FIGURE: Annotated diagram of walk() traversal order on a small sample tree — CANVAS → FRAME → COMPONENT_SET → COMPONENT — showing numbered visit sequence and depth values, illustrating pre-order traversal] -->

---

## The Local Fixture

The fixture written by `figma-read.mjs` is not a nice-to-have. It is a core practice.

A full file fetch on a large design system takes several seconds and consumes rate-limit quota. Figma imposes rate limits on the REST API [verify — current rate limit values and headers]. If you are iterating on extraction logic — debugging a variable resolver, adjusting a traversal, testing a new output format — hitting the live API on every run means slow feedback loops and the real possibility of exhausting your quota mid-session. The fixture is a local snapshot of the full response, written on the first fetch, used for every subsequent run during development.

The pattern is a two-line conditional in any script that follows:

```javascript
const data = FIXTURE_PATH
  ? JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'))
  : await fetchFile(FIGMA_FILE_KEY);
```

Two rules for fixture hygiene. First, add `.figma-fixtures/` to `.gitignore`. Fixtures contain your file structure, which may include unpublished components and internal naming. Do not commit them to a public repository. Second, name fixtures with the file key and date so you know exactly when they were generated — a fixture that is two weeks old is still useful for testing traversal logic, but not for auditing the current state of the file.

---

## Three Read Strategies

Not every question about a Figma file requires the full 47,000-line response. There are three read strategies, each suited to different questions.

`GET /v1/files/:key` — the full fetch — returns the complete document tree, all component metadata, all style metadata, and the variables block. Use this when you need to traverse the full graph: complete audits, compliance checks, any analysis where you do not know in advance which nodes you will care about. Accept that this is slow on large files. Write the fixture after the first fetch.

`GET /v1/files/:key?depth=N` — the depth-limited fetch — returns only the top N levels of the tree. [verify — depth parameter current behavior] Use this for structural reads: getting page names, counting top-level frames, checking whether certain node types are present at the top level. It is substantially faster on large files because the response is smaller by orders of magnitude.

`GET /v1/files/:key/nodes?ids=ID1,ID2,...` — the targeted fetch — returns specific nodes and their subtrees. Use this when you have a list of node IDs from a previous structural pass and need the full property graph of just those nodes. An audit script that first does a depth-limited structural pass to collect a list of component IDs, then fetches only those component subtrees, is much more efficient than fetching the entire file when only a fraction of it is relevant.

<!-- → [TABLE: Three read strategies — columns: endpoint, when to use it, speed, tradeoffs — covering full fetch, depth-limited, and targeted node fetch] -->

The general workflow: do a full fetch once, write the fixture, develop against the fixture. In production, decide based on what you need — structural reads get the depth-limited endpoint, targeted reads get the nodes endpoint, full audits get the full fetch with rate-limit awareness.

---

## The Output Shape

`figma-read.mjs` produces three files. These are the stable interface for everything downstream.

`component-inventory.json` is a flat list of all component definitions: names, IDs, descriptions, and a boolean `hasDescription`. It is consumed by documentation sync in Chapter 10, audit tooling in Chapter 5, and specification generation in Chapter 12.

`variable-inventory.json` is a flat list of all variables with their collection membership, resolved type, description, and computed values per mode. It is consumed by token extraction in Chapter 8.

`missing-descriptions.md` is a markdown table of every component with an empty description field. It is a human-readable work item list — the kind of thing you share in a Slack channel or file as a GitHub issue rather than feeding to a program.

The discipline of producing these three files as a stable output shape, regardless of how the extraction logic evolves, is what allows downstream tools to depend on `figma-read.mjs` without coupling to its internals.

<!-- → [INFOGRAPHIC: Flow diagram showing figma-read.mjs as a central node with inputs (Figma REST API, local fixture) and outputs (component-inventory.json → Chapter 5 audit + Chapter 10 docs sync + Chapter 12 spec gen; variable-inventory.json → Chapter 8 token extraction; missing-descriptions.md → human review) — illustrating how this tool is the stable interface for the rest of the book] -->

---

## Failure Modes

Understanding how this script fails is as important as understanding how it works.

**The large-file timeout.** For files with hundreds of components and deep nesting, the full fetch can take a long time — sometimes tens of seconds. If the connection drops before the response completes, you get an error rather than a partial response. There is no partially-delivered JSON here; the API returns the full body or nothing. Mitigation: add retry logic for the initial fetch, and consider whether the depth-limited or targeted strategies would serve your question better.

**The partial variable response.** On some plan configurations the `variables` block in the response may be present but empty — not absent, not a 403, just an empty object. This is different from the Enterprise plan gate (which returns a 403 directly). If your variable inventory reports zero variables but you know the file has variables, check: are the variables published? Local-only variables may not appear in all API response contexts. [verify — current visibility rules for unpublished variables]

**Stale node IDs.** Node IDs are stable for the lifetime of a node. When a designer deletes a component and recreates it, the recreated component has a new ID. Any downstream reference by the old ID is now broken. Fixtures written before the recreation carry the old IDs. This is a fundamental property of the data model, not a bug in your extraction code. Treat node IDs as stable within a session and across minor edits — not across file refactors.

**The archive page problem.** Most real design system files have an archive page where deprecated components live. `figma-read.mjs` as written includes everything in the file, including archived content, so the component count may be higher than you expect. If you want to exclude archived pages, filter by name before extracting:

```javascript
const EXCLUDED_PAGES = ['_Archive', 'Archive', '🗑️ Archive'];

const activePages = data.document.children.filter(
  (page) => !EXCLUDED_PAGES.some(
    (excluded) => page.name.toLowerCase().includes(excluded.toLowerCase())
  )
);
```

**Instance vs. definition confusion.** The `components` top-level map contains component definitions. Instances of those components appear in the document tree as nodes with `type === 'INSTANCE'` and a `componentId` pointing back to the definition. A search for `COMPONENT` nodes in the document tree finds definitions. A search for `INSTANCE` nodes finds usages. These are different questions. Conflating them is the most common beginner mistake in Figma graph traversal.

---

## The AI Wayback Machine: DOM Traversal and the Figma Graph

If you have written JavaScript for the web, you have traversed a document graph before. The DOM is a tree of nodes — elements, text nodes, comments — each with properties and children. `document.querySelectorAll('.button')` is a depth-first traversal with a selector function as its visitor.

The Figma document graph is structurally identical. The node types are different (FRAME and COMPONENT rather than div and span), and the property schemas are different (`fills` and `boundVariables` rather than `className` and `style`), but the traversal pattern is the same. The `walk` function you read above is what `querySelectorAll` does internally, made explicit so you can write the selector yourself.

The same pattern appears everywhere trees appear in software: TypeScript's compiler has a `visitNode` function that accepts a visitor; Babel's transform pipeline visits AST nodes with plugin-supplied visitors; ESLint rules are functions that receive AST nodes. If you have written an ESLint rule, you have already written a Figma graph traversal. If you have not, the Figma graph is a forgiving place to encounter the pattern for the first time, because every node corresponds to something you can see on screen.

---

## What Comes Next

You can now read any Figma file programmatically. You have a fixture for offline development. You have a component inventory, a variable inventory, and a missing-description report — three files that are the stable input for every downstream tool in this book.

The gap that remains is not about reading. It is about trust. You can extract what the file contains; you cannot yet determine whether the file is structured in a way that a pipeline can rely on. Chapter 4 addresses naming as an API contract — why the names your designer gives to variables and components determine what your pipeline produces, and what the consequences are when those names drift. Chapter 5 builds the audit tool that checks a file systematically before you stake a production pipeline on it.

You know what the file contains. Now let's find out whether it is ready to be consumed.

---

## LLM Exercises

**Exercise 1 — Generate and examine.**
Paste the `walk` function and the `findHardcodedColors` function into a conversation with an LLM. Ask it to explain, step by step, what `boundVariables.fills.some((b) => b)` is checking and why a fill could pass the `fill.type === 'SOLID'` check but still be a variable-bound color. Ask the LLM to identify any edge case where this check would produce a false positive — a fill the code treats as hardcoded that is actually variable-bound.

**Exercise 2 — Apply to known context.**
Take the component inventory output produced by `figma-read.mjs` on a file you have access to. Paste a sample of the JSON (ten to twenty components) into an LLM conversation. Ask it to generate a shell command using `jq` that would filter the JSON to only components whose `name` starts with a specific prefix — for example, all components in the `Button /` family. Run the command and confirm the output is correct.

**Exercise 3 — Stress-test a specific claim.**
The chapter claims that you should almost always prefer the variable reference over the resolved fill value when building a pipeline. Ask an LLM to argue the opposite case: when would you specifically want the resolved value rather than the variable reference? Ask it to describe a concrete pipeline scenario where chasing the resolved value is the right choice. Evaluate the argument against what you know about your own design system.

**Exercise 4 — Draft a professional deliverable.**
Using `missing-descriptions.md` output from a real run of `figma-read.mjs` (or a plausible fabricated sample if you do not have access to a Figma file), ask an LLM to draft a brief message to your design team explaining the findings and requesting that descriptions be added. The message should explain why component descriptions matter for pipeline automation without being condescending. Revise the draft based on your knowledge of how your team communicates.
