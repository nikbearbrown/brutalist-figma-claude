# Chapter 9 — Asset Export Automation

The Slack message arrived at 11:47 PM: "buttons look fine on staging but the close icon is completely broken in prod."

It was not the close icon. The close icon SVG had been re-exported from Figma by the designer three days earlier, optimized with SVGO, and committed to the repository. The icon in production was a different file — from six months ago — that a different developer had hardcoded into a legacy component because they did not know the design system had an official close icon. The two files had the same display name in the UI. They had completely different paths in the codebase.

When the designer re-exported and overwrote the design system file, the legacy component did not update. The legacy component had no connection to the design system asset pipeline. It had a hardcoded relative path to a file that no longer existed at that path. The broken display was a 404 on an SVG that had been moved.

This is not a story about SVG optimization or API calls. It is a story about what happens when asset management is informal: no single source of truth, no deterministic paths, no manifest of what exists and where it should live, no automated verification that the file in the repository matches the node in Figma.

The pipeline in this chapter builds the thing the team in that story did not have.

---

## What This Chapter Does

This chapter builds `export-assets.mjs` — the script that takes a manifest of Figma node IDs, requests export renders from the Figma image endpoint, downloads the expiring URLs, post-processes SVGs with SVGO, and writes the results to deterministic paths in the repository.

By the end of this chapter you will have:

- An `asset-manifest.json` that maps Figma node IDs to repository paths, formats, and optimization rules
- An `export-assets.mjs` that batches image endpoint requests, handles expiring URLs, retries on rate-limit errors, and verifies output integrity
- SVGO post-processing configured to remove Figma-specific metadata, standardize identifiers, and produce production-ready SVG
- A GitHub Actions workflow triggered by `LIBRARY_PUBLISH` webhooks that exports, optimizes, and opens a pull request
- Explicit handling of the four operational hazards that break real asset pipelines

---

## Diagnosis: The Four Operational Hazards

The Figma image export endpoint is not like a file download endpoint. It is a render endpoint — it takes a node ID, renders the node at the requested format and scale, and returns a URL pointing to a CDN-hosted render. That URL expires. [verify — current as of writing: Figma documentation states that generated image URLs expire; the expiry window is documented in https://developers.figma.com/docs/rest-api/file-endpoints/ — verify the exact expiry period before shipping]

This distinction creates four hazards that do not exist in simpler file-download pipelines.

**Hazard 1: URLs expire.** The pipeline must download the rendered assets immediately after receiving the URLs — not cache the URLs and download later, not retry the same URL after a delay. A pipeline that stores image URLs in a file and downloads them in a separate step (or a later CI run) will find the URLs 403ing silently. The expiring URL is not a defect in the API; it is the intended behavior. The pipeline must be designed around it.

**Hazard 2: Rate limits apply to image requests.** The image endpoint is rate-limited separately from other Figma API endpoints. [verify — current as of writing] Requesting exports for 500 icons in a single call will not work. The pipeline must batch requests — grouping node IDs into chunks — and add delays between batches. If the pipeline hits a rate limit, it must back off and retry rather than failing hard.

**Hazard 3: Node IDs change on copy-paste.** A Figma node ID is stable as long as the node is not deleted and recreated. A rename does not change the ID. A move does not change the ID. A copy-paste creates a new node with a new ID. If a designer copies an icon frame to a new page (rather than moving it), the node ID changes and the asset manifest is invalid. The pipeline must detect this and log a warning rather than overwriting existing assets with renders from the wrong node.

**Hazard 4: Raw Figma SVG is not production-ready.** Figma's SVG export includes IDs, filter references, clip paths, and style attributes that are specific to Figma's rendering model. These are not harmful, but they add file size, can cause conflicts when multiple SVGs are inlined on the same page (duplicate `id` attributes), and do not follow the accessibility conventions that production SVGs should follow. Post-processing with SVGO is not optional — it is the step that transforms a Figma export into a production asset.

---

## The Asset Manifest

The manifest is the contract between the Figma file and the repository. It is a JSON file, version-controlled, that maps node IDs to repository paths, formats, and export settings.

```json
// asset-manifest.json
{
  "version": 2,
  "assets": [
    {
      "nodeId": "1:234",
      "name": "icon-close",
      "outputPath": "src/assets/icons/icon-close.svg",
      "format": "svg",
      "scale": 1,
      "svgo": true
    },
    {
      "nodeId": "1:235",
      "name": "icon-chevron-down",
      "outputPath": "src/assets/icons/icon-chevron-down.svg",
      "format": "svg",
      "scale": 1,
      "svgo": true
    },
    {
      "nodeId": "2:100",
      "name": "illustration-empty-state",
      "outputPath": "src/assets/illustrations/illustration-empty-state.svg",
      "format": "svg",
      "scale": 1,
      "svgo": false
    },
    {
      "nodeId": "3:50",
      "name": "logo-primary",
      "outputPath": "src/assets/brand/logo-primary@2x.png",
      "format": "png",
      "scale": 2,
      "svgo": false
    }
  ]
}
```

The manifest is maintained by a human (or the `figma-audit.js` from Chapter 5 in its manifest-generation mode). It is not generated by the export script. The export script reads it and trusts it. This is intentional: the decision of which nodes should be exported, in what format, to what path, is a design systems decision — not something the pipeline should infer.

The node ID is the key. It is the stable identifier that survives renames. When a designer renames an icon in Figma, the node ID does not change, the manifest does not need to be updated, and the repository path stays the same. When a designer duplicates an icon (copy-paste), the old node ID is still valid, the old asset is still in the repository, and the manifest correctly identifies the original — the copy has a different ID and is not in the manifest until someone adds it deliberately.

---

## export-assets.mjs

```javascript
// export-assets.mjs
// Usage: node export-assets.mjs [--dry-run] [--manifest asset-manifest.json]
// Requires: FIGMA_TOKEN, FIGMA_FILE_KEY in environment
// Illustrative — verify endpoint behavior and rate-limit headers before shipping

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname }                           from 'path';
import { fileURLToPath }                           from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const TOKEN      = process.env.FIGMA_TOKEN;
const FILE_KEY   = process.env.FIGMA_FILE_KEY;
const DRY_RUN    = process.argv.includes('--dry-run');
const MANIFEST   = process.argv.find(a => a.startsWith('--manifest='))?.split('=')[1]
                 ?? 'asset-manifest.json';

if (!TOKEN || !FILE_KEY) {
  console.error('[export-assets] ERROR: FIGMA_TOKEN and FIGMA_FILE_KEY are required.');
  process.exit(1);
}

const BASE = 'https://api.figma.com/v1';

// Batch size: number of node IDs per image request
// [verify — current as of writing] Figma does not publish an explicit batch limit;
// 50 is a conservative default that avoids URL-length and rate-limit issues
const BATCH_SIZE = 50;

// Delay between batches in milliseconds
const BATCH_DELAY_MS = 1000;

// Maximum retries on 429 rate-limit response
const MAX_RETRIES = 3;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function figmaGet(path, retries = 0) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Figma-Token': TOKEN }
  });

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries on ${path}`);
    }
    // [verify — current as of writing] Figma returns Retry-After header on 429
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '30', 10);
    console.warn(`[export-assets] Rate limited. Waiting ${retryAfter}s before retry ${retries + 1}/${MAX_RETRIES}...`);
    await sleep(retryAfter * 1000);
    return figmaGet(path, retries + 1);
  }

  if (!res.ok) {
    throw new Error(`Figma API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

// Request image renders for a batch of node IDs
// Returns { [nodeId]: url }
// [verify — current as of writing] GET /v1/images endpoint and response shape
async function requestImageBatch(nodeIds, format, scale) {
  const ids = nodeIds.join(',');
  const data = await figmaGet(
    `/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`
  );

  if (data.err) {
    throw new Error(`Image endpoint error: ${data.err}`);
  }

  return data.images; // { [nodeId]: url | null }
}

// Download an expiring image URL and return the buffer
// IMPORTANT: URLs expire. Download immediately after receiving.
async function downloadImage(url, name) {
  const res = await fetch(url);
  if (!res.ok) {
    // A 403 or 410 here usually means the URL has expired.
    // [verify — current as of writing] Figma CDN URL expiry behavior
    throw new Error(`Failed to download ${name}: ${res.status}. URL may have expired.`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer;
}

// Chunk an array into groups of size n
function chunk(arr, n) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += n) {
    chunks.push(arr.slice(i, i + n));
  }
  return chunks;
}

// Write a buffer to an output path, creating directories as needed
function writeAsset(outputPath, buffer) {
  const absPath = join(__dir, outputPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, buffer);
}

async function run() {
  // Read manifest
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const assets = manifest.assets ?? [];

  if (assets.length === 0) {
    console.log('[export-assets] No assets in manifest. Exiting.');
    return;
  }

  console.log(`[export-assets] Processing ${assets.length} asset(s) from manifest...`);
  if (DRY_RUN) console.log('[export-assets] DRY RUN — no files will be written.');

  // Group assets by format and scale for batching
  const groups = {};
  for (const asset of assets) {
    const key = `${asset.format}:${asset.scale}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(asset);
  }

  const results = {
    succeeded: [],
    failed:    [],
    nullRender: []
  };

  for (const [groupKey, groupAssets] of Object.entries(groups)) {
    const [format, scale] = groupKey.split(':');
    const batches = chunk(groupAssets, BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const nodeIds = batch.map(a => a.nodeId);

      console.log(`[export-assets] Requesting ${format}@${scale}x — batch ${batchIdx + 1}/${batches.length} (${batch.length} nodes)`);

      let images;
      try {
        images = await requestImageBatch(nodeIds, format, parseFloat(scale));
      } catch (err) {
        console.error(`[export-assets] FAILED batch request: ${err.message}`);
        batch.forEach(a => results.failed.push({ name: a.name, reason: err.message }));
        continue;
      }

      // Download each URL immediately
      for (const asset of batch) {
        const url = images[asset.nodeId];

        if (!url) {
          console.warn(`[export-assets] WARN: Null render for "${asset.name}" (nodeId ${asset.nodeId}). Node may have been deleted or its ID changed.`);
          results.nullRender.push(asset.name);
          continue;
        }

        try {
          console.log(`[export-assets] Downloading ${asset.name}...`);
          let buffer = await downloadImage(url, asset.name);

          // SVG post-processing
          if (format === 'svg' && asset.svgo) {
            buffer = await optimizeSvg(buffer, asset.name);
          }

          if (!DRY_RUN) {
            writeAsset(asset.outputPath, buffer);
            console.log(`[export-assets]   -> ${asset.outputPath}`);
          } else {
            console.log(`[export-assets]   [dry-run] would write ${asset.outputPath} (${buffer.length} bytes)`);
          }

          results.succeeded.push(asset.name);
        } catch (err) {
          console.error(`[export-assets] FAILED "${asset.name}": ${err.message}`);
          results.failed.push({ name: asset.name, reason: err.message });
        }
      }

      // Delay between batches to respect rate limits
      if (batchIdx < batches.length - 1) {
        await sleep(BATCH_DELAY_MS);
      }
    }
  }

  // Summary
  console.log('\n=== Export Summary ===');
  console.log(`Succeeded:   ${results.succeeded.length}`);
  console.log(`Null renders: ${results.nullRender.length}`);
  console.log(`Failed:       ${results.failed.length}`);

  if (results.nullRender.length > 0) {
    console.warn('\nNull renders (check node IDs in manifest):');
    results.nullRender.forEach(n => console.warn(`  ${n}`));
  }

  if (results.failed.length > 0) {
    console.error('\nFailures:');
    results.failed.forEach(f => console.error(`  ${f.name}: ${f.reason}`));
    process.exit(1);
  }

  // Write result log
  const log = {
    timestamp: new Date().toISOString(),
    dryRun:    DRY_RUN,
    ...results
  };
  writeFileSync('export-assets-log.json', JSON.stringify(log, null, 2));
  console.log('\nLog written to export-assets-log.json');
}

run().catch(err => {
  console.error('[export-assets] Fatal:', err.message);
  process.exit(1);
});
```

---

## SVG Post-Processing with SVGO

SVGO (SVG Optimizer) is the standard tool for removing unnecessary content from SVG files. Raw Figma SVG exports include several categories of content that production SVGs should not have:

- `id` attributes generated by Figma (e.g., `id="paint0_linear_1_234"`) that conflict with IDs from other inlined SVGs on the same page
- `<defs>` blocks with `linearGradient` and `clipPath` elements that use those generated IDs
- `data-name` and other non-standard attributes
- Unnecessary precision in numeric values (Figma exports with six decimal places)
- Empty groups and redundant transforms

Install SVGO: `npm install svgo`

```javascript
// Add to export-assets.mjs
import { optimize } from 'svgo';

// SVGO configuration for Figma SVG output
// [verify — current as of writing] SVGO 3.x config API
const SVGO_CONFIG = {
  plugins: [
    'removeDoctype',
    'removeXMLProcInst',
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'cleanupAttrs',
    'mergeStyles',
    'inlineStyles',
    'minifyStyles',
    'cleanupIds',          // removes unused IDs; caution with multi-SVG pages
    'removeUselessDefs',
    'cleanupNumericValues',
    'convertColors',
    'removeNonInheritableGroupAttrs',
    'removeUselessStrokeAndFill',
    'removeViewBox',       // CAUTION: set to false if SVGs need to be resized via CSS
    'cleanupEnableBackground',
    'removeHiddenElems',
    'removeEmptyText',
    'convertShapeToPath',
    'moveElemsAttrsToGroup',
    'moveGroupAttrsToElems',
    'collapseGroups',
    'convertPathData',
    'convertEllipseToCircle',
    'convertTransform',
    'removeEmptyAttrs',
    'removeEmptyContainers',
    'mergePaths',
    'removeUnknownsAndDefaults',
    'removeNonInheritableGroupAttrs',
    'sortAttrs',
    'sortDefsChildren',
    'removeTitle',         // CAUTION: remove only if title is not needed for accessibility
    'removeDesc'
  ]
};

async function optimizeSvg(buffer, name) {
  const svgString = buffer.toString('utf8');
  const result = optimize(svgString, { ...SVGO_CONFIG, path: name });

  if (result.error) {
    throw new Error(`SVGO error for ${name}: ${result.error}`);
  }

  // Size reduction sanity check
  const originalSize = buffer.length;
  const optimizedSize = Buffer.byteLength(result.data, 'utf8');
  const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
  console.log(`[export-assets]   SVGO: ${originalSize}b -> ${optimizedSize}b (${reduction}% smaller)`);

  return Buffer.from(result.data, 'utf8');
}
```

**Two SVGO decisions require explicit judgment.**

First: `removeViewBox`. If you set this to `true`, SVGO removes the `viewBox` attribute and replaces it with `width` and `height` attributes at the pixel dimensions of the export. SVGs without `viewBox` cannot be resized via CSS `width`/`height` without distortion. For an icon system where icons are sized via CSS, keep `viewBox` — set `removeViewBox` to `false` or remove that plugin from the config.

Second: `removeTitle`. The `<title>` element inside an SVG is the accessibility label for screen readers. If your icons are used as standalone images (not as `aria-hidden` decorative elements), removing the `<title>` breaks accessibility. If every icon use-site provides an `aria-label` on the wrapping element, removing the embedded `<title>` is acceptable. Know which pattern your component library uses before configuring this.

---

## Integrity Checks

Before writing each asset, the pipeline should verify that what it downloaded makes sense.

Add these checks to `export-assets.mjs` after the download step:

```javascript
function verifyAsset(buffer, asset) {
  const errors = [];

  // 1. Not empty
  if (buffer.length === 0) {
    errors.push('Empty render — Figma returned a zero-byte file.');
  }

  // 2. SVG content check
  if (asset.format === 'svg') {
    const content = buffer.toString('utf8');
    if (!content.trim().startsWith('<')) {
      errors.push('SVG content does not start with <. May be a JSON error response.');
    }
    if (!content.includes('<svg')) {
      errors.push('SVG content does not contain <svg> element.');
    }
  }

  // 3. PNG content check
  if (asset.format === 'png') {
    // PNG magic bytes: 89 50 4E 47
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
      errors.push('PNG content does not have PNG magic bytes. May be an error response.');
    }
  }

  return errors;
}
```

These checks catch the silent failure mode where Figma returns a valid HTTP 200 with an error payload in the body — which happens when a render times out for complex vector nodes. [verify — current as of writing] The pipeline would otherwise write an error JSON as if it were an SVG file.

---

## The GitHub Actions Workflow

```yaml
# .github/workflows/assets.yml
name: Export design assets

on:
  repository_dispatch:
    types: [figma-library-publish]
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  export-assets:
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

      - name: Export assets
        run: node export-assets.mjs
        env:
          FIGMA_TOKEN:    ${{ secrets.FIGMA_TOKEN }}
          FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}

      - name: Check for changes
        id: changes
        run: |
          git diff --quiet src/assets/ || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Open PR with updated assets
        if: steps.changes.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "chore: update design assets from Figma"
          branch: figma/asset-update
          title: "Design asset update from Figma library publish"
          body: |
            Automated asset update triggered by Figma library publish.
            
            Review the diff. Check for:
            - Node IDs that produced null renders (possible deleted or moved nodes)
            - Unexpected changes to stable assets
            - New assets not yet in the manifest
            
            This PR was opened by the asset pipeline — not a human.
          labels: design-assets, automated
```

The `Check for changes` step prevents the workflow from opening a PR when the export produces byte-for-byte identical output — which will happen on most runs if no assets have changed. A PR that says "no changes" is noise. The `git diff` step filters it out.

---

## Failure Modes

**Render timeouts on complex vectors.** Some Figma nodes — gradients with many stops, effects stacked on effects, complex masks — can take longer than Figma's render timeout to process. [verify — current as of writing] When this happens, the image endpoint returns a null URL for that node. The pipeline logs it as a null render and continues. The solution is usually to simplify the node in Figma (flatten effects, reduce gradient complexity) rather than to increase timeout values the pipeline cannot control.

**Rate limits on image endpoints.** The image endpoint has its own rate-limit tier, separate from the file endpoint. [verify — current as of writing] A design system with 500 icons and a batch size of 50 requires 10 image requests. With 1-second delays between batches, the pipeline takes at least 10 seconds on the image requests alone. This is normal. Do not remove the delays; they are what keeps the pipeline from hitting the rate limit ceiling.

**Node ID instability after file refactors.** When a designer restructures the Figma file — moving frames between pages, reorganizing component sets, rebuilding icons from scratch — node IDs can change for entire subtrees. The manifest becomes invalid for those nodes, and the pipeline produces null renders or exports the wrong assets. The fix is to regenerate the relevant entries in the manifest from the current file state. There is no automated way to detect this silently; the null renders in the export log are the signal.

**SVG output quirks.** Figma's SVG export is not always what you expect. Common surprises:

- Text nodes are exported as `<text>` elements, not as paths, unless the text is explicitly outlined in Figma. `<text>` in SVG requires font files to render correctly. Export icons with outlined text, or use the `convertShapeToPath` SVGO plugin with caution.
- Nested frames produce nested SVGs in some export configurations. Most SVGO configs handle this, but verify.
- Figma's auto-layout containers export as groups with transforms. After SVGO flattening, the transforms may produce unexpected coordinate offsets.

**Duplicate filename collisions.** If two assets in the manifest have the same `outputPath`, the second write overwrites the first silently. The manifest should be validated for duplicate output paths before the export runs. Add a check in the manifest loading step:

```javascript
const paths = assets.map(a => a.outputPath);
const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i);
if (duplicates.length > 0) {
  console.error(`[export-assets] Duplicate output paths in manifest: ${duplicates.join(', ')}`);
  process.exit(1);
}
```

---

## Decision Rules

**When to use SVG vs. PNG.** Use SVG for all icons, illustrations, and graphics that need to scale or be resized via CSS. Use PNG only for assets that have pixel-precise rendering requirements (retina photographs, complex raster compositions) or for targets that do not support SVG (older email clients, some native app contexts). For a web-first design system, SVG for icons is almost always the right answer.

**When to disable SVGO.** Disable SVGO (`"svgo": false` in the manifest) for complex illustrations where SVGO's path optimization changes the visual output. SVGO's `mergePaths` and `convertPathData` transforms are lossless in theory but can produce visible differences on complex artwork. When in doubt, run the optimized version through a visual diff tool before committing.

**When to update the manifest.** Update the manifest when a new asset is added to Figma and should flow into the repository. Update it when an asset is removed from Figma and should be removed from the repository. Update it when a node ID changes (which you will discover from null renders in the export log). Do not update the manifest automatically — it is a deliberate, human-owned document.

**When to trigger manually vs. on `LIBRARY_PUBLISH`.** Use `LIBRARY_PUBLISH` as the trigger for the steady-state pipeline. Use `workflow_dispatch` (manual trigger) for the initial setup, for recovering from manifest errors, and for dry-run validation. Do not use a scheduled trigger (nightly, hourly) as the primary mechanism — it adds unnecessary latency between the designer publishing and the repository updating, and it will run even when nothing has changed.

**When the null-render list in the export log is a blocker.** If the null-render list contains assets that are used in production (primary navigation icons, branding elements, critical UI components), treat it as a blocking failure and do not merge the PR without investigation. If the null renders are for assets that are not yet in use (designer working ahead of the product), treat them as advisory and continue.

---

## Try This

1. Build the `asset-manifest.json` for your design system. Start with five icons. Run `node export-assets.mjs --dry-run` and verify the log shows five expected writes.

2. Remove `--dry-run` and run for real. Open the downloaded SVGs in a browser and verify they render correctly. Then run the SVGO optimization and compare the file sizes.

3. Pick one of the exported SVGs and inline it on a test HTML page alongside a second copy. Verify that the two copies do not produce duplicate `id` attribute warnings in the browser console. If they do, your SVGO `cleanupIds` configuration needs adjustment.

4. Deliberately enter a wrong node ID in the manifest and run the export. Verify that the pipeline logs it as a null render and continues rather than failing hard. Verify that the export log captures the null render.

5. Add the `export-assets.mjs` step to your CI pipeline after the preflight check. Run the full pipeline with `npm run figma:preflight && npm run figma:assets`. Verify that a preflight failure prevents the asset export from running.

---

## AI Wayback Machine: The Octicons Pipeline and the Icon Font Era

Before SVG icons were practical on the web — before browser support was reliable and before inline SVG tooling existed — icon systems were delivered as icon fonts. The icon was a Unicode character mapped to a glyph in a custom font file. To update an icon, a designer modified the glyph in a font editor (Glyphs, FontForge) and the engineering team regenerated the font files and updated the CSS codepoint mapping. The workflow was manual, opaque to designers, and produced accessibility nightmares (`role="img"` on a `<span>` containing an invisible character).

GitHub's Octicons were one of the first major icon systems to migrate from icon fonts to SVG, making the migration and the resulting SVG-based pipeline public in 2016. The key decisions the Octicons pipeline made — deterministic file paths, automated optimization, a manifest that maps icon names to source files, CI-driven builds — are the same decisions the pipeline in this chapter makes, applied to the Figma API rather than to a font editor workflow. [verify — current as of writing]

The icon font era ended because SVG was simply better: resizable, colorable with CSS, accessible with `<title>` and `aria-label`, and not dependent on the browser's font rendering stack. The lesson from that transition is that the pipeline architecture — manifest, batch processing, optimization, deterministic output, CI build — survives across tool generations. The specific tool (font editor, Figma, Sketch) changes. The structure of the problem does not.

---

*The token pipeline and the asset pipeline together cover the two highest-value extraction use cases. Chapter 10 applies the same structural thinking to component documentation: reading component names, descriptions, and variant properties from the API and generating documentation artifacts that stay in sync with the file.*
