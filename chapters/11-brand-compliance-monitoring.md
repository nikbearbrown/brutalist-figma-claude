# Chapter 11 — Brand Compliance Monitoring

*A programmatic report of every object in the file that deviates from brand guidelines — run on demand or on every commit.*

---

## The Failure

The release is in three days. Someone runs a last-minute visual QA pass over the marketing file. They find it: a dark-gray text on a medium-gray background. The designer used the right-looking color but picked it from the color picker instead of from the style library. The contrast ratio is 2.9:1 against a white background and 1.8:1 against the gray. Both fail WCAG AA. [WCAG 2.1 requires 4.5:1 for normal text, 3:1 for large text.] The component goes live anyway because the fix would delay the launch, and nobody is sure how many other instances of the problem exist in the file.

The answer — how many other instances exist — is exactly what `monitor-brand.mjs` answers. Run it before the release, not after. Better: run it on every commit, so the drift is caught when it is one object, not when it is eighty.

Brand compliance failures come in clusters. They are not isolated mistakes. When one designer uses a hardcoded hex color instead of a style, it usually means the style library was not set up in a way that made using it easier than not using it. When one text layer uses 13px instead of 14px (the nearest type scale step), it usually means the type scale was not clearly communicated. Compliance failures are signals about system gaps, not just individual errors. A programmatic compliance report turns those signals into a data file a team can act on.

This chapter builds `monitor-brand.mjs`: a CLI tool that walks the Figma file, checks every styleable object against declared brand rules, flags WCAG contrast failures, and writes a diffable compliance report. The same tool runs locally before a design review and in CI after a library publish, producing the same structured output both times. The diff between two runs is the compliance delta — the measure of whether the design is getting better or worse.

---

## What This Chapter Lets You Do

By the end of this chapter you can:

- Define brand compliance rules as a machine-readable configuration (approved colors, type scale, spacing grid)
- Walk a Figma file's node tree and check every object against those rules
- Detect WCAG contrast failures with correct AA and AAA thresholds for normal and large text
- Write diffable compliance reports in JSON and Markdown that CI can compare across runs
- Exit with a non-zero code when critical violations are present, blocking a PR merge or a documentation sync
- Distinguish between errors (break the pipeline or fail WCAG), warnings (deviate from brand but do not fail accessibility), and informational findings (improvement opportunities)

---

## Diagnosis: Brand Drift and Why It Is Invisible

Brand compliance degrades gradually. In a well-maintained design system, designers use styles and variables for every color, type size, and spacing value. In practice, the style library is one click further than the color picker. One exception is made under deadline pressure. Then another. Then a third designer joins the team and learns by copying existing work. By the time the compliance problem is visible to the naked eye, it is embedded in hundreds of objects across dozens of frames.

The Figma file does not mark compliant and non-compliant objects differently. There is no red border around a hardcoded hex value. Every fill looks like every other fill in the canvas. The only way to detect compliance failures systematically is to read the raw API response, which distinguishes between a fill applied via a style reference and a fill applied as an inline property.

The Figma API distinguishes these two cases in the node data [verify — current as of writing]:

- A fill applied via a color style has a `styles.fill` property on the node, referencing the style's key. The actual color value is also present for rendering, but the style reference indicates that the fill was applied from the library.
- A fill applied directly has no `styles.fill` property — only the raw `fills` array with RGBA values.

This is the detection mechanism. Any node with a fill that does not reference a style is a candidate for a compliance violation. Your brand rules then determine whether the raw RGBA value matches an approved palette entry.

The same pattern applies to text:

- A text node styled via a text style has `styles.text` referencing the style key.
- A text node with inline typography overrides has raw `style.fontSize`, `style.fontFamily`, and so on — without a style reference, or with a style reference but with overrides applied on top.

For spacing and layout: Figma Auto Layout frames expose their `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`, `itemSpacing`, and `counterAxisSpacing` as raw numeric values [verify — current as of writing]. There is no spacing style reference — Figma does not have spacing styles as a first-class object in the same way as color or text styles. Spacing compliance is therefore rule-based: check whether each padding and gap value is a member of your declared spacing scale.

---

## Defining Brand Rules

Before writing the walker, define the rules the walker checks against. The rules belong in a configuration file committed to your repository — not hardcoded in the script.

```json
// brand-rules.json
// [illustrative — populate with your actual design system values]
{
  "approvedColors": [
    { "name": "brand-primary", "hex": "#1A56DB", "rgba": [26, 86, 219, 1] },
    { "name": "brand-secondary", "hex": "#6875F5", "rgba": [104, 117, 245, 1] },
    { "name": "neutral-900", "hex": "#111928", "rgba": [17, 25, 40, 1] },
    { "name": "neutral-700", "hex": "#374151", "rgba": [55, 65, 81, 1] },
    { "name": "neutral-500", "hex": "#6B7280", "rgba": [107, 114, 128, 1] },
    { "name": "neutral-100", "hex": "#F3F4F6", "rgba": [243, 244, 246, 1] },
    { "name": "white", "hex": "#FFFFFF", "rgba": [255, 255, 255, 1] },
    { "name": "error-500", "hex": "#F05252", "rgba": [240, 82, 82, 1] },
    { "name": "success-500", "hex": "#0E9F6E", "rgba": [14, 159, 110, 1] }
  ],
  "approvedTypeSizes": [11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72],
  "approvedFontWeights": [400, 500, 600, 700],
  "approvedFontFamilies": ["Inter", "Inter Variable"],
  "spacingScale": [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96],
  "minTouchTarget": 44,
  "colorTolerance": 2,
  "wcag": {
    "normalText": { "aa": 4.5, "aaa": 7.0 },
    "largeText": { "aa": 3.0, "aaa": 4.5 },
    "largeTextThresholdPt": 18,
    "boldLargeTextThresholdPt": 14
  }
}
```

Two notes on this configuration:

**Color tolerance**: Exact RGBA matching is too strict. Screen rendering, rounding, and opacity stacking mean that `rgba(26, 86, 219, 1)` and `rgba(27, 86, 219, 1)` are visually the same color but will not match exactly. The `colorTolerance` field allows a per-channel delta before flagging a mismatch.

**WCAG thresholds**: The WCAG 2.1 standard defines contrast ratios precisely. Normal text (below 18pt regular or 14pt bold) requires 4.5:1 for AA, 7:1 for AAA. Large text (18pt or larger regular, 14pt or larger bold) requires 3:1 for AA, 4.5:1 for AAA. These are stable standards — they do not change with the API. The contrast ratio calculation itself uses the relative luminance formula defined in WCAG 2.1, which takes sRGB values, applies a linearization step, and computes luminance as a weighted sum. [verify — the APCA algorithm proposed for WCAG 3 uses a different formula; this chapter uses WCAG 2.1 contrast ratios, which remain the current normative standard as of writing.]

---

## Building `monitor-brand.mjs`

```javascript
// monitor-brand.mjs
// [illustrative — adapt brand-rules.json to your design system]

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;
const RULES_PATH = process.argv.find(a => a.startsWith('--rules='))?.split('=')[1] || 'brand-rules.json';
const OUT_DIR = process.argv.find(a => a.startsWith('--out='))?.split('=')[1] || 'brand-compliance-output';
const BASELINE = process.argv.find(a => a.startsWith('--baseline='))?.split('=')[1] || null;

if (!TOKEN || !FILE_KEY) {
  console.error('ERROR: FIGMA_TOKEN and FIGMA_FILE_KEY required.');
  process.exit(1);
}

const rules = JSON.parse(readFileSync(RULES_PATH, 'utf8'));
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

// WCAG 2.1 relative luminance
function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r, g, b) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorDistance(a, b) {
  return Math.max(
    Math.abs(a[0] - b[0]),
    Math.abs(a[1] - b[1]),
    Math.abs(a[2] - b[2])
  );
}

function isApprovedColor(rgba, tolerance) {
  const [r, g, b] = [
    Math.round(rgba.r * 255),
    Math.round(rgba.g * 255),
    Math.round(rgba.b * 255)
  ];
  return rules.approvedColors.some(ac =>
    colorDistance([r, g, b], [ac.rgba[0], ac.rgba[1], ac.rgba[2]]) <= tolerance
  );
}

function isOnSpacingScale(value) {
  return rules.spacingScale.includes(Math.round(value));
}

function isLargeText(fontSize, fontWeight) {
  return fontSize >= rules.wcag.largeTextThresholdPt ||
    (fontSize >= rules.wcag.boldLargeTextThresholdPt && fontWeight >= 700);
}

const findings = [];
let objectsChecked = 0;

function addFinding(severity, page, nodeName, nodeId, category, issue, detail) {
  findings.push({ severity, page, nodeName, nodeId, category, issue, detail });
}

function checkNode(node, pageName, parentBg) {
  objectsChecked++;
  const nodeName = node.name || 'Unnamed';
  const nodeId = node.id;

  // Check fills
  if (node.fills && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type !== 'SOLID' || fill.opacity === 0 || fill.visible === false) continue;
      const hasStyleRef = node.styles && node.styles.fill;
      if (!hasStyleRef) {
        if (!isApprovedColor(fill.color, rules.colorTolerance)) {
          addFinding('error', pageName, nodeName, nodeId, 'color',
            'hardcoded-unapproved-color',
            `Fill rgba(${Math.round(fill.color.r*255)},${Math.round(fill.color.g*255)},${Math.round(fill.color.b*255)}) not in approved palette and not applied via style`
          );
        } else {
          addFinding('warning', pageName, nodeName, nodeId, 'color',
            'hardcoded-approved-color',
            `Fill is an approved color but not applied via a color style — replace with a style reference`
          );
        }
      }
    }
  }

  // Check strokes
  if (node.strokes && Array.isArray(node.strokes)) {
    for (const stroke of node.strokes) {
      if (stroke.type !== 'SOLID' || stroke.opacity === 0 || stroke.visible === false) continue;
      const hasStyleRef = node.styles && node.styles.stroke;
      if (!hasStyleRef && !isApprovedColor(stroke.color, rules.colorTolerance)) {
        addFinding('warning', pageName, nodeName, nodeId, 'color',
          'hardcoded-stroke-color',
          `Stroke color not in approved palette`
        );
      }
    }
  }

  // Check typography
  if (node.type === 'TEXT' && node.style) {
    const s = node.style;
    const hasStyleRef = node.styles && node.styles.text;

    if (!rules.approvedTypeSizes.includes(s.fontSize)) {
      addFinding(hasStyleRef ? 'info' : 'warning', pageName, nodeName, nodeId, 'typography',
        'off-scale-font-size',
        `Font size ${s.fontSize}px is not in the approved type scale [${rules.approvedTypeSizes.join(', ')}]`
      );
    }

    if (s.fontFamily && !rules.approvedFontFamilies.includes(s.fontFamily)) {
      addFinding('error', pageName, nodeName, nodeId, 'typography',
        'unapproved-font-family',
        `Font family "${s.fontFamily}" not in approved list`
      );
    }

    if (s.fontWeight && !rules.approvedFontWeights.includes(s.fontWeight)) {
      addFinding('info', pageName, nodeName, nodeId, 'typography',
        'unapproved-font-weight',
        `Font weight ${s.fontWeight} not in approved weights`
      );
    }

    // Contrast check against parent background
    if (parentBg && node.fills && node.fills.length > 0) {
      const textFill = node.fills.find(f => f.type === 'SOLID' && f.visible !== false);
      if (textFill) {
        const textR = Math.round(textFill.color.r * 255);
        const textG = Math.round(textFill.color.g * 255);
        const textB = Math.round(textFill.color.b * 255);
        const bgR = Math.round(parentBg.r * 255);
        const bgG = Math.round(parentBg.g * 255);
        const bgB = Math.round(parentBg.b * 255);

        const textLum = relativeLuminance(textR, textG, textB);
        const bgLum = relativeLuminance(bgR, bgG, bgB);
        const ratio = contrastRatio(textLum, bgLum);
        const large = isLargeText(s.fontSize, s.fontWeight || 400);
        const threshold = large ? rules.wcag.largeText.aa : rules.wcag.normalText.aa;

        if (ratio < threshold) {
          addFinding('error', pageName, nodeName, nodeId, 'accessibility',
            'contrast-failure',
            `Contrast ratio ${ratio.toFixed(2)}:1 fails WCAG 2.1 AA (required ${threshold}:1 for ${large ? 'large' : 'normal'} text)`
          );
        }
      }
    }
  }

  // Check spacing (Auto Layout frames)
  if (node.layoutMode && (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL')) {
    for (const prop of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'itemSpacing']) {
      const val = node[prop];
      if (val !== undefined && val !== 0 && !isOnSpacingScale(val)) {
        addFinding('warning', pageName, nodeName, nodeId, 'spacing',
          'off-scale-spacing',
          `${prop}=${val} is not in the approved spacing scale [${rules.spacingScale.join(', ')}]`
        );
      }
    }
  }

  // Check touch targets for interactive components (frames with component-like names)
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    const w = node.absoluteBoundingBox?.width;
    const h = node.absoluteBoundingBox?.height;
    if (w && h && (w < rules.minTouchTarget || h < rules.minTouchTarget)) {
      addFinding('warning', pageName, nodeName, nodeId, 'accessibility',
        'small-touch-target',
        `Component bounding box ${Math.round(w)}x${Math.round(h)}px may be below minimum touch target (${rules.minTouchTarget}px)`
      );
    }
  }

  // Recurse into children, passing background color if this node has a solid fill
  let nextBg = parentBg;
  if (node.fills && node.fills.length > 0) {
    const solidFill = node.fills.find(f => f.type === 'SOLID' && f.visible !== false && f.opacity !== 0);
    if (solidFill) nextBg = solidFill.color;
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      checkNode(child, pageName, nextBg);
    }
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Fetching file...');
  const fileData = await figmaGet(`/files/${FILE_KEY}`);
  const pages = fileData.document?.children || [];

  for (const page of pages) {
    console.log(`  Checking page: ${page.name}`);
    if (page.children) {
      for (const child of page.children) {
        checkNode(child, page.name, null);
      }
    }
  }

  // Summarize
  const errors = findings.filter(f => f.severity === 'error');
  const warnings = findings.filter(f => f.severity === 'warning');
  const infos = findings.filter(f => f.severity === 'info');

  const bySeverity = {
    error: errors.length,
    warning: warnings.length,
    info: infos.length
  };

  const byCategory = {};
  for (const f of findings) {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    fileKey: FILE_KEY,
    objectsChecked,
    totalFindings: findings.length,
    bySeverity,
    byCategory,
    findings
  };

  const reportPath = join(OUT_DIR, 'compliance-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const mdReport = generateMarkdownReport(report);
  writeFileSync(join(OUT_DIR, 'compliance-report.md'), mdReport);

  // Diff against baseline if provided
  if (BASELINE) {
    try {
      const baselineData = JSON.parse(readFileSync(BASELINE, 'utf8'));
      const diff = computeDiff(baselineData, report);
      writeFileSync(join(OUT_DIR, 'compliance-diff.json'), JSON.stringify(diff, null, 2));
      writeFileSync(join(OUT_DIR, 'compliance-diff.md'), generateDiffMarkdown(diff));
      console.log(`\nDiff vs baseline: ${diff.newFindings} new findings, ${diff.resolvedFindings} resolved.`);
    } catch (e) {
      console.warn(`Could not load baseline: ${e.message}`);
    }
  }

  console.log(`\nChecked ${objectsChecked} objects. ${findings.length} findings.`);
  console.log(`Errors: ${errors.length} | Warnings: ${warnings.length} | Info: ${infos.length}`);
  console.log(`Output: ${OUT_DIR}/`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s) found — CI failing.`);
    process.exit(1);
  }
}

function computeDiff(baseline, current) {
  const baselineSet = new Set(baseline.findings.map(f =>
    `${f.nodeId}::${f.category}::${f.issue}`
  ));
  const currentSet = new Set(current.findings.map(f =>
    `${f.nodeId}::${f.category}::${f.issue}`
  ));

  const newFindings = current.findings.filter(f =>
    !baselineSet.has(`${f.nodeId}::${f.category}::${f.issue}`)
  );
  const resolvedFindings = baseline.findings.filter(f =>
    !currentSet.has(`${f.nodeId}::${f.category}::${f.issue}`)
  );

  return {
    baselineDate: baseline.generatedAt,
    currentDate: current.generatedAt,
    newFindings: newFindings.length,
    resolvedFindings: resolvedFindings.length,
    newFindingsList: newFindings,
    resolvedFindingsList: resolvedFindings
  };
}

function generateMarkdownReport(report) {
  const lines = [];
  lines.push('# Brand Compliance Report');
  lines.push(`\nGenerated: ${report.generatedAt}`);
  lines.push(`\n## Summary\n`);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Objects checked | ${report.objectsChecked} |`);
  lines.push(`| Total findings | ${report.totalFindings} |`);
  lines.push(`| Errors | ${report.bySeverity.error} |`);
  lines.push(`| Warnings | ${report.bySeverity.warning} |`);
  lines.push(`| Info | ${report.bySeverity.info} |`);

  lines.push(`\n## By Category\n`);
  for (const [cat, count] of Object.entries(report.byCategory)) {
    lines.push(`- **${cat}**: ${count}`);
  }

  const errors = report.findings.filter(f => f.severity === 'error');
  if (errors.length > 0) {
    lines.push(`\n## Errors (${errors.length})\n`);
    for (const f of errors) {
      lines.push(`### ${f.nodeName} — ${f.issue}`);
      lines.push(`- **Page:** ${f.page}`);
      lines.push(`- **Node ID:** \`${f.nodeId}\``);
      lines.push(`- **Detail:** ${f.detail}\n`);
    }
  }

  const warnings = report.findings.filter(f => f.severity === 'warning');
  if (warnings.length > 0) {
    lines.push(`\n## Warnings (${warnings.length})\n`);
    for (const f of warnings) {
      lines.push(`- **${f.nodeName}** [${f.page}] \`${f.nodeId}\`: ${f.detail}`);
    }
  }

  return lines.join('\n');
}

function generateDiffMarkdown(diff) {
  const lines = [];
  lines.push('# Compliance Diff Report');
  lines.push(`\nBaseline: ${diff.baselineDate}`);
  lines.push(`Current: ${diff.currentDate}`);
  lines.push(`\n**${diff.newFindings} new findings | ${diff.resolvedFindings} resolved**`);

  if (diff.newFindingsList.length > 0) {
    lines.push(`\n## New Findings\n`);
    for (const f of diff.newFindingsList) {
      lines.push(`- [${f.severity.toUpperCase()}] **${f.nodeName}** — ${f.issue}: ${f.detail}`);
    }
  }
  if (diff.resolvedFindingsList.length > 0) {
    lines.push(`\n## Resolved\n`);
    for (const f of diff.resolvedFindingsList) {
      lines.push(`- **${f.nodeName}** — ${f.issue}`);
    }
  }

  return lines.join('\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
```

### Running It

```bash
# First run — save as baseline
node monitor-brand.mjs --rules=brand-rules.json --out=compliance-run-1

# Second run — compare against baseline
node monitor-brand.mjs --rules=brand-rules.json --out=compliance-run-2 \
  --baseline=compliance-run-1/compliance-report.json
```

```json
{
  "scripts": {
    "brand:check": "node monitor-brand.mjs --rules=brand-rules.json --out=compliance-output",
    "brand:diff": "node monitor-brand.mjs --rules=brand-rules.json --out=compliance-output --baseline=compliance-baseline/compliance-report.json",
    "brand:baseline": "node monitor-brand.mjs --rules=brand-rules.json --out=compliance-baseline"
  }
}
```

---

## The Diff is the Point

A single compliance report is useful. A diff between two compliance reports — before and after a design sprint, before and after a library update, before and after a batch fix — is where the tool earns its keep in CI.

The `computeDiff` function identifies findings by a composite key: `nodeId + category + issue`. A finding is "resolved" when that key disappears between runs. It is "new" when it appears without having been present before. This is a coarse definition — a node can be renamed or moved and the key changes — but it is stable enough for the purpose: showing whether the file is getting cleaner or dirtier.

In a GitHub Actions workflow, the compliance diff becomes the PR check:

```yaml
# .github/workflows/brand-compliance.yml
name: Brand Compliance Check
on:
  pull_request:
  schedule:
    - cron: '0 9 * * 1'  # Weekly Monday morning

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Download baseline
        run: |
          # Restore compliance baseline from artifact storage or cache
          # [configure per your CI setup]
      - name: Run compliance check
        env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
          FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}
        run: npm run brand:diff
      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: compliance-report
          path: compliance-output/
```

The exit code from `monitor-brand.mjs` — zero on warning-only, non-zero on errors — drives the CI gate. Contrast failures are errors. Hardcoded unapproved colors are errors. Hardcoded approved colors (right color, wrong delivery) are warnings. Off-scale spacing is a warning. This severity mapping should match the team's actual risk model.

---

## WCAG Contrast: The Stakes Are Real

Contrast ratio checking gets its own section because the stakes are different from brand color compliance. A hardcoded hex color is a process violation. A failing contrast ratio is an accessibility failure that affects real users — users with low vision, users in bright outdoor environments, users on older displays.

WCAG 2.1 defines contrast as the ratio of relative luminance values, adjusted by 0.05 to avoid division by zero:

```
contrast = (L_lighter + 0.05) / (L_darker + 0.05)
```

where `L` is relative luminance computed from sRGB values:

```
L = 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB
```

with each channel linearized from sRGB gamma:

```
if channel <= 0.04045: linear = channel / 12.92
else:                  linear = ((channel + 0.055) / 1.055) ^ 2.4
```

The thresholds are:
- Normal text (below 18pt regular or 14pt bold): 4.5:1 (AA), 7:1 (AAA)
- Large text (18pt or larger regular, 14pt bold or bolder): 3:1 (AA), 4.5:1 (AAA)
- Non-text UI components (icons, borders, interactive states): 3:1 (AA)

[verify — WCAG 2.2 introduced no changes to contrast requirements; WCAG 3.0 proposes APCA, which remains a draft as of writing and is not normative for production compliance]

The checker in `monitor-brand.mjs` propagates a `parentBg` color down the node tree, using the nearest solid fill ancestor as the background against which text nodes are checked. This is a simplification: real contrast checks account for opacity stacking, blending modes, and layered fills. The checker as written will miss some failures (elements with partial opacity over complex backgrounds) and will not flag failures it cannot compute (gradient backgrounds, image backgrounds). Flag these limitations in the CI report with a note that complex backgrounds require manual review.

The non-text 3:1 threshold for UI components requires knowing which components are interactive. The script approximates this by checking components against a minimum touch target size. This is not the same as WCAG 1.4.11 (Non-text Contrast), which requires that the visual indicator of an interactive component has 3:1 contrast against adjacent colors. Correctly checking 1.4.11 requires knowing which borders, outlines, and state indicators belong to interactive elements — information that requires design intent beyond what the API exposes. Mark these checks as requiring human review.

---

## Failure Modes of the Monitor

**The node tree walker is depth-limited.** The full file fetch returns the complete document tree for files under the API's node limit, but very large files may not include all deeply nested nodes [verify — current as of writing]. If the file has deeply nested component instances, the checker may miss fills inside instances. Test by checking a known-failing instance and confirming the finding appears.

**Background color propagation is approximate.** The `parentBg` passed down the tree is the nearest ancestor's solid fill. This misses: semi-transparent fills, gradient fills, image fills, and mixed opacity. Treat contrast findings as conservative — they catch the obvious failures but are not a replacement for a dedicated accessibility audit tool that renders the file.

**The approved color list must be maintained.** Every time the design system adds a new approved color, `brand-rules.json` must be updated. If the list lags behind the design system, approved new colors will generate false-positive warnings. Assign ownership of the rules file to the design systems team and treat updates to it as requiring review.

**Style references are not verified.** The checker confirms that a fill is applied via a style reference (`styles.fill` is present), but it does not verify that the referenced style is the correct one. A designer can apply a style with the wrong color name if the style library has duplicates. The missing-description report from Chapter 10 and the audit from Chapter 5 should catch style library hygiene problems before the compliance check runs.

**The contrast checker cannot read intent.** The API does not know whether a decorative element is purely decorative (exempt from contrast requirements under WCAG 1.4.3) or whether it conveys information. All text nodes are checked. All falls through to the human reviewer to confirm which findings require remediation and which are correctly decorative.

**CI false positives erode trust.** If the compliance check flags warnings so aggressively that engineers begin ignoring it, the check has failed its purpose. Calibrate the warning threshold to your team's actual process. A design system in an early cleanup phase should treat off-scale spacing as info, not warning, and fix the compliance baseline after each sprint rather than requiring perfection before any commit.

---

## Decision Rules

**Run `monitor-brand.mjs` before**: every library publish, every major release, any design review where brand fidelity is at stake.

**Run it in CI**: on a schedule (weekly is a reasonable minimum) and on pull requests that modify Figma-sourced assets or design tokens.

**Make CI fail on**: contrast failures, unapproved font families, and hardcoded colors that are not in the approved palette. These are either accessibility failures or violations that indicate the style library is not being used.

**Make CI warn on**: hardcoded approved colors (right color, wrong delivery mechanism), off-scale spacing, and off-scale font sizes. These are process violations worth fixing but do not break accessibility.

**Make CI info on**: thin or unusual font weights, touch target sizes that are marginal, and spacing values near but not on the scale. These are improvement opportunities.

**Save a compliance baseline** after each major cleanup sprint. The diff from that baseline is the measure of progress and regression.

**Do not automate fixes**: the compliance report identifies violations; it does not fix them. Fixing requires a human in Figma, or a Plugin API script reviewed by the design team before running. The compliance report is input to that process, not the process itself.

**Treat contrast findings as genuine errors**: they affect users. A contrast failure is not a style preference. It is a usability and legal accessibility risk. Give contrast findings the same weight as a broken component in code.

---

## Try This

1. Run `monitor-brand.mjs` against your most active Figma file. Save the output as your baseline. Count the errors. Count the warnings. This is your compliance starting point.

2. Pick one page with the highest error count. Fix the errors in Figma — swap hardcoded fills for style references, adjust failing contrast pairs. Re-run the check. Compare the diff.

3. Add the tool to a GitHub Action that runs on a schedule. Configure it to post the diff as a comment on the weekly "design system health" issue or Slack thread.

4. Take the contrast check and test it against a component you know has passed a manual accessibility review. Confirm the tool agrees. Then test it against a component you know is decorative. Note the false positive — this is where the human review step matters.

5. Update `brand-rules.json` to add one new approved color from a recent design decision. Confirm that the warning disappears for that color. This tests that the rules file is the single source of truth.

---

## AI Wayback Machine — The Lint Report

Long before design files existed in a form that programs could read, code compliance was monitored by **linters**: static analysis tools that walked source code and reported deviations from a defined style or correctness standard.

The canonical early linter was `lint`, written by Stephen Johnson at Bell Labs in 1978 for C code. Its job was to detect constructs that, while syntactically valid, were likely to be mistakes: unused variables, type mismatches, pointer errors. It did not fix anything. It reported. The human decided what to do with the report.

The pattern — a tool that walks a formal artifact, checks against declared rules, and emits a structured report — is the pattern this chapter implements for Figma files. The inputs are different (a JSON node tree instead of C source), the rules are different (brand guidelines instead of type safety), but the mechanism is the same: define the rule, walk the artifact, report the deviation.

The critical insight from the lint tradition, which applies equally to design compliance monitoring, is that the value of a linter is proportional to the actionability of its output. A linter that produces five hundred warnings with no severity ranking trains engineers to ignore it. ESLint, the dominant JavaScript linter of the 2010s-2020s, succeeded in part because it distinguished fixable from non-fixable violations and allowed teams to configure rule severity to match their actual risk model. `monitor-brand.mjs` is built on the same principle: errors block, warnings inform, info items educate. The severity mapping belongs to the team, not the tool author.

The design compliance space is still in the early phase of this evolution — the phase where teams are still deciding which violations are worth failing CI over. The constraint chapter answers this for Figma: start with contrast failures and unapproved font families (genuine correctness failures), and treat everything else as configurable.

---

*Next chapter: when the consumer is not a human at all — structuring the Figma file's data as a machine-readable specification that a CLI or code generator can build from.*
