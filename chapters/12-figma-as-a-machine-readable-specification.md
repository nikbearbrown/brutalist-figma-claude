# Chapter 12 — Figma as a Machine-Readable Specification

*When the output is not for a human but for a CLI to build from — more detail is better, not less.*

---

## The Failure

The code generator runs. It has been handed a JSON file that looks like a design spec: component names, some properties, a few color values. It produces a React component library. The components render. The design engineer does a review pass and finds that every component is missing its disabled state, none of the spacing values match the actual layout constraints from the Figma file, the variant prop names are different from the Figma variant dimension names, and the token aliases are resolved to raw hex values instead of CSS custom property references.

The code generator did not fail. It consumed the specification it was given and produced code accordingly. The specification was the problem: it was written for humans, not machines. It documented what the component looked like, not what a code generator needs to know to build it correctly.

A human reading a design spec applies decades of tacit knowledge to fill in the gaps. They know that "disabled" is a state, not a variant, even if it is listed both ways in different components. They know that `16px` probably means `spacing.md` in the token system, even if the spec does not say so. They know that the border-radius on the Card component probably matches the border-radius token, even if the spec shows only the rendered pixel value.

A machine knows none of this. A machine needs the complete alias chain — not the resolved value, but the token reference that produced the resolved value. It needs the variant property names exactly as they appear in Figma, because those names are the contract between the design component and the code component. It needs the layout constraints, the spacing values before they are rounded, the node IDs that uniquely identify each component across file versions.

`build-spec.mjs` emits a machine-readable component specification JSON that contains everything a code generator or AI coding agent needs, with nothing compressed out for the sake of human readability. This is the keystone chapter of Part Three. The chapters that follow — MCP integration, CI orchestration — consume the output of this script. A downstream CLI cannot make reliable decisions about what to generate unless the specification it reads is complete.

---

## What This Chapter Lets You Do

By the end of this chapter you can:

- Understand the structural difference between human-readable documentation and machine-readable specifications
- Define a component specification schema that contains everything a code generator needs and nothing that has been silently resolved or compressed
- Build `build-spec.mjs`, which fetches a Figma design system file and emits a schema-validated component specification JSON
- Understand which Figma API data is suitable for machine consumers and which requires supplementary annotation
- Write contract tests that fail if the specification omits required fields or contains unresolved design references
- Understand how this specification feeds the MCP workflows in Chapter 13

---

## The Two Consumer Types

The distinction between human and machine consumers is not a matter of formatting preference. It is a structural difference in what information must be present.

A human documentation consumer wants compression. They want the canonical usage of a component, not every variant value. They want usage guidance, not a complete enumeration of layout constraints. They want the example that covers 80% of use cases, not the edge cases. Compression makes documentation scannable and useful. A human who needs more detail can look at the Figma file directly.

A machine consumer — a code generator, an AI coding agent, a CLI that produces component scaffolding — wants completeness. Missing information forces the machine to guess. Guessing produces the wrong code. There is no equivalent of "open the Figma file to check" for a CLI running in CI.

The table below shows what each consumer type needs from the same component:

| Information | Human doc | Machine spec |
|---|---|---|
| Component name | Yes | Yes |
| Description | Yes (curated) | Yes (verbatim) |
| Variant dimensions | Yes (example) | Yes (complete enumeration) |
| Token alias chain | No — resolved value | Yes — full alias path |
| Node ID | No | Yes |
| Layout constraints | No | Yes |
| Spacing values | No — "16px" | Yes — raw value + token reference |
| Border radius | No — "rounded" | Yes — value + token reference |
| Typography details | Partially | Yes — all properties |
| Code Connect path | Maybe | Yes — required |
| Export formats | No | Yes |

The machine spec is not a better version of the human doc. It is a different artifact with a different structure and purpose. Generating a machine spec from the Figma API and using it as human documentation would produce something unreadable. Generating human documentation and feeding it to a code generator would produce code that guesses at the parts that were compressed out.

---

## What the Figma API Provides for Machine Consumers

The Figma REST API exposes more information than most practitioners use. The standard documentation sync use case (Chapter 10) only needed names, descriptions, and variant properties. A machine-readable specification needs everything the API can provide.

**Component-level data** (from `GET /v1/files/:key`) [verify — current as of writing]:

- `id`: the node ID. Stable within a file version; may change if the component is moved to a different page or file.
- `name`: the component's display name.
- `key`: the component key used in library references. More stable than node ID across file refactors.
- `componentSetId`: the parent component set, if this component is a variant.
- `variantProperties`: the exact key-value map of variant dimensions and values for this component node.
- `description`: the description field from Figma's component panel.
- `absoluteBoundingBox`: the pixel dimensions and position of the component in the canvas.
- `constraints`: horizontal and vertical sizing behavior (`SCALE`, `FIXED`, `CENTER`, `STRETCH`, `INHERIT`) [verify — current as of writing].
- `layoutMode`: `HORIZONTAL`, `VERTICAL`, or `NONE` — whether the component uses Auto Layout.
- `primaryAxisSizingMode` and `counterAxisSizingMode`: `FIXED` or `HUG` — whether the component's dimensions are fixed or wrap content.
- `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`: the Auto Layout padding values.
- `itemSpacing`: the gap between Auto Layout children.
- `fills`, `strokes`, `effects`: the visual properties of the component itself.
- `styles`: the style references applied to the component (links to color, text, and effect styles).
- `children`: the full node tree of the component's internals.

**Token/variable data** (from `GET /v1/files/:key/variables/local` — Enterprise only) [verify — current as of writing]:

- Variable collections: groupings of related variables (e.g., `color/brand`, `spacing/base`).
- Individual variables: name, type (`COLOR`, `FLOAT`, `STRING`, `BOOLEAN`), value per mode.
- Alias chains: a variable whose value is itself a reference to another variable, enabling the primitive → semantic → component layering described in Chapter 4.

**Style data** (from `GET /v1/files/:key`) [verify — current as of writing]:

- `styles` at the top level: keyed by style ID, with `name`, `description`, `styleType` (`FILL`, `TEXT`, `EFFECT`, `GRID`), and `key`.
- The style ID links node-level `styles.fill`, `styles.text`, etc. to the style definition.
- Style values are in the full file node tree, not in the styles map directly — you find the style's values by walking the node tree and finding the node that defines the style.

**Code Connect data** [verify — current as of writing]:

- When Code Connect is configured and published, the Figma Dev Mode API (`GET /v1/files/:key/dev_resources` or through the Code Connect CLI output) can expose the component-to-code mapping. The exact API surface for Code Connect data is still evolving; the stable approach is to maintain a `code-connect.json` file generated by the Code Connect CLI and merge it into the spec at build time.

---

## Defining the Component Specification Schema

A schema is a contract. Before writing `build-spec.mjs`, define the output format that downstream tools will consume. Name the fields, specify their types, and mark which are required.

```json
// component-spec-schema.json
// [illustrative — adapt to your design system's requirements]
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "title": "ComponentSpec",
  "description": "Machine-readable specification for a single Figma component",
  "type": "object",
  "required": ["nodeId", "key", "name", "specVersion", "generatedAt"],
  "properties": {
    "specVersion": {
      "type": "string",
      "description": "Spec schema version for downstream compatibility checks"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "nodeId": {
      "type": "string",
      "description": "Figma node ID — unique within file, may change across restructuring"
    },
    "key": {
      "type": "string",
      "description": "Figma component key — more stable than nodeId for library references"
    },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "componentSetId": { "type": ["string", "null"] },
    "variantProperties": {
      "type": ["object", "null"],
      "description": "Key-value map of variant dimensions and values for this specific component"
    },
    "dimensions": {
      "type": "object",
      "properties": {
        "width": { "type": "number" },
        "height": { "type": "number" },
        "widthSizing": { "type": "string", "enum": ["FIXED", "HUG", "FILL"] },
        "heightSizing": { "type": "string", "enum": ["FIXED", "HUG", "FILL"] }
      }
    },
    "layout": {
      "type": "object",
      "properties": {
        "mode": { "type": "string", "enum": ["HORIZONTAL", "VERTICAL", "NONE", "WRAP"] },
        "paddingTop": { "type": "number" },
        "paddingBottom": { "type": "number" },
        "paddingLeft": { "type": "number" },
        "paddingRight": { "type": "number" },
        "itemSpacing": { "type": "number" },
        "counterAxisSpacing": { "type": "number" }
      }
    },
    "fills": {
      "type": "array",
      "description": "Fill paint values with resolved colors and style references",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "color": {
            "type": "object",
            "properties": {
              "r": { "type": "number" },
              "g": { "type": "number" },
              "b": { "type": "number" },
              "a": { "type": "number" }
            }
          },
          "styleId": { "type": ["string", "null"] },
          "styleName": { "type": ["string", "null"] },
          "tokenAlias": { "type": ["string", "null"] }
        }
      }
    },
    "typography": {
      "type": ["object", "null"],
      "description": "Typography properties for text-bearing components",
      "properties": {
        "fontFamily": { "type": "string" },
        "fontWeight": { "type": "number" },
        "fontSize": { "type": "number" },
        "lineHeight": {},
        "letterSpacing": {},
        "styleId": { "type": ["string", "null"] },
        "styleName": { "type": ["string", "null"] },
        "tokenAlias": { "type": ["string", "null"] }
      }
    },
    "codeConnect": {
      "type": ["object", "null"],
      "description": "Code Connect mapping to the codebase implementation",
      "properties": {
        "importPath": { "type": "string" },
        "componentName": { "type": "string" },
        "propMappings": {
          "type": "object",
          "description": "Maps Figma variant dimension names to code prop names"
        }
      }
    },
    "children": {
      "type": "array",
      "description": "Recursive child nodes for code generators that need interior structure",
      "items": { "$ref": "#" }
    }
  }
}
```

The `tokenAlias` field on fills, strokes, and typography is critical. When a fill is applied via a color style that is itself bound to a variable, the downstream code generator should emit a CSS custom property reference (`var(--color-brand-primary)`), not a raw hex value. This requires tracing the chain from fill → style → variable → alias. The script below builds this chain where the data is available.

---

## Building `build-spec.mjs`

```javascript
// build-spec.mjs
// [illustrative — adapt to your file structure, variable access, and Code Connect setup]

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;
const OUT_DIR = process.argv.find(a => a.startsWith('--out='))?.split('=')[1] || 'spec-output';
const CODE_CONNECT_PATH = process.argv.find(a => a.startsWith('--code-connect='))?.split('=')[1] || null;
const SPEC_VERSION = '1.0.0';

if (!TOKEN || !FILE_KEY) {
  console.error('ERROR: FIGMA_TOKEN and FIGMA_FILE_KEY required.');
  process.exit(1);
}

const BASE = 'https://api.figma.com/v1';

async function figmaGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Figma-Token': TOKEN }
  });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('Retry-After') || '30', 10);
    console.warn(`Rate limited. Waiting ${retry}s...`);
    await new Promise(r => setTimeout(r, retry * 1000));
    return figmaGet(path);
  }
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Attempt to fetch variables (Enterprise only — graceful degradation on 403)
async function fetchVariables() {
  try {
    const data = await figmaGet(`/files/${FILE_KEY}/variables/local`);
    return data;
  } catch (e) {
    if (e.message.includes('403') || e.message.includes('403')) {
      console.warn('Variables API returned 403 — Enterprise plan required. Proceeding without variable alias chains.');
      return null;
    }
    throw e;
  }
}

function buildVariableIndex(variablesData) {
  if (!variablesData) return {};
  const index = {};
  const { variables, variableCollections } = variablesData.meta || variablesData;
  if (!variables) return index;

  for (const [id, variable] of Object.entries(variables)) {
    index[id] = {
      name: variable.name,
      type: variable.resolvedType,
      collectionId: variable.variableCollectionId,
      collectionName: variableCollections?.[variable.variableCollectionId]?.name || null
    };
  }
  return index;
}

function buildStyleIndex(fileData) {
  const styleIndex = {};
  const styles = fileData.styles || {};
  for (const [id, style] of Object.entries(styles)) {
    styleIndex[id] = {
      name: style.name,
      type: style.styleType,
      description: style.description || ''
    };
  }
  return styleIndex;
}

// Load Code Connect mappings from a file if provided
function loadCodeConnect(path) {
  if (!path || !existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    // Assume format: { [figmaKey]: { importPath, componentName, propMappings } }
    return raw;
  } catch {
    console.warn(`Could not parse Code Connect file at ${path}`);
    return {};
  }
}

function resolveFillInfo(node, styleIndex) {
  if (!node.fills || !Array.isArray(node.fills)) return [];
  return node.fills
    .filter(f => f.visible !== false)
    .map(fill => {
      const styleId = node.styles?.fill || node.styles?.fills || null;
      const styleName = styleId && styleIndex[styleId] ? styleIndex[styleId].name : null;
      return {
        type: fill.type,
        color: fill.color || null,
        opacity: fill.opacity !== undefined ? fill.opacity : 1,
        styleId,
        styleName,
        tokenAlias: styleName ? styleNameToTokenAlias(styleName) : null
      };
    });
}

function styleNameToTokenAlias(styleName) {
  // Convert "color/brand/primary" → "color.brand.primary"
  // This is a convention — adapt to your naming system
  return styleName.replace(/\//g, '.');
}

function resolveTypography(node, styleIndex) {
  if (node.type !== 'TEXT' || !node.style) return null;
  const s = node.style;
  const styleId = node.styles?.text || null;
  const styleName = styleId && styleIndex[styleId] ? styleIndex[styleId].name : null;

  return {
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    fontSize: s.fontSize,
    lineHeight: s.lineHeightPx || s.lineHeightPercent || s.lineHeightUnit,
    letterSpacing: s.letterSpacing,
    textAlignHorizontal: s.textAlignHorizontal,
    textDecoration: s.textDecoration,
    styleId,
    styleName,
    tokenAlias: styleName ? styleNameToTokenAlias(styleName) : null
  };
}

function buildNodeSpec(node, styleIndex, codeConnectIndex, depth = 0) {
  const spec = {
    nodeId: node.id,
    type: node.type,
    name: node.name,
    fills: resolveFillInfo(node, styleIndex),
    strokes: (node.strokes || []).filter(s => s.visible !== false).map(stroke => ({
      type: stroke.type,
      color: stroke.color,
      styleId: node.styles?.stroke || null,
      styleName: node.styles?.stroke && styleIndex[node.styles.stroke]
        ? styleIndex[node.styles.stroke].name
        : null
    })),
    typography: resolveTypography(node, styleIndex)
  };

  // Layout
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    spec.layout = {
      mode: node.layoutMode,
      paddingTop: node.paddingTop || 0,
      paddingBottom: node.paddingBottom || 0,
      paddingLeft: node.paddingLeft || 0,
      paddingRight: node.paddingRight || 0,
      itemSpacing: node.itemSpacing || 0,
      counterAxisSpacing: node.counterAxisSpacing || 0,
      primaryAxisSizingMode: node.primaryAxisSizingMode || 'FIXED',
      counterAxisSizingMode: node.counterAxisSizingMode || 'FIXED',
      primaryAxisAlignItems: node.primaryAxisAlignItems,
      counterAxisAlignItems: node.counterAxisAlignItems
    };
  }

  // Dimensions
  if (node.absoluteBoundingBox) {
    spec.dimensions = {
      width: node.absoluteBoundingBox.width,
      height: node.absoluteBoundingBox.height,
      widthSizing: node.primaryAxisSizingMode || null,
      heightSizing: node.counterAxisSizingMode || null
    };
  }

  // Constraints
  if (node.constraints) {
    spec.constraints = node.constraints;
  }

  // Effects
  if (node.effects && node.effects.length > 0) {
    spec.effects = node.effects.filter(e => e.visible !== false);
  }

  // Corner radius
  if (node.cornerRadius !== undefined || node.rectangleCornerRadii) {
    spec.cornerRadius = node.cornerRadius || null;
    spec.cornerRadii = node.rectangleCornerRadii || null;
  }

  // Children (limit depth to avoid enormous outputs for complex files)
  if (depth < 3 && node.children && node.children.length > 0) {
    spec.children = node.children.map(child =>
      buildNodeSpec(child, styleIndex, codeConnectIndex, depth + 1)
    );
  }

  return spec;
}

function buildComponentSpec(nodeId, comp, styleIndex, codeConnectIndex) {
  return {
    specVersion: SPEC_VERSION,
    generatedAt: new Date().toISOString(),
    nodeId,
    key: comp.key,
    name: comp.name,
    description: comp.description || '',
    componentSetId: comp.componentSetId || null,
    variantProperties: comp.variantProperties || null,
    fills: resolveFillInfo(comp, styleIndex),
    layout: comp.layoutMode && comp.layoutMode !== 'NONE' ? {
      mode: comp.layoutMode,
      paddingTop: comp.paddingTop || 0,
      paddingBottom: comp.paddingBottom || 0,
      paddingLeft: comp.paddingLeft || 0,
      paddingRight: comp.paddingRight || 0,
      itemSpacing: comp.itemSpacing || 0,
      counterAxisSpacing: comp.counterAxisSpacing || 0
    } : null,
    dimensions: comp.absoluteBoundingBox ? {
      width: comp.absoluteBoundingBox.width,
      height: comp.absoluteBoundingBox.height
    } : null,
    constraints: comp.constraints || null,
    codeConnect: codeConnectIndex[comp.key] || null,
    internalStructure: comp.children
      ? comp.children.map(child => buildNodeSpec(child, styleIndex, codeConnectIndex))
      : []
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Fetching file...');
  const fileData = await figmaGet(`/files/${FILE_KEY}`);

  console.log('Fetching variables (Enterprise only — will degrade gracefully)...');
  const variablesData = await fetchVariables();
  const variableIndex = buildVariableIndex(variablesData);

  const styleIndex = buildStyleIndex(fileData);
  const codeConnectIndex = loadCodeConnect(CODE_CONNECT_PATH);

  const rawComponents = fileData.components || {};
  const rawComponentSets = fileData.componentSets || {};

  // Build component set index
  const setSpecs = {};
  for (const [setId, set] of Object.entries(rawComponentSets)) {
    setSpecs[setId] = {
      specVersion: SPEC_VERSION,
      generatedAt: new Date().toISOString(),
      nodeId: setId,
      name: set.name,
      description: set.description || '',
      variants: []
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

  // Manifest
  const manifest = {
    specVersion: SPEC_VERSION,
    generatedAt: new Date().toISOString(),
    fileKey: FILE_KEY,
    fileName: fileData.name,
    lastModified: fileData.lastModified,
    totalComponents: componentSpecs.length,
    totalComponentSets: Object.keys(setSpecs).length,
    hasVariableData: variablesData !== null,
    hasCodeConnect: Object.keys(codeConnectIndex).length > 0,
    componentKeys: componentSpecs.map(c => c.key),
    componentSetNames: Object.values(setSpecs).map(s => s.name)
  };

  // Write outputs
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(OUT_DIR, 'components.json'), JSON.stringify(componentSpecs, null, 2));
  writeFileSync(join(OUT_DIR, 'component-sets.json'), JSON.stringify(Object.values(setSpecs), null, 2));

  // Write per-component files for large systems
  const componentsDir = join(OUT_DIR, 'components');
  mkdirSync(componentsDir, { recursive: true });
  for (const spec of componentSpecs) {
    const safeName = spec.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    writeFileSync(
      join(componentsDir, `${safeName}-${spec.nodeId}.json`),
      JSON.stringify(spec, null, 2)
    );
  }

  console.log(`\nDone.`);
  console.log(`${componentSpecs.length} component specs written to ${OUT_DIR}/`);
  console.log(`Variable data: ${variablesData ? 'yes' : 'no (upgrade to Enterprise or use Tokens Studio)'}`);
  console.log(`Code Connect: ${Object.keys(codeConnectIndex).length} mappings loaded`);

  // Contract validation — fail if required fields are missing
  const contractFailures = [];
  for (const spec of componentSpecs) {
    if (!spec.key) contractFailures.push(`${spec.name}: missing key`);
    if (!spec.nodeId) contractFailures.push(`${spec.name}: missing nodeId`);
    if (spec.specVersion !== SPEC_VERSION) contractFailures.push(`${spec.name}: wrong specVersion`);
  }

  if (contractFailures.length > 0) {
    console.error('\nContract failures:');
    for (const f of contractFailures) console.error(' ', f);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
```

### Running It

```bash
# Basic run
node build-spec.mjs --out=spec-output

# With Code Connect mappings
node build-spec.mjs --out=spec-output --code-connect=code-connect.json
```

```json
{
  "scripts": {
    "figma:spec": "node build-spec.mjs --out=spec-output",
    "figma:spec:full": "node build-spec.mjs --out=spec-output --code-connect=code-connect.json"
  }
}
```

---

## The Variable Alias Chain: The Non-Enterprise Path

The token alias chain — the chain from a raw fill value back through a style reference to a token variable — is where the machine-readable spec most clearly outperforms human documentation. A human reader can infer that the primary button's blue fill probably comes from the `brand-primary` token. A code generator cannot infer this. It must be told.

The full alias chain requires the Variables API, which is gated behind the Enterprise plan [verify — current as of writing]. On non-Enterprise plans:

**Option 1 — Tokens Studio**: The Tokens Studio plugin exports a JSON file that contains variables and their alias relationships, regardless of plan. The `build-spec.mjs` script can be extended to merge a Tokens Studio JSON file into the spec, resolving style names to token aliases. The Tokens Studio format is not identical to the DTCG W3C format, but it is parseable and stable enough to build on [verify — current as of writing].

**Option 2 — Style-name convention**: If your team follows the naming convention from Chapter 4 — `color/brand/primary` for color styles, matching the token hierarchy — then `build-spec.mjs` can infer the token alias from the style name. The `styleNameToTokenAlias` function in the script above does this: `color/brand/primary` becomes `color.brand.primary`, which maps to `--color-brand-primary` in CSS or `$color-brand-primary` in Sass. This is a convention, not a guaranteed mapping, and it breaks when style names do not match token names.

**Option 3 — Style Dictionary integration**: Run Style Dictionary against a known token source (Tokens Studio JSON or manually maintained DTCG JSON) and produce a style-ID-to-token-name lookup table. Merge this table into `build-spec.mjs` at build time. This is the most reliable non-Enterprise approach but requires maintaining Style Dictionary configuration separately.

The correct answer for your team depends on your plan and your naming discipline. The script gracefully degrades — it emits whatever alias information it can construct and marks the rest as `null`. A contract test should warn (not fail) when token aliases are absent, so the generator knows to use resolved values as a fallback.

---

## W3C DTCG as the Interchange Format

The component spec JSON defined above is specific to this book's tool chain. If you need to share specs across tool boundaries — different teams, different code generators, different platforms — the W3C Design Tokens Community Group (DTCG) format [verify — current as of writing] is the emerging standard for tokens.

DTCG defines a format for design token interchange:

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

The `$value`, `$type`, and `$description` fields are the DTCG primitives. Aliases are expressed as references:

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

The `build-spec.mjs` script can emit DTCG-compatible token data for each component — the component-level tokens that are specific to this component, not the global token set. This gives downstream tools a per-component token scope, which some code generators use to generate component-scoped CSS custom properties.

Style Dictionary supports DTCG input natively [verify — current as of writing], which means a spec generated by `build-spec.mjs` with DTCG token data can be processed by Style Dictionary to produce CSS, Swift, Android XML, or any other platform target.

---

## Contract Tests

A machine-readable spec is only useful if it is complete. Contract tests are the mechanism that prevents the spec from silently regressing.

The contract test is simple: after generating the spec, assert that every required field is present, no field contains an unresolved alias reference (where resolution was expected), and the spec version matches what the downstream consumer expects.

```javascript
// test-spec-contract.mjs
// [illustrative — run after build-spec.mjs]

import { readFileSync } from 'fs';

const components = JSON.parse(readFileSync('spec-output/components.json', 'utf8'));

let failures = 0;

for (const spec of components) {
  if (!spec.nodeId) { console.error(`FAIL: ${spec.name} missing nodeId`); failures++; }
  if (!spec.key) { console.error(`FAIL: ${spec.name} missing key`); failures++; }
  if (!spec.specVersion) { console.error(`FAIL: ${spec.name} missing specVersion`); failures++; }

  // Warn on missing Code Connect
  if (!spec.codeConnect) {
    console.warn(`WARN: ${spec.name} has no Code Connect mapping`);
  }

  // Warn on unresolved fills (fill present but no token alias and no style reference)
  if (spec.fills && spec.fills.some(f => f.type === 'SOLID' && !f.styleId && !f.tokenAlias)) {
    console.warn(`WARN: ${spec.name} has fills without style reference or token alias — code generator will use raw values`);
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
    "figma:spec": "node build-spec.mjs --out=spec-output",
    "figma:spec:check": "node build-spec.mjs --out=spec-output && node test-spec-contract.mjs"
  }
}
```

---

## How This Feeds Chapter 13: MCP and the AI Coding Agent

The component spec JSON from `build-spec.mjs` is the structured context that an AI coding agent needs to generate code that matches your design system. Without it, an agent like Claude Code working in an MCP session has to infer component structure from whatever is visible in the Figma canvas — which is richer than no information but structurally incomplete.

With the spec:

- The agent knows the exact variant dimensions and values for each component, so it can generate a TypeScript `type Props = { variant: 'primary' | 'secondary' | 'destructive'; size: 'sm' | 'md' | 'lg' }` without guessing.
- The agent knows the token alias for each fill, so it can emit `color: var(--color-brand-primary)` instead of `color: #1A56DB`.
- The agent knows the Code Connect import path, so it can write `import { Button } from '@acme/design-system'` rather than inventing an import.
- The agent knows the layout constraints, so it can make informed decisions about whether a component should be `width: 100%` or `width: fit-content`.

This is the thesis of the book made explicit: the canvas is not machine-readable by itself. The extraction layer — the audit, the naming conventions, the token pipeline, the spec generator — is what makes it machine-readable. `build-spec.mjs` is the output of that extraction layer for the component specification case.

The spec is also a fixture for tests. A code generator that has consumed a spec should produce the same output from the same spec. Storing the spec in version control means you can detect when a Figma change has altered the spec — and decide whether that change should trigger a code generation run.

---

## Failure Modes

**The spec is large.** A design system with 500 components and deep node trees produces a spec file that is several megabytes. This is not a problem for a CLI that writes to disk, but it is a problem for an AI coding agent that loads the entire spec into context. For MCP use, generate per-component specs (the `components/` directory from `build-spec.mjs`) and load only the components relevant to the current generation task.

**Node IDs are not stable across file restructuring.** When a component is moved to a different page or the file is restructured, its node ID changes. The component key (the `key` field) is more stable — it persists across moves within the file. Build downstream tools to key on `key`, not `nodeId`, for component identity. Store both in the spec.

**Variable data requires Enterprise.** The graceful degradation in `build-spec.mjs` means the spec is generated without alias chains on non-Enterprise plans. A code generator consuming a spec with no alias chains will use resolved hex values instead of token references. This is not wrong — it is a known limitation. Document it in the spec's manifest. The non-Enterprise alternatives (Tokens Studio, style-name convention) partially close this gap.

**Code Connect must be maintained separately.** `build-spec.mjs` reads Code Connect data from a file generated by the Code Connect CLI. When components are added or variants change, the Code Connect file must be updated. If it is out of date, the spec will have stale or missing Code Connect mappings, and the code generator will fall back to inferring import paths. Track Code Connect updates as part of the same process as publishing a library component.

**Internal structure depth.** The script limits internal node traversal to three levels of depth to keep spec files manageable. Some code generators need the complete interior structure — every nested frame, every text layer. If your generator needs deeper structure, increase the depth limit, but monitor output size. Very deep traversals on complex components can produce spec files that are impractical to diff or load.

---

## Decision Rules

**Generate the spec whenever**: the Figma library is published, a new component is added, or variant properties change.

**Use `build-spec.mjs` as the source for**: code generators, AI coding agent context, design-to-code pipeline inputs, and component scaffolding CLIs.

**Do not use it as**: human-readable documentation. The spec is for machines. The documentation from Chapter 10 is for humans.

**Store the spec in version control**: treat `components.json` and `manifest.json` as generated files that change when the design system changes. Their diffs are meaningful — they show exactly what changed in the design system between two runs.

**Run contract tests**: before any code generation run. A spec with missing required fields or stale Code Connect data produces bad code. The contract test is the gatekeeper.

**On non-Enterprise plans**: use Tokens Studio JSON merged into the spec, or rely on style-name conventions for token alias resolution. Document the limitation clearly in the manifest.

---

## Try This

1. Run `build-spec.mjs` against your design system file. Open `components.json` in a JSON viewer. Find a component you know well — Button or Card. Look at the `fills` array. Does it have a `styleId`? Does it have a `tokenAlias`? This tells you how much of the alias chain your current file structure exposes.

2. Pick one component set — say, Button — and find its entry in `component-sets.json`. Look at the `variants` array. Confirm that every variant dimension you defined in Figma is present. If a variant property is missing, it means the component in Figma is not properly structured as a component set.

3. Write a minimal code generator that reads one component spec from `components/` and produces a TypeScript props type from `variantProperties`. Do not generate the JSX yet — just the props type. Confirm that the output matches what you would write by hand.

4. Configure Code Connect for one component. Add the Code Connect JSON output to `--code-connect`. Re-run `build-spec.mjs` and confirm that `codeConnect` is populated in that component's spec. Now write a code generator that uses the `importPath` to produce the correct import statement.

5. Store the `components.json` output in Git. Make a change to a component in Figma — add a variant, rename a property. Re-run the spec. Look at the diff. Confirm that the diff captures exactly what changed. This is the design-to-production paper trail.

---

## AI Wayback Machine — The OpenAPI Specification

The challenge of making a human-designed artifact machine-readable is not new. The most successful solution to date is the **OpenAPI Specification** (formerly Swagger), which defines a standard machine-readable format for HTTP APIs.

Before OpenAPI, API documentation was written for human readers: prose descriptions of endpoints, example requests and responses, informal notes about error codes. This worked until tools needed to consume the API definition — SDK generators, mock servers, test harnesses, documentation renderers. Each tool had to parse human prose, which was imprecise and inconsistent. The result was fragile tool chains that broke when the prose changed.

OpenAPI solved this by defining a JSON or YAML schema that a machine could parse and validate. An API described in OpenAPI can be consumed by an SDK generator, a mock server, a documentation renderer, and a test harness — all from the same source. The schema is the contract. The tools are the consumers.

The `build-spec.mjs` output is the design system equivalent: a machine-parseable schema that describes the components, their properties, their token references, and their code mappings. Like OpenAPI, it is too verbose and complete to be useful as human documentation. Like OpenAPI, it enables tool chains that would otherwise require fragile prose parsing.

The lesson from OpenAPI is that the schema needs to be versioned (`specVersion` in the manifest serves this role), validated (`test-spec-contract.mjs` serves this role), and treated as a contract — not just as data. When the schema changes in a breaking way, downstream consumers must be updated. The spec version is the signal that tells them to update.

Design systems are following the same path that APIs followed a decade earlier: from human documentation to machine-readable contracts. This book is about the extraction layer that makes that transition possible.

---

*Next chapter: putting the spec to work — connecting a design system file to an AI coding agent via the Figma MCP server, using the spec as the structured context that makes the agent's output trustworthy.*
