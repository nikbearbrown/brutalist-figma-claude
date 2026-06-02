# Chapter 6 — Fixing the File with the Plugin API

*The audit tells you what is wrong. The plugin is the only tool that can fix it — and why the human in the loop is not optional.*

---

Forty-five minutes. Eleven variables. Your wrist is starting to complain, and the audit report has 247 items on it.

This is not a time-management problem. It is an architectural one. The Figma REST API — the same API that produced the audit report in Chapter 5 — is read-only for canvas content. You can read every node, every variable, every component description. You cannot change any of them through REST. Write access to the canvas belongs exclusively to the Plugin API: the JavaScript environment that runs inside the Figma editor itself.

That boundary is intentional. Understanding why it exists is the first thing this chapter has to explain, because the design of the fix tool follows directly from it.

<!-- → [FIGURE: Diagram showing the architectural split between REST API (read-only, runs outside Figma) and Plugin API (read/write, runs inside Figma editor) — with arrows showing which operations each enables and where the human approval gate sits] -->

---

## Why REST Can Read but Not Write

The Figma REST API is a query interface. It answers questions about a file's current state. The Plugin API is the editor interface — it operates on the file with the full authority of the editor itself, meaning changes appear immediately on the canvas and propagate to every other editor in the file via Figma's multiplayer sync. [verify — current REST API write capabilities; as of writing, write operations via REST are limited to comments and a small number of specific endpoints]

Figma drew this line deliberately. When a script modifies a file through the REST API, nothing about the execution context ensures a human is present or paying attention. When a plugin runs inside the Figma editor, the editor is open, the file is visible, and a human made a deliberate choice to run the plugin. Writes belong in the context where the consequences are visible.

This reasoning has a practical implication that the plugin in this chapter takes seriously: Figma does not provide batch undo for plugin operations. You can Ctrl+Z individual operations after a plugin run, but if a plugin renames 247 variables in a loop, you cannot reverse that as a unit. The only safe pattern is: preview every proposed change, require explicit human approval, then apply.

The dangerous word in "apply all" is "all." This chapter builds a plugin that treats it with the caution it deserves.

---

## The Plugin API Runtime

The Plugin API runs in a QuickJS WebAssembly sandbox inside the Figma desktop application. [verify — current runtime; Figma has used different sandboxes at different points in its history] The desktop app is required — the plugin sandbox is not available in the browser editor.

What this sandbox can do: read and write node properties (`name`, `fills`, `strokes`, `opacity`, `visible`, `locked`, `effects`, layout constraints); read and write variable names, descriptions, values, and collection structure; read and write component descriptions; traverse the full document tree; create, delete, and move nodes. [verify — full writable property list and variable write support in current Plugin API release]

What this sandbox cannot do: access browser APIs directly. There is no `fetch`, no `localStorage`, no DOM. The sandbox can only access the Figma document model through `figma.*`.

This creates the two-process model that every non-trivial Figma plugin uses. Plugin code splits into two environments that communicate via `postMessage`:

```
Plugin Sandbox (figma.*)          Plugin UI (iframe)
        │                                │
        │  figma.ui.postMessage() ────► │  (browser APIs available here)
        │                                │
        │ ◄──── parent.postMessage()     │
```

The sandbox has `figma.*`. The UI iframe has the browser. If the plugin needs to load external data — like the audit JSON from Chapter 5 — it fetches that data in the UI iframe and posts it to the sandbox. The sandbox applies the changes and posts results back to the UI for display.

<!-- → [FIGURE: Two-process plugin architecture diagram — sandbox with figma.* on the left, UI iframe with browser APIs on the right, postMessage channel in the middle — annotated with which operations happen where] -->

This split is not a quirk to work around. It is the plugin model. The approach taken here is to do everything we can in the UI iframe — loading and parsing the audit JSON, generating fix proposals, rendering the preview, managing approval state — and to send only the final approved change list to the sandbox for execution.

---

## The Staged Workflow

The fix plugin follows a strict three-phase sequence. No write happens until Phase 3, and Phase 3 requires explicit human confirmation.

**Phase 1 — Load:** The user pastes the `audit-report.json` produced by `figma-audit.js`. The UI parses it and generates fix proposals for every finding that can be automatically addressed. Findings that require design judgment are excluded — flagged for manual review, not proposed for automation.

**Phase 2 — Preview:** Every proposed fix is displayed with its current value, its proposed new value, and its rule ID and severity from the audit. The user can approve or reject each fix individually. Nothing changes in the Figma file during this phase.

**Phase 3 — Apply:** The user clicks "Apply Approved Changes." A confirmation dialog appears showing the count. After confirmation, only the approved fixes are sent to the sandbox for execution. Results — successes and failures — are reported back to the UI.

Phase 2 is not a courtesy. It is where the human exercises judgment that the tool cannot substitute for. A variable named `Color 4` needs a human to determine that it should become `color/primitive/blue-500` rather than `color/palette/brand-primary` — those are different semantic claims, and the naming convention rules alone cannot make the distinction. Phase 2 is where that decision happens.

---

## `figma-fix-plugin/`

The named artifact for this chapter is a plugin directory, not a Node.js script. It runs inside the Figma editor.

```
figma-fix-plugin/
├── manifest.json
├── code.js
├── ui.html
└── README.md
```

### manifest.json

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

### code.js — The Sandbox

```javascript
// code.js
// Plugin sandbox — accesses figma.* but not browser APIs.
// Illustrative — adapt to your file structure.

figma.showUI(__html__, { width: 600, height: 700 });

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

async function buildVariableMap() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variableMap = new Map();
  for (const collection of collections) {
    for (const varId of collection.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable) variableMap.set(varId, variable);
    }
  }
  return variableMap;
}

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

  figma.ui.postMessage({
    type: 'APPLY_RESULTS',
    results,
    log: {
      appliedAt: new Date().toISOString(),
      appliedBy: figma.currentUser?.name ?? 'unknown', // [verify — currentUser property]
      fileKey: figma.fileKey ?? 'unknown',             // [verify — figma.fileKey availability]
      changeCount: results.applied.length,
    }
  });
}
```

### ui.html — The Preview Panel

```html
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
    <button onclick="approveAll()">Approve All</button>
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

    // Only rules that are deterministically fixable from structure — no design judgment required.
    const AUTO_FIXABLE_RULES = ['TOK002', 'COMP001'];

    function generateFixes(findings) {
      return findings
        .filter(f => AUTO_FIXABLE_RULES.includes(f.ruleId))
        .map(f => ({
          id: f.nodeId,
          ruleId: f.ruleId,
          nodeName: f.nodeName,
          type: fixTypeForRule(f.ruleId),
          currentValue: f.nodeName,
          newValue: proposedValue(f),
          severity: f.severity,
          approved: null,
        }))
        .filter(f => f.newValue !== null);
    }

    function fixTypeForRule(ruleId) {
      return { 'TOK002': 'SET_VARIABLE_DESCRIPTION', 'COMP001': 'SET_COMPONENT_DESCRIPTION' }[ruleId] ?? null;
    }

    function proposedValue(finding) {
      // Description rules: flag that a description is needed but require manual input.
      // NAME001 (rename) is never auto-proposed — the correct name requires design judgment.
      if (finding.ruleId === 'TOK002') return '(no description — add one in this panel before approving)';
      if (finding.ruleId === 'COMP001') return '(no description — add one in this panel before approving)';
      return null;
    }

    function renderPreview() {
      document.getElementById('load-section').style.display = 'none';
      document.getElementById('preview-section').style.display = 'block';

      document.getElementById('summary').textContent =
        `${fixes.length} auto-fixable findings. NAME001 (rename) findings excluded — require manual input.`;

      const list = document.getElementById('fix-list');
      list.innerHTML = '';
      for (const fix of fixes) {
        const div = document.createElement('div');
        div.className = `finding ${fix.severity}`;
        div.id = `fix-${fix.id}`;
        div.innerHTML = `
          <strong>${fix.ruleId}</strong> · ${fix.nodeName}<br/>
          <em>${fix.newValue}</em><br/>
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
      document.getElementById(`fix-${id}`).className = `finding ${fix.severity} approved`;
      updateApplyButton();
    }

    function reject(id) {
      const fix = fixes.find(f => f.id === id);
      if (fix) fix.approved = false;
      document.getElementById(`fix-${id}`).className = `finding ${fix.severity} rejected`;
      updateApplyButton();
    }

    function approveAll() { for (const fix of fixes) approve(fix.id); }

    function updateApplyButton() {
      const count = fixes.filter(f => f.approved === true).length;
      const btn = document.getElementById('apply-btn');
      btn.disabled = count === 0;
      btn.textContent = `Apply ${count} Approved Change${count === 1 ? '' : 's'}`;
    }

    function applyApproved() {
      const approved = fixes.filter(f => f.approved === true);
      if (!approved.length) return;
      const confirmed = confirm(
        `You are about to apply ${approved.length} changes to this Figma file.\n\nThis cannot be batch-undone. Continue?`
      );
      if (!confirmed) return;
      parent.postMessage({ pluginMessage: { type: 'APPLY_FIXES', fixes: approved } }, '*');
    }

    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;
      if (msg.type === 'APPLY_RESULTS') renderResults(msg.results);
    };

    function renderResults(results) {
      document.getElementById('preview-section').style.display = 'none';
      document.getElementById('results-section').style.display = 'block';
      document.getElementById('results-list').innerHTML = `
        <p>${results.applied.length} applied. ${results.failed.length} failed.</p>
        ${results.failed.map(f => `<p class="finding error">${f.nodeName}: ${f.reason}</p>`).join('')}
      `;
    }
  </script>
</body>
</html>
```

---

## Loading the Plugin

During development: open Figma Desktop, go to Plugins → Development → Import plugin from manifest, navigate to `figma-fix-plugin/manifest.json`. Run it from Plugins → Development → Figma Fix. [verify — current plugin development load flow]

For team distribution, publish to your organization's private plugin library through the Figma admin panel. [verify — organization plugin publishing flow]

The desktop application is required. The plugin sandbox is not available in the browser-based Figma editor.

<!-- → [INFOGRAPHIC: Step-by-step plugin loading flow — numbered steps from manifest import through plugin execution, with callouts for "development only" vs "production distribution" paths] -->

---

## What the Approval Gate Is For

The approval gate is not a UX nicety. It is where two things happen that the tool cannot substitute for.

The first is judgment about semantic meaning. The audit can tell you that a variable is named `Color 4`, which violates the naming convention from Chapter 4. It cannot tell you whether `Color 4` should become `color/primitive/blue-500` or `color/semantic/action-primary` — those are different claims about what the color means in the design system. One of them may be correct. Only someone who understands the design system knows which one.

The second is awareness of consequences. When you rename a variable in Figma, alias references to that variable within the same file update automatically. [verify — current alias update behavior on rename] Aliases from other library consumer files may not update immediately. [verify — cross-file alias update behavior on rename] The person approving the rename needs to know whether this variable is referenced by other files and whether those consumers are prepared for the change. The tool has no visibility into that.

The `generateFixes` function above deliberately excludes `NAME001` (naming violations) from auto-proposals. This is the right call. Naming errors are the most common finding, but they are the ones that most require judgment. The plugin surfaces them in the audit summary and tells you how many there are. It does not propose specific new names, because it has no basis for choosing.

<!-- → [TABLE: Fix types by rule ID — columns: rule ID, what it flags, whether auto-fixable, why or why not — covering NAME001, TOK002, COMP001, and rules that require design judgment (alias targets, value changes, component restructuring)] -->

---

## What to Never Automate

Structural fixes — description text, a description where there was none — are safe to automate because the only question is "does this field have content?" The answer is deterministic.

The following are not safe to automate, regardless of how confident the audit findings look:

**Alias target changes.** If a semantic token aliases the wrong primitive, the correct alias requires understanding what the token is supposed to represent. A script cannot know this.

**Value changes.** Changing a color value, a spacing value, a typography scale — these are design decisions. The audit can flag that a value looks inconsistent with its peer variables; it cannot propose the correct value.

**Component restructuring.** Merging similar components, adding or removing variants, changing a component's API surface — these require design and engineering alignment that cannot be captured in a JSON rule.

**Deletions.** What looks unused to a static analysis may have runtime uses the REST API does not see. Deletion is irreversible. Cleanup should always be manual.

The rule is: automate what is deterministic from structure and naming convention alone. Ask a human for everything else. When in doubt, put it in the preview and let the human reject it, rather than silently excluding it.

---

## The Backup Pattern

Before any bulk fix run, create a version history checkpoint in Figma. File menu → Save to Version History → add a note like "Pre-audit-fix 2026-06-01." [verify — current plan requirements for version history access]

If your plan does not include version history: File → Save local copy to export the file as `.fig`. This is a manual snapshot, not a live backup, but it is a restore point.

For teams with this in a structured workflow, a pre-fix call to the Figma REST API `/v1/files/:key/versions` endpoint can capture a programmatic version snapshot before the plugin runs. [verify — whether REST API supports creating version history snapshots]

The log that `code.js` emits after a successful apply run — `appliedAt`, `appliedBy`, `fileKey`, `changeCount` — should be saved to `./reports/fix-log-<date>.json` alongside the audit reports from Chapter 5. When someone asks who renamed `Color 3` to `color/palette/blue-500` and when, the log has the answer. This is not nice to have. It is the paper trail that makes bulk automation auditable by the people who are responsible for the design system.

---

## Failure Modes

Understanding how this plugin fails is as important as understanding how it works.

<!-- → [TABLE: Failure modes reference — columns: failure mode, symptom, mitigation — covering ID mismatch, sandbox memory limit, multiplayer collision, alias propagation lag — one row per failure mode with specific diagnostic signals and concrete mitigations] -->

**The ID mismatch.** The audit report captures node IDs at the time the fixture was created. If the file was modified between fixture creation and plugin execution, some IDs may have changed or been deleted. The `Variable not found by ID` error in the `failed` results is the signal. If more than 10% of proposed fixes report this error, stop the run — re-audit against a fresh fixture before continuing.

**The sandbox memory limit.** A plugin processing thousands of nodes in a loop can hit the QuickJS memory ceiling. [verify — current memory limits for the Figma plugin sandbox] The symptom is the plugin freezing or crashing without an error message. The mitigation is to process fixes in batches of 50, yielding between batches:

```javascript
for (let i = 0; i < fixes.length; i += 50) {
  const batch = fixes.slice(i, i + 50);
  await processBatch(batch);
  await new Promise(r => setTimeout(r, 0)); // yield to event loop
}
```

**The multiplayer collision.** If another editor has the file open during the plugin run, their concurrent edits and the plugin's writes may interleave. Figma's multiplayer generally handles this safely at the data level, but the audit findings were generated before their edits — fix proposals may be stale. The mitigation is social, not technical: announce "running fix plugin" in your team channel and ask for five minutes of clear ownership.

**The alias propagation lag.** After a bulk variable rename, aliases in other library consumer files may take time to resolve to the new names. [verify — current cross-file alias update behavior on rename] Do not run the plugin and immediately check consumer files expecting everything to be updated. Give Figma's sync infrastructure time to propagate the changes, then validate.

---

## The AI Wayback Machine: Refactoring Tools and the Approval Gate

The preview-approve-apply pattern did not originate in design tooling. It is the standard pattern for IDE refactoring tools — established in the early JetBrains IDEs (IntelliJ IDEA, ReSharper for .NET) during the early 2000s. "Rename this method" would enumerate every call site in every file before making a single change. You confirmed the list. Only then did the rename propagate.

The reason was not caution for its own sake. It was recognition that a rename is a semantic act. Renaming `getUserId()` to `getCustomerId()` is a statement about the conceptual model — these are different entities, and the method's purpose has changed. A tool that does it without showing you the consequences is making that assertion on your behalf, invisibly. The preview panel makes the assertion visible and gives it back to you.

Database migration tooling added the irreversibility constraint. Flyway and Liquibase enforce that migrations are forward-only: once you apply a schema change, you do not undo it — you write a new migration that reverses it. The changelog is the migration record. The Figma fix plugin inherits the same discipline: the approval log is the change record; fixing a bad fix means running the plugin again with the corrected proposal, not silently rolling back.

The NIST AI Risk Management Framework formalized the underlying principle as "human oversight for consequential decisions." [Source: NIST AI Risk Management Framework] In design system terms: the audit pipeline runs automatically; the canvas modification does not. The boundary between them is the approval gate — not because the software cannot cross it, but because the software lacks the context to cross it safely.

---

## What Comes Next

The plugin gives you the write path. The audit gives you the findings. What you do not yet have is a way to run this loop continuously — not as a one-time remediation effort, but as an ongoing check that fires whenever the file changes. Chapter 7 covers webhooks and event-driven automation: how Figma notifies external systems when a file is updated, and how to use those notifications to trigger the audit pipeline automatically so that the 247 errors never accumulate in the first place.

---

## LLM Exercises

**Exercise 1 — Generate and examine.**
Paste the `applyFixes` function from `code.js` into a conversation with an LLM. Ask it to walk through what happens when `fix.type` is `RENAME_VARIABLE` and `variableMap.get(fix.nodeId)` returns `undefined`. Ask: what would the function do if the `if (!variable)` guard was absent? What class of runtime error would result, and would it be caught by the outer `try/catch`? Ask the LLM to propose a version of the function that logs a structured warning for each skipped fix rather than pushing to `results.failed`.

**Exercise 2 — Apply to known context.**
Take the approval log format from this chapter — `appliedAt`, `appliedBy`, `fileKey`, `changeCount`. Ask an LLM to extend the log schema to also capture, per individual fix: the rule ID, the old value, and the new value. Then ask it to write a short Node.js script that reads a directory of fix log files and produces a summary: total changes applied across all runs, broken down by rule ID. Run the script against two or three fabricated log files to verify it works.

**Exercise 3 — Stress-test a specific claim.**
The chapter claims that `NAME001` findings should never be auto-proposed — that the correct name always requires design judgment. Ask an LLM to argue the opposite: under what conditions could a tool safely auto-propose a rename for a naming violation? What information would the tool need to have, and what constraints would need to hold, for the proposal to be reliably correct? Evaluate the argument against the actual naming violations in your own design system (or a plausible fabricated example).

**Exercise 4 — Draft a professional deliverable.**
You have just run the fix plugin on your team's design system file and applied 89 approved changes. Write a brief message to your design and engineering teams explaining: what was fixed, how the process worked, what was excluded and why, and what they should do if they notice something has changed unexpectedly. Ask an LLM to draft the first version, then revise it to match the communication norms of your team.
