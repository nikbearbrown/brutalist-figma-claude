# Chapter 5 — The Figma Audit

> "Run this before building anything on top of a file. It tells you exactly what is broken before it becomes a pipeline problem."

---

## The Production Failure

The design system team spent three sprints building a token extraction pipeline. It runs cleanly in CI. It generates CSS variables, Swift constants, and Android XML on every merge to main. Everyone is proud of it.

Then a new engineer joins and tries to use it on the marketing team's Figma file — a file that has been evolving for two years under three different designers, none of whom knew the extraction pipeline was coming. The pipeline runs. No errors. The output CSS has 847 variables. About 200 of them have names like `--fill-2`, `--text`, `--color-17`. Forty-three of them resolve to `undefined` because they alias variables that were deleted six months ago. Twelve have hardcoded hex values where alias references should be. Sixteen low-contrast text/background pairs exist in the design and will now be enforced in the codebase.

The pipeline did not fail. The file was never ready for the pipeline. No one checked.

This is what the audit is for. Run it before you build anything on top of a file.

---

## What This Chapter Lets You Do

After this chapter you can:

- Run `figma-audit.js` against any Figma file and get a structured report of all findings
- Distinguish error-level findings (pipeline-breaking) from warnings (brand deviation) and info (improvement opportunity)
- Read the JSON output in CI and fail a build when errors exist
- Understand what the audit cannot catch and why
- Establish a baseline snapshot so future audits show only regressions

The named CLI artifact for this chapter is `figma-audit.js`. It reads the Figma REST API (or a local fixture), applies a rule set, and emits findings as both a human-readable markdown report and a machine-readable JSON file.

---

## Diagnosis: Why Files Fail Silently

The Figma REST API has no concept of "this file is structurally correct." It returns whatever is in the file. A variable named `Color 3` is returned exactly as `Color 3`. An alias chain that points to a deleted variable returns whatever the current resolution state is — which may be a fallback value, an empty value, or simply a missing key in the response. [verify — current as of writing, alias resolution behavior for deleted references]

The API makes no assertions. The pipeline makes no assertions (unless you write them). The file makes no assertions. Assertions are your job, and the audit is where you write them down.

The categories of assertion an audit needs to cover:

1. **Naming** — do variable, component, style, and layer names conform to the convention from Chapter 4?
2. **Token hygiene** — are alias chains intact? Are there orphaned aliases? Hardcoded values where references should be?
3. **Component hygiene** — do components have descriptions? Are they published? Are variant properties documented?
4. **Brand compliance** — are hardcoded color values present that should reference tokens? Are off-brand values in use?
5. **Accessibility risks** — do text/background pairings meet WCAG contrast minimums? [Source: w3.org/WAI/standards-guidelines/wcag/]
6. **Structural completeness** — are export layers named? Are required variable collections present? Are required pages present?

Each category can produce findings at three severity levels:

- **error** — breaks or corrupts the pipeline. Must be fixed before extraction runs.
- **warning** — deviates from brand or convention but does not break the pipeline. Should be fixed.
- **info** — improvement opportunity. Fix when bandwidth allows.

---

## Building `figma-audit.js`

### Architecture

The audit has three stages:
1. **Fetch** — get the file data (live API or local fixture)
2. **Check** — apply rule functions to the data
3. **Report** — emit findings as markdown and JSON

```
figma-audit.js
├── fetch (GET /v1/files/:key + GET /v1/files/:key/variables)
├── checks/
│   ├── check-naming.js
│   ├── check-token-hygiene.js
│   ├── check-component-hygiene.js
│   ├── check-brand-compliance.js
│   ├── check-accessibility.js
│   └── check-structure.js
└── report (markdown + JSON output)
```

### The Main Script

```js
// figma-audit.js
// Usage: node figma-audit.js [--fixture ./fixtures/file.json] [--output ./reports/]
// Requires: FIGMA_TOKEN and FIGMA_FILE_KEY in environment (or --fixture for offline mode)
// Illustrative code — error handling and retry logic omitted for clarity.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { checkNaming } from './checks/check-naming.js';
import { checkTokenHygiene } from './checks/check-token-hygiene.js';
import { checkComponentHygiene } from './checks/check-component-hygiene.js';
import { checkBrandCompliance } from './checks/check-brand-compliance.js';
import { checkAccessibility } from './checks/check-accessibility.js';
import { checkStructure } from './checks/check-structure.js';
import { renderMarkdown, renderJSON } from './lib/render.js';

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY;

const args = process.argv.slice(2);
const fixtureArg = args.find(a => a.startsWith('--fixture='))?.split('=')[1];
const outputDir = args.find(a => a.startsWith('--output='))?.split('=')[1] ?? './reports';

async function fetchData() {
  if (fixtureArg) {
    return JSON.parse(readFileSync(fixtureArg, 'utf8'));
  }
  if (!FIGMA_TOKEN || !FIGMA_FILE_KEY) {
    console.error('Set FIGMA_TOKEN and FIGMA_FILE_KEY, or pass --fixture=<path>');
    process.exit(1);
  }
  // GET /v1/files/:key [verify — endpoint current as of writing]
  const fileRes = await fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}?depth=3`,
    { headers: { 'X-Figma-Token': FIGMA_TOKEN } }
  );
  if (!fileRes.ok) {
    console.error(`API error: ${fileRes.status} ${fileRes.statusText}`);
    process.exit(1);
  }
  const fileData = await fileRes.json();

  // GET /v1/files/:key/variables/local [verify — requires Enterprise or specific plan]
  const varsRes = await fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}/variables/local`,
    { headers: { 'X-Figma-Token': FIGMA_TOKEN } }
  );
  const varsData = varsRes.ok ? await varsRes.json() : { meta: { variables: {}, variableCollections: {} } };

  return { file: fileData, variables: varsData };
}

async function main() {
  const data = await fetchData();

  const findings = [
    ...checkNaming(data),
    ...checkTokenHygiene(data),
    ...checkComponentHygiene(data),
    ...checkBrandCompliance(data),
    ...checkAccessibility(data),
    ...checkStructure(data),
  ];

  mkdirSync(outputDir, { recursive: true });

  const mdReport = renderMarkdown(findings, data);
  const jsonReport = renderJSON(findings);

  writeFileSync(`${outputDir}/audit-report.md`, mdReport);
  writeFileSync(`${outputDir}/audit-report.json`, jsonReport);

  const errors = findings.filter(f => f.severity === 'error');
  const warnings = findings.filter(f => f.severity === 'warning');
  const infos = findings.filter(f => f.severity === 'info');

  console.log(`\nAudit complete.`);
  console.log(`  ${errors.length} errors`);
  console.log(`  ${warnings.length} warnings`);
  console.log(`  ${infos.length} info`);
  console.log(`\nReports written to ${outputDir}/`);

  if (errors.length > 0) {
    console.error('\nErrors found. Fix before running any pipeline.');
    process.exit(1);
  }
}

main();
```

Add to `package.json`:

```json
{
  "scripts": {
    "figma:audit": "node figma-audit.js",
    "figma:audit:fixture": "node figma-audit.js --fixture=./fixtures/file.json",
    "figma:audit:ci": "node figma-audit.js --output=./reports"
  }
}
```

Run locally: `npm run figma:audit:fixture`
Run in CI: `npm run figma:audit:ci`

### The Check Functions

Each check function receives the full data object and returns an array of findings. A finding has a consistent shape:

```ts
// Finding shape (TypeScript interface for documentation — audit code uses plain JS)
interface Finding {
  category: 'naming' | 'token-hygiene' | 'component-hygiene' | 'brand-compliance' | 'accessibility' | 'structure';
  severity: 'error' | 'warning' | 'info';
  nodeId?: string;       // Figma node ID for deep linking
  nodeName?: string;     // Human-readable name
  page?: string;         // Page name where the node lives
  message: string;       // Human-readable finding
  suggestion?: string;   // Suggested remediation
  ruleId: string;        // Stable rule identifier for CI baseline
}
```

**Naming check (excerpt):**

```js
// checks/check-naming.js
// Illustrative code — imports validateTokenName from Chapter 4's lib.

import { validateTokenName } from '../lib/validate-name.js';

export function checkNaming({ variables }) {
  const findings = [];
  const allVars = Object.values(variables?.meta?.variables ?? {});

  for (const v of allVars) {
    const result = validateTokenName(v.name);
    if (!result.valid) {
      for (const error of result.errors) {
        findings.push({
          category: 'naming',
          severity: 'error',
          nodeId: v.id,
          nodeName: v.name,
          message: error,
          suggestion: 'Rename to match convention: category/subcategory/name (lowercase, hyphens only).',
          ruleId: 'NAME001',
        });
      }
    }
  }

  return findings;
}
```

**Token hygiene check (excerpt):**

```js
// checks/check-token-hygiene.js
// Checks: orphaned aliases, hardcoded values in semantic tier, missing descriptions.
// Illustrative code.

export function checkTokenHygiene({ variables }) {
  const findings = [];
  const allVars = variables?.meta?.variables ?? {};
  const varIds = new Set(Object.keys(allVars));

  for (const [id, v] of Object.entries(allVars)) {
    // Check for alias references to deleted variables
    for (const [modeId, value] of Object.entries(v.valuesByMode ?? {})) {
      if (value?.type === 'VARIABLE_ALIAS') {
        if (!varIds.has(value.id)) {
          findings.push({
            category: 'token-hygiene',
            severity: 'error',
            nodeId: id,
            nodeName: v.name,
            message: `Alias references deleted variable ID "${value.id}".`,
            suggestion: 'Update alias to a valid variable or set a direct value.',
            ruleId: 'TOK001',
          });
        }
      }
    }

    // Check for missing descriptions on non-primitive tokens
    // (Naming convention: primitives live under color/palette, spacing/scale, etc.)
    const isPrimitive = v.name.includes('/palette/') || v.name.includes('/scale/');
    if (!isPrimitive && !v.description) {
      findings.push({
        category: 'token-hygiene',
        severity: 'warning',
        nodeId: id,
        nodeName: v.name,
        message: 'Semantic token has no description.',
        suggestion: 'Add a description explaining the role of this token.',
        ruleId: 'TOK002',
      });
    }
  }

  return findings;
}
```

**Component hygiene check (excerpt):**

```js
// checks/check-component-hygiene.js
// Checks: published state, description presence, variant documentation.
// Illustrative code.

export function checkComponentHygiene({ file }) {
  const findings = [];
  const components = file?.components ?? {};

  for (const [id, comp] of Object.entries(components)) {
    if (!comp.description) {
      findings.push({
        category: 'component-hygiene',
        severity: 'warning',
        nodeId: id,
        nodeName: comp.name,
        message: 'Component has no description field.',
        suggestion: 'Add a description in Figma. It becomes searchable metadata and MCP context.',
        ruleId: 'COMP001',
      });
    }
  }

  return findings;
}
```

**Accessibility check (excerpt):**

```js
// checks/check-accessibility.js
// Checks WCAG contrast for text nodes against their fills.
// WCAG AA: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold).
// WCAG source: w3.org/WAI/standards-guidelines/wcag/
// Illustrative code — full contrast calculation requires walking the node tree
// and resolving fill colors through variable aliases.

import { relativeLuminance, contrastRatio } from '../lib/color.js';

export function checkAccessibility({ file }) {
  const findings = [];
  // Walk pages and frames for TEXT nodes with fills
  // This is computationally expensive; consider running only on specific pages
  // Full implementation requires recursive node traversal — abbreviated here.

  // For each text node: resolve foreground color, resolve background color,
  // compute contrast ratio, check against threshold.

  // Threshold: 4.5 for normal text, 3.0 for large text (>=18pt or >=14pt bold)
  // [verify — WCAG 2.1 thresholds; check WCAG 3.0 status at time of use]

  return findings; // Populated in full implementation
}
```

**Brand compliance check (excerpt):**

```js
// checks/check-brand-compliance.js
// Checks for hardcoded color fills that are not variable references.
// Illustrative code.

export function checkBrandCompliance({ file }) {
  const findings = [];
  // Walk node tree for RECTANGLE, FRAME, TEXT, ELLIPSE nodes
  // For each, check if fills[].type === 'SOLID' with no boundVariables reference
  // Any hardcoded fill is a brand compliance warning (it bypasses the token system)

  // [verify — boundVariables shape in current API response]

  return findings; // Populated in full implementation
}
```

### The Report Renderer

The report must be useful to two audiences: a human reading in a browser or Slack, and a machine parsing it in CI.

**Markdown output (`audit-report.md`):**

```md
# Figma Audit Report
**File:** My Design System
**Date:** 2026-06-01
**Findings:** 12 errors · 34 warnings · 8 info

---

## Errors (12)

### [NAME001] Naming — `Color 3` (id: 4:12)
**Page:** Foundations
**Message:** Unknown category "color 3". Use: color, spacing, typography, radius, shadow, motion.
**Suggestion:** Rename to `color/palette/blue-500` or equivalent semantic name.

...
```

**JSON output (`audit-report.json`):**

```json
{
  "meta": {
    "fileKey": "abc123",
    "fileName": "My Design System",
    "auditDate": "2026-06-01T14:22:00Z",
    "counts": { "error": 12, "warning": 34, "info": 8 }
  },
  "findings": [
    {
      "category": "naming",
      "severity": "error",
      "nodeId": "4:12",
      "nodeName": "Color 3",
      "page": "Foundations",
      "message": "Unknown category \"color 3\".",
      "suggestion": "Rename to match convention.",
      "ruleId": "NAME001"
    }
  ]
}
```

The JSON is what CI, `figma-fix-plugin/` (Chapter 6), and any downstream automation consume. The `nodeId` fields are deep-linkable into the Figma file at `https://figma.com/file/:key?node-id=:nodeId`. [verify — deep link URL format current as of writing]

---

## The Walker Principle

The Walker principle — named for common database refactoring discipline, not for any specific person — is this: rename and restructure before building on top. It applies directly to Figma files.

If you build the token extraction pipeline before fixing the naming violations, you own two problems: the pipeline problem and the naming problem. If you fix the naming first, you own one problem and the pipeline inherits a clean foundation.

The audit enforces this discipline by failing with exit code 1 when errors exist. If `npm run figma:audit` fails, `npm run figma:tokens` should not run. Wire them in sequence in CI:

```yaml
# .github/workflows/figma-pipeline.yml (excerpt)
steps:
  - name: Audit Figma file
    run: npm run figma:audit:ci
    env:
      FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
      FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}
  
  - name: Extract tokens (only if audit passes)
    if: success()
    run: npm run figma:tokens
```

---

## CI Behavior: Exit Codes, Baselines, and Blocking Rules

**Exit codes:**
- `0` — no errors (warnings and info may exist)
- `1` — one or more errors, or audit script itself failed

**Baseline snapshots:**

On day one, a large file may have hundreds of warnings. You cannot block CI on all of them — you would never merge anything. Use a baseline approach: snapshot the current finding counts and only fail on regressions.

```js
// scripts/audit-diff.js
// Compare current audit-report.json against a committed baseline.
// Fail if new errors appeared. Report new warnings. Ignore improvements.
// Illustrative code.

import { readFileSync } from 'fs';

const current = JSON.parse(readFileSync('./reports/audit-report.json', 'utf8'));
const baseline = JSON.parse(readFileSync('./reports/audit-baseline.json', 'utf8'));

const currentByRule = {};
for (const f of current.findings) {
  currentByRule[f.ruleId] = (currentByRule[f.ruleId] ?? 0) + 1;
}

const baselineByRule = {};
for (const f of baseline.findings) {
  baselineByRule[f.ruleId] = (baselineByRule[f.ruleId] ?? 0) + 1;
}

let regressions = 0;
for (const [ruleId, count] of Object.entries(currentByRule)) {
  const baselineCount = baselineByRule[ruleId] ?? 0;
  if (count > baselineCount) {
    console.error(`REGRESSION: ${ruleId} went from ${baselineCount} to ${count} findings.`);
    regressions++;
  }
}

if (regressions > 0) {
  process.exit(1);
}
console.log('No regressions. Audit passed baseline check.');
```

Commit the baseline JSON to the repository. Update it deliberately — only when you have intentionally fixed (not added) findings. This gives you a ratchet: you can only improve.

**When a warning becomes blocking:**

Promote a warning to error-level in your rule configuration when it represents something that your team has decided is unacceptable. Low contrast (WCAG AA failure) should be an error, not a warning, if your team is committed to accessibility compliance. Off-brand hardcoded colors might start as warnings and become errors once the variable migration is complete.

Add a `severity-overrides` section to your audit config:

```js
// audit.config.js
export const SEVERITY_OVERRIDES = {
  'ACC001': 'error',   // Contrast failure is always blocking
  'COMP001': 'info',   // Missing descriptions are improvement opportunities for now
};
```

---

## Rate Limit Awareness

The audit calls two endpoints: `GET /v1/files/:key` and `GET /v1/files/:key/variables/local`. [verify — current endpoint paths]

Figma rate limits apply per user token, not per script. [Source: developers.figma.com/docs/rest-api/rate-limits/] A CI pipeline running the audit on every PR could hit rate limits if the team is large and PRs are frequent.

Mitigations:
- Use a fixture for most CI runs. Only call the live API for scheduled audits (nightly or on library publish webhook).
- Cache the file response for 15 minutes. Subsequent audit runs within that window use the cache.
- Use a dedicated CI service account token with its own rate limit budget. [verify — whether service accounts have separate rate limits on current plan]

The `--fixture` flag exists for this reason. Updating the fixture is its own CI step (scheduled separately), while the audit runs against the committed fixture on every PR.

---

## Failure Modes of the Audit Itself

The audit has genuine limitations. Knowing them prevents false confidence.

**What the audit cannot catch:**

1. **Designer intent vs. naming accidents.** A variable named `color/brand/primary` that actually holds a secondary color passes the naming check. The audit validates structure, not semantics.

2. **Accessibility of complex interactions.** WCAG contrast for static text/background pairs is checkable. Hover states, focus rings, animation timing, and motion sensitivity are not expressible in static Figma data.

3. **Whether a component is actually correct.** The audit can check that a component has a description and is published. It cannot check that the component is well-designed, consistent with the brand, or accessible beyond basic color contrast.

4. **Variable modes in context.** A semantic token might have correct light-mode values and broken dark-mode values. The audit can check whether mode values exist and whether they are valid alias references, but it cannot check whether the dark-mode color is the right dark-mode color — that requires design judgment.

5. **Prototype and interaction data.** The REST API does not expose prototype interactions. Accessibility issues related to focus management, keyboard navigation, or interactive state disclosure cannot be audited programmatically.

**False positives to expect:**

- Components that are intentionally not published (work-in-progress) will trigger component hygiene warnings. Add a naming prefix like `_WIP/` to suppress these: the check skips components whose names start with `_`.
- Primitive tokens without descriptions will trigger the token hygiene description check. Either add descriptions to primitives (reasonable) or exclude the primitive tier from the description check (also reasonable — document which you chose).

---

## Decision Rules

Before running the audit:
- [ ] Do you have a `naming.config.js` that defines your convention? (Chapter 4)
- [ ] Do you have a local fixture (`./fixtures/file.json`) for offline runs?
- [ ] Is `FIGMA_TOKEN` and `FIGMA_FILE_KEY` in your `.env` for live runs?

After running the audit:
- [ ] Zero errors before running any extraction pipeline
- [ ] Warnings reviewed and either fixed or documented in the baseline
- [ ] Audit added to CI (as fixture-based check on every PR; live API check on schedule)
- [ ] Baseline JSON committed and updated only when findings improve
- [ ] Severity overrides configured for your team's non-negotiables (accessibility, brand compliance)

When a finding appears that you disagree with:
- Verify the rule is correct (check the ruleId and its logic)
- If the rule is wrong, fix the rule and update the baseline
- If the rule is right but the finding is acceptable for this file, add a structured exception with a comment explaining why

---

## AI Wayback Machine: Linters and the Idea of Automated Quality Gates

The Figma audit is structurally identical to a code linter. JSLint appeared in 2002. ESLint followed in 2013. Both made the same argument: code quality is checkable by machine, and the machine should check it before a human wastes time reviewing it. The same argument applies to design files.

The linter tradition established conventions that the audit inherits directly: severity levels (error vs. warning), rule IDs (stable identifiers for suppressing false positives), exit codes (1 for failures so CI can stop), baseline snapshots (so a team can adopt a linter without being blocked by existing violations), and configuration files (so rules are version-controlled alongside the code they check).

Accessibility scanners (axe, Lighthouse) applied the same pattern to rendered HTML: scan, categorize findings by WCAG criterion, produce a structured JSON report, fail CI on errors. The conceptual leap from accessibility scanner to Figma audit is small — the API surface is different, the rule set is different, but the architecture is identical.

Database migration tooling (Flyway, Liquibase) added the ratchet pattern: changes to a schema must be forward-only, tracked in a version log, applied idempotently. The audit baseline is the same concept applied to design quality: you commit where you are, you can only improve, and regressions are visible immediately.

The Figma audit is not a novel idea. It is the application of forty years of automated quality gate thinking to a new artifact type. The fact that it did not exist as a standard practice before design-to-code pipelines became necessary explains a lot about why so many design systems pipelines fail silently.

---

## Try This

**Exercise 1 — First audit run**

Download the fixture for your design system file using `figma-read.mjs` (Chapter 3). Run `figma-audit.js --fixture=./fixtures/file.json`. Read the full markdown report. How many errors? How many warnings? Pick the three highest-severity findings and trace each one back to the specific Figma object (use the `nodeId` to deep-link into the file). Understand why it was flagged before fixing anything.

**Exercise 2 — Establish a baseline**

After your first run, copy `./reports/audit-report.json` to `./reports/audit-baseline.json` and commit it. Now fix three errors. Run the audit again. Run `audit-diff.js`. Verify that the diff shows only improvements, no regressions. This is the working loop: audit, fix, re-audit, update baseline.
