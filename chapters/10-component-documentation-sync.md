# Chapter 10 — Component Documentation Sync

*Keeping living documentation in sync with the Figma file — without manually updating it every time a component changes.*

---

## The Failure

The design system has a documentation site. It is built with care. Someone wrote usage guidance for the Button component, added a do/don't example for the Modal, documented the four variants of the Card. The site looks authoritative.

Then the design team ships a quarter. The Button gets a new `destructive` variant. The Card acquires a `compact` density option. The Modal's dismiss behavior changes. Nobody updates the documentation site. Nobody has time. The documentation site is now lying.

This is not negligence. It is the predictable outcome of documentation maintained by hand in a repository separate from the design file. The Figma file changes. The code changes. The documentation lags — by days, then weeks, then permanently. By the time a new engineer asks "what variants does this component support?", the documentation is an artifact of a Figma file that no longer exists.

The documentation drift problem is the same synchronization problem as token drift, just slower-moving and therefore easier to ignore until it is embarrassing.

This chapter builds `sync-docs.mjs`, a CLI tool that reads your Figma library directly and generates three machine-readable artifacts: a component inventory, variant property tables, and a missing-description report. These artifacts give documentation platforms — Storybook, Zeroheight, Supernova [verify — current as of writing], and custom portals — machine-verifiable facts to build from. The human work of writing usage guidance still belongs to humans. The machine work of knowing what exists, what its properties are, and what has not been documented yet belongs to the CLI.

---

## What This Chapter Lets You Do

By the end of this chapter you can:

- Extract a complete component inventory from a published Figma library using the REST API
- Generate variant property tables for every component with variants
- Produce a missing-description report that shows exactly which components have no description, which descriptions are too short to be useful, and which published components have no Code Connect link
- Run this as a scheduled CI task so documentation staleness becomes a CI failure, not a human discovery
- Know exactly which parts of the documentation still require human writing and which facts the machine can supply reliably

---

## Diagnosis: What the API Actually Knows About Your Components

The Figma REST API exposes several facts about components that are directly useful for documentation. Understanding which facts are available, and at what access level, determines what your CLI can do without human input.

**What the API exposes** [verify — current as of writing]:

- `GET /v1/files/:key` returns `components` at the top level, keyed by node ID. Each entry includes `name`, `description`, `key` (the component key used in library references), and `componentSetId` if the component belongs to a component set.
- `GET /v1/files/:key/components` returns the same set with additional `containing_frame` metadata.
- Component sets (the Figma object that holds variants) appear in the `componentSets` top-level map, again keyed by node ID. Each set has `name` and `description`.
- The `GET /v1/files/:key?depth=N` parameter controls how deep the node tree is fetched. For component inventory purposes, depth 2 or 3 is typically enough to see component sets and their children.
- Variant properties are embedded in component nodes as `variantProperties`: a key-value map of the variant dimensions and their values for that specific component.

**What the API does not expose**:

- Usage guidance. The description field holds whatever a designer typed in Figma's component description box. It does not know what the component is for, when to use it, or when not to.
- Accessibility semantics. The API cannot tell you whether a button needs an `aria-label`, or whether a tooltip has a keyboard-accessible trigger. These require human authoring.
- Do/don't examples. These are editorial decisions.
- Whether the documentation is correct. The API knows what exists in the Figma file. It does not know whether the guidance on the documentation site matches engineering reality.

This distinction matters because it defines the boundary of what your CLI can automate. The CLI can tell you "the Button component has 47 descriptions filled in out of 48 components" and identify which one is missing. It cannot write the missing description. That is the contract.

**Publication state**: For library components, only published components are available to other files via `GET /v1/files/:key/components` [verify — current as of writing]. Draft components — components in the file but not yet published — appear in the full file response but not in the library endpoint. Your CLI should handle both cases.

**Code Connect**: Figma's Code Connect feature [verify — current as of writing] links a Figma component to its real codebase implementation. When Code Connect is configured, the Figma API can surface the code snippet or component path associated with a design component. This is high-value for documentation: it closes the loop between the visual design and the actual import statement. However, Code Connect requires setup per-component and is not automatically inferred. The missing-description report should flag components without Code Connect links as a separate category — it is a gap worth knowing about, distinct from missing descriptive text.

---

## Building `sync-docs.mjs`

The script does four things in sequence: fetch the component list, extract variant structures, compute coverage metrics, and write output in three formats.

### Environment

```bash
# .env
FIGMA_TOKEN=figd_your_personal_access_token
FIGMA_FILE_KEY=your_design_system_file_key
```

```bash
npm run docs:sync
# package.json entry:
# "docs:sync": "node sync-docs.mjs --out=docs-sync-output"
```

### The Script

```javascript
// sync-docs.mjs
// [illustrative — adapt to your file structure and documentation platform]

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;
const OUT_DIR = process.argv.includes('--out=') 
  ? process.argv.find(a => a.startsWith('--out=')).split('=')[1]
  : 'docs-sync-output';

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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API ${res.status}: ${body}`);
  }
  return res.json();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Fetching file...');
  // Fetch full file with depth limit — components are typically within depth 3
  const fileData = await figmaGet(`/files/${FILE_KEY}`);
  
  const rawComponents = fileData.components || {};
  const rawComponentSets = fileData.componentSets || {};

  // Build inventory
  const inventory = [];
  const variantTables = [];
  const missingDocs = [];

  // Index component sets by ID for lookup
  const setIndex = {};
  for (const [nodeId, set] of Object.entries(rawComponentSets)) {
    setIndex[nodeId] = {
      nodeId,
      name: set.name,
      description: set.description || '',
      components: []
    };
  }

  // Process components
  for (const [nodeId, comp] of Object.entries(rawComponents)) {
    const name = comp.name;
    const description = comp.description || '';
    const setId = comp.componentSetId || null;
    const variantProps = comp.variantProperties || null;

    const entry = {
      nodeId,
      name,
      description,
      setId,
      variantProperties: variantProps,
      hasDescription: description.trim().length > 0,
      descriptionLength: description.trim().length,
      isVariant: !!setId
    };

    inventory.push(entry);

    if (setId && setIndex[setId]) {
      setIndex[setId].components.push(entry);
    }

    // Flag missing or thin descriptions
    if (!entry.hasDescription) {
      missingDocs.push({
        nodeId,
        name,
        type: 'component',
        issue: 'no-description',
        setId
      });
    } else if (entry.descriptionLength < 20) {
      missingDocs.push({
        nodeId,
        name,
        type: 'component',
        issue: 'description-too-short',
        description,
        setId
      });
    }
  }

  // Build variant property tables for each component set
  for (const [setId, set] of Object.entries(setIndex)) {
    if (set.components.length === 0) continue;

    // Collect all variant dimensions across components in this set
    const dimensionValues = {};
    for (const comp of set.components) {
      if (!comp.variantProperties) continue;
      for (const [dim, val] of Object.entries(comp.variantProperties)) {
        if (!dimensionValues[dim]) dimensionValues[dim] = new Set();
        dimensionValues[dim].add(val);
      }
    }

    const dimensions = Object.entries(dimensionValues).map(([dim, vals]) => ({
      dimension: dim,
      values: [...vals].sort()
    }));

    variantTables.push({
      setId,
      setName: set.name,
      setDescription: set.description,
      hasSetDescription: set.description.trim().length > 0,
      dimensions,
      componentCount: set.components.length
    });

    // Flag sets without descriptions
    if (!set.description.trim()) {
      missingDocs.push({
        nodeId: setId,
        name: set.name,
        type: 'component-set',
        issue: 'no-description'
      });
    }
  }

  // Coverage summary
  const totalComponents = inventory.length;
  const withDescription = inventory.filter(c => c.hasDescription).length;
  const withoutDescription = inventory.filter(c => !c.hasDescription).length;
  const thinDescription = inventory.filter(c => c.hasDescription && c.descriptionLength < 20).length;
  const totalSets = Object.keys(setIndex).length;
  const setsWithDescription = Object.values(setIndex)
    .filter(s => s.description.trim().length > 0).length;

  const summary = {
    generatedAt: new Date().toISOString(),
    fileKey: FILE_KEY,
    totalComponents,
    withDescription,
    withoutDescription,
    thinDescriptions: thinDescription,
    totalComponentSets: totalSets,
    setsWithDescription,
    setsWithoutDescription: totalSets - setsWithDescription,
    missingDocCount: missingDocs.length,
    coveragePercent: totalComponents > 0
      ? Math.round((withDescription / totalComponents) * 100)
      : 0
  };

  // Write outputs
  const inventoryOut = { summary, components: inventory };
  writeFileSync(join(OUT_DIR, 'component-inventory.json'), JSON.stringify(inventoryOut, null, 2));

  writeFileSync(join(OUT_DIR, 'variant-tables.json'), JSON.stringify(variantTables, null, 2));

  writeFileSync(join(OUT_DIR, 'missing-docs.json'), JSON.stringify({
    summary,
    findings: missingDocs
  }, null, 2));

  // Generate markdown report
  const md = generateMarkdownReport(summary, missingDocs, variantTables);
  writeFileSync(join(OUT_DIR, 'docs-sync-report.md'), md);

  // Exit with failure if there are errors (missing descriptions on component sets)
  const errorCount = missingDocs.filter(f => f.type === 'component-set').length;
  console.log(`\nDone. ${totalComponents} components. ${summary.coveragePercent}% have descriptions.`);
  console.log(`${missingDocs.length} documentation gaps found.`);
  console.log(`Output: ${OUT_DIR}/`);

  if (errorCount > 0) {
    console.error(`\n${errorCount} component sets have no description (CI-blocking).`);
    process.exit(1);
  }
}

function generateMarkdownReport(summary, missingDocs, variantTables) {
  const lines = [];
  lines.push('# Component Documentation Sync Report');
  lines.push(`\nGenerated: ${summary.generatedAt}`);
  lines.push(`\n## Coverage Summary\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total components | ${summary.totalComponents} |`);
  lines.push(`| With description | ${summary.withDescription} (${summary.coveragePercent}%) |`);
  lines.push(`| Without description | ${summary.withoutDescription} |`);
  lines.push(`| Thin descriptions (<20 chars) | ${summary.thinDescriptions} |`);
  lines.push(`| Component sets | ${summary.totalComponentSets} |`);
  lines.push(`| Sets with description | ${summary.setsWithDescription} |`);

  if (missingDocs.length > 0) {
    lines.push(`\n## Documentation Gaps (${missingDocs.length})\n`);
    const errors = missingDocs.filter(f => f.type === 'component-set');
    const warnings = missingDocs.filter(f => f.type === 'component' && f.issue === 'no-description');
    const infos = missingDocs.filter(f => f.issue === 'description-too-short');

    if (errors.length > 0) {
      lines.push(`### Errors — Component Sets Without Description (${errors.length})\n`);
      for (const f of errors) {
        lines.push(`- **${f.name}** \`${f.nodeId}\``);
      }
    }
    if (warnings.length > 0) {
      lines.push(`\n### Warnings — Components Without Description (${warnings.length})\n`);
      for (const f of warnings) {
        lines.push(`- ${f.name} \`${f.nodeId}\``);
      }
    }
    if (infos.length > 0) {
      lines.push(`\n### Info — Thin Descriptions (${infos.length})\n`);
      for (const f of infos) {
        lines.push(`- ${f.name}: "${f.description}" \`${f.nodeId}\``);
      }
    }
  }

  if (variantTables.length > 0) {
    lines.push(`\n## Variant Property Tables\n`);
    for (const vt of variantTables) {
      lines.push(`### ${vt.setName} (${vt.componentCount} variants)\n`);
      if (vt.setDescription) lines.push(`*${vt.setDescription}*\n`);
      if (vt.dimensions.length > 0) {
        lines.push(`| Dimension | Values |`);
        lines.push(`|-----------|--------|`);
        for (const d of vt.dimensions) {
          lines.push(`| ${d.dimension} | ${d.values.join(', ')} |`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
```

Run it:

```bash
node sync-docs.mjs --out=docs-sync-output
```

Or via npm:

```json
{
  "scripts": {
    "docs:sync": "node sync-docs.mjs --out=docs-sync-output",
    "docs:sync:ci": "node sync-docs.mjs --out=docs-sync-output && cat docs-sync-output/docs-sync-report.md"
  }
}
```

### What You Get

After one run you have three files in `docs-sync-output/`:

**`component-inventory.json`** — the full component list with name, description, variant properties, and set membership. Feed this to a documentation site generator or diff it in CI to detect new components.

**`variant-tables.json`** — for each component set, the complete set of variant dimensions and their possible values. A documentation platform can render this as a property table without any additional API calls.

**`missing-docs.json`** — the actionable gap report. Grouped by severity: errors (component sets with no description — these gate the pipeline), warnings (individual components missing descriptions), and info (descriptions present but too short to be useful).

---

## Connecting to Documentation Platforms

### Storybook

Storybook does not consume the Figma API directly. The connection works through two paths:

1. **Code Connect** [verify — current as of writing]: Figma Code Connect links a Figma component to its Storybook story by embedding a code snippet in the Figma component description or through a separate Code Connect configuration file. When configured, the Figma Dev Mode panel shows the story link and the live code snippet next to the design. Code Connect requires explicit setup per component — it is not inferred automatically.

2. **Storybook + generated metadata**: Your `component-inventory.json` can serve as a source of truth for Storybook's `parameters.docs.description.component` field. A separate generator script reads the JSON and writes or patches `.stories.ts` files with the canonical description from Figma. This is a documentation-as-code pattern: the Figma file drives the description, the generator keeps the story in sync.

### Zeroheight [verify — current as of writing]

Zeroheight has a native Figma integration that syncs component thumbnails and some metadata from the Figma file directly. However, the native sync does not expose variant property tables or coverage metrics. The `variant-tables.json` from `sync-docs.mjs` can supplement Zeroheight's native data by providing a structured property table that editors paste into Zeroheight's content blocks. A more automated approach uses Zeroheight's API (where available) to push descriptions from the inventory JSON.

### Supernova [verify — current as of writing]

Supernova's Figma integration imports component data and links it to a design system documentation structure. Like Zeroheight, it has a native sync but limited programmatic control of content. The machine-readable output from `sync-docs.mjs` serves as the audit layer: you run it before each Supernova sync to confirm that the Figma file is in a state worth syncing from.

### Custom portals

If you maintain a custom documentation site (a Next.js or Astro static site is common for design systems), the inventory JSON is directly consumable. A build step reads `component-inventory.json` and generates component pages, variant tables, and gap reports. This pattern gives you the most control but requires the most maintenance of the generator itself.

---

## Code Connect: The Link You Still Have to Make

Code Connect [verify — current as of writing] is worth addressing directly because it closes the gap that documentation sites cannot close automatically: the connection between the Figma component and the real import path in the codebase.

Without Code Connect, a developer looking at a Figma component in Dev Mode sees the visual design but has to guess the correct import. With Code Connect, the Dev Mode panel shows something like:

```typescript
import { Button } from '@acme/design-system';

<Button variant="primary" size="medium">
  Label
</Button>
```

Setting up Code Connect requires:

1. Installing the Code Connect CLI: `npm install --save-dev @figma/code-connect` [verify — current as of writing]
2. Creating a `.figma.connect.ts` file per component that maps the Figma component node ID to the real component and its prop mappings
3. Running `figma connect publish` to push the mappings to Figma

This is not a one-time operation. When a Figma component gets new variants, the Code Connect file needs updating. The missing-docs report from `sync-docs.mjs` should flag components without Code Connect links as a documentation debt item, not just missing descriptive text. You can detect the absence of Code Connect data in the API response by checking whether the component's metadata includes code snippets in the Dev Mode endpoint [verify — current as of writing].

---

## Failure Modes

**The description field is the most common failure.** In practice, most Figma files have large numbers of components with empty description fields. The designer who built the component knew what it was for; they did not write it down. `sync-docs.mjs` surfaces this systematically, but the fix requires human effort: someone has to write descriptions in Figma for every component that needs them. This is design-side work. The CLI gives you the report; it cannot do the writing.

**Published vs. draft confusion.** If your team works in a file where components exist but are not published to the library, the `GET /v1/files/:key/components` endpoint returns only published components [verify — current as of writing]. The full file response includes everything. Running sync-docs against the full file will include draft components that are not yet available for use — which inflates the inventory and may produce confusing documentation. Add a `--published-only` flag to filter components that belong to published component sets.

**Variant property drift.** When a designer adds a new variant value in Figma without updating any connected documentation or Code Connect mappings, the variant tables generated by `sync-docs.mjs` will include the new value immediately. Documentation sites and Storybook stories will be stale. This is exactly what the diff is for: run `sync-docs.mjs` before and after a library publish event, diff the `variant-tables.json` files, and treat new variant values as documentation tasks.

**Rate limits on large files.** A design system library with hundreds of components fetches cleanly with a single `GET /v1/files/:key` call. But if your file is very large and you are paginating through nested nodes, you will hit rate limits. The backoff logic in the example script handles 429 responses, but the Figma REST API rate limit architecture [verify — current as of writing] differs by plan: Professional plan users have lower limits than Enterprise. Structure your requests to minimize round-trips — the full file fetch is almost always more efficient than fetching components individually.

**The documentation platform de-syncs.** `sync-docs.mjs` generates facts from the Figma file. If your documentation platform has content that was edited directly in the platform (descriptions written in Zeroheight's editor, for example), running a sync can overwrite human-written content with Figma's thinner description. Decide once which system owns the canonical description: Figma, or the documentation platform. If Figma owns it, the CLI drives the sync. If the platform owns it, the CLI produces a report but does not push.

---

## Decision Rules

**Use `sync-docs.mjs` in CI when**: your design system has more than a dozen components, the library publishes more than once per sprint, or you have onboarded a new documentation platform and need a baseline coverage report.

**Run it manually before**: a major library version release, onboarding new documentation contributors, or reviewing documentation before a design system audit.

**Let the machine generate**: component inventories, variant property tables, coverage percentages, missing-description reports, and component-to-code-path gap reports.

**Keep humans responsible for**: usage guidance, do/don't examples, accessibility notes, rationale for design decisions, and anything that requires knowing what the component is actually for in the product.

**Make CI fail on**: component sets with no description. A component set with no description is undocumented in the most basic sense — you cannot tell from the API what it is. This is a blocking issue.

**Make CI warn on**: individual component variants with no description (especially common for auto-generated variant nodes), descriptions under 20 characters, and components without Code Connect links.

**Do not try to automate**: writing descriptions, writing usage guidance, or generating do/don't examples. These require design judgment that the API cannot supply.

---

## Try This

1. Run `sync-docs.mjs` against your design system file. Note the coverage percentage. If it is below 70%, the documentation work has been deferred. You now know exactly where.

2. Add `npm run docs:sync` to your CI pipeline as a check that runs after every library publish event (triggered via webhook, or on a schedule). Fail the build if any component set has no description.

3. Take the `variant-tables.json` output and render it in your documentation site's component page template. Compare the generated table to whatever is currently written by hand. The gaps will be obvious.

4. For three of your highest-traffic components, configure Code Connect and re-run the sync. Check the Figma Dev Mode panel to confirm the code snippet is visible. Note how much the experience changes for a developer who opens that component in Figma.

5. Run `sync-docs.mjs` before and after a library publish. Diff the two `component-inventory.json` files. Decide whether those changes required documentation updates — and whether your process currently produces them.

---

## AI Wayback Machine — The Living Style Guide

Before automated pipeline tooling existed, documentation drift was addressed by a concept called the **living style guide**: a documentation artifact that was generated directly from source code or design tokens, theoretically staying in sync by construction.

The living style guide emerged in the mid-2010s as teams using CSS preprocessors and component libraries discovered that hand-maintained style guides became stale within days of release. Tools like KSS (Knyle Style Sheets), Hologram, and later Storybook generated documentation directly from annotated CSS and component code. The source was the documentation — if the code changed, the docs changed.

The problem was that the design side of the living style guide was never truly live. Design files existed in Figma (or earlier, in Sketch) as a separate artifact. The style guide documented code, not design intent. When the design changed and the code did not yet reflect it, the living style guide showed the code reality, not the design intent.

Code Connect and programmatic component inventory are the current generation of this idea, applied to the design side. The Figma file is now the upstream source; the CLI extracts structured facts from it. The gap that living style guides could not close — between the design file and the documentation — is what this chapter's tooling is built to address.

The same problem remains: facts are machine-extractable, intent is not. The living style guide could tell you the CSS custom property values; it could not tell you why the primary button is that particular shade of blue. Programmatic docs sync can tell you the variant dimensions; it cannot tell you when to use `size=compact` versus `size=default`. The boundary between what the machine knows and what the human must write has not moved. Only the machine's territory has expanded.

---

*Next chapter: monitoring the whole file for brand drift, not just documentation gaps — color, type, spacing, and contrast as continuous compliance checks.*
