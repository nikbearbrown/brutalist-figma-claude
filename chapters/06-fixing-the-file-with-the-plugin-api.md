# Chapter 6 — Fixing the File with the Plugin API

> "The REST API reads the file. The Plugin API writes it. This is how you apply the audit findings programmatically — with a human in the loop before anything is changed."

---

## The Production Failure

The audit ran. The report has 247 naming errors. Every one of them is a variable with a name like `Color 4`, `Text Style - Large Bold`, or `Spacing / 8px`. They all need to be renamed to follow the convention from Chapter 4. You know exactly what the new names should be. You have the mapping.

You open Figma and start renaming manually. Forty-five minutes later you have fixed eleven variables and your wrist hurts. At this rate it will take a week. Worse: while you are renaming, another designer is adding new variables, and the file is changing under you.

This is exactly the situation the Plugin API was designed for. You can write a plugin that reads the audit findings, generates the rename mapping, shows you every proposed change in a preview panel, and — only after you confirm — applies all of them at once.

The dangerous word in that sentence is "confirm." Figma does not have undo for plugin writes in the way a text editor does. A bulk rename that touches 247 variables is not easily reversed. The human approval gate is not a UX nicety. It is a safety requirement.

---

## What This Chapter Lets You Do

After this chapter you can:

- Understand the Plugin API runtime: what it is, what it can do, what it cannot
- Build `figma-fix-plugin/` — a staged rename and metadata plugin that requires human approval before writing anything
- Read the audit JSON from Chapter 5 and generate a preview of proposed fixes
- Apply fixes to variables, component descriptions, and layer names in bulk
- Recognize which fixes must not be automated and why

The named CLI artifact for this chapter is `figma-fix-plugin/` — a Figma plugin directory, not a Node.js script. It runs inside the Figma editor, not the terminal. It consumes the `audit-report.json` produced by `figma-audit.js`.

---

## Diagnosis: Why REST Can Read but Not Write

The Figma REST API is read-only for file content. [verify — current REST API write capabilities; as of 2025, write operations via REST are limited to comments and specific endpoints] You can fetch the document graph, the variables, the components, the styles. You cannot rename a variable, update a component description, or change any canvas property via REST.

Write access to the canvas requires the Plugin API. This is an intentional architectural boundary. The REST API is a query interface; the Plugin API is the editor interface. Figma's reasoning is clear: writes to a file are consequential, and the editor is the appropriate context for them — where a human is present, can see the state of the file, and can stop an operation.

The Plugin API runs inside the Figma editor as a JavaScript sandbox. It has direct access to the document object model — nodes, variables, components, styles — and can modify them. When a plugin writes to a node, the change appears immediately in the canvas. Other editors of the file see the change in real time via Figma's multiplayer sync.

This is why the human approval gate matters. There is no "undo last plugin run" in Figma. There is Ctrl+Z for individual operations, but a plugin that executes 247 renames in a loop cannot be easily reversed as a batch. The only safe pattern is: preview first, approve explicitly, then apply.

---

## The Plugin API Runtime

Before writing plugin code, understand the environment it runs in. [Source: developers.figma.com/docs/plugins/api/api-reference/]

**The sandbox:**
Figma plugins run in a QuickJS WebAssembly sandbox. [verify — current runtime; Figma has used different sandboxes at different times] This means:

- ES2020+ syntax is supported in current Figma plugin builds, but confirm with the Figma plugin bundler requirements at time of development [verify]
- Browser APIs (DOM, `fetch`, `localStorage`) are not available in the plugin sandbox directly
- Network access from the sandbox requires using `figma.ui.postMessage` to communicate with the plugin UI frame, which runs in a separate browser context with full browser API access
- File system access is not available — you cannot read local files directly from the sandbox

**The two-process model:**
Plugin code runs in two environments that communicate via `postMessage`:

```
Plugin Sandbox (figma.*)     Plugin UI (iframe)
     │                              │
     │  figma.ui.postMessage()      │
     │ ────────────────────────── ► │
     │                              │
     │  parent.postMessage()        │
     │ ◄ ────────────────────────── │
```

The sandbox has access to `figma.*` — the document, nodes, variables, components. The UI iframe has access to browser APIs — fetch, DOM rendering, local storage. If your plugin needs to fetch external data (like your audit JSON), it does so from the UI iframe, then posts it to the sandbox.

**What the Plugin API can do:**
- Read and write node properties: `name`, `fills`, `strokes`, `opacity`, `visible`, `locked`, `effects`, `layoutMode`, layout constraints [verify — full writable property list in current API]
- Read and write variable names, descriptions, values, and collection structure [verify — variable write support in Plugin API]
- Read and write component descriptions and metadata
- Traverse the full document tree recursively
- Create, delete, and move nodes
- Publish changes to team libraries [verify — library publish via plugin requires specific permissions]

**What the Plugin API cannot do:**
- Operate outside the Figma editor (no CLI, no CI runner)
- Access files other than the currently open file
- Run on a schedule or respond to webhooks
- Create or delete Figma accounts or team resources

---

## Building `figma-fix-plugin/`

### Directory Structure

```
figma-fix-plugin/
├── manifest.json          — plugin metadata (name, permissions, entry points)
├── code.js                — plugin sandbox code (the figma.* operations)
├── ui.html                — plugin UI (preview panel + approval controls)
├── ui.js                  — UI logic (bundled separately or inline in ui.html)
└── README.md              — how to load and use the plugin
```

### `manifest.json`

```json
{
  "name": "Figma Fix — Audit Remediation",
  "id": "figma-fix-audit",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "permissions": ["currentuser", "activeusers"]
}
```

[verify — current manifest format and required permissions for variable write access]

### The Staged Workflow

The plugin follows a strict three-phase sequence:

```
Phase 1 — Load      : Read audit-report.json. Parse proposed fixes.
Phase 2 — Preview   : Show every proposed change. User reviews. User approves or rejects.
Phase 3 — Apply     : Apply only the approved changes. Log results. Re-render UI.
```

Phase 3 does not start until the user clicks "Apply Approved Changes." No write happens in Phase 1 or Phase 2.

### `code.js` — The Sandbox

```js
// code.js
// Plugin sandbox — has access to figma.* but not browser APIs.
// Illustrative code — adapt node traversal to your file structure.

// Show the UI panel (600 × 700 px)
figma.showUI(__html__, { width: 600, height: 700 });

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'APPLY_FIXES':
      await applyFixes(msg.fixes);
      break;
    case 'CLOSE':
      figma.closePlugin();
      break;
  }
};

// Build a map of node ID → node for variable lookups
// [verify — figma.variables API shape in current release]
async function buildVariableMap() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variableMap = new Map();

  for (const collection of collections) {
    for (const varId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) {
        variableMap.set(varId, variable);
      }
    }
  }

  return variableMap;
}

// Apply approved fixes
async function applyFixes(fixes) {
  const results = { applied: [], failed: [] };
  const variableMap = await buildVariableMap();

  for (const fix of fixes) {
    try {
      if (fix.type === 'RENAME_VARIABLE') {
        const variable = variableMap.get(fix.nodeId);
        if (!variable) {
          results.failed.push({ ...fix, reason: 'Variable not found by ID' });
          continue;
        }
        variable.name = fix.newValue;
        results.applied.push(fix);
      }

      if (fix.type === 'SET_VARIABLE_DESCRIPTION') {
        const variable = variableMap.get(fix.nodeId);
        if (!variable) {
          results.failed.push({ ...fix, reason: 'Variable not found by ID' });
          continue;
        }
        variable.description = fix.newValue;
        results.applied.push(fix);
      }

      if (fix.type === 'SET_COMPONENT_DESCRIPTION') {
        const component = await figma.getNodeByIdAsync(fix.nodeId);
        if (!component || component.type !== 'COMPONENT') {
          results.failed.push({ ...fix, reason: 'Component not found by ID' });
          continue;
        }
        component.description = fix.newValue;
        results.applied.push(fix);
      }

    } catch (err) {
      results.failed.push({ ...fix, reason: err.message });
    }
  }

  figma.ui.postMessage({ type: 'APPLY_RESULTS', results });
}
```

### `ui.html` — The Preview Panel

The UI runs in a browser iframe. It loads the audit JSON (pasted or fetched), generates the fix preview, and controls the approval flow.

```html
<!-- ui.html — Illustrative markup. Style as appropriate. -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Figma Fix</title>
  <style>
    body { font-family: monospace; font-size: 12px; margin: 0; padding: 12px; }
    .finding { border-bottom: 1px solid #ddd; padding: 8px 0; }
    .finding.error { border-left: 3px solid #e00; padding-left: 8px; }
    .finding.warning { border-left: 3px solid #f80; padding-left: 8px; }
    .approved { background: #e8f4e8; }
    .rejected { background: #f4e8e8; text-decoration: line-through; }
    #apply-btn { background: #18a0fb; color: white; border: none;
                 padding: 8px 16px; cursor: pointer; margin-top: 12px; }
    #apply-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  </style>
</head>
<body>
  <h3>Figma Fix — Audit Remediation</h3>

  <div id="load-section">
    <p>Paste the contents of <code>audit-report.json</code> below:</p>
    <textarea id="json-input" rows="6" style="width:100%;font-size:11px;"></textarea>
    <button onclick="loadAudit()">Load Audit</button>
  </div>

  <div id="preview-section" style="display:none;">
    <p id="summary"></p>
    <div id="fix-list"></div>
    <button id="approve-all-btn" onclick="approveAll()">Approve All</button>
    <button id="apply-btn" disabled onclick="applyApproved()">Apply Approved Changes</button>
  </div>

  <div id="results-section" style="display:none;">
    <h4>Results</h4>
    <div id="results-list"></div>
    <button onclick="parent.postMessage({ pluginMessage: { type: 'CLOSE' } }, '*')">Close</button>
  </div>

  <script>
    let fixes = [];

    function loadAudit() {
      try {
        const report = JSON.parse(document.getElementById('json-input').value);
        fixes = generateFixes(report.findings);
        renderPreview();
      } catch (e) {
        alert('Invalid JSON: ' + e.message);
      }
    }

    // Generate fix proposals from audit findings
    // Only auto-fixable rules generate proposals.
    // Rules that require designer judgment (e.g., semantic meaning) are excluded.
    function generateFixes(findings) {
      const autoFixableRules = ['NAME001', 'TOK002', 'COMP001'];
      return findings
        .filter(f => autoFixableRules.includes(f.ruleId))
        .map(f => ({
          id: f.nodeId,
          ruleId: f.ruleId,
          nodeName: f.nodeName,
          type: fixTypeForRule(f.ruleId),
          currentValue: f.nodeName,
          newValue: proposedValue(f),
          severity: f.severity,
          approved: null, // null = not yet decided, true = approved, false = rejected
        }))
        .filter(f => f.newValue !== null); // Exclude fixes with no proposal
    }

    function fixTypeForRule(ruleId) {
      const map = {
        'NAME001': 'RENAME_VARIABLE',
        'TOK002': 'SET_VARIABLE_DESCRIPTION',
        'COMP001': 'SET_COMPONENT_DESCRIPTION',
      };
      return map[ruleId] ?? null;
    }

    function proposedValue(finding) {
      // NAME001: generate proposed name. For illustration — real implementation
      // uses the naming convention rules to suggest a corrected name.
      // Many NAME001 findings cannot be auto-proposed (ambiguous intent).
      // Return null if no safe proposal can be made.
      if (finding.ruleId === 'NAME001') return null; // Require manual input
      if (finding.ruleId === 'TOK002') return '(no description set — add one manually in this panel)';
      if (finding.ruleId === 'COMP001') return '(no description set — add one manually in this panel)';
      return null;
    }

    function renderPreview() {
      document.getElementById('load-section').style.display = 'none';
      document.getElementById('preview-section').style.display = 'block';

      const auto = fixes.filter(f => f.newValue !== null);
      const manual = fixes.filter(f => f.newValue === null);

      document.getElementById('summary').textContent =
        `${fixes.length} fixable findings. ${auto.length} can be previewed. ${manual.length} require manual input and are excluded from bulk apply.`;

      const list = document.getElementById('fix-list');
      list.innerHTML = '';

      for (const fix of auto) {
        const div = document.createElement('div');
        div.className = `finding ${fix.severity}`;
        div.id = `fix-${fix.id}`;
        div.innerHTML = `
          <strong>${fix.ruleId}</strong> · ${fix.nodeName}<br/>
          <em>Proposed: ${fix.newValue}</em><br/>
          <button onclick="approve('${fix.id}')">Approve</button>
          <button onclick="reject('${fix.id}')">Reject</button>
        `;
        list.appendChild(div);
      }

      updateApplyButton();
    }

    function approve(id) {
      const fix = fixes.find(f => f.id === id);
      if (fix) fix.approved = true;
      document.getElementById(`fix-${id}`).className =
        `finding ${fix.severity} approved`;
      updateApplyButton();
    }

    function reject(id) {
      const fix = fixes.find(f => f.id === id);
      if (fix) fix.approved = false;
      document.getElementById(`fix-${id}`).className =
        `finding ${fix.severity} rejected`;
      updateApplyButton();
    }

    function approveAll() {
      for (const fix of fixes) {
        if (fix.newValue !== null) approve(fix.id);
      }
    }

    function updateApplyButton() {
      const approved = fixes.filter(f => f.approved === true).length;
      const btn = document.getElementById('apply-btn');
      btn.disabled = approved === 0;
      btn.textContent = `Apply ${approved} Approved Change${approved === 1 ? '' : 's'}`;
    }

    function applyApproved() {
      const approved = fixes.filter(f => f.approved === true);
      if (approved.length === 0) return;

      const confirmed = confirm(
        `You are about to apply ${approved.length} changes to this Figma file.\n\n` +
        `This cannot be batch-undone. Continue?`
      );
      if (!confirmed) return;

      parent.postMessage({ pluginMessage: { type: 'APPLY_FIXES', fixes: approved } }, '*');
    }

    // Receive results from sandbox
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;
      if (msg.type === 'APPLY_RESULTS') {
        renderResults(msg.results);
      }
    };

    function renderResults(results) {
      document.getElementById('preview-section').style.display = 'none';
      document.getElementById('results-section').style.display = 'block';
      const list = document.getElementById('results-list');
      list.innerHTML = `
        <p>${results.applied.length} applied successfully. ${results.failed.length} failed.</p>
        ${results.failed.map(f => `<p class="finding error">${f.nodeName}: ${f.reason}</p>`).join('')}
      `;
    }
  </script>
</body>
</html>
```

---

## Loading the Plugin into Figma

To run `figma-fix-plugin/` during development: [verify — current plugin development load flow]

1. Open Figma desktop application (the plugin sandbox requires the desktop app, not the browser)
2. Menu → Plugins → Development → Import plugin from manifest
3. Navigate to `figma-fix-plugin/manifest.json`
4. Run: Menu → Plugins → Development → Figma Fix

For team distribution, publish the plugin to your organization's private plugin library through the Figma admin panel. [verify — organization plugin publishing flow]

---

## What to Never Automate

The plugin should auto-apply only structural fixes: naming normalization, description text, layer name corrections. It must not auto-apply decisions that require design judgment.

**Never automate:**

- **Alias target changes.** If a semantic token aliases the wrong primitive, the correct alias requires understanding what the token is supposed to represent. A script cannot know this.
- **Value changes.** Changing a color value, spacing value, or typography value is a design decision. The audit can flag it; the fix requires a designer.
- **Component restructuring.** Merging two similar components, adding or removing variants, changing the component API — these require design and engineering alignment.
- **Mode value corrections.** If the dark-mode value of a token is wrong, fixing it requires knowing what the correct dark-mode value is. The audit can flag that a value looks inconsistent; it cannot propose the correct one.
- **Deleting variables or components.** Deletion is irreversible. Even if the audit identifies orphaned or unused variables, the cleanup should be manual. What looks unused to a static analysis may have runtime uses the API does not see.

The rule: automate what is deterministic from the naming convention. Ask a human for everything else.

---

## The Backup Pattern

Before running any bulk fix, export a version history checkpoint. Figma's built-in version history (Version History panel, available on Professional plan and above) [verify — current plan requirements for version history] is your primary backup. Create a named version before running the plugin:

In Figma: File menu → Save to Version History → add a note like "Pre-audit-fix 2026-06-01".

If your plan does not support version history: export the file as `.fig` before running the plugin. Menu → File → Save local copy. This is a manual export, not a live backup, but it gives you a restore point.

For teams running this in a structured workflow, wire a pre-fix REST API call to the `/v1/files/:key/versions` endpoint to programmatically capture a version snapshot before the plugin runs. [verify — whether REST API supports creating version history snapshots]

---

## The Approval Log

After the plugin applies fixes, emit an approval log — a JSON record of what was changed, by whom, and when. This log is the audit trail.

```js
// In code.js, after applyFixes completes, post the log to the UI:
figma.ui.postMessage({
  type: 'APPLY_RESULTS',
  results,
  log: {
    appliedAt: new Date().toISOString(),
    appliedBy: figma.currentUser?.name ?? 'unknown', // [verify — currentUser property]
    fileKey: figma.fileKey ?? 'unknown', // [verify — figma.fileKey availability]
    changeCount: results.applied.length,
  }
});
```

The UI should offer to download this log as JSON. Store it alongside your audit reports in `./reports/fix-log-<date>.json`. When someone asks "who renamed `Color 3` to `color/palette/blue-500`?" — the log has the answer.

---

## Failure Modes of the Fix Plugin

**The rename-breaks-alias problem.** When you rename a variable in Figma, alias references to that variable update automatically within the same file. [verify — current behavior; this is documented behavior but verify it is not plan-gated] Aliases from other files (library consumers) may not update immediately. [verify — cross-file alias update behavior on rename] Test with a non-critical variable first before running a bulk rename.

**The ID mismatch problem.** The audit report captures node IDs at the time the fixture was created. If the file was modified between fixture creation and plugin execution, some node IDs may have changed or been deleted. The plugin handles this with the `Variable not found by ID` error in the `failed` results. After a bulk fix, re-run the audit against a fresh fixture to verify.

**The sandbox memory limit.** A plugin processing thousands of nodes in a loop can hit the QuickJS sandbox memory limit. [verify — current memory limits for Figma plugin sandbox] Symptom: the plugin freezes or crashes without an error message. Mitigation: process fixes in batches of 50 and yield between batches using `await new Promise(r => setTimeout(r, 0))`.

**The multiplayer collision.** If another editor has the file open during the plugin run, their concurrent edits and the plugin's writes may interleave. Figma's CRDT-based multiplayer generally handles this safely, but the audit findings were generated before their edits — the fix proposals may be stale. Mitigation: announce "running fix plugin" in your team channel and ask others to close the file for five minutes.

**The description-overwrites-existing problem.** The `SET_COMPONENT_DESCRIPTION` fix sets a description on components that have none. If a component already has a description (however thin), the plugin preview shows the existing description alongside the proposed one, and the user must decide whether to overwrite. The current implementation above does not handle this — it needs a comparison between the current description and the proposed value before displaying the preview item.

---

## Decision Rules

Before running the plugin:
- [ ] Version history snapshot created in Figma (or `.fig` export saved locally)
- [ ] Audit report JSON is recent (generated from a fixture no more than 24 hours old)
- [ ] Other editors notified and not actively working in the file
- [ ] All proposed changes reviewed in the preview panel — no "approve all" without reading

During the plugin run:
- [ ] Approve only naming and description fixes
- [ ] Reject any proposal that touches semantic meaning or design values
- [ ] Stop if more than 10% of fixes fail (signals an ID mismatch — re-audit before continuing)

After the plugin run:
- [ ] Fix log downloaded and saved to `./reports/`
- [ ] Figma fixture updated: re-run `figma-read.mjs` to pull the corrected file state
- [ ] Audit re-run against the new fixture: all previously-fixed errors should be gone
- [ ] Alias chain validation run: `npm run figma:validate-names` exits 0

---

## AI Wayback Machine: Refactoring Tools and the Human Approval Gate

The staged fix pattern — preview, approve, apply — has deep roots in software engineering. The refactoring tools in the early 2000s JetBrains IDEs (IntelliJ IDEA, later ReSharper for .NET) made this pattern standard. "Rename this method" would show you every call site, in every file, before making a single change. You confirmed. Only then did the rename propagate.

The reason was not technical caution. It was recognition that a rename is a semantic act, not a mechanical one. Renaming `getUserId()` to `getCustomerId()` is a statement about the conceptual model. A tool that does it without showing you the consequences is making that statement on your behalf, invisibly.

The same reasoning applies to bulk Figma renames. Renaming `Color 3` to `color/palette/blue-500` is not just a string substitution. It is asserting that this particular shade of blue belongs in the primitive palette at the 500 scale. That assertion might be correct. It might also be wrong — the color might actually be a one-off used only in a deprecated component. The tool cannot know. You can.

Database migration tooling added the irreversibility constraint. Flyway and Liquibase enforce that migrations are forward-only: once you have applied a schema change, you cannot un-apply it; you can only apply a new migration that reverses it. The changelog is the audit trail. The Figma fix plugin inherits this discipline: the log is the migration record; fixing a bad fix requires running the plugin again with the corrected proposal, not silently undoing.

The NIST AI Risk Management Framework (AI RMF) [Source: research-ch-06, NIST AI Risk Management Framework] formalized the principle as "human oversight for consequential decisions." In the design system context: the pipeline can run automatically; the canvas modification cannot. The boundary between them is the approval gate.

---

## Try This

**Exercise 1 — Build and load the plugin**

Clone the `figma-fix-plugin/` directory from this chapter into a local folder. Load it into Figma Desktop via Plugins → Development → Import plugin from manifest. Open a test Figma file (not your production file). Run the plugin and paste a minimal audit JSON with two or three manufactured findings. Verify that the preview panel renders, approve one fix, reject another, and apply. Verify the change appears in the Figma canvas.

**Exercise 2 — Connect audit to fix**

Run `figma-audit.js` against your real design system fixture. Count the `NAME001` findings. Manually write the rename mapping for five of them (old name → new name). Add those five as fix proposals to the plugin (by modifying `proposedValue()` to return the correct new name for those specific ruleIds). Run the full staged workflow: load, preview, approve, apply. Re-run `figma-audit.js` against a fresh fixture. Verify those five findings no longer appear.
