# Chapter 7 — The Machine-Ready File

The pipeline did not fail on day one. It failed six weeks in, after the sprint where the design system designer reorganized the variable collections.

She had good reasons. The old structure — one massive collection named "Tokens" — was unwieldy. She split it into three: Primitives, Semantics, and Component. She renamed a handful of variables along the way to match the new slash conventions she had read about. The Figma file looked cleaner. The component library published without errors. The designers on the product teams could finally find what they needed.

The token pipeline ran that night. It completed without a hard failure — it just silently dropped 47 of the 183 semantic tokens. The CSS it wrote had `var(--color-brand-primary)` referencing a variable that no longer existed in the output. The staging build deployed. The design review the following Thursday was the first time anyone saw that the button primary color had reverted to the browser default blue.

The pipeline had been running on a file it thought was machine-ready. It was not. No one had defined what machine-ready meant. No one had checked.

---

## What This Chapter Does

This chapter defines a standard for machine-readiness. Not a score, not an aspiration — a contract. A specific list of conditions that must be true before a pipeline is authorized to read the file and trust what it finds.

By the end of this chapter you will have:

- A named set of machine-readiness criteria organized into five categories
- A `figma-preflight.mjs` script that checks those criteria against any file and exits with a non-zero code if it finds blockers
- A `FIGMA.md` template that declares what automation is authorized to do — and what it must not do without human review
- A clear understanding of which problems the readiness check can catch and which ones it cannot

Chapter 8 (design token pipelines) and Chapter 9 (asset export automation) both assume the file has passed the preflight in this chapter. The preflight is not optional — it is the contract those pipelines build on.

---

## Diagnosis: What Makes a File Untrustworthy to a Pipeline

When a pipeline reads a Figma file, it makes a set of implicit assumptions. Each assumption is a place it can silently fail.

**Naming assumption.** The pipeline expects variable and component names to follow a consistent slash-separated hierarchy (`color/brand/primary`). If names are inconsistent — some use hyphens, some use spaces, some have no hierarchy at all — the transformation step produces garbage, or simply drops values it cannot classify.

**Alias assumption.** When a semantic token (`color/button/primary`) references a primitive (`color/brand/blue-600`), the pipeline assumes the alias chain resolves to a raw value. If the primitive has been renamed or deleted, the chain is broken. The pipeline either silently writes an unresolved reference into the output or crashes on the resolve step.

**Publication assumption.** Token extraction from the Variables API [verify — current as of writing] and component metadata from the REST file endpoint both return data about the current file state, but component metadata is only fully available for published library components. If components are not published, downstream documentation tools, code generators, and MCP consumers get incomplete data.

**Structure assumption.** The pipeline expects a variable collection architecture that separates primitives from semantics from component-specific overrides. A single flat collection is not structurally invalid, but it breaks the transformation logic that most token pipelines rely on to determine output intent.

**Description assumption.** When a pipeline builds component documentation, generates a design spec, or provides context to an AI coding agent, it reads the `description` field on components and variables. If those fields are empty — which they are in most real files — the pipeline has nothing to pass downstream except names and values.

**Export assumption.** Asset export pipelines expect that exportable nodes are named consistently, that export settings are configured on each node, and that the names map to meaningful paths in the repository. A frame named "Frame 47" with no export settings is invisible to the pipeline.

**Authorization assumption.** Without a declared governance document, the pipeline has to guess what it is authorized to do. Overwrite existing files? Commit changes directly to main? Delete assets that no longer appear in the file? The pipeline cannot know. The only safe default is to fail.

Every one of these failure modes is preventable before the pipeline runs. The preflight check exists to surface them before the pipeline makes decisions based on a file it should not trust.

---

## The Machine-Readiness Contract

Machine-readiness is not a binary pass/fail — it is a severity-graded set of criteria with two classes of finding: **blocking** (the pipeline must not proceed) and **advisory** (the pipeline can proceed but the finding should be logged and reviewed).

The contract has five categories.

### Category 1: Naming Contract

A file passes the naming contract when:

- All variables follow the slash-separated hierarchy convention with at least two levels (`category/name`). [verify — current as of writing: the Figma Variables API returns variable names as plain strings; the convention is implemented by the team, not enforced by Figma]
- Variable names contain no spaces, no uppercase characters, and no special characters other than hyphens within a segment
- Component names follow a consistent capitalization convention (PascalCase recommended for component names)
- Layer names on exportable assets are not Figma-generated defaults (`Frame 47`, `Group 12`, `Rectangle 8`)

Naming violations are blocking unless they affect only non-exported, non-variable nodes.

### Category 2: Variable Architecture

A file passes the variable architecture check when:

- There is at least one variable collection for primitives (raw values) and at least one for semantic aliases
- No semantic token aliases chain through more than three levels (`semantic → primitive` is normal; `semantic → semantic → semantic → primitive` is a sign of architectural confusion)
- All alias chains resolve to a raw value — no broken references [verify — current as of writing: the Figma Variables API exposes `resolvedType` and the alias target's `variableId`; a broken alias occurs when the target variable does not exist in the same file or in an enabled library]
- No variables are duplicates of other variables (same value, different name, no semantic distinction)

Broken aliases are always blocking. Duplicate values are advisory.

### Category 3: Publication State

A file passes the publication check when:

- The component library has been published at least once [verify — current as of writing: published state is available via `GET /v1/files/:key` in the `components` map; each component entry includes a `componentSetId` if it belongs to a set]
- No components that were previously published have been moved to a non-published location without the corresponding update to the library publication
- The last publication timestamp is within a threshold acceptable to the team (advisory: warn if the library has not been re-published in more than 14 days)

Unpublished state for components that downstream pipelines are known to consume is blocking.

### Category 4: Component Documentation

A file passes the documentation check when:

- All published components have a non-empty `description` field
- All component sets (variant groups) have a description explaining what the variants represent
- Variable descriptions are populated for all non-primitive tokens (primitive tokens like `blue-600` are self-documenting; semantic tokens like `color/button/primary` are not)

Empty descriptions on published components are advisory by default. They become blocking if the pipeline is a documentation generator or MCP context provider.

### Category 5: Export Targets

A file passes the export check when:

- All frames and components intended for export have export settings configured in Figma (SVG, PNG, or PDF at the appropriate scale)
- Export target names do not conflict with each other across pages
- Export target names map to valid filesystem paths (no slashes in names, no reserved characters)

Missing export settings on intended export targets are blocking for asset export pipelines and advisory for everything else.

---

## The Automation Contract: FIGMA.md

The readiness contract is about file structure. The automation contract is about what a pipeline is authorized to do with what it finds.

A `FIGMA.md` file lives in the root of the repository that owns the pipeline code. It is the governing document for any automation — including AI coding agents — that reads or acts on the Figma file.

```markdown
# FIGMA.md — Automation Governance

## File Key
FIGMA_FILE_KEY=abc123def456  <!-- stored in .env; this file documents intent, not credentials -->

## What automation may do without human review
- Read the file and write local JSON fixtures
- Extract variables and write DTCG-compatible token JSON to /tokens/
- Export named assets and write to /src/assets/icons/
- Run the preflight check and exit with non-zero code if blockers are found
- Open a pull request with generated output for human review

## What automation must not do without human review
- Commit generated files directly to main without a PR
- Delete files from /src/assets/ without first confirming the node still exists in Figma
- Modify any Figma file contents via the Plugin API
- Infer semantic meaning from unnamed or ambiguously named nodes
- Use node IDs that are not confirmed stable (see Node ID Stability below)

## What this pipeline does NOT do
- Make design decisions
- Resolve naming conflicts
- Determine which components should be published
- Override the designer's intent as expressed in variable values or component structure

## Node ID Stability
Node IDs in Figma are stable as long as the node is not deleted and recreated.
A rename does not change the node ID. A copy-paste creates a new ID.
If node IDs in the asset manifest change, the pipeline will log a warning and
require manual confirmation before updating the manifest.

## Rate Limit Policy
This pipeline respects Figma's rate limits. [verify — current as of writing]
Requests are batched to 50 nodes per image request.
Retries use exponential backoff with a maximum of 3 attempts.
If rate limits are exhausted, the pipeline exits with code 2 and logs the retry-after header.

## Modes and Themes
The token pipeline extracts all modes from each variable collection.
Mode selection for platform targets is declared in /tokens/config.mjs.
The pipeline does not guess which mode maps to which platform.
```

This document travels with the code. When the CI pipeline runs, it reads `FIGMA.md` as part of its governance check. When an AI coding agent is given access to the Figma file via MCP, `FIGMA.md` scopes what it can infer and what it must refuse. The document is not an access control mechanism — access is controlled at the API token level. It is a declared intent document. It makes the implicit assumptions of every pipeline explicit and reviewable.

---

## The Preflight Script: figma-preflight.mjs

The preflight script runs before any pipeline. It reads the file, checks against the machine-readiness contract, prints a graded finding report, and exits with a non-zero code if any blocking issues are found.

```javascript
// figma-preflight.mjs
// Usage: node figma-preflight.mjs
// Requires: FIGMA_TOKEN, FIGMA_FILE_KEY in environment
// Illustrative — adapt severity rules to your file's contract

import { writeFileSync } from 'fs';

const TOKEN   = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;

if (!TOKEN || !FILE_KEY) {
  console.error('[preflight] ERROR: FIGMA_TOKEN and FIGMA_FILE_KEY are required.');
  process.exit(1);
}

const BASE = 'https://api.figma.com/v1';

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Figma-Token': TOKEN }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API error ${res.status}: ${body}`);
  }
  return res.json();
}

// [verify — current as of writing] Variables API endpoint and response shape
async function getVariables() {
  return get(`/files/${FILE_KEY}/variables/local`);
}

async function getFile() {
  return get(`/files/${FILE_KEY}`);
}

function slugValid(name) {
  // Checks: slash-separated, no spaces, no uppercase, no special chars
  const segments = name.split('/');
  if (segments.length < 2) return false;
  return segments.every(seg => /^[a-z0-9][a-z0-9\-]*$/.test(seg));
}

function checkVariableNames(variables) {
  const findings = [];
  for (const [id, variable] of Object.entries(variables)) {
    if (!slugValid(variable.name)) {
      findings.push({
        severity: 'blocking',
        category: 'naming',
        message:  `Variable name does not follow slug convention: "${variable.name}"`,
        id
      });
    }
  }
  return findings;
}

function checkAliasChains(variables) {
  const findings = [];
  const variableIds = new Set(Object.keys(variables));

  for (const [id, variable] of Object.entries(variables)) {
    for (const [mode, value] of Object.entries(variable.valuesByMode)) {
      if (value && value.type === 'VARIABLE_ALIAS') {
        // [verify — current as of writing] alias structure in Variables API response
        if (!variableIds.has(value.id)) {
          findings.push({
            severity: 'blocking',
            category: 'aliases',
            message:  `Broken alias in "${variable.name}" (mode ${mode}): references missing variable ${value.id}`,
            id
          });
        }
      }
    }
  }
  return findings;
}

function checkComponentDescriptions(components) {
  const findings = [];
  for (const [id, component] of Object.entries(components)) {
    if (!component.description || component.description.trim() === '') {
      findings.push({
        severity: 'advisory',
        category: 'documentation',
        message:  `Component has empty description: "${component.name}"`,
        id
      });
    }
  }
  return findings;
}

function checkExportTargetNames(document) {
  const findings = [];
  const reservedChars = /[<>:"/\\|?*]/;

  function walk(node) {
    if (node.exportSettings && node.exportSettings.length > 0) {
      if (reservedChars.test(node.name)) {
        findings.push({
          severity: 'blocking',
          category: 'export',
          message:  `Export target name contains reserved characters: "${node.name}"`,
          id: node.id
        });
      }
      if (/^(Frame|Group|Rectangle|Ellipse) \d+$/.test(node.name)) {
        findings.push({
          severity: 'blocking',
          category: 'export',
          message:  `Export target has a Figma-generated default name: "${node.name}"`,
          id: node.id
        });
      }
    }
    if (node.children) node.children.forEach(walk);
  }

  walk(document);
  return findings;
}

async function run() {
  console.log('[preflight] Reading file...');
  const [fileData, varData] = await Promise.all([getFile(), getVariables()]);

  const findings = [];

  // Check variable names
  findings.push(...checkVariableNames(varData.variables ?? {}));

  // Check alias chains
  findings.push(...checkAliasChains(varData.variables ?? {}));

  // Check component descriptions
  findings.push(...checkComponentDescriptions(fileData.components ?? {}));

  // Check export target names
  findings.push(...checkExportTargetNames(fileData.document));

  // Summary
  const blocking = findings.filter(f => f.severity === 'blocking');
  const advisory = findings.filter(f => f.severity === 'advisory');

  console.log('\n=== Preflight Report ===');
  console.log(`Blocking: ${blocking.length}  Advisory: ${advisory.length}`);

  if (advisory.length > 0) {
    console.log('\n--- Advisory ---');
    advisory.forEach(f => console.log(`  [${f.category}] ${f.message}`));
  }

  if (blocking.length > 0) {
    console.log('\n--- Blocking ---');
    blocking.forEach(f => console.log(`  [${f.category}] ${f.message}`));
  }

  // Write machine-readable output
  const report = {
    timestamp:  new Date().toISOString(),
    fileKey:    FILE_KEY,
    blocking:   blocking.length,
    advisory:   advisory.length,
    findings
  };
  writeFileSync('preflight-report.json', JSON.stringify(report, null, 2));
  console.log('\nReport written to preflight-report.json');

  if (blocking.length > 0) {
    console.error(`\n[preflight] FAILED: ${blocking.length} blocking issue(s) found. Fix before running pipelines.`);
    process.exit(1);
  }

  console.log('\n[preflight] PASSED. File is machine-ready.');
}

run().catch(err => {
  console.error('[preflight] Unexpected error:', err.message);
  process.exit(1);
});
```

Add it to `package.json`:

```json
{
  "scripts": {
    "figma:preflight": "node figma-preflight.mjs"
  }
}
```

Run it before any pipeline step in CI:

```bash
npm run figma:preflight && npm run figma:tokens && npm run figma:assets
```

The `&&` is not cosmetic. It is the enforcement mechanism. If `figma:preflight` exits with a non-zero code, the subsequent commands do not run. That is the contract.

---

## The Before/After Contrast

Before the machine-readiness standard is applied, a file looks like this in a preflight report:

```
=== Preflight Report ===
Blocking: 14  Advisory: 31

--- Blocking ---
  [naming] Variable name does not follow slug convention: "Primary Color"
  [naming] Variable name does not follow slug convention: "Button BG Hover"
  [aliases] Broken alias in "color/semantic/interactive" (mode 1): references missing variable 1:2003
  [export]  Export target has a Figma-generated default name: "Frame 23"
  ...
```

After a design system engineer works through the TIKTOC checklist — fixing names, repairing aliases, naming export targets, adding descriptions — the same run produces:

```
=== Preflight Report ===
Blocking: 0  Advisory: 3

--- Advisory ---
  [documentation] Component has empty description: "Badge/Status/Warning"
  [documentation] Component has empty description: "DataTable/Cell/Numeric"
  [documentation] Component has empty description: "Tooltip/Rich"

[preflight] PASSED. File is machine-ready.
```

The three advisory findings are not blocking. The badge, data table cell, and tooltip components exist, are published, and have correct names. They are candidates for documentation improvement but they will not break the token pipeline or the asset export.

---

## What the Preflight Cannot Catch

The preflight checks structure. It does not check intent.

It cannot tell you whether the semantic token `color/button/primary` actually maps to the right primitive for your brand. It only tells you whether the alias is unbroken. A designer who maps primary to a gray instead of the brand blue will not be caught by a naming check.

It cannot tell you whether the component architecture makes sense for the product. Components with correct names and non-empty descriptions can still be structured in ways that make code generation difficult — too many variant properties, variants that represent states which should be handled in code rather than in Figma, components nested at the wrong level of abstraction.

It cannot tell you whether the exported assets will render correctly in browsers. An SVG that passes the export-target-name check can still contain text that was not converted to outlines, transparency that renders unexpectedly on certain backgrounds, or filters that require browser-specific behavior.

These are judgment calls. The preflight is not a substitute for design review. It is the check that ensures the mechanical conditions for pipeline reliability are met so that the design review can focus on the things a machine cannot assess.

---

## Failure Modes of the Preflight Itself

**False pass.** The preflight checks the conditions it knows about. A file can pass the preflight and still fail downstream if the pipeline encounters a condition the preflight did not check. The preflight is a floor, not a ceiling. Teams should extend the checks when they discover new failure modes.

**Stale fixture.** If the preflight is run against a local fixture (a saved JSON response) rather than the live API, it will not catch changes made to the file since the fixture was saved. Always run the preflight against the live API in CI. Local fixtures are for development and testing only.

**Rate limit failure.** The preflight makes at least two API calls — one for the file, one for variables. On large files, these can take several seconds. If the file is very large or the account is under rate-limit pressure, the file call may be truncated or fail. [verify — current as of writing] Add a delay between calls and handle retry logic as described in Chapter 2.

**Variables API plan gate.** The `GET /v1/files/:key/variables/local` endpoint [verify — current as of writing] requires an Enterprise plan. On Professional plans, the variables check will return an authorization error. The preflight must handle this gracefully: log that the variables check was skipped due to plan constraints, flag it as advisory (not blocking), and document the non-Enterprise alternative. The non-Enterprise path is covered in Chapter 8: use the Tokens Studio plugin to export variables before running the preflight.

---

## Decision Rules

**When to treat advisory findings as blocking.** If the pipeline downstream is a documentation generator, a code spec emitter, or an MCP context provider, empty descriptions are functionally blocking — not because the pipeline will crash, but because it will emit incomplete output that downstream consumers will treat as authoritative. Adjust the severity classification in your preflight configuration to match the pipeline's actual requirements.

**When to skip the preflight.** Never skip it in CI. In local development, skipping is acceptable when iterating on the pipeline code itself using a known-good fixture. Document the skip reason in a comment and reintroduce the preflight before merging.

**When to escalate an advisory to the design team.** Advisories that recur across multiple preflight runs without resolution are a signal that a structural decision needs to be made, not just a fix applied. Escalate through your team's normal design review process — the preflight report is the artifact that makes the conversation concrete.

**When the preflight passes but the pipeline still fails.** The failure is in the pipeline's assumptions, not in the file. Add a check to the preflight and rerun. The goal is for the preflight to catch anything the pipeline would trip over.

---

## Try This

1. Run `npm run figma:preflight` against your actual design system file right now. Do not fix anything first. Read the output. Count the blocking issues. That number is the debt your pipeline is running on today.

2. Pick one blocking finding from the naming category. Fix it in Figma. Republish. Run the preflight again. Confirm the finding disappears. This is the test that the feedback loop works.

3. Write a `FIGMA.md` for your current project. Start with two sections: what automation may do without review, and what it may not. If you are unsure which category a capability belongs in, put it in the "must not" list and move it to "may" only after a team conversation about the risk.

4. Add `npm run figma:preflight` as the first step in your CI pipeline before the token and asset steps. Verify that a blocking finding causes the CI run to fail without running the downstream steps.

---

## AI Wayback Machine: The "Definition of Done" Pattern

Before automated preflight tools existed, design system teams enforced machine-readiness through a "definition of done" checklist in Confluence or Notion — a static document that a designer was expected to consult before declaring a component ready for handoff.

The pattern was reasonable. The execution was fragile. The checklist was maintained by the person who wrote it, which was usually the design systems lead. When that person was on leave, the checklist was not consulted. When the checklist was updated, no one remembered to check whether the existing components still met the new criteria. The checklist measured intent, not state.

Automated preflight checks are the same concept running against the live file instead of human memory. The checklist still exists — it is encoded in the preflight script. The difference is that the check runs on every CI invocation and exits with a code that CI cannot ignore.

The design systems teams that ran the most reliable token pipelines in the mid-2020s were the ones who had, often without framing it this way, built automated definition-of-done checks. The framing came later. The practice preceded it.

---

*Chapter 8 builds the token extraction pipeline on top of this contract. Run the preflight first. The pipeline assumes you did.*
