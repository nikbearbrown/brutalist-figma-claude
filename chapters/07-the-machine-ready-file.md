# Chapter 7 — The Machine-Ready File

*A file that looks correct to a designer can be structurally opaque to a pipeline — and the pipeline will not always tell you which one it's reading.*

---

The pipeline did not fail on day one. It failed six weeks in, after the sprint where the design system designer reorganized the variable collections.

She had good reasons. The old structure — one massive collection named "Tokens" — was unwieldy at the scale the team had grown to. She split it into three: Primitives, Semantics, and Component. She renamed a handful of variables along the way to match the slash conventions from Chapter 4. The Figma file looked cleaner. The component library published without errors. Product designers could finally find what they needed.

The token pipeline ran that night. It completed without a hard failure. It silently dropped 47 of the 183 semantic tokens. The CSS it wrote had `var(--color-brand-primary)` referencing a variable that no longer existed in the output. The staging build deployed. The design review the following Thursday was the first time anyone saw that the button primary color had reverted to the browser default blue.

The pipeline had been reading a file it thought was machine-ready. It was not. No one had defined what machine-ready meant. No one had checked.

---

## The Implicit Assumptions a Pipeline Makes

When a pipeline reads a Figma file, it does not read with judgment. It reads with assumptions. Each assumption is a place the pipeline can fail silently — producing output that is structurally valid but semantically wrong, which is a worse failure than crashing, because nobody knows to look.

The naming assumption: variable and component names follow a consistent slash-separated hierarchy. If some names use spaces, some use underscores, some have no hierarchy at all, the transformation step produces garbage or silently drops values it cannot classify. The pipeline does not complain. It processes what it can and ignores the rest.

The alias assumption: when a semantic token references a primitive, the alias chain resolves to a raw value. If the primitive was renamed or deleted — as it was in the story above — the chain is broken. The pipeline either writes an unresolved reference into the output or crashes on the resolve step. Which one it does depends on implementation details the user may not have read.

The publication assumption: component metadata is only fully available for published library components. If components are unpublished, documentation generators, code generators, and MCP consumers get incomplete data without knowing it is incomplete. They will report what they have as if it were the whole picture.

The structure assumption: most token pipelines are written to expect a variable collection architecture that separates primitives from semantics. A single flat collection is not invalid — Figma will not reject it — but it breaks the transformation logic that determines output intent. The pipeline cannot infer which tokens are decisions and which are vocabulary if both live in the same collection with the same depth.

The description assumption: when a pipeline builds component documentation, generates a design spec, or provides context to an AI coding agent, it reads the `description` field on components and variables. In most real files, those fields are empty. The pipeline has nothing to pass downstream except names and values, and a name like `Button/Primary/Default` without a description tells a code generator approximately nothing about when to use it.

The export assumption: asset export pipelines expect exportable nodes to be named consistently, to have export settings configured, and for those names to map to meaningful paths in the repository. A frame named `Frame 47` with no export settings is invisible to the pipeline.

<!-- → [TABLE: Six pipeline assumptions — columns: assumption, what breaks when it's violated, failure mode (silent vs. crash), how to detect] -->

These are not exotic edge cases. They are the normal state of a Figma file that has been worked on by a team for more than a few months. Files accrete. Conventions drift. A variable added by a designer on a deadline who hasn't read the convention document is a broken alias chain waiting to fire.

---

## What Machine-Readiness Actually Means

Machine-readiness is not a score. It is not an aspiration. It is a contract — a specific set of conditions that must be true before a pipeline is authorized to read the file and trust what it finds.

The contract has five categories, each with two severity levels: **blocking** (the pipeline must not proceed) and **advisory** (the pipeline can proceed but the finding should be logged and reviewed).

**Category one: naming contract.** All variables follow the slash-separated hierarchy convention from Chapter 4. Variable names contain no spaces, no uppercase characters, and no special characters other than hyphens within a segment. Component names follow a consistent capitalization convention. Layer names on exportable assets are not Figma-generated defaults — no `Frame 47`, no `Group 12`, no `Rectangle 8`. Naming violations are blocking unless they affect only non-exported, non-variable nodes that nothing in the pipeline touches.

**Category two: variable architecture.** At least one collection exists for primitives and at least one for semantic aliases. No semantic token aliases chain through more than three levels — `semantic → primitive` is normal; `semantic → semantic → semantic → primitive` is a sign of architectural confusion that will produce unpredictable results when a primitive changes. All alias chains resolve to a raw value; no broken references. [verify — current as of writing: the Figma Variables API exposes `resolvedType` and the alias target's `variableId`; a broken alias occurs when the target variable does not exist in the same file or in an enabled library] Broken aliases are always blocking. Duplicate values — the same color at two different names with no semantic distinction between them — are advisory.

**Category three: publication state.** The component library has been published at least once. No components that were previously published have been moved to an unpublished location without a corresponding library update. The last publication timestamp is within a threshold acceptable to the team — warn if the library has not been re-published in more than fourteen days. Unpublished state for components that downstream pipelines are known to consume is blocking.

**Category four: component documentation.** All published components have a non-empty `description` field. All component sets — variant groups — have a description explaining what the variants represent. Variable descriptions are populated for all non-primitive tokens: a primitive like `color/palette/blue-500` is self-documenting by name; a semantic token like `color/button/primary` is not. Empty descriptions on published components are advisory by default, and become blocking if the pipeline is a documentation generator or MCP context provider whose output will be treated as authoritative.

**Category five: export targets.** All frames and components intended for export have export settings configured. Export target names do not conflict with each other across pages. Export target names map to valid filesystem paths — no reserved characters, no leading slashes. Missing export settings on intended export targets are blocking for asset export pipelines and advisory for everything else.

<!-- → [FIGURE: Severity matrix — five categories on one axis, blocking vs. advisory on the other, with brief consequences for each cell. Caption: Not every violation stops the pipeline, but every violation degrades the output. Blocking violations make the degradation immediate and detectable.] -->

The distinction between blocking and advisory is important because it determines the pipeline's behavior when findings exist. A pipeline that halts on every advisory finding will never run in a real project — real projects accumulate advisory findings faster than they are resolved. A pipeline that ignores blocking findings will silently produce wrong output and deploy it. The severity classification is the policy decision that determines which failures the team accepts responsibility for surfacing immediately versus monitoring over time.

---

## The Automation Contract: FIGMA.md

The readiness contract is about file structure. There is a second contract the machine-readiness standard requires, and it is about authorization: what is a pipeline permitted to do with what it finds?

Without a declared governance document, a pipeline has to guess. Can it overwrite existing files? Commit changes directly to main? Delete assets that no longer appear in the file? The only safe default is to fail on ambiguity — which means the pipeline will fail constantly in ways that require human judgment to resolve, defeating the purpose of automation.

The solution is a `FIGMA.md` file at the root of the repository that owns the pipeline code. It is the governing document for any automation — including AI coding agents given access to the Figma file via MCP — that reads or acts on the Figma file. It is not an access control mechanism; access is controlled at the API token level. It is a declared intent document: the set of assumptions the pipeline makes, written down and reviewed by the team.

```markdown
# FIGMA.md — Automation Governance

## File Key
FIGMA_FILE_KEY=abc123def456
<!-- stored in .env; this file documents intent, not credentials -->

## What automation may do without human review
- Read the file and write local JSON fixtures
- Extract variables and write DTCG-compatible token JSON to /tokens/
- Export named assets and write to /src/assets/icons/
- Run the preflight check and exit with non-zero code if blockers are found
- Open a pull request with generated output for human review

## What automation must not do without human review
- Commit generated files directly to main without a PR
- Delete files from /src/assets/ without confirming the node still exists in Figma
- Modify any Figma file contents via the Plugin API
- Infer semantic meaning from unnamed or ambiguously named nodes
- Use node IDs not confirmed stable (see Node ID Stability below)

## What this pipeline does NOT do
- Make design decisions
- Resolve naming conflicts
- Determine which components should be published
- Override the designer's intent as expressed in variable values or component structure

## Node ID Stability
Node IDs in Figma are stable as long as the node is not deleted and recreated.
A rename does not change the node ID. A copy-paste creates a new ID.
If node IDs in the asset manifest change, the pipeline will log a warning
and require manual confirmation before updating the manifest.

## Rate Limit Policy
Requests are batched to 50 nodes per image request.
Retries use exponential backoff with a maximum of 3 attempts.
If rate limits are exhausted, the pipeline exits with code 2 and logs
the retry-after header. [verify — current as of writing]
```

<!-- → [FIGURE: Diagram showing FIGMA.md as the central governance document read by CI, the preflight script, and AI coding agents simultaneously. Caption: One document, three consumers. The pipeline's behavior is determined by what is declared here, not by what individual contributors assume.] -->

The value of this document is not primarily technical. It is organizational. When a new engineer joins the team and asks "what is this pipeline allowed to do?", the answer is in `FIGMA.md`. When an AI coding agent is given Figma access and needs to know whether it can infer semantic intent from an unnamed node, the answer is in `FIGMA.md`. When the team debates whether to allow direct commits to main for generated token files, the document is the artifact that makes the debate concrete — edit the document, review the edit, merge or reject it.

---

## The Preflight Script

The preflight script is the enforcement mechanism for the readiness contract. It runs before any pipeline step in CI, reads the live file, checks against the five categories, and exits with a non-zero code if blocking issues are found. If it exits non-zero, subsequent pipeline steps do not run. That is the contract in code.

```javascript
// figma-preflight.mjs
// Usage: node figma-preflight.mjs
// Requires: FIGMA_TOKEN, FIGMA_FILE_KEY in environment
// [verify — current as of writing] Variables API endpoint and response shape

import { writeFileSync } from 'fs';

const TOKEN    = process.env.FIGMA_TOKEN;
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

function slugValid(name) {
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
  const [fileData, varData] = await Promise.all([
    get(`/files/${FILE_KEY}`),
    get(`/files/${FILE_KEY}/variables/local`)
  ]);

  const findings = [];
  findings.push(...checkVariableNames(varData.variables ?? {}));
  findings.push(...checkAliasChains(varData.variables ?? {}));
  findings.push(...checkComponentDescriptions(fileData.components ?? {}));
  findings.push(...checkExportTargetNames(fileData.document));

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

  writeFileSync(
    'preflight-report.json',
    JSON.stringify({ timestamp: new Date().toISOString(), fileKey: FILE_KEY, blocking: blocking.length, advisory: advisory.length, findings }, null, 2)
  );
  console.log('\nReport written to preflight-report.json');

  if (blocking.length > 0) {
    console.error(`\n[preflight] FAILED: ${blocking.length} blocking issue(s). Fix before running pipelines.`);
    process.exit(1);
  }
  console.log('\n[preflight] PASSED. File is machine-ready.');
}

run().catch(err => {
  console.error('[preflight] Unexpected error:', err.message);
  process.exit(1);
});
```

Wire it into CI before every pipeline step:

```bash
npm run figma:preflight && npm run figma:tokens && npm run figma:assets
```

The `&&` is not cosmetic. If `figma:preflight` exits non-zero, the subsequent commands do not run. That is the enforcement.

<!-- → [TABLE: Before/after preflight report — left column: report from an uncontracted file (14 blocking, 31 advisory with sample findings); right column: report after remediation (0 blocking, 3 advisory). Caption: The three remaining advisory findings are candidates for documentation improvement, not pipeline blockers.] -->

A file that passes preflight with zero blocking findings is not a perfect file. It is a file whose structural conditions for pipeline reliability have been met. The design review can then focus on what machines cannot assess: whether the semantic tokens represent the right decisions, whether the component architecture makes sense for the product, whether the exported assets will render correctly across browsers.

---

## What the Preflight Cannot Catch

I want to be honest about the limits, because treating the preflight as a complete quality gate is itself a failure mode.

It cannot tell you whether `color/button/primary` maps to the right primitive for your brand. It only tells you whether the alias is unbroken. A designer who maps the primary button color to a gray instead of the brand blue will not be caught by a naming or alias check — both the name and the alias are structurally valid.

It cannot tell you whether the component architecture makes sense for code generation. Components with correct names and non-empty descriptions can still be structured in ways that make automation difficult: too many variant properties, variants that represent states which should be handled in code rather than in Figma, components nested at the wrong level of abstraction. These are design judgment calls that require a human.

It cannot tell you whether exported SVGs will render correctly across browsers. An SVG that passes the export-target-name check can still contain text that was not converted to outlines, transparency that renders unexpectedly on dark backgrounds, or filters that require browser-specific behavior. The preflight checks the pipeline's assumptions; it does not check the asset's contents.

And it cannot catch conditions it does not know about. The preflight is the current enumeration of known failure modes. When the pipeline encounters a new one — and it will — the correct response is to add a check to the preflight and rerun, so the same failure cannot recur silently.

---

## The Failure Modes of the Preflight Itself

A false pass is the preflight's most dangerous failure: the file passes all checks, the pipeline runs, and the output is still wrong because the pipeline encountered a condition the preflight did not check for. The preflight is a floor, not a ceiling. Teams that treat it as a ceiling stop extending it when they find new failure modes, and the debt accumulates.

Stale fixture is the most common operational failure: running the preflight against a locally saved JSON response rather than the live API. The fixture was accurate when saved. The file has changed since. CI must always run against the live API. Local fixtures are for development iteration only, and should be marked clearly in the codebase as not authoritative.

The Variables API plan gate is a structural constraint worth knowing about explicitly. The `GET /v1/files/:key/variables/local` endpoint [verify — current as of writing] requires an Enterprise plan. On Professional plans, the variables check will return an authorization error. The preflight must handle this gracefully: log that the variables check was skipped due to plan constraints, treat it as advisory rather than blocking, and document the non-Enterprise alternative. On Professional plans, the workaround is using the Tokens Studio plugin to export variables before running the preflight — covered in Chapter 8.

---

## Before This Was a Script

Long before automated preflight tools existed, design system teams enforced machine-readiness through a "definition of done" checklist in Confluence or Notion — a static document a designer was expected to consult before declaring a component ready for handoff. The pattern was reasonable. The execution was fragile. The checklist was maintained by whoever wrote it, usually the design systems lead. When that person was unavailable, the checklist was not consulted. When the checklist was updated, no one remembered to verify that existing components still met the new criteria. The checklist measured stated intent, not actual state.

The preflight script is the same concept running against the live file instead of human memory. The checklist still exists — it is encoded as check functions in the script. The difference is that the check runs on every CI invocation and exits with a code that CI cannot ignore.

The teams running the most reliable token pipelines in the mid-2020s had, often without framing it this way, built automated definition-of-done checks. They had discovered that the moment the check lived in code rather than documentation, its enforcement rate went from aspirational to mandatory. The conceptual framing arrived later. The practice preceded it.

---

Chapter 8 builds the token extraction pipeline on top of this contract. The pipeline assumes the preflight passed. Run it first.

---

**LLM Exercises**

*Use these with Claude or any capable language model to deepen your understanding of the concepts in this chapter.*

**1. Generate and examine.** Ask the model to describe what "machine-readiness" means in a different automated pipeline context — a CI/CD pipeline for a web application, a data ingestion pipeline, an API integration. Ask it to identify the equivalent of "blocking" versus "advisory" findings in that domain. Then compare its structure to the five-category contract in this chapter and note which categories transfer and which are Figma-specific.

**2. Apply to known context.** Describe your team's current Figma file structure — the number of variable collections, whether components are published, whether export targets have configured settings, roughly how consistent the naming is. Ask the model to predict which of the five categories is most likely to have blocking findings and explain its reasoning. Then run the actual preflight and compare the prediction to the output.

**3. Stress-test a specific claim.** This chapter argues that the severity classification — blocking versus advisory — is the most important policy decision in the preflight, and that getting it wrong in either direction causes real problems. Present this claim to the model and ask it to construct a scenario where treating advisory findings as blocking would improve pipeline reliability, and a scenario where it would make the pipeline unusable. Evaluate whether the chapter's default severity assignments are calibrated correctly for your team's situation.

**4. Draft or audit a professional deliverable.** Write a `FIGMA.md` for your current project — the two sections on what automation may do without review and what it must not do. Ask the model to review it for completeness, ambiguity, and coverage of edge cases it would expect a pipeline to encounter in the first six months of operation. Ask it to identify the single highest-risk item that belongs in the "must not" list that you might have missed.
