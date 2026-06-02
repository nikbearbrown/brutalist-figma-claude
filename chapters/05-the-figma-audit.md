# Chapter 5 — The Figma Audit

*Run this before building anything on top of a file. It tells you exactly what is broken before it becomes a pipeline problem.*

---

The design system team spent three sprints building a token extraction pipeline. It runs cleanly in CI. It generates CSS variables, Swift constants, and Android XML on every merge to main. Then a new engineer points it at the marketing team's Figma file — two years old, three designers, none of whom knew the pipeline was coming. The pipeline runs. No errors. The output CSS has 847 variables. About 200 of them are named `--fill-2`, `--text`, `--color-17`. Forty-three resolve to `undefined` because they alias variables deleted six months ago. Twelve carry hardcoded hex values where references should be. Sixteen text/background pairs fail WCAG contrast minimums, and now that failure is enforced in the codebase.

The pipeline did not break. The file was never ready for the pipeline. Nobody checked.

This is the central problem with building on top of Figma data: the API has no concept of correctness. It returns what is in the file. A variable named `Color 3` comes back as `Color 3`. An alias chain that points to a deleted variable returns whatever the current resolution state happens to be — a fallback, an empty value, a missing key. [verify — current alias resolution behavior for deleted references] The API makes no assertions. The pipeline makes no assertions unless you write them. The file makes no assertions at all. Assertions are your job, and the audit is where you write them down.

---

## What the Audit Is Actually Doing

Before writing any code, it helps to understand the structure of what you are building. The audit has three stages: fetch the file data, apply a rule set to it, and emit findings. Each finding has a category, a severity, a reference to the Figma object that triggered it, and a suggestion for what to do.

The severity levels matter and they are not decorative. An **error** breaks or corrupts the pipeline — an orphaned alias, a naming violation severe enough to produce unparseable output, a structural piece that downstream code depends on and cannot find. These must be fixed before extraction runs. A **warning** deviates from brand or convention but does not stop the pipeline — a missing token description, an undocumented component, an off-brand hardcoded color that bypasses the token system. These should be fixed. **Info** is an improvement opportunity — fix it when bandwidth allows.

The categories cover six kinds of assertion:

**Naming** — do variable, component, style, and layer names conform to the convention from Chapter 4? A variable named `Color 3` fails this check. A variable named `color/palette/blue-500` passes.

**Token hygiene** — are alias chains intact? A semantic token that references a deleted primitive is an orphaned alias. A semantic token with a hardcoded hex value is a bypass of the entire token system. Both are errors.

**Component hygiene** — do components have descriptions? Are they published to the library? Component descriptions become searchable metadata and, critically, MCP context for AI coding agents. Missing them is a warning now and a problem later.

**Brand compliance** — are hardcoded fill values present on nodes that should reference tokens? Any solid fill that carries no `boundVariables` reference has escaped the token system entirely.

**Accessibility** — do text/background pairings meet WCAG contrast minimums? WCAG AA requires 4.5:1 for normal text and 3:1 for large text (18pt or larger, or 14pt bold). [Source: w3.org/WAI/standards-guidelines/wcag/] A design that ships failing contrast is not a design system — it is a liability.

**Structural completeness** — are required pages present? Required variable collections? Export layers named? These are the load-bearing expectations your pipeline has about the file's shape.

<!-- → [TABLE: Six audit categories — columns: category, what it checks, example error, example warning, example info] -->

---

## Building `figma-audit.js`

The architecture follows directly from the three-stage model. A main script fetches data and wires together check functions. Each check function receives the full data and returns an array of findings. A renderer emits the findings as both a human-readable markdown report and a machine-readable JSON file.

```
figma-audit.js
├── fetch (GET /v1/files/:key + GET /v1/files/:key/variables/local)
├── checks/
│   ├── check-naming.js
│   ├── check-token-hygiene.js
│   ├── check-component-hygiene.js
│   ├── check-brand-compliance.js
│   ├── check-accessibility.js
│   └── check-structure.js
└── report (markdown + JSON output)
```

<!-- → [FIGURE: Audit pipeline diagram — data flows from Figma API or fixture through six check functions into a findings array, then into parallel markdown and JSON renderers; annotated with severity levels at the findings stage] -->

The main script takes either a live API call or a local fixture via `--fixture`. The fixture path is not optional ceremony — it is how you run the audit in CI without hammering the rate limits on every pull request. Updating the fixture is a separate scheduled step; the audit itself runs against the committed fixture on every PR.

```js
// figma-audit.js
// Usage: node figma-audit.js [--fixture=./fixtures/file.json] [--output=./reports/]
// Requires: FIGMA_TOKEN and FIGMA_FILE_KEY in environment, or --fixture for offline mode.
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

  // GET /v1/files/:key/variables/local [verify — requires Enterprise plan]
  const varsRes = await fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}/variables/local`,
    { headers: { 'X-Figma-Token': FIGMA_TOKEN } }
  );
  const varsData = varsRes.ok
    ? await varsRes.json()
    : { meta: { variables: {}, variableCollections: {} } };

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

  writeFileSync(`${outputDir}/audit-report.md`, renderMarkdown(findings, data));
  writeFileSync(`${outputDir}/audit-report.json`, renderJSON(findings));

  const errors   = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const infos    = findings.filter(f => f.severity === 'info').length;

  console.log(`\nAudit complete: ${errors} errors · ${warnings} warnings · ${infos} info`);
  console.log(`Reports written to ${outputDir}/`);

  if (errors > 0) {
    console.error('\nErrors found. Fix before running any pipeline.');
    process.exit(1);
  }
}

main();
```

Every finding has a consistent shape. The `ruleId` is the most important field for CI purposes — it is stable across runs and allows the baseline diffing tool to track whether a specific rule's count is improving or regressing.

```ts
// Finding shape (TypeScript interface for documentation — audit code uses plain JS)
interface Finding {
  category:    'naming' | 'token-hygiene' | 'component-hygiene' | 'brand-compliance' | 'accessibility' | 'structure';
  severity:    'error' | 'warning' | 'info';
  nodeId?:     string;   // Figma node ID for deep linking
  nodeName?:   string;   // Human-readable name
  page?:       string;   // Page name where the node lives
  message:     string;   // Human-readable finding
  suggestion?: string;   // Suggested remediation
  ruleId:      string;   // Stable rule identifier for CI baseline
}
```

The six check functions follow the same contract: receive the full data object, return an array of findings. Here is what the three most consequential checks actually do.

**Naming:**

```js
// checks/check-naming.js
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

**Token hygiene** — the check that catches the orphaned aliases and missing descriptions:

```js
// checks/check-token-hygiene.js
export function checkTokenHygiene({ variables }) {
  const findings = [];
  const allVars = variables?.meta?.variables ?? {};
  const varIds = new Set(Object.keys(allVars));

  for (const [id, v] of Object.entries(allVars)) {
    for (const [, value] of Object.entries(v.valuesByMode ?? {})) {
      if (value?.type === 'VARIABLE_ALIAS' && !varIds.has(value.id)) {
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

**Component hygiene** — the check that ensures your components are documented:

```js
// checks/check-component-hygiene.js
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

The accessibility and brand compliance checks require walking the full node tree — accessibility needs foreground and background color pairs resolved through alias chains, brand compliance needs every solid fill inspected for a missing `boundVariables` reference. [verify — `boundVariables` shape in current API response] Both are computationally expensive. On large files, scope them to specific pages or run them on a schedule rather than on every PR.

---

## The Report

The report serves two audiences simultaneously: a human reading a markdown file in a browser or Slack, and a machine parsing JSON in CI. Both outputs are written on every run.

The markdown report exists so a designer can open it, find the specific node, click the deep link into Figma, and fix the problem. The JSON report exists so CI can count errors, run the diff against the baseline, and decide whether to block the build. The `nodeId` fields in the JSON generate deep links to the exact object in the file at `https://figma.com/file/:key?node-id=:nodeId`. [verify — deep link URL format current as of writing]

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

---

## The Ratchet: Baselines and CI

There is a name for the discipline this audit enforces: it comes from database refactoring tools like Flyway and Liquibase, which established the idea that schema changes must be forward-only, tracked in a version log, and applied idempotently. The audit baseline is the same concept applied to design quality. You commit where you are. You can only improve. Regressions are visible immediately.

On day one, a large legacy file may have hundreds of warnings. You cannot block CI on all of them — you would never merge anything. Snapshot the current finding counts, commit them as `audit-baseline.json`, and only fail on regressions from that point forward. The diff script implements this:

```js
// scripts/audit-diff.js
// Compare current audit-report.json against the committed baseline.
// Fail if new errors appeared. Report new warnings. Ignore improvements.

import { readFileSync } from 'fs';

const current  = JSON.parse(readFileSync('./reports/audit-report.json', 'utf8'));
const baseline = JSON.parse(readFileSync('./reports/audit-baseline.json', 'utf8'));

const count = (findings) => findings.reduce((acc, f) => {
  acc[f.ruleId] = (acc[f.ruleId] ?? 0) + 1;
  return acc;
}, {});

const currentByRule  = count(current.findings);
const baselineByRule = count(baseline.findings);

let regressions = 0;
for (const [ruleId, n] of Object.entries(currentByRule)) {
  const base = baselineByRule[ruleId] ?? 0;
  if (n > base) {
    console.error(`REGRESSION: ${ruleId} went from ${base} to ${n} findings.`);
    regressions++;
  }
}

if (regressions > 0) process.exit(1);
console.log('No regressions. Audit passed baseline check.');
```

The CI wiring enforces the rename-before-building discipline explicitly. The audit runs first. If it fails, the pipeline does not run. This is not a suggestion — it is an architectural constraint enforced by exit codes:

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

<!-- → [FIGURE: CI pipeline sequence — Audit step with exit code 0/1 gate before token extraction and code generation steps; annotated to show which failures block which downstream steps] -->

When a warning deserves promotion to error — because accessibility compliance is now non-negotiable, because the variable migration is complete and hardcoded colors have no excuse left — update a severity override in the audit config rather than modifying the check function itself. This keeps the rule logic stable while the team's tolerance changes:

```js
// audit.config.js
export const SEVERITY_OVERRIDES = {
  'ACC001': 'error',   // Contrast failure is always blocking
  'COMP001': 'info',   // Missing descriptions are improvement opportunities for now
};
```

---

## What the Audit Cannot Catch

The audit validates structure. It cannot validate intent. A variable named `color/brand/primary` that actually holds a secondary color passes every naming check. The audit did its job. The designer made a mistake. These are different problems and only one of them is machine-checkable.

Accessibility beyond static contrast is not expressible in static Figma data. Hover states, focus rings, animation timing, motion sensitivity, keyboard navigation, focus management — none of this exists in the REST API response. The contrast check is the beginning of accessibility work, not the end of it.

Variable modes in context are partially checkable but not fully. The audit can verify that dark-mode values exist and that they are valid alias references. It cannot verify that the dark-mode color is the right dark-mode color — that requires design judgment applied by a human.

Prototype and interaction data does not appear in the REST API at all. Accessibility concerns related to interactive behavior are outside the audit's reach entirely.

False positives are predictable. Work-in-progress components that are intentionally not published will trigger component hygiene warnings. Suppress them by prefixing their names with `_WIP/` — the check skips nodes whose names start with `_`. Primitive tokens without descriptions will trigger the token hygiene description check. Either add descriptions to primitives or exclude the primitive tier from the description check; document which you chose so future engineers understand the decision.

<!-- → [TABLE: What the audit can and cannot catch — columns: concern, checkable by audit, why/why not — rows covering naming, orphaned aliases, contrast, intent/semantics, prototype behavior, mode correctness] -->

---

## Linters and the Automated Quality Gate

The Figma audit is structurally identical to a code linter, and that is not a coincidence — it is the application of forty years of automated quality gate thinking to a new artifact type.

JSLint appeared in 2002. ESLint followed in 2013. Both made the same argument: code quality is checkable by machine, and the machine should check it before a human wastes time on review. Severity levels, stable rule IDs, exit codes that stop CI, baseline snapshots that let a team adopt a linter without being immediately blocked by existing violations, configuration files that version-control the rules alongside the code they check — all of these conventions were established by the linter tradition and inherited directly by the audit.

Accessibility scanners — axe, Lighthouse — applied the same pattern to rendered HTML: scan, categorize findings by WCAG criterion, produce structured JSON, fail CI on errors. The leap from accessibility scanner to Figma audit is conceptually small. The API surface is different, the rule set is different, but the architecture is identical.

The fact that this infrastructure did not exist as standard practice before design-to-code pipelines became necessary explains a great deal about why so many pipelines fail silently. The technology to build it was always present. The motivation arrived when the output of a Figma file started mattering to a compiler.

---

## What Comes Next

Chapter 6 builds `figma-fix-plugin/` — the Plugin API complement to the audit. The audit identifies what is broken. The fix plugin repairs it in bulk from inside Figma: renaming naming violations, resolving orphaned aliases, adding missing descriptions to components. The audit's JSON output is the fix plugin's input. The two tools are designed to be used together.

You have a report. Now let's fix what it found.

---

## LLM Exercises

**Exercise 1 — Generate and examine**

Paste the `checkTokenHygiene` function into a conversation with an LLM. Ask it to explain, step by step, what the function checks and what its two failure modes are. Then ask: what is one category of token hygiene problem this function cannot detect? Examine the answer critically — is the gap real, or has the model invented a limitation?

**Exercise 2 — Apply to known context**

Describe your team's Figma file structure to an LLM: how many variable collections, whether you use modes, which plan tier your organization is on. Ask it which of the six audit categories is most likely to produce errors on first run, and why. Compare its reasoning to your own expectation. Run the audit. See who was right.

**Exercise 3 — Stress-test a specific claim**

The chapter claims that naming violations should be errors, not warnings, because unparseable names can corrupt pipeline output. Ask an LLM to argue the opposite position: that naming violations should always be warnings and never block the pipeline. Evaluate whether the argument it makes is valid, partially valid, or wrong. What would have to be true about your pipeline for the warning-only approach to be acceptable?

**Exercise 4 — Draft or audit a professional deliverable**

You have 200 warnings after the first audit run. Write a short briefing document (one page) for a design director who needs to understand: what the audit found, why warnings exist at warning severity rather than error, what the remediation plan is, and how long it will take. Ask an LLM to draft this document. Then audit the draft: does it accurately represent what warnings mean? Does it give the design director enough information to make a decision, or does it obscure the severity?
