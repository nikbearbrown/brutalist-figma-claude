# Chapter 4 — Naming as an API Contract

> "A variable named `Color 3` becomes garbage at the other end. A variable named `color/brand/primary` becomes `--color-brand-primary` in CSS, `colorBrandPrimary` in Swift, and `color_brand_primary` in Android XML. The designer's naming decision is the API contract."

---

## The Production Failure

It is 2 PM on release day and the token pipeline is broken. The CSS output looks like this:

```css
:root {
  --color-3: #0066ff;
  --text-1: #1a1a1a;
  --spacing-2: 8px;
  --button-: ;
  --/brand/accent: #ff3300;
}
```

No one touched the pipeline. No one changed the transformation config. The designers renamed some variables two weeks ago — tidying up, they said — and the pipeline swallowed it silently, transformed whatever names came through, and wrote these identifiers into the generated stylesheet that your CI deployed this morning.

`--button-` is not a valid CSS custom property. `--/brand/accent` is worse. And `--color-3` is meaningless to every engineer who has to consume it. The pipeline did exactly what it was told. The names were the bug.

This is not a pipeline failure. It is a naming failure that the pipeline faithfully reproduced.

---

## What This Chapter Lets You Do

After this chapter you can:

- Define a naming convention that functions as a machine-parseable API contract, not a stylistic preference
- Map the three-tier token hierarchy — primitive, semantic, component — to concrete slash-notation examples
- Explain to a designer why their naming decision in Figma determines what ends up in Swift, Android XML, and CSS
- Write a convention enforcement function that your Chapter 5 audit will call
- Recognize the six failure modes that bad naming produces downstream

This chapter establishes the convention the audit enforces and the pipelines depend on. Chapters 5 and 6 build directly on top of it.

---

## Diagnosis: What Names Actually Are

When a designer names a Figma variable `color/brand/primary`, that string travels through several transformation stages before it reaches any consumer:

1. The Figma REST API returns it as the `name` property of a variable object [verify — current as of writing]
2. The token extractor reads that name and uses it as the token's identifier
3. Style Dictionary (or an equivalent transformer) parses the slash hierarchy into an object path: `{ color: { brand: { primary: ... } } }`
4. Platform formatters convert that path into platform-specific identifiers:
   - CSS: `--color-brand-primary`
   - Swift: `colorBrandPrimary` (lowerCamelCase)
   - Android XML: `color_brand_primary` (snake_case)
   - JavaScript/TypeScript: `color.brand.primary` (dot-chained)

Every transformation step is deterministic — it applies simple string rules. The input name is the only variable the pipeline author does not control. A name like `Color 3` produces `--color-3` in CSS. A name like `Button / hover` (with spaces around the slash) may produce `--button---hover` or fail entirely, depending on how strictly the transformer handles whitespace.

The naming decision belongs to a designer. The downstream consequence belongs to an engineer. That gap is where silent failures live.

### The Slash Convention

The design tokens ecosystem has converged on slash-separated hierarchy as the standard path separator. Style Dictionary [Source: styledictionary.com] uses it. Tokens Studio [Source: docs.tokens.studio] uses it. The W3C Design Tokens Community Group (DTCG) format [Source: tr.designtokens.org/format/] uses nested objects that map cleanly to it.

The slash hierarchy carries three pieces of information:

```
category/subcategory/name
```

- **category**: the semantic type — `color`, `spacing`, `typography`, `radius`, `shadow`, `motion`
- **subcategory**: the design role within the category — `brand`, `neutral`, `feedback`, `interactive`
- **name**: the specific decision — `primary`, `secondary`, `base`, `large`, `xs`

A full name: `color/brand/primary`. Parsed path: `color → brand → primary`. Output: `--color-brand-primary`.

That is the contract. Anyone consuming the CSS knows that this variable represents the primary brand color, without reading a comment or checking a Figma frame. The name is the documentation.

### What Bad Names Produce

Here are six naming failure modes with their downstream consequences:

**1. Enumerated names** — `Color 1`, `Color 2`, `Color 3`
CSS output: `--color-1`, `--color-2`, `--color-3`. Meaningless to every consumer. Breaks when a designer adds `Color 4` in a different position.

**2. Human-only labels** — `Brand Blue`, `Dark Gray`, `Action Green`
CSS output: `--brand-blue`, `--dark-gray`, `--action-green`. Describes appearance, not role. Breaks when brand blue becomes navy. Engineers consume by color name, not intent.

**3. Slash-with-spaces** — `Color / Brand / Primary`
Transformer behavior varies. Style Dictionary may produce `--color---brand---primary` or error. Some pipelines strip the spaces; some preserve them as hyphens. Results are unpredictable across tools.

**4. Inconsistent depth** — some tokens have two segments, others have three
`color/primary` alongside `color/brand/secondary`. The object shape is inconsistent. Consumers cannot rely on depth to infer category. Documentation scripts cannot group by tier.

**5. Platform-specific names** — `--brand-primary` (CSS variable syntax already in the Figma name)
The transformer will double-encode: `----brand-primary`. Do not include platform syntax in Figma names. Figma names are the source; the platform format is the output.

**6. Unicode, punctuation, emoji** — `🎨 Brand Primary`
Many transformers drop or error on non-ASCII characters. The pipeline often passes anyway, silently substituting empty strings or underscores.

---

## The Three-Tier Token Hierarchy

The canonical architecture for design tokens — established in practice by Nathan Curtis's systems work, Brad Frost's atomic design, and now formalized in the DTCG format — uses three tiers:

### Tier 1 — Primitive Tokens

Raw values. No semantic meaning. Every value the design system uses, named by what it is.

```
color/palette/blue-500   → #0066ff
color/palette/gray-900   → #1a1a1a
spacing/scale/4          → 4px
spacing/scale/8          → 8px
spacing/scale/16         → 16px
typography/size/14       → 14px
typography/size/16       → 16px
radius/scale/2           → 2px
radius/scale/4           → 4px
```

These are never consumed directly by product code. They are the vocabulary the semantic tier references.

### Tier 2 — Semantic Tokens

Decision tokens. Alias references into the primitive tier. Name by role, not value.

```
color/brand/primary      → {color.palette.blue-500}
color/brand/secondary    → {color.palette.gray-900}
color/interactive/default → {color.palette.blue-500}
color/interactive/hover  → {color.palette.blue-700}
color/feedback/error     → {color.palette.red-500}
spacing/layout/section   → {spacing.scale.16}
spacing/component/gap    → {spacing.scale.8}
```

These are what product code consumes. When the brand blue changes from `#0066ff` to `#0055ee`, you update one primitive. All semantic tokens that alias it update automatically.

### Tier 3 — Component Tokens

Component-scoped decisions. Alias references into the semantic tier. Scoped to a specific component.

```
color/button/background/default   → {color.interactive.default}
color/button/background/hover     → {color.interactive.hover}
color/button/label/default        → {color.neutral.white}
spacing/button/padding/horizontal → {spacing.component.gap}
radius/button/default             → {radius.scale.4}
```

Component tokens are optional. Small design systems often skip Tier 3 and have components reference semantic tokens directly. Larger systems with per-component customization requirements benefit from Tier 3 because it allows component-scoped overrides without breaking the semantic layer.

---

## The Naming Convention: Concrete Rules

This is the convention the audit in Chapter 5 enforces. Write it into a shared `naming.config.js` file in your project. Every team member, every designer, every engineer should be able to read it.

```js
// naming.config.js
// The naming contract this project's pipeline enforces.
// All Figma variable names must pass these rules before extraction runs.

export const NAMING_RULES = {
  // Segment separator
  separator: '/',

  // Allowed categories (first segment of every token name)
  categories: [
    'color',
    'spacing',
    'typography',
    'radius',
    'shadow',
    'motion',
    'opacity',
    'z-index',
  ],

  // Minimum and maximum depth (segment count)
  minDepth: 3,
  maxDepth: 4,

  // Character rules (applied to each segment individually)
  segmentPattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  // Allows: color, brand, primary, blue-500, 4xl
  // Blocks: Color (uppercase), brand primary (space), blue_500 (underscore)

  // Required tiers by depth
  tiers: {
    3: 'semantic',   // color/brand/primary
    4: 'component',  // color/button/background/default
  },
};
```

And a validation function that the audit will call:

```js
// lib/validate-name.js
// Validates a single Figma variable name against the naming contract.
// Returns an object: { valid: boolean, errors: string[] }
// Illustrative code — adapt segment rules to your naming contract.

import { NAMING_RULES } from '../naming.config.js';

export function validateTokenName(name) {
  const errors = [];
  const segments = name.split(NAMING_RULES.separator);

  // Rule 1: depth
  if (segments.length < NAMING_RULES.minDepth) {
    errors.push(
      `Too shallow: "${name}" has ${segments.length} segment(s), minimum is ${NAMING_RULES.minDepth}.`
    );
  }
  if (segments.length > NAMING_RULES.maxDepth) {
    errors.push(
      `Too deep: "${name}" has ${segments.length} segment(s), maximum is ${NAMING_RULES.maxDepth}.`
    );
  }

  // Rule 2: category
  const category = segments[0];
  if (!NAMING_RULES.categories.includes(category)) {
    errors.push(
      `Unknown category: "${category}". Allowed: ${NAMING_RULES.categories.join(', ')}.`
    );
  }

  // Rule 3: segment characters
  for (const segment of segments) {
    if (!NAMING_RULES.segmentPattern.test(segment)) {
      errors.push(
        `Invalid characters in segment "${segment}". Use lowercase letters, digits, and hyphens only.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

Run this from `package.json`:

```json
{
  "scripts": {
    "figma:validate-names": "node scripts/validate-names.js"
  }
}
```

```js
// scripts/validate-names.js
// Reads a local fixture or calls the API, checks all variable names.
// Run: npm run figma:validate-names
// Illustrative code — wire to your fixture or live API as needed.

import { readFileSync } from 'fs';
import { validateTokenName } from '../lib/validate-name.js';

const fixture = JSON.parse(readFileSync('./fixtures/variables.json', 'utf8'));
const allVariables = Object.values(fixture.meta.variables);

let errorCount = 0;

for (const variable of allVariables) {
  const result = validateTokenName(variable.name);
  if (!result.valid) {
    console.log(`\n[ERROR] ${variable.name}`);
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
    errorCount++;
  }
}

console.log(`\n${allVariables.length} variables checked. ${errorCount} with naming errors.`);
if (errorCount > 0) {
  process.exit(1); // Fail CI if any naming violations exist
}
```

This script reads the variables fixture written by `figma-read.mjs` (Chapter 3). It does not need to call the API — it validates the local snapshot. If it exits with code 1, CI stops.

---

## Component and Style Naming

Variables are not the only names the pipeline consumes. Components, styles, and layer names all become identifiers.

### Component Names

Component names in Figma become keys in the component inventory, documentation paths, Code Connect mappings, and AI agent context. Apply the same hierarchical discipline:

```
Button/Primary/Default
Button/Primary/Hover
Button/Secondary/Default
Card/Product/With-Image
Input/Text/Error
Navigation/Top/Mobile
```

The convention: `Category/Variant/State`. Capitalized, slash-separated, no spaces around slashes. This is different from token names (which use lowercase) because component names appear in Figma's layer panel and documentation as display strings. They still parse cleanly — `Button/Primary/Default` produces `button.primary.default` or `ButtonPrimaryDefault` depending on the transformer.

### Style Names

Text styles, color styles, and effect styles follow the same hierarchy. In Figma, styles are separate from variables — they are applied to layers as reusable definitions. If you are migrating from styles to variables (which Figma encourages as of 2024) [verify — current as of writing], your style names should match your variable names to make the migration path clear.

### Layer Names for Export Targets

Layers that the asset pipeline will export (Chapter 9) need stable, unique names that map to deterministic file paths. The convention:

```
icons/arrow-right
icons/check-circle
illustrations/empty-state/no-results
```

Lowercase, slash-separated. The pipeline maps these directly to repository paths: `assets/icons/arrow-right.svg`. A designer who renames the layer breaks the path. This is the most common silent failure in asset pipelines — a rename that looks cosmetic deletes the old asset and creates a new one with a new filename, orphaning every reference in the codebase.

---

## The Transformation Chain: One Example, Three Outputs

Here is what happens to a well-named variable through the full transformation chain. This is the flow Style Dictionary [Source: styledictionary.com] runs. Token transformers from other tools follow the same logic.

**Input (Figma variable name):** `color/brand/primary`
**Value:** `#0066ff`

Style Dictionary parses the slash path into a nested object:
```json
{
  "color": {
    "brand": {
      "primary": {
        "$value": "#0066ff",
        "$type": "color"
      }
    }
  }
}
```

**CSS output:**
```css
:root {
  --color-brand-primary: #0066ff;
}
```

**Swift output (iOS):**
```swift
public extension Color {
  static let colorBrandPrimary = Color(hex: "#0066ff")
}
```

**Android XML output:**
```xml
<resources>
  <color name="color_brand_primary">#0066ff</color>
</resources>
```

Three platforms. Three conventions. One source name. The transformation is deterministic — the designer's naming decision propagates exactly.

Now run the same chain on `Brand Blue`:

**CSS output:** `--brand-blue: #0066ff`
**Swift output:** `Color.brandBlue`
**Android:** `color_brand_blue`

The values are correct. The names communicate appearance, not role. Six months from now when the brand updates to navy, the name `brand-blue` is wrong, and every hardcoded reference to it in six platforms needs to be audited and updated by hand.

---

## Designer-Engineer Naming Ownership

A common failure mode is ambiguity about who owns the naming decision. The answer is clear once you understand what the name represents:

| What the name represents | Who owns it | What happens when they get it wrong |
|---|---|---|
| Semantic role (`brand/primary`) | Design + Engineering, agreed contract | Pipeline produces wrong identifiers |
| Primitive value (`palette/blue-500`) | Engineering convention | Token references break |
| Component category (`Button/Primary`) | Design + Engineering, agreed contract | Documentation and Code Connect mappings break |
| Layer export path (`icons/arrow-right`) | Engineering convention | Asset pipeline orphans files |

The practical answer: the naming contract lives in `naming.config.js` in the repository, where it is version-controlled and reviewable. Designers learn it once. Violations surface in the audit (Chapter 5). Bulk fixes come from the plugin (Chapter 6).

---

## Migrating a Messy File

If you are applying this convention to an existing file — the common case — the migration path is:

1. Run `npm run figma:validate-names` against the current fixture. Count violations.
2. Generate a rename mapping: old name → new name. Do this in a spreadsheet or script; do not rename in Figma directly yet.
3. Review the mapping with the design team. Flag any name changes that affect semantic meaning.
4. Apply bulk renames using the Plugin API fix tool from Chapter 6. Stage the rename; require approval before applying.
5. Re-run `npm run figma:validate-names`. All names should now pass.
6. Update all downstream consumers — token references, Code Connect annotations, documentation — to use the new names.

Do not rename variables without updating their consumers. A variable rename in Figma does not automatically update any alias references. An alias that pointed to `Color 3` will break silently if `Color 3` is renamed to `color/brand/primary` without updating the alias. [verify — current as of writing, alias behavior under renames]

---

## Failure Modes of the Naming Convention Itself

Even a well-specified naming convention has failure modes:

**Naming drift over time.** The convention is in a file. The file is not shown in the Figma editor. Designers adding new variables do not see it. Without the audit running in CI, violations accumulate silently. Mitigation: run `figma:validate-names` as a CI step on every PR that touches the Figma fixture.

**Category expansion without governance.** A designer adds `elevation/card/shadow` — a reasonable name, but `elevation` is not in the approved categories list. The pipeline fails. Mitigation: treat the categories list as a controlled vocabulary. Expansion requires a PR to `naming.config.js`, not a unilateral decision in Figma.

**The alias chain problem.** Semantic tokens alias primitive tokens. If a primitive is renamed without updating its aliases, every semantic token that references it resolves to an undefined value. The pipeline may still run and produce empty or fallback values — no error, wrong output. Mitigation: run alias resolution validation (covered in Chapter 8's `validate-tokens.mjs`).

**The tier collapse problem.** A designer who does not understand the three-tier hierarchy names everything as semantic tokens, creating aliases like `color/brand/primary → #0066ff` (direct value, not alias). The primitive tier disappears. Multi-mode support breaks. Mitigation: the audit checks whether semantic tokens alias primitives or hardcode values, and flags hardcoded values as warnings.

---

## Decision Rules

Use this checklist before running any pipeline. If any item fails, fix it before building on top.

- [ ] All variable names use lowercase segments, hyphens only, no spaces
- [ ] All names have exactly 3 or 4 slash-separated segments
- [ ] All first segments are in the approved categories list
- [ ] All semantic tokens alias primitive tokens (no hardcoded values in the semantic tier)
- [ ] All component tokens alias semantic tokens (no skipped tiers)
- [ ] Component names follow `Category/Variant/State` format
- [ ] Export layer names are stable, lowercase, slash-separated, and unique
- [ ] The naming config is version-controlled and referenced in the project README
- [ ] `npm run figma:validate-names` exits 0

When this checklist passes, the file's naming layer is machine-readable. When it fails, fix the names before running the token extractor, the asset pipeline, or anything downstream.

---

## AI Wayback Machine: BEM and the History of Naming as a Contract

Long before design tokens, the front-end community was already learning that names are API contracts. In 2009, Yandex engineers published the Block-Element-Modifier (BEM) methodology. The insight was identical to what design tokens formalized a decade later: if you name HTML class attributes by semantic role rather than visual appearance (`.button--primary` rather than `.blue-button`), the name survives reskinning. The class name becomes a contract between the HTML structure and the CSS rule. Change the visual representation; the contract holds.

The same lesson was learned independently in CSS architecture (OOCSS, SMACSS), in API design (semantic versioning, stable endpoint naming), and in database schema design (meaningful column names over positional indexing). Every domain that had to maintain code across time came to the same conclusion: names are not labels. They are the stable interface between the producer and every consumer that comes after.

Design tokens extended this insight from two parties (HTML and CSS) to an arbitrary number: a Figma variable consumed by CSS, iOS, Android, documentation, AI agents, and code generators simultaneously. The stakes of a bad name multiplied. The discipline required multiplied with it.

The CSS Custom Properties specification (W3C) reinforced the convention by making variable names part of the language syntax — you cannot define `var(--color-3)` and later claim it means something specific without the name itself carrying that meaning. The variable name is the only documentation that survives into the browser's computed styles inspector.

Design systems teams who internalized BEM in the 2010s had a head start when design tokens arrived. Teams who had named everything by appearance had technical debt that cost weeks of migration work. The lesson travels.

---

## Try This

**Exercise 1 — Audit your current variable names**

Export your Figma variables fixture (use `figma-read.mjs` from Chapter 3 or download from the Figma developer console). Run `scripts/validate-names.js` from this chapter against it. Count the violations. Categorize them: how many are enumerated names? Human-only labels? Slash-with-spaces?

If you have fewer than 20 violations: your naming is already in reasonable shape. Fix the violations and wire the validator into CI.

If you have more than 100 violations: do not try to fix them by hand. Document the convention first, then use the Plugin API rename tool from Chapter 6 to apply bulk fixes.

**Exercise 2 — Trace one name through the transformation chain**

Pick your most important brand color. Find its name in the Figma fixture. Run it through Style Dictionary's CLI (or write the JSON transform manually) and check the CSS, Swift, and Android outputs. Is the output name what you would want engineers to use? If not, the problem is in Figma — fix it at the source.
