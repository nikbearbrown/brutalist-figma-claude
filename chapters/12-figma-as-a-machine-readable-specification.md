# Chapter 12 — Figma as a Machine-Readable Specification

*When the output is not for a human but for a CLI to build from — more detail is better, not less.*

---

The code generator ran. It had been handed a JSON file that looked like a design spec: component names, some properties, a few color values. It produced a React component library. The design engineer did a review pass and found that every component was missing its disabled state, none of the spacing values matched the layout constraints in the Figma file, the variant prop names differed from the variant dimension names in Figma, and every token alias had been resolved to a raw hex value instead of a CSS custom property reference.

The code generator did not fail. It consumed the specification it was given and produced code accordingly. The specification was the problem. It had been written for humans, not machines.

A human reading a design spec applies decades of tacit knowledge to fill in the gaps. They know that "disabled" is a state even when it appears inconsistently across components. They know that `16px` probably means `spacing.md` in the token system, even if the spec does not say so. They know the border-radius on the Card probably matches the border-radius token, even though the spec shows only the rendered pixel value.

A machine knows none of this. It needs the complete alias chain — not the resolved value, but the token reference that produced it. It needs the variant property names exactly as they appear in Figma, because those names are the contract between the design component and the code component. It needs the layout constraints, the spacing values before rounding, the node IDs that uniquely identify each component across file versions.

`build-spec.mjs` emits a machine-readable component specification JSON that contains everything a code generator or AI coding agent needs, with nothing compressed out for the sake of human readability. The chapters that follow — MCP integration, CI orchestration — consume its output. A downstream CLI cannot make reliable decisions about what to generate unless the specification it reads is complete.

<!-- → [FIGURE: Side-by-side comparison of human-readable component doc vs. machine-readable spec for the same Button component — showing what information is present in each, what is absent in each, and annotating which omissions cause code generation failures] -->

---

## The Two Consumer Types

The distinction between human and machine consumers is structural, not cosmetic.

A human documentation consumer wants compression. The canonical usage, not every variant value. Usage guidance, not a complete enumeration of layout constraints. The example that covers 80% of use cases, not the edge cases. Compression makes documentation scannable. A human who needs more detail can open the Figma file directly.

A machine consumer — a code generator, an AI coding agent, a CLI that produces component scaffolding — needs completeness. Missing information forces the machine to guess. Guessing produces wrong code. There is no equivalent of "open the Figma file to check" for a CLI running in CI.

<!-- → [TABLE: What each consumer type needs from the same component — rows: component name, description, variant dimensions, token alias chain, node ID, layout constraints, spacing values, typography details, Code Connect path — columns: human doc, machine spec — marking yes/partial/no and noting consequence of absence in spec column] -->

The machine spec is not a better version of the human doc. It is a different artifact with a different structure and purpose. Using the machine spec as documentation would produce something unreadable. Using human documentation as code generator input would produce code that guesses at what was compressed out.

---

## What the Figma API Provides

The Figma REST API exposes more than most practitioners use. The documentation sync in Chapter 10 needed names, descriptions, and variant properties. A machine-readable specification needs everything the API can provide.

From `GET /v1/files/:key` [verify — current as of writing], at the component level: `id` (the node ID, stable within a file version but not across structural refactors); `key` (the component library key, more stable than node ID across file changes); `componentSetId` (the parent set, if this component is a variant); `variantProperties` (the exact key-value map of variant dimensions and values for this component node); `description`; `absoluteBoundingBox` (pixel dimensions and canvas position); `constraints` (horizontal and vertical sizing behavior — `SCALE`, `FIXED`, `CENTER`, `STRETCH`, `INHERIT`) [verify]; `layoutMode` (`HORIZONTAL`, `VERTICAL`, `NONE`); `primaryAxisSizingMode` and `counterAxisSizingMode` (`FIXED` or `HUG`); the padding and gap values; `fills`, `strokes`, `effects`; `styles` (links to named color, text, and effect styles).

From `GET /v1/files/:key/variables/local` (Enterprise only) [verify]: variable collections, individual variables with type and per-mode values, and alias chains — a variable whose value is itself a reference to another variable, enabling the primitive → semantic → component token layering from Chapter 4.

When Code Connect is configured and published, the component-to-code mapping is accessible via the Code Connect CLI output. The exact REST surface for Code Connect data is still evolving [verify]. The stable approach is to maintain a `code-connect.json` generated by the Code Connect CLI and merge it into the spec at build time.

---

## The Component Specification Schema

A schema is a contract. Before writing `build-spec.mjs`, define what downstream tools will consume.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "title": "ComponentSpec",
  "type": "object",
  "required": ["nodeId", "key", "name", "specVersion", "generatedAt"],
  "properties": {
    "specVersion":    { "type": "string" },
    "generatedAt":    { "type": "string", "format": "date-time" },
    "nodeId":         { "type": "string" },
    "key":            { "type": "string" },
    "name":           { "type": "string" },
    "description":    { "type": "string" },
    "componentSetId": { "type": ["string", "null"] },
    "variantProperties": {
      "type": ["object", "null"],
      "description": "Exact key-value map of variant dimensions for this component node"
    },
    "dimensions": {
      "type": "object",
      "properties": {
        "width":        { "type": "number" },
        "height":       { "type": "number" },
        "widthSizing":  { "type": "string", "enum": ["FIXED", "HUG", "FILL"] },
        "heightSizing": { "type": "string", "enum": ["FIXED", "HUG", "FILL"] }
      }
    },
    "layout": {
      "type": "object",
      "properties": {
        "mode":                  { "type": "string" },
        "paddingTop":            { "type": "number" },
        "paddingBottom":         { "type": "number" },
        "paddingLeft":           { "type": "number" },
        "paddingRight":          { "type": "number" },
        "itemSpacing":           { "type": "number" },
        "counterAxisSpacing":    { "type": "number" },
        "primaryAxisAlignItems": { "type": "string" },
        "counterAxisAlignItems": { "type": "string" }
      }
    },
    "fills": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type":       { "type": "string" },
          "color":      { "type": "object" },
          "opacity":    { "type": "number" },
          "styleId":    { "type": ["string", "null"] },
          "styleName":  { "type": ["string", "null"] },
          "tokenAlias": { "type": ["string", "null"],
                         "description": "Token path derived from style name — null when style name does not resolve" }
        }
      }
    },
    "typography": {
      "type": ["object", "null"],
      "properties": {
        "fontFamily":   { "type": "string" },
        "fontWeight":   { "type": "number" },
        "fontSize":     { "type": "number" },
        "lineHeight":   {},
        "letterSpacing":{},
        "styleId":      { "type": ["string", "null"] },
        "styleName":    { "type": ["string", "null"] },
        "tokenAlias":   { "type": ["string", "null"] }
      }
    },
    "codeConnect": {
      "type": ["object", "null"],
      "properties": {
        "importPath":     { "type": "string" },
        "componentName":  { "type": "string" },
        "propMappings":   { "type": "object",
                           "description": "Maps Figma variant dimension names to code prop names" }
      }
    },
    "internalStructure": {
      "type": "array",
      "description": "Child nodes to depth 3 for code generators that need interior structure"
    }
  }
}
```

The `tokenAlias` field on fills and typography is the critical one. When a fill is applied via a named style that corresponds to a design token, the code generator should emit `color: var(--color-brand-primary)` — not `color: #1A56DB`. Building that alias requires tracing: fill → style reference → style name → token name convention. The script below builds this chain where the data is available and marks it `null` where it is not.

---

## `build-spec.mjs`

```javascript
// build-spec.mjs
// [illustrative — adapt to your file structure, variable access, and Code Connect setup]

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TOKEN           = process.env.FIGMA_TOKEN;
const FILE_KEY        = process.env.FIGMA_FILE_KEY;
const OUT_DIR         = process.argv.find(a => a.startsWith('--out='))?.split('=')[1] || 'spec-output';
const CODE_CONNECT    = process.argv.find(a => a.startsWith('--code-connect='))?.split('=')[1] || null;
const SPEC_VERSION    = '1.0.0';
const BASE            = 'https://api.figma.com/v1';

if (!TOKEN || !FILE_KEY) {
  console.error('ERROR: FIGMA_TOKEN and FIGMA_FILE_KEY required.');
  process.exit(1);
}

async function figmaGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Figma-Token': TOKEN } });
  if (res.status === 429) {
    const wait = parseInt(res.headers.get('Retry-After') || '30', 10);
    console.warn(`Rate limited. Waiting ${wait}s...`);
    await new Promise(r => setTimeout(r, wait * 1000));
    return figmaGet(path);
  }
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Variables API: Enterprise only — degrade gracefully on 403
// [verify — current plan requirements for /variables/local endpoint]
async function fetchVariables() {
  try {
    return await figmaGet(`/files/${FILE_KEY}/variables/local`);
  } catch (e) {
    if (e.message.includes('403')) {
      console.warn('Variables API: 403 — Enterprise plan required. Spec will lack token alias chains.');
      return null;
    }
    throw e;
  }
}

function buildStyleIndex(fileData) {
  const index = {};
  for (const [id, style] of Object.entries(fileData.styles || {})) {
    index[id] = { name: style.name, type: style.styleType, description: style.description || '' };
  }
  return index;
}

function loadCodeConnect(path) {
  if (!path || !existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.warn(`Could not parse Code Connect file at ${path}`);
    return {};
  }
}

// Convert style name to token alias using the path-slash convention from Chapter 4.
// "color/brand/primary" → "color.brand.primary" → maps to var(--color-brand-primary).
// Returns null if name does not follow the convention.
function styleNameToTokenAlias(name) {
  if (!name || !name.includes('/')) return null;
  return name.replace(/\//g, '.');
}

function resolveFills(node, styleIndex) {
  if (!Array.isArray(node.fills)) return [];
  return node.fills
    .filter(f => f.visible !== false)
    .map(fill => {
      const styleId   = node.styles?.fill || node.styles?.fills || null;
      const styleName = styleId && styleIndex[styleId] ? styleIndex[styleId].name : null;
      return {
        type:       fill.type,
        color:      fill.color || null,
        opacity:    fill.opacity ?? 1,
        styleId,
        styleName,
        tokenAlias: styleName ? styleNameToTokenAlias(styleName) : null
      };
    });
}

function resolveTypography(node, styleIndex) {
  if (node.type !== 'TEXT' || !node.style) return null;
  const s = node.style;
  const styleId   = node.styles?.text || null;
  const styleName = styleId && styleIndex[styleId] ? styleIndex[styleId].name : null;
  return {
    fontFamily:          s.fontFamily,
    fontWeight:          s.fontWeight,
    fontSize:            s.fontSize,
    lineHeight:          s.lineHeightPx || s.lineHeightPercent || s.lineHeightUnit || null,
    letterSpacing:       s.letterSpacing,
    textAlignHorizontal: s.textAlignHorizontal,
    textDecoration:      s.textDecoration || null,
    styleId,
    styleName,
    tokenAlias:          styleName ? styleNameToTokenAlias(styleName) : null
  };
}

// Recursive interior node structure — limited to 3 levels to keep spec files manageable.
// Increase depth for generators that need complete interior structure; monitor output size.
function buildNodeSpec(node, styleIndex, depth = 0) {
  const spec = {
    nodeId:     node.id,
    type:       node.type,
    name:       node.name,
    fills:      resolveFills(node, styleIndex),
    typography: resolveTypography(node, styleIndex),
  };

  if (node.layoutMode && node.layoutMode !== 'NONE') {
    spec.layout = {
      mode:                  node.layoutMode,
      paddingTop:            node.paddingTop    || 0,
      paddingBottom:         node.paddingBottom || 0,
      paddingLeft:           node.paddingLeft   || 0,
      paddingRight:          node.paddingRight  || 0,
      itemSpacing:           node.itemSpacing   || 0,
      counterAxisSpacing:    node.counterAxisSpacing || 0,
      primaryAxisAlignItems: node.primaryAxisAlignItems  || null,
      counterAxisAlignItems: node.counterAxisAlignItems  || null,
      primaryAxisSizingMode: node.primaryAxisSizingMode  || null,
      counterAxisSizingMode: node.counterAxisSizingMode  || null
    };
  }

  if (node.absoluteBoundingBox) {
    spec.dimensions = {
      width:  node.absoluteBoundingBox.width,
      height: node.absoluteBoundingBox.height
    };
  }

  if (node.constraints) spec.constraints = node.constraints;

  if (node.cornerRadius !== undefined)      spec.cornerRadius  = node.cornerRadius;
  if (node.rectangleCornerRadii)            spec.cornerRadii   = node.rectangleCornerRadii;

  if (node.effects?.length)
    spec.effects = node.effects.filter(e => e.visible !== false);

  if (depth < 3 && node.children?.length) {
    spec.children = node.children.map(c => buildNodeSpec(c, styleIndex, depth + 1));
  }

  return spec;
}

function buildComponentSpec(nodeId, comp, styleIndex, codeConnectIndex) {
  return {
    specVersion:   SPEC_VERSION,
    generatedAt:   new Date().toISOString(),
    nodeId,
    key:           comp.key,
    name:          comp.name,
    description:   comp.description || '',
    componentSetId:comp.componentSetId || null,
    variantProperties: comp.variantProperties || null,
    fills:         resolveFills(comp, styleIndex),
    layout:        comp.layoutMode && comp.layoutMode !== 'NONE' ? {
      mode:         comp.layoutMode,
      paddingTop:   comp.paddingTop    || 0,
      paddingBottom:comp.paddingBottom || 0,
      paddingLeft:  comp.paddingLeft   || 0,
      paddingRight: comp.paddingRight  || 0,
      itemSpacing:  comp.itemSpacing   || 0
    } : null,
    dimensions:    comp.absoluteBoundingBox ? {
      width:  comp.absoluteBoundingBox.width,
      height: comp.absoluteBoundingBox.height
    } : null,
    constraints:   comp.constraints || null,
    codeConnect:   codeConnectIndex[comp.key] || null,
    internalStructure: (comp.children || []).map(c => buildNodeSpec(c, styleIndex))
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Fetching file...');
  const fileData = await figmaGet(`/files/${FILE_KEY}`);

  console.log('Fetching variables (Enterprise only — degrades gracefully)...');
  const variablesData = await fetchVariables();

  const styleIndex       = buildStyleIndex(fileData);
  const codeConnectIndex = loadCodeConnect(CODE_CONNECT);

  const rawComponents    = fileData.components    || {};
  const rawComponentSets = fileData.componentSets || {};

  // Build component set index
  const setSpecs = {};
  for (const [setId, set] of Object.entries(rawComponentSets)) {
    setSpecs[setId] = {
      specVersion: SPEC_VERSION,
      generatedAt: new Date().toISOString(),
      nodeId:      setId,
      name:        set.name,
      description: set.description || '',
      variants:    []
    };
  }

  const componentSpecs = [];
  for (const [nodeId, comp] of Object.entries(rawComponents)) {
    const spec = buildComponentSpec(nodeId, comp, styleIndex, codeConnectIndex);
    componentSpecs.push(spec);
    if (comp.componentSetId && setSpecs[comp.componentSetId]) {
      setSpecs[comp.componentSetId].variants.push(spec);
    }
  }

  const manifest = {
    specVersion:        SPEC_VERSION,
    generatedAt:        new Date().toISOString(),
    fileKey:            FILE_KEY,
    fileName:           fileData.name,
    lastModified:       fileData.lastModified,
    totalComponents:    componentSpecs.length,
    totalComponentSets: Object.keys(setSpecs).length,
    hasVariableData:    variablesData !== null,
    hasCodeConnect:     Object.keys(codeConnectIndex).length > 0,
    componentKeys:      componentSpecs.map(c => c.key),
    componentSetNames:  Object.values(setSpecs).map(s => s.name)
  };

  writeFileSync(join(OUT_DIR, 'manifest.json'),       JSON.stringify(manifest,                    null, 2));
  writeFileSync(join(OUT_DIR, 'components.json'),     JSON.stringify(componentSpecs,              null, 2));
  writeFileSync(join(OUT_DIR, 'component-sets.json'), JSON.stringify(Object.values(setSpecs),     null, 2));

  // Per-component files for large systems and MCP context loading
  const compDir = join(OUT_DIR, 'components');
  mkdirSync(compDir, { recursive: true });
  for (const spec of componentSpecs) {
    const safeName = spec.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    writeFileSync(join(compDir, `${safeName}-${spec.nodeId}.json`), JSON.stringify(spec, null, 2));
  }

  console.log(`\nDone.`);
  console.log(`${componentSpecs.length} component specs → ${OUT_DIR}/`);
  console.log(`Variable data: ${variablesData ? 'yes' : 'no (Enterprise required or use Tokens Studio)'}`);
  console.log(`Code Connect:  ${Object.keys(codeConnectIndex).length} mappings loaded`);

  // Contract validation inline
  const failures = [];
  for (const spec of componentSpecs) {
    if (!spec.key)           failures.push(`${spec.name}: missing key`);
    if (!spec.nodeId)        failures.push(`${spec.name}: missing nodeId`);
    if (!spec.specVersion)   failures.push(`${spec.name}: missing specVersion`);
  }
  if (failures.length) {
    console.error('\nContract failures:');
    failures.forEach(f => console.error(' ', f));
    process.exit(1);
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
```

Running it:

```bash
node build-spec.mjs --out=spec-output
node build-spec.mjs --out=spec-output --code-connect=code-connect.json
```

```json
{
  "scripts": {
    "figma:spec":      "node build-spec.mjs --out=spec-output",
    "figma:spec:full": "node build-spec.mjs --out=spec-output --code-connect=code-connect.json"
  }
}
```

---

## The Token Alias Chain: The Non-Enterprise Path

The alias chain — tracing from a raw fill value back through a style reference to a design token — is where the machine-readable spec most clearly outperforms human documentation. A human reader can infer that the primary button's blue fill probably comes from the `brand-primary` token. A code generator cannot infer this. It must be told.

The full alias chain requires the Variables API, which is gated behind the Enterprise plan [verify]. Three alternatives exist for other plan tiers.

The first is Tokens Studio. The Tokens Studio plugin exports a JSON file containing variables and their alias relationships regardless of plan tier. `build-spec.mjs` can be extended to merge a Tokens Studio JSON into the spec, resolving style names to token aliases. The Tokens Studio format is parseable and stable enough to build on [verify].

The second is the style-name convention. If the team follows the naming convention from Chapter 4 — `color/brand/primary` for color styles, matching the token hierarchy — the script can infer the token alias from the style name. `styleNameToTokenAlias` does this: `color/brand/primary` becomes `color.brand.primary`, which maps to `--color-brand-primary` in CSS. This works only when style names match token names; it breaks silently when they diverge.

The third is Style Dictionary integration. Run Style Dictionary against a maintained token source and produce a style-ID-to-token-name lookup table. Merge that table into `build-spec.mjs` at build time. This is the most reliable non-Enterprise approach but requires maintaining Style Dictionary configuration separately.

The script degrades gracefully — it emits whatever alias information it can build and marks the rest `null`. A contract test should warn (not fail) when token aliases are absent, so the generator knows to fall back to resolved hex values rather than failing silently.

<!-- → [FIGURE: Three paths to token alias resolution — columns showing Enterprise path (Variables API direct), Tokens Studio path, and style-name convention path — with arrows showing which data flows into tokenAlias field in each case] -->

---

## W3C DTCG as the Interchange Format

The component spec JSON above is specific to this toolchain. When specs need to cross tool boundaries — different teams, different code generators, different platforms — the W3C Design Tokens Community Group (DTCG) format is the emerging standard for token interchange. [verify — current DTCG specification status]

DTCG defines a JSON format for token data where `$value`, `$type`, and `$description` are the primitive fields:

```json
{
  "color": {
    "brand": {
      "primary": {
        "$value": "#1A56DB",
        "$type": "color",
        "$description": "Primary brand color"
      }
    }
  }
}
```

Aliases use `{dot.path}` references:

```json
{
  "button": {
    "background": {
      "$value": "{color.brand.primary}",
      "$type": "color"
    }
  }
}
```

`build-spec.mjs` can be extended to emit DTCG-compatible token data for each component — the component-level tokens that are specific to that component, not the global token set. Style Dictionary supports DTCG input natively [verify], which means a spec with DTCG token data can be processed by Style Dictionary to produce CSS custom properties, Swift tokens, Android XML, or any other platform target from the same source.

---

## Contract Tests

A machine-readable spec is only useful if it is complete. Contract tests are the mechanism that prevents it from silently regressing.

<!-- → [TABLE: Contract test checks — columns: check name, failure type (hard fail vs. warn), what the downstream consumer does when this check fails — covering missing nodeId, missing key, missing specVersion, missing Code Connect, fills without style reference or token alias] -->

```javascript
// test-spec-contract.mjs
// Run after build-spec.mjs

import { readFileSync } from 'fs';

const components = JSON.parse(readFileSync('spec-output/components.json', 'utf8'));
let failures = 0;

for (const spec of components) {
  if (!spec.nodeId)      { console.error(`FAIL: ${spec.name} missing nodeId`);      failures++; }
  if (!spec.key)         { console.error(`FAIL: ${spec.name} missing key`);          failures++; }
  if (!spec.specVersion) { console.error(`FAIL: ${spec.name} missing specVersion`);  failures++; }

  if (!spec.codeConnect) {
    console.warn(`WARN: ${spec.name} has no Code Connect mapping — generator will infer import`);
  }

  // Fills present but no style reference and no token alias means generator uses raw hex
  if (spec.fills?.some(f => f.type === 'SOLID' && !f.styleId && !f.tokenAlias)) {
    console.warn(`WARN: ${spec.name} has fills without style reference — generator will use raw hex values`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} contract failure(s). Spec is not safe for code generation.`);
  process.exit(1);
}

console.log(`Contract check passed. ${components.length} components verified.`);
```

```json
{
  "scripts": {
    "figma:spec:check": "node build-spec.mjs --out=spec-output && node test-spec-contract.mjs"
  }
}
```

The distinction between failures and warnings is deliberate. A missing `nodeId` or `key` is a hard failure — the downstream consumer cannot identify the component at all. A missing Code Connect mapping or an unresolved fill are warnings — the generator can fall back to reasonable defaults, but the output will be less precise than it could be. Both deserve to be visible; only the hard failures should halt the build.

---

## How This Feeds MCP and the AI Coding Agent

The component spec JSON from `build-spec.mjs` is the structured context that makes an AI coding agent's output trustworthy. Without it, an agent working in an MCP session has to infer component structure from what is visible in the Figma canvas — richer than nothing but structurally incomplete.

With the spec, the agent knows the exact variant dimensions and values for each component, so it can generate a TypeScript props type without guessing. It knows the token alias for each fill, so it emits `color: var(--color-brand-primary)` rather than `color: #1A56DB`. It knows the Code Connect import path, so it writes `import { Button } from '@acme/design-system'` rather than inventing an import. It knows the layout constraints, so it can decide whether a component should be `width: 100%` or `width: fit-content`.

The spec is also a fixture for regression testing. A code generator that has consumed a spec should produce identical output from an identical spec. Storing the spec in version control means a Figma change that alters the spec produces a diff — and that diff is the signal that either triggers a code generation run or flags a change that needs human review before code is generated.

For large design systems — 500 components or more — loading the entire `components.json` into an agent's context is impractical. The per-component files in `spec-output/components/` exist for this reason. An MCP workflow loads only the components relevant to the current generation task, treating the per-component spec as a targeted context window rather than a complete file read.

<!-- → [INFOGRAPHIC: How build-spec.mjs output flows into downstream consumers — manifest.json → CI decisions; components.json → code generator batch runs; components/*.json → MCP agent context loading; component-sets.json → variant prop type generation — with annotations showing which fields each consumer uses] -->

---

## Failure Modes

**The spec is large.** A design system with 500 components and deep node trees produces a spec file several megabytes in size. This is not a problem for a CLI writing to disk. It is a problem for an AI coding agent loading the entire spec into context. Use the per-component files and load only what is relevant to the current task.

**Node IDs are not stable across file restructuring.** When a component is moved to a different page or rebuilt, its node ID changes. The component `key` field is more stable — it persists across moves within the same file. Build downstream tools to key on `key`, not `nodeId`, for component identity. Store both in the spec so the choice is available.

**Variable data requires Enterprise.** The graceful degradation means the spec is generated without alias chains on non-Enterprise plans. A code generator consuming a spec with no alias chains will use resolved hex values. This is not wrong — it is a known limitation documented in the manifest's `hasVariableData` field. The Tokens Studio and style-name-convention alternatives partially close this gap.

**Code Connect must be maintained separately.** `build-spec.mjs` reads Code Connect data from a file generated by the Code Connect CLI. When components are added or variant names change, the Code Connect file must be updated. Stale Code Connect data produces missing or incorrect import paths. Track Code Connect updates as part of the library publish process.

**Internal structure depth.** The script limits traversal to three levels of depth. Some generators need the complete interior — every nested frame, every text layer. Increasing the depth limit is correct for those generators; monitor output size, since deep traversals on complex components can produce spec files that are impractical to diff or load into an MCP session.

**The silent mismatch between style names and token names.** The `styleNameToTokenAlias` function assumes style names follow the token hierarchy. When they do not — when a style is named "Button Background" rather than "color/brand/primary" — the function returns `null` rather than a wrong alias. Nulls are visible in the warnings from the contract test. Wrong aliases would not be. The function fails safely by returning `null` on names that do not contain `/`, which is why the naming convention from Chapter 4 matters for this pipeline: it is what makes the alias derivation possible at all.

---

## Decision Rules

Generate the spec whenever the Figma library is published, a new component is added, or variant properties change.

Use `build-spec.mjs` output as the source for code generators, AI coding agent context, design-to-code pipeline inputs, and component scaffolding CLIs.

Do not use it as human-readable documentation. The spec is for machines. The documentation from Chapter 10 is for humans.

Store `components.json` and `manifest.json` in version control as generated files. Their diffs are meaningful — they show exactly what changed in the design system between two runs.

Run contract tests before any code generation run. A spec with missing required fields or stale Code Connect data produces bad code. The contract test is the gatekeeper.

On non-Enterprise plans, use Tokens Studio JSON merged into the spec, or rely on style-name conventions. Document the limitation in the manifest's `hasVariableData` field.

---

## The AI Wayback Machine: The OpenAPI Specification

The challenge of making a human-designed artifact machine-readable is not new. The most successful solution to date is the OpenAPI Specification (formerly Swagger), which defines a standard machine-readable format for HTTP APIs.

Before OpenAPI, API documentation was written for human readers: prose descriptions of endpoints, example requests and responses, informal notes about error codes. This worked until tools needed to consume the API definition — SDK generators, mock servers, test harnesses, documentation renderers. Each tool had to parse human prose, which was imprecise and inconsistent. The result was fragile tool chains that broke when the prose changed.

OpenAPI solved this by defining a JSON or YAML schema that a machine could parse and validate. An API described in OpenAPI can drive an SDK generator, a mock server, a documentation renderer, and a test harness — all from the same source. The schema is the contract. The tools are the consumers.

The `build-spec.mjs` output is the design system equivalent: a machine-parseable schema describing components, their properties, their token references, and their code mappings. Like OpenAPI, it is too verbose and complete to be useful as human documentation. Like OpenAPI, it enables tool chains that would otherwise require fragile prose parsing.

The lesson from OpenAPI is that the schema needs to be versioned (`specVersion` in the manifest), validated (`test-spec-contract.mjs`), and treated as a contract. When the schema changes in a breaking way, downstream consumers must be updated. The spec version is the signal that tells them to update. Design systems are following the same path that APIs followed a decade earlier: from human documentation to machine-readable contracts. This book is about building the extraction layer that makes that transition possible.

---

## What Comes Next

The spec is the structured context the next chapter needs. Chapter 13 connects the design system file to an AI coding agent via the Figma MCP server, using the spec as the foundation that makes the agent's output trustworthy. An agent that knows the variant dimensions, the token aliases, and the import paths can generate code that matches the design system. An agent that has only the canvas has to guess at all three.

---

## LLM Exercises

**Exercise 1 — Generate and examine.**
Paste the `resolveFills` function and the `styleNameToTokenAlias` function into an LLM conversation. Ask it to trace what happens when a component has a fill applied via a style named `"Button Background"` — a name that does not follow the slash-path convention. Ask: what does `tokenAlias` contain in the output? What does the code generator do with that? Then ask the LLM to propose a modified version of `styleNameToTokenAlias` that also handles a secondary convention — for example, camelCase names like `"colorBrandPrimary"` — without breaking the existing slash-path handling.

**Exercise 2 — Apply to known context.**
Run `build-spec.mjs` against a Figma file you have access to (or build a minimal fixture from the output of `figma-read.mjs` from Chapter 3). Open `component-sets.json`. Find a component set with at least three variants. Write a short Node.js script that reads that component set's entry and produces a TypeScript union type for each variant dimension — for example, `type Size = 'sm' | 'md' | 'lg'`. Run the script and verify the output matches what you would write by hand.

**Exercise 3 — Stress-test a specific claim.**
The chapter claims that the spec should be stored in version control and that its diffs are meaningful. Ask an LLM to argue the opposite case: what are the arguments against storing generated files in version control? What problems does it cause? How do the most mature CI-driven projects handle generated output? Evaluate the argument against your team's current practice — do the tradeoffs the LLM identifies apply to your situation?

**Exercise 4 — Draft a professional deliverable.**
You are proposing to add `build-spec.mjs` and `test-spec-contract.mjs` to your team's CI pipeline. Write a brief technical design document (one to two pages) for your engineering team explaining: what the spec generator does, what problem it solves, what it costs (CI time, maintenance of Code Connect), and what the failure modes are. Ask an LLM to draft the first version, then revise it to match the level of technical detail your team expects in design documents.
