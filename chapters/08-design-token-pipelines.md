# Chapter 8 — Design Token Pipelines

The sprint ended on a Friday. On Monday the developer opened the staging build to discover that every interactive element — buttons, links, focus rings, form borders — had the wrong blue.

She checked the CSS. The CSS was correct. The custom properties were correct. She checked the generated token JSON. The token JSON was correct. She tracked it back to the source: the Figma file. In the Figma file, `color/brand/interactive` resolved to `#2563EB`. In the CSS, `--color-brand-interactive` was `#1D4ED8`. Both values were in the design system. They were two different steps on the blue scale.

The pipeline had run successfully. It had extracted tokens from the file as it existed the previous Wednesday. The designer had updated `color/brand/interactive` on Thursday afternoon. She published the library. No one triggered the pipeline again. The pipeline had no way to know the file had changed. The staging build was running four-day-old tokens.

The problem was not the pipeline code. The problem was a pipeline architecture without an automatic trigger. The synchronization had a human-sized hole in it.

---

## What This Chapter Does

This chapter builds `extract-tokens.mjs` and `validate-tokens.mjs` — the two scripts that form the operational core of a design token pipeline.

By the end of this chapter you will have:

- A working `extract-tokens.mjs` that calls the Figma Variables API, resolves alias chains, handles multiple modes, and writes DTCG-compatible JSON
- A non-Enterprise fallback path using Tokens Studio for teams that cannot access the Variables REST API
- A `validate-tokens.mjs` that catches broken aliases, malformed values, missing modes, and platform-incompatible names before Style Dictionary runs
- A Style Dictionary configuration that transforms DTCG JSON into CSS custom properties, Swift constants, and Android XML
- A GitHub Actions workflow that triggers on `LIBRARY_PUBLISH` webhook events, runs the pipeline, and opens a pull request for human review

The token pipeline is the highest-value extraction pipeline in the book. When it works, a designer changes a value in Figma, publishes the library, and a pull request opens with the updated token JSON and the generated platform artifacts — all without a human in the loop except for the final review.

---

## Diagnosis: The Five-Stage Architecture

Token pipelines that break do so at predictable points. Understanding the five-stage architecture makes those failure points legible.

**Stage 1 — Declare.** The design system declares its token taxonomy: what collections exist, what modes they contain, and what naming conventions apply. This stage happens in Figma. The machine-readiness contract from Chapter 7 governs it. If Stage 1 is wrong — bad names, broken aliases, missing collections — every downstream stage amplifies the problem.

**Stage 2 — Extract.** The pipeline reads variables from Figma (via the Variables REST API or via a Tokens Studio export) and writes them to a normalized intermediate format. This chapter implements this stage in `extract-tokens.mjs`.

**Stage 3 — Transform.** A transformation tool (Style Dictionary is the current standard) reads the intermediate format and applies platform-specific transforms: `#2563EB` becomes `--color-brand-interactive: #2563EB` in CSS, `UIColor(red: 0.145, green: 0.388, blue: 0.922, alpha: 1)` in Swift, `#FF2563EB` in Android XML. [verify — current as of writing]

**Stage 4 — Distribute.** The pipeline writes the transformed output to a location where downstream consumers can reach it: a package in a private registry, a JSON file in the repository, a PR that updates the generated files.

**Stage 5 — Compile.** Each platform's build system compiles the distributed tokens into its own format. The CSS file is imported. The Swift constants are referenced. The Android resource file is parsed.

A reliable pipeline makes every stage explicit, testable, and independently verifiable. This chapter focuses on Stages 2 and 3. The validation script sits between them.

---

## The Enterprise Gate

The Figma Variables REST API — `GET /v1/files/:key/variables/local` — is an Enterprise-plan endpoint. [verify — current as of writing] This is not a soft limitation; it is an access control decision. If your organization is on a Professional plan or lower, the endpoint returns an authorization error.

This is the Starter-plan trap applied to tokens. A significant portion of design systems engineers working in product companies are on Professional plans. Every token pipeline that depends exclusively on the Variables REST API excludes them.

This chapter solves the problem by treating the Enterprise path and the non-Enterprise path as two parallel implementations of Stage 2. `extract-tokens.mjs` supports both. The configuration declares which path to use. The rest of the pipeline — validation, transformation, distribution, compilation — is identical either way.

---

## The Enterprise Path: extract-tokens.mjs (Variables REST API)

```javascript
// extract-tokens.mjs (Enterprise path)
// Usage: node extract-tokens.mjs
// Requires: FIGMA_TOKEN, FIGMA_FILE_KEY in environment
// Optional: FIGMA_COLLECTION_FILTER (comma-separated collection names to include)
// Illustrative — verify Variables API response shape before shipping

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TOKEN    = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;
const FILTER   = process.env.FIGMA_COLLECTION_FILTER
  ? process.env.FIGMA_COLLECTION_FILTER.split(',').map(s => s.trim())
  : null;

if (!TOKEN || !FILE_KEY) {
  console.error('[extract-tokens] ERROR: FIGMA_TOKEN and FIGMA_FILE_KEY are required.');
  process.exit(1);
}

// [verify — current as of writing] Variables API endpoint
const BASE = 'https://api.figma.com/v1';

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Figma-Token': TOKEN }
  });
  if (res.status === 403) {
    console.error('[extract-tokens] 403 Forbidden — the Variables REST API requires an Enterprise plan.');
    console.error('[extract-tokens] Use the non-Enterprise path: set TOKENS_STUDIO_INPUT and run with --source=studio');
    process.exit(2);
  }
  if (!res.ok) {
    throw new Error(`Figma API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// [verify — current as of writing] Response shape: { variables, variableCollections }
async function fetchVariables() {
  const data = await get(`/files/${FILE_KEY}/variables/local`);
  return {
    variables:   data.variables   ?? {},
    collections: data.variableCollections ?? {}
  };
}

// Resolve alias chains to raw values
// Returns { resolved: value, type: 'COLOR'|'FLOAT'|'STRING'|'BOOLEAN' }
function resolveAlias(variableId, modeId, variables, depth = 0) {
  if (depth > 10) {
    throw new Error(`Alias chain too deep for variable ${variableId}`);
  }
  const variable = variables[variableId];
  if (!variable) {
    throw new Error(`Missing variable: ${variableId}`);
  }
  const value = variable.valuesByMode[modeId]
    ?? Object.values(variable.valuesByMode)[0]; // fallback to first mode value

  if (value && value.type === 'VARIABLE_ALIAS') {
    // [verify — current as of writing] alias shape: { type: 'VARIABLE_ALIAS', id: 'variableId' }
    return resolveAlias(value.id, modeId, variables, depth + 1);
  }
  return { resolved: value, type: variable.resolvedType };
}

// Convert Figma RGBA float object { r, g, b, a } to hex
// [verify — current as of writing] Figma uses 0–1 float range for RGBA
function rgbaToHex({ r, g, b, a }) {
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a === 1) return hex;
  return `${hex}${toHex(a)}`;
}

// Build a DTCG-compatible token from a variable + mode
// [verify — current as of writing] W3C DTCG format: https://tr.designtokens.org/format/
function buildDTCGToken(variable, modeId, resolvedValue, resolvedType) {
  const token = {
    $value: resolvedValue,
    $type:  resolvedType.toLowerCase()
  };
  if (variable.description) {
    token.$description = variable.description;
  }
  return token;
}

// Set a nested value on an object from a slash-separated key path
function setNestedValue(obj, path, value) {
  const keys = path.split('/');
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

async function run() {
  console.log('[extract-tokens] Fetching variables...');
  const { variables, collections } = await fetchVariables();

  const totalVars = Object.keys(variables).length;
  const totalCols = Object.keys(collections).length;
  console.log(`[extract-tokens] Found ${totalVars} variables in ${totalCols} collections`);

  const output = {};  // will hold one DTCG JSON object per mode

  for (const [collectionId, collection] of Object.entries(collections)) {
    // Apply collection filter if set
    if (FILTER && !FILTER.includes(collection.name)) {
      console.log(`[extract-tokens] Skipping collection: ${collection.name}`);
      continue;
    }

    for (const mode of collection.modes) {
      const modeKey = mode.name.toLowerCase().replace(/\s+/g, '-');
      if (!output[modeKey]) output[modeKey] = {};

      for (const variableId of collection.variableIds) {
        const variable = variables[variableId];
        if (!variable) continue;

        let resolvedValue, resolvedType;
        try {
          const { resolved, type } = resolveAlias(variableId, mode.modeId, variables);
          resolvedType = type;

          if (type === 'COLOR') {
            resolvedValue = rgbaToHex(resolved);
          } else if (type === 'FLOAT') {
            resolvedValue = resolved;
          } else {
            resolvedValue = String(resolved);
          }
        } catch (err) {
          console.warn(`[extract-tokens] WARN: Could not resolve "${variable.name}" in mode "${mode.name}": ${err.message}`);
          continue;
        }

        const token = buildDTCGToken(variable, mode.modeId, resolvedValue, resolvedType);
        setNestedValue(output[modeKey], variable.name, token);
      }
    }
  }

  // Write output
  mkdirSync('tokens', { recursive: true });
  for (const [modeKey, tokens] of Object.entries(output)) {
    const outPath = join('tokens', `${modeKey}.json`);
    writeFileSync(outPath, JSON.stringify(tokens, null, 2));
    console.log(`[extract-tokens] Wrote ${outPath}`);
  }

  console.log('[extract-tokens] Done.');
}

run().catch(err => {
  console.error('[extract-tokens] Fatal:', err.message);
  process.exit(1);
});
```

---

## The Non-Enterprise Path: Tokens Studio

Tokens Studio (formerly Figma Tokens) is a Figma plugin that runs inside the Figma environment and can export variables to JSON without requiring the Variables REST API. It is the standard non-Enterprise extraction path. [verify — current as of writing]

The workflow is:

1. A designer runs Tokens Studio inside Figma and exports the token JSON (or configures Tokens Studio to sync to a GitHub repository automatically)
2. The CI pipeline reads the Tokens Studio JSON, normalizes it to DTCG format, and proceeds identically to the Enterprise path from validation onward

Add a `--source` flag to `extract-tokens.mjs` to support both:

```javascript
// At the top of extract-tokens.mjs, add:
const SOURCE = process.argv.includes('--source=studio') ? 'studio' : 'api';
const STUDIO_INPUT = process.env.TOKENS_STUDIO_INPUT ?? 'tokens-studio-output.json';

// In run():
if (SOURCE === 'studio') {
  console.log(`[extract-tokens] Using Tokens Studio input: ${STUDIO_INPUT}`);
  const raw = JSON.parse(readFileSync(STUDIO_INPUT, 'utf8'));
  // Tokens Studio JSON is not DTCG-compatible out of the box.
  // Normalize it here or use the @tokens-studio/sd-transforms package
  // with Style Dictionary. [verify — current as of writing]
  const normalized = normalizeTokensStudio(raw);
  writeFileSync('tokens/source.json', JSON.stringify(normalized, null, 2));
  console.log('[extract-tokens] Wrote tokens/source.json from Tokens Studio input.');
  return;
}
```

The `@tokens-studio/sd-transforms` package provides Style Dictionary transforms that understand Tokens Studio's output format. It bridges the non-standard Tokens Studio JSON to DTCG-compatible output that Style Dictionary can process. [verify — current as of writing]

For teams on Professional plans, the recommended architecture is:

- Tokens Studio handles extraction (Stage 2), configured to sync to a branch in GitHub
- The CI pipeline picks up the synced JSON, validates it, and runs Style Dictionary (Stages 3–5)
- The Variables REST API is not used

---

## validate-tokens.mjs

Validation runs after extraction and before Style Dictionary. Its job is to catch problems that would cause Style Dictionary to produce malformed output — or to succeed while writing incorrect values.

```javascript
// validate-tokens.mjs
// Usage: node validate-tokens.mjs [--input tokens/]
// Illustrative — extend checks to match your taxonomy

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const INPUT_DIR = process.argv[2] ?? 'tokens';

function getTokenFiles(dir) {
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ file: f, path: join(dir, f) }));
}

function walkTokens(obj, path, callback) {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}/${key}` : key;
    if (value && typeof value === 'object' && '$value' in value) {
      callback(currentPath, value);
    } else if (value && typeof value === 'object') {
      walkTokens(value, currentPath, callback);
    }
  }
}

function validateColor(value, path) {
  // Accept #RGB, #RRGGBB, #RRGGBBAA
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?$/.test(value)) {
    return `Invalid color value at "${path}": "${value}"`;
  }
  return null;
}

function validateFloat(value, path) {
  if (typeof value !== 'number' && isNaN(parseFloat(value))) {
    return `Invalid float value at "${path}": "${value}"`;
  }
  return null;
}

function validateTokenName(path) {
  const segments = path.split('/');
  const invalid = segments.filter(s => !/^[a-z0-9][a-z0-9\-]*$/.test(s));
  if (invalid.length > 0) {
    return `Token path has non-slug segments at "${path}": [${invalid.join(', ')}]`;
  }
  return null;
}

function validateFile(filePath) {
  const errors = [];
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));

  walkTokens(raw, '', (path, token) => {
    const nameError = validateTokenName(path);
    if (nameError) errors.push(nameError);

    if (token.$type === 'color') {
      const colorError = validateColor(token.$value, path);
      if (colorError) errors.push(colorError);
    }

    if (token.$type === 'number' || token.$type === 'dimension') {
      const floatError = validateFloat(token.$value, path);
      if (floatError) errors.push(floatError);
    }

    // Check for unresolved alias references (DTCG aliases use { } syntax)
    if (typeof token.$value === 'string' && token.$value.startsWith('{')) {
      errors.push(`Unresolved alias at "${path}": "${token.$value}" — alias was not resolved during extraction`);
    }
  });

  return errors;
}

function run() {
  const files = getTokenFiles(INPUT_DIR);
  if (files.length === 0) {
    console.error(`[validate-tokens] No JSON files found in ${INPUT_DIR}`);
    process.exit(1);
  }

  let totalErrors = 0;

  for (const { file, path } of files) {
    console.log(`[validate-tokens] Checking ${file}...`);
    const errors = validateFile(path);
    if (errors.length > 0) {
      console.error(`  ERRORS in ${file}:`);
      errors.forEach(e => console.error(`    ${e}`));
      totalErrors += errors.length;
    } else {
      console.log(`  OK`);
    }
  }

  if (totalErrors > 0) {
    console.error(`\n[validate-tokens] FAILED: ${totalErrors} error(s) found. Fix before running Style Dictionary.`);
    process.exit(1);
  }

  console.log(`\n[validate-tokens] PASSED. ${files.length} file(s) validated.`);
}

run();
```

The validate step makes one guarantee: if it exits zero, Style Dictionary will not produce a token file with unresolved aliases or malformed color values. It does not guarantee that the tokens are semantically correct. That is a design review concern.

---

## Style Dictionary Configuration

Style Dictionary is the current industry standard for transforming token JSON into platform-specific output. It reads the DTCG-compatible JSON from `tokens/` and emits CSS, Swift, Android XML, or any other format you configure. [verify — current as of writing]

```javascript
// sd.config.mjs
// Usage: npx style-dictionary build --config sd.config.mjs
// [verify — current as of writing] Style Dictionary 4.x config API

import StyleDictionary from 'style-dictionary';

export default {
  source: ['tokens/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: '',
      buildPath: 'dist/css/',
      files: [{
        destination: 'tokens.css',
        format: 'css/variables',
        options: {
          outputReferences: false  // resolve aliases in output; set true to emit var() chains
        }
      }]
    },
    js: {
      transformGroup: 'js',
      buildPath: 'dist/js/',
      files: [{
        destination: 'tokens.js',
        format: 'javascript/module'
      }]
    }
    // Add swift and android platforms here following Style Dictionary docs
  }
};
```

The CSS output for a token like:

```json
{
  "color": {
    "brand": {
      "primary": {
        "$value": "#2563EB",
        "$type": "color",
        "$description": "Primary brand interactive color"
      }
    }
  }
}
```

...becomes:

```css
:root {
  --color-brand-primary: #2563EB;
}
```

The name transformation from slash-separated DTCG paths to kebab-case CSS custom property names is handled by Style Dictionary's built-in CSS transform group. [verify — current as of writing]

---

## GitHub Actions: The Trigger and the PR

The failure in the opening scenario was a missing trigger. The pipeline ran on a schedule, not on file changes. Figma webhooks solve this.

Figma sends a `LIBRARY_PUBLISH` event when a designer publishes a library update. [verify — current as of writing: webhook event types and payloads are documented at https://developers.figma.com/docs/rest-api/webhooks/] A GitHub Actions workflow can receive this event via a webhook endpoint (a simple serverless function or a GitHub repository dispatch relay) and trigger the token pipeline.

```yaml
# .github/workflows/tokens.yml
name: Update design tokens

on:
  repository_dispatch:
    types: [figma-library-publish]
  workflow_dispatch:  # manual trigger for testing

permissions:
  contents: write
  pull-requests: write

jobs:
  extract-tokens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Preflight check
        run: npm run figma:preflight
        env:
          FIGMA_TOKEN:    ${{ secrets.FIGMA_TOKEN }}
          FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}

      - name: Extract tokens
        run: node extract-tokens.mjs
        env:
          FIGMA_TOKEN:    ${{ secrets.FIGMA_TOKEN }}
          FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}

      - name: Validate tokens
        run: node validate-tokens.mjs

      - name: Transform with Style Dictionary
        run: npx style-dictionary build --config sd.config.mjs

      - name: Open PR with updated tokens
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "chore: update design tokens from Figma"
          branch: figma/token-update
          title: "Design token update from Figma library publish"
          body: |
            Automated design token update triggered by Figma library publish.
            
            Review the diff before merging. This PR was opened by the token pipeline — not a human.
          labels: design-tokens, automated
```

The pull request is not optional. A pipeline that commits token changes directly to main without review has removed the only human checkpoint in the synchronization loop. The pull request diff is the design-development conversation. The designer can see exactly which CSS variables changed. The developer can confirm the values match what they saw in the design file. The PR is the trust mechanism, not a bureaucratic step.

---

## Fixture Tests

Pipelines are code. Code without tests fails silently in ways that feel like success.

```javascript
// test/extract-tokens.test.mjs
// Usage: node --test test/extract-tokens.test.mjs
// Requires a saved fixture: test/fixtures/variables-response.json

import { strict as assert } from 'assert';
import { test }             from 'node:test';
import { readFileSync }     from 'fs';

// Import the pure functions from extract-tokens.mjs
// (export them separately from the run() entry point)
import { resolveAlias, rgbaToHex, buildDTCGToken } from '../extract-tokens.mjs';

const fixture = JSON.parse(readFileSync('test/fixtures/variables-response.json', 'utf8'));

test('rgbaToHex converts Figma RGBA to hex', () => {
  assert.equal(rgbaToHex({ r: 0.145, g: 0.388, b: 0.922, a: 1 }), '#2563EB');
  assert.equal(rgbaToHex({ r: 1, g: 1, b: 1, a: 0.5 }),           '#FFFFFF80');
});

test('resolveAlias resolves direct value', () => {
  const vars = fixture.variables;
  const firstId = Object.keys(vars)[0];
  const firstModeId = Object.keys(vars[firstId].valuesByMode)[0];
  const result = resolveAlias(firstId, firstModeId, vars);
  assert.ok(result.resolved !== undefined);
});

test('resolveAlias throws on broken alias', () => {
  const vars = { 'broken-id': { name: 'broken', resolvedType: 'COLOR',
    valuesByMode: { 'mode1': { type: 'VARIABLE_ALIAS', id: 'nonexistent' } } } };
  assert.throws(() => resolveAlias('broken-id', 'mode1', vars));
});
```

Save a real API response to `test/fixtures/variables-response.json` by running the extract script in dry-run mode. The fixture does not change unless you update it deliberately. The test catches regressions in the transformation logic without making API calls.

---

## Failure Modes

**The UID wrench.** [verify — current as of writing] Figma variable IDs are stable across file saves, but if a designer deletes a variable and creates a new one with the same name, the ID changes. The alias chain in other variables that referenced the old ID is now broken. The preflight from Chapter 7 catches this before the pipeline runs, but only if it runs against the current file state. Always run the preflight immediately before extraction — not against a cached file response.

**The sync lag.** The Figma API reflects the current save state of the file, not necessarily the last published state. A designer who saves without publishing may have a file state that differs from what the library consumers see. The token pipeline should extract from the published state if possible. [verify — current as of writing: the Variables API returns data for the current file, not the last published version; consult Figma documentation for the distinction]

**The Starter-plan trap.** As noted above, the Variables REST API requires Enterprise. Document this clearly in the repository README so the next engineer who onboards to the pipeline does not spend four hours debugging a 403 that has nothing to do with their code.

**The modes explosion.** A variable collection with many modes (light, dark, high-contrast-light, high-contrast-dark, compact, comfortable, brand-a, brand-b...) produces a token file per mode. Style Dictionary needs explicit configuration to combine modes correctly into platform-specific outputs. If mode handling is not explicitly configured, Style Dictionary defaults may produce unexpected output. [verify — current as of writing]

**Silent type coercion.** Figma FLOAT variables can represent anything — spacing, font sizes, line heights, border radii, durations. Without explicit `$type` declarations in the DTCG output, Style Dictionary treats them all as raw numbers and applies no unit. A spacing token that should be `8px` arrives as `8` in CSS and breaks any rule that expects a unit.

The fix: when extracting FLOAT variables, use the variable's collection and name to infer `$type`. A variable in a collection named "Spacing" with a name like `spacing/s/200` gets `"$type": "dimension"`. A variable in a collection named "Duration" gets `"$type": "duration"`. This requires a type mapping configuration in `extract-tokens.mjs` — not a lookup table you can generate automatically from the Figma data alone.

---

## Decision Rules

**When to use the Variables REST API vs. Tokens Studio.** Use the REST API if your organization is on Enterprise and you want to eliminate the designer-operated export step entirely. Use Tokens Studio if you are on Professional or lower, or if your team already uses Tokens Studio and wants to keep the extraction logic inside Figma's plugin environment.

**When to use `outputReferences: true` in Style Dictionary.** Use it when you want the CSS output to preserve the alias structure as `var()` chains — so `--color-button-primary: var(--color-brand-blue-600)` instead of `--color-button-primary: #2563EB`. This makes the CSS output more expressive and easier to override at runtime, but it requires all referenced variables to be present in the same CSS file. Use `false` (resolved values) when you need to distribute tokens to consumers who may not have access to the full primitive set.

**When to treat the token PR as non-blocking.** A minor update to a single token (a spacing value changes from 8 to 10) can be merged quickly after visual review. A large update that touches hundreds of tokens, or any update to color primitives that all semantic tokens reference, should require a longer review and possibly a visual regression test before merging.

**When to add a new token collection.** When a new design concept does not fit cleanly into an existing collection — and not before. Token taxonomy is a design decision, not a pipeline decision. The pipeline should adapt to the taxonomy, not drive it.

---

## Try This

1. Run `node extract-tokens.mjs` against your file right now. If it returns a 403, you are on a non-Enterprise plan. Set up the Tokens Studio path as described above.

2. After a successful extraction, open `tokens/default.json` (or whichever mode file was generated) and find a semantic token. Trace its `$value` back through the alias chain to confirm it resolved to the expected raw value.

3. Run `node validate-tokens.mjs` and read every error. Each one is a token that would have produced incorrect output in Style Dictionary.

4. Configure the GitHub Actions workflow, but set `workflow_dispatch` as the only trigger first. Run it manually from the GitHub Actions UI to confirm it opens a PR correctly. Only then add the `repository_dispatch` trigger for the Figma webhook.

5. Add one fixture test: a known variable in, the expected DTCG output out. Run it with `node --test`. If it fails, the transformation logic is wrong and you know before the pipeline runs in CI.

---

## AI Wayback Machine: Style Dictionary and the DTCG Standard

Style Dictionary was created by Danny Banks at Amazon in 2017, initially as an internal tool for managing design tokens across Amazon's product surfaces. It was open-sourced and became the de facto standard for token transformation before the W3C Design Tokens Community Group had published a format specification. [verify — current as of writing]

The DTCG format — `$value`, `$type`, `$description` — is the result of multi-year work by the Design Tokens Community Group to standardize the JSON structure that tools like Style Dictionary, Tokens Studio, and Theo had been inventing independently. The W3C Community Group specification is ongoing and has not reached Recommendation status. [verify — current as of writing: https://tr.designtokens.org/format/]

The practical consequence is that "DTCG-compatible" in 2026 means "close to the current draft" rather than "conforming to a ratified standard." Style Dictionary 4.x added explicit DTCG support. Tokens Studio added a DTCG export option. Both are tracking a moving target.

When this book tells you to write DTCG-compatible JSON, it means: use `$value`, `$type`, and `$description` as key names, and use the type values the DTCG draft specifies (`color`, `dimension`, `duration`, `number`, `string`, `boolean`). If the standard changes, the extraction script changes — and the fixture tests catch the regression.

---

*The token pipeline is the extraction layer at its most direct. Chapter 9 handles the other half of the canvas: the images, icons, and graphics that live in Figma as vector nodes and need to arrive in the repository as optimized, production-ready files.*
