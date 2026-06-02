# Chapter 2 — What the API Actually Exposes

*The API does not export your design. It exposes a document graph. Understanding the difference is the prerequisite for everything else.*

---

## What This Chapter Lets You Do

After this chapter you can: identify which of Figma's five API surfaces is right for a given task; set up the environment variables for any Figma CLI tool; recognize the plan and permission gates before you hit them; and run `figma-ping.js` to confirm that your token, your file key, your plan access, and your rate-limit headroom are all valid before you write any downstream code.

This chapter introduces the first named CLI artifact: `figma-ping.js`.

---

## The Failure

It is 11 AM on a Tuesday. You have just landed a contract to build the token extraction pipeline for a client's design system. The Figma file key is in the project brief. You have your Personal Access Token. You write your first script — ten lines of Node.js, fetch the file endpoint, print the response. You run it.

```
HTTP 403 Forbidden
{"status":403,"err":"Invalid token"}
```

You double-check the token. It looks right. You try the endpoint in curl. Same result. You spend thirty minutes rotating the token, reading the authentication docs, wondering if the API is down. Then you notice: the token is a Personal Access Token for your personal account. The Figma file belongs to the client's organization. Your account has not been added to that organization's workspace.

Alternatively: the token is correct. The file key is correct. The response is a nested JSON object with three thousand lines. You start trying to extract token variables. Nothing is in the response. You read more carefully: the `variables` field is not there. You search the docs. You find it: the Variables API [verify — current as of writing] requires an Enterprise plan. The client is on Professional. You now need a different approach.

Both of these failures have the same cause: not understanding the API surface before using it. This chapter prevents them.

---

## Diagnosis: The Five API Surfaces

Figma is not a single API. It is five overlapping programmatic surfaces, each with different permissions, plan requirements, rate limits, and read/write capabilities. Confusing them is the most common source of early-stage pipeline failures.

### Surface 1 — The REST API

**What it is:** A conventional HTTP API with a base URL of `https://api.figma.com` [verify — current as of writing]. Authenticated with a token in the request header. Returns JSON.

**What it exposes:**
- File graph (`GET /v1/files/:key`) — the full document node tree
- Node subsets (`GET /v1/files/:key/nodes`) — a subset of nodes by ID
- Images (`GET /v1/images/:key`) — rendered images or SVG/PDF exports of specific nodes
- Image fills (`GET /v1/files/:key/images`) — resolved URLs for embedded image fills
- Comments (`GET /v1/files/:key/comments`)
- Components and styles (`GET /v1/files/:key/components`, `GET /v1/files/:key/styles`)
- Variables (`GET /v1/files/:key/variables/local`) [verify — Enterprise plan gate]
- Team components and styles

**What it does not expose:**
- Prototype interactions and flow logic
- Presentation/animation timings
- Font files (Figma does not distribute fonts via API)
- Plugin-private data
- Write operations (reads only)

**Read/write:** Read only. The REST API is a query interface.

**Auth:** Personal Access Tokens (PATs) or OAuth 2.0 tokens. [verify — current as of writing]

**Rate limits:** Plan-dependent and resource-dependent. The documentation states that rate limits apply per token and can vary by endpoint. [verify — current limits documented at https://developers.figma.com/docs/rest-api/rate-limits/] A `429 Too Many Requests` response includes a `Retry-After` header. Your code must respect it.

### Surface 2 — The Plugin API

**What it is:** A JavaScript sandbox that runs inside the Figma application, with access to the document graph through the `figma` global object. Plugins run in a QuickJS WebAssembly sandbox with a postMessage bridge between the plugin code and any plugin UI.

**What it exposes that REST cannot:**
- Write access — rename nodes, update properties, create and delete objects
- Access to the full local file state without an API call
- Access to plugin-private storage

**What it cannot do:**
- Run outside of Figma (no CLI, no CI)
- Make arbitrary network requests without explicit plugin manifest permissions
- Access files the current user cannot open in Figma

**Read/write:** Both. This is the only surface that can write to the canvas.

**Auth:** Runs in the user's Figma session. No separate authentication required.

**Constraints:** ES5-compatible. No top-level await in the main sandbox. No Node.js APIs. Covered in detail in Chapter 6.

### Surface 3 — The Variables API

**What it is:** A subset of the REST API, with its own endpoint group, that exposes Figma's variables system — what Figma calls the design tokens infrastructure.

**What it exposes:**
- Variable collections (groups of variables, each potentially with multiple modes)
- Individual variables (name, type, value per mode, alias targets)
- Published variables from team libraries

**The Enterprise gate:** The Variables REST API requires an Enterprise plan [verify — current as of writing]. On Professional and Starter plans, the endpoint returns a 403 or an empty variable set. This is the most common plan-gate surprise in practice.

**The non-Enterprise path:** If you are on Professional or Starter, the Variables REST API is not available for extraction. Your options are: the Tokens Studio plugin (Chapter 8 covers this path), the Plugin API (read-only access to local variable state from inside Figma), or manual export. The book covers the non-Enterprise path with equal depth because most teams are not on Enterprise.

**Read/write:** Read only for the REST surface. Write via Plugin API.

### Surface 4 — Webhooks

**What it is:** An event subscription system that sends HTTP POST requests to a URL you control when events occur in a Figma file or team. [verify — current as of writing]

**What it exposes (event types):**
- `LIBRARY_PUBLISH` — a component library was published
- `FILE_UPDATE` — a file was modified
- `FILE_VERSION_UPDATE` — a named version was created
- `FILE_COMMENT` — a comment was added to a file
- `FILE_DELETE` — a file was deleted

**What it is for:** Triggering pipeline runs. The canonical pattern is: a designer publishes the component library → Figma fires `LIBRARY_PUBLISH` → your server receives the webhook → your server enqueues a pipeline run → the pipeline reads the updated file and produces updated artifacts.

**What it is not for:** Real-time sync. Webhooks have delivery latency and are not guaranteed-once. Build your handlers to be idempotent.

**Auth:** Webhook registration requires a token. Events are verified with a passcode you set at registration time. [verify — current as of writing]

**Plan requirements:** [verify — current as of writing]

### Surface 5 — The MCP Server

**What it is:** A Model Context Protocol server operated by Figma that gives AI coding agents (Claude Code, Cursor, Copilot, Windsurf) structured access to Figma data in their context window. [verify — MCP server is active as of writing; beta status may have changed]

**What it exposes to AI agents:**
- File and node content in structured form
- Component descriptions and variant properties
- Code Connect annotations (when configured)
- Dev Mode inspection data

**What it is not:**
- A code generator (the AI coding agent generates code; the MCP server provides context)
- A write path (reading only)
- A replacement for the REST API in CLI pipelines

**Auth:** Requires Figma Dev Mode access [verify — plan requirement current as of writing]. Local server via `npx @figma/mcp` or the Figma Desktop application.

**Covered in:** Chapter 13.

---

## Authentication: PATs vs. OAuth vs. Plan Access Tokens

Every REST API call requires authentication via the `X-Figma-Token` header [verify — header name current as of writing].

### Personal Access Tokens (PATs)

The simplest authentication method. Generated in Figma account settings under **Security**. Scoped to the generating user's permissions — the token can only access files the user can access.

PATs for CLI use should be treated as secrets: stored in environment variables, never hardcoded, never committed to a repository.

```bash
# In your shell profile or .env (never committed)
export FIGMA_TOKEN="figd_..."
```

The `FIGMA_TOKEN` environment variable is the stable name used throughout this book. Every CLI tool in the book reads it from the environment, never from a command-line argument.

**Limitations:** PATs are per-user. A CI pipeline running with a PAT runs as that user. If the user loses access to the file, the pipeline breaks. Consider using a dedicated Figma "bot" account for CI authentication, or investigate OAuth for multi-user scenarios.

### OAuth 2.0

Required when your tool needs to act on behalf of multiple users or needs user-specific access decisions. The authorization code flow is standard. [verify — current OAuth scopes documented at https://developers.figma.com/docs/rest-api/] For most CLI pipeline use cases, a PAT is simpler and sufficient.

### Plan Access Tokens

Figma has introduced plan-level access controls for certain API surfaces. [verify — exact mechanism and name current as of writing] Consult current Figma developer documentation for the plan-level authentication requirements for your specific use case.

---

## The Rate Limit Architecture

Rate limits are the most common reason a working script stops working at scale.

**What we know from the documentation:** [verify — all specific figures below against current docs before production use]

- Rate limits are applied per token (per user).
- Rate limits vary by endpoint — file reads have different limits than image renders.
- Rate limits vary by plan tier — higher plans have higher limits.
- A `429 Too Many Requests` response includes a `Retry-After` header indicating how many seconds to wait before retrying.

**The Starter-plan trap:** On the Starter plan (free tier), rate limits are significantly lower than on Professional or Enterprise. [verify — current Starter limits] A script that works fine against a test file may hit rate limits against a large production file on a Starter plan. If your pipeline is being built for an organization on Starter, test under realistic load before declaring it production-ready.

**The correct handling pattern:**

```javascript
// Illustrative — not production-complete
async function figmaFetch(url, token) {
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': token }
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10);
    console.warn(`Rate limited. Retrying after ${retryAfter}s`);
    await sleep(retryAfter * 1000);
    return figmaFetch(url, token); // retry once
  }

  if (!res.ok) {
    throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}
```

Every API call in this book's CLI tools uses a variant of this pattern. `figma-ping.js` validates that you are not already rate-limited before a pipeline run begins.

---

## The Enterprise Gate: What It Blocks and What Exists Beyond It

Understanding the Enterprise gate is not about complaining that Enterprise costs money. It is about designing your pipeline correctly for your plan tier.

**What requires Enterprise [verify — all items below against current Figma pricing/docs]:**

- REST API access to local variable collections (`GET /v1/files/:key/variables/local`)
- REST API write access to variables via `POST /v1/files/:key/variables`
- Advanced webhooks features (some event types may be plan-gated)

**What is available on Professional and below:**

- Full file graph read access (`GET /v1/files/:key`)
- Component and style metadata
- Image and asset export
- Basic webhook events
- Plugin API (runs in-app, no plan gate)

**The practical consequence:** If your token pipeline relies on `GET /v1/files/:key/variables/local` and your team is on Professional, the pipeline will silently return no variables (or a 403). You need to know this before you build.

**The non-Enterprise paths for token extraction:**

1. **Tokens Studio plugin** — exports variables to JSON from inside Figma, where the Plugin API has access regardless of plan tier. The export can be automated with a CI trigger that reads the committed JSON file. Chapter 8 covers this in detail.

2. **Plugin API** — a plugin running in Figma can read local variables and post them to an external endpoint or write them to a file. This requires someone to run the plugin, so it is not fully automated, but it avoids the REST API plan gate.

3. **Style-based token extraction** — Figma styles (color styles, text styles, effect styles) are accessible via REST on all plans. If your design system uses styles rather than variables for token management, the REST API can extract them without an Enterprise gate. This is a viable approach for teams that have not migrated to variables.

---

## The CLI Environment Contract

Every CLI tool in this book reads configuration from the environment. The contract is:

```bash
# Required
FIGMA_TOKEN=figd_...              # Your Figma Personal Access Token
FIGMA_FILE_KEY=abc123XYZ...       # The file key from the Figma URL

# Optional, used by team/library operations
FIGMA_TEAM_ID=12345678
FIGMA_PROJECT_ID=87654321

# Optional, used by webhook handlers
FIGMA_WEBHOOK_PASSCODE=your-passcode-here
```

**Where the file key comes from:** The Figma file key is the alphanumeric string in the Figma file URL. For a URL like `https://www.figma.com/file/abc123XYZdef456/My-Design-File`, the key is `abc123XYZdef456`. [verify — URL structure current as of writing; Figma has been migrating URLs to a new format]

**Local `.env` files:** Use a `.env` file at the project root for local development. Never commit `.env` files. Add them to `.gitignore` before you do anything else.

```
# .gitignore
.env
.env.local
.env.*.local
```

**In CI:** Inject `FIGMA_TOKEN` and `FIGMA_FILE_KEY` as CI environment secrets. GitHub Actions, GitLab CI, and similar systems have first-class secret management. A `429` or a `403` in CI means your token or file key is wrong — not a code error.

---

## The CLI Artifact: `figma-ping.js`

`figma-ping.js` is a session health check. Run it before any serious pipeline work. It tells you, definitively, whether your authentication is valid, your file is accessible, your plan permits the endpoints you need, and your rate-limit headroom is acceptable.

This is not optional ceremony. It is the difference between spending twenty minutes debugging `403 Forbidden` versus knowing in ten seconds that your token expired.

**What `figma-ping.js` checks:**

1. `FIGMA_TOKEN` present in the environment
2. `FIGMA_FILE_KEY` present in the environment
3. Auth validity — `GET /v1/me` succeeds [verify — endpoint name current as of writing]
4. File accessibility — `GET /v1/files/:key?depth=1` succeeds without a full tree fetch
5. Variables API access — `GET /v1/files/:key/variables/local` and whether it returns a 403 (Enterprise gate) or data
6. Rate limit headroom — checking response headers from the file ping [verify — which headers Figma returns for rate limit state]
7. Clear next-action output for every failure

```javascript
#!/usr/bin/env node
// figma-ping.js — Figma session health check
// Illustrative. Review and adapt before use in production.

import 'dotenv/config'; // requires dotenv package

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY;
const BASE_URL = 'https://api.figma.com'; // [verify — current base URL]

const PASS = '  PASS';
const FAIL = '  FAIL';
const WARN = '  WARN';

async function ping(label, url, { expectStatus = 200, warnOn = [] } = {}) {
  console.log(`\nChecking: ${label}`);
  try {
    const res = await fetch(url, {
      headers: { 'X-Figma-Token': FIGMA_TOKEN }, // [verify — header name]
    });

    if (res.status === expectStatus) {
      console.log(`${PASS} ${label} (${res.status})`);
      return { ok: true, status: res.status, res };
    }

    if (warnOn.includes(res.status)) {
      const body = await res.json().catch(() => ({}));
      console.warn(`${WARN} ${label}: HTTP ${res.status}`, body.err || '');
      return { ok: false, warn: true, status: res.status };
    }

    const body = await res.json().catch(() => ({}));
    console.error(`${FAIL} ${label}: HTTP ${res.status}`, body.err || '');
    return { ok: false, status: res.status };
  } catch (err) {
    console.error(`${FAIL} ${label}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function main() {
  console.log('=== figma-ping: session health check ===');

  // 1. Environment
  console.log('\nChecking: environment');
  let envOk = true;
  if (!FIGMA_TOKEN) {
    console.error(`${FAIL} FIGMA_TOKEN not set`);
    envOk = false;
  } else {
    console.log(`${PASS} FIGMA_TOKEN is set (${FIGMA_TOKEN.slice(0, 6)}...)`);
  }
  if (!FIGMA_FILE_KEY) {
    console.error(`${FAIL} FIGMA_FILE_KEY not set`);
    envOk = false;
  } else {
    console.log(`${PASS} FIGMA_FILE_KEY is set (${FIGMA_FILE_KEY})`);
  }
  if (!envOk) {
    console.error('\nSet missing environment variables and retry.');
    process.exit(1);
  }

  // 2. Auth — GET /v1/me [verify — endpoint current]
  const meResult = await ping(
    'auth: GET /v1/me',
    `${BASE_URL}/v1/me`
  );
  if (!meResult.ok) {
    console.error('\nAuth failed. Check your FIGMA_TOKEN and retry.');
    process.exit(1);
  }

  // 3. File access — shallow fetch [verify — ?depth=1 supported]
  const fileResult = await ping(
    `file access: GET /v1/files/${FIGMA_FILE_KEY}?depth=1`,
    `${BASE_URL}/v1/files/${FIGMA_FILE_KEY}?depth=1`
  );
  if (!fileResult.ok) {
    console.error('\nFile access failed. Check FIGMA_FILE_KEY and that your account has access.');
    process.exit(1);
  }

  // 4. Variables API — Enterprise gate check [verify — endpoint and gate current]
  const varsResult = await ping(
    'variables API: GET /v1/files/:key/variables/local',
    `${BASE_URL}/v1/files/${FIGMA_FILE_KEY}/variables/local`,
    { warnOn: [403] }
  );
  if (varsResult.warn || !varsResult.ok) {
    console.warn(`\n  Variables API not available (HTTP ${varsResult.status}).`);
    console.warn('  This usually means your plan is not Enterprise.');
    console.warn('  Token extraction via REST Variables API will not work.');
    console.warn('  Use the Tokens Studio plugin path instead (Chapter 8).');
  }

  // 5. Rate limit headers [verify — which headers Figma exposes]
  if (fileResult.res) {
    const remaining = fileResult.res.headers.get('X-RateLimit-Remaining');
    const limit = fileResult.res.headers.get('X-RateLimit-Limit');
    if (remaining !== null) {
      console.log(`\n  Rate limit: ${remaining} / ${limit} requests remaining`);
      if (parseInt(remaining, 10) < 10) {
        console.warn(`${WARN} Rate limit headroom is low. Wait before running pipeline.`);
      }
    } else {
      console.log('\n  Rate limit headers not present in response. [verify — expected header names]');
    }
  }

  console.log('\n=== figma-ping complete ===');
  console.log('Your session is healthy. Proceed with confidence.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
```

**Running it:**

```bash
# Install dependencies
npm install dotenv

# Create .env with your values
echo "FIGMA_TOKEN=figd_your_token_here" >> .env
echo "FIGMA_FILE_KEY=your_file_key_here" >> .env

# Run the ping
node figma-ping.js
```

**Expected output (healthy session):**

```
=== figma-ping: session health check ===

Checking: environment
  PASS FIGMA_TOKEN is set (figd_a...)
  PASS FIGMA_FILE_KEY is set (abc123XYZdef456)

Checking: auth: GET /v1/me
  PASS auth: GET /v1/me (200)

Checking: file access: GET /v1/files/abc123XYZdef456?depth=1
  PASS file access: GET /v1/files/abc123XYZdef456?depth=1 (200)

Checking: variables API: GET /v1/files/:key/variables/local
  WARN variables API: GET /v1/files/:key/variables/local: HTTP 403

  Variables API not available (HTTP 403).
  This usually means your plan is not Enterprise.
  Token extraction via REST Variables API will not work.
  Use the Tokens Studio plugin path instead (Chapter 8).

  Rate limit headers not present in response. [verify — expected header names]

=== figma-ping complete ===
Your session is healthy. Proceed with confidence.
```

The warning about variables is informational, not fatal. A healthy non-Enterprise session looks exactly like this: auth passes, file access passes, variables endpoint declines, and the ping tells you which extraction path to use next.

---

## The API Surface Decision Table

| Task | Use this surface |
|---|---|
| Read the full file graph | REST `GET /v1/files/:key` |
| Read specific nodes by ID | REST `GET /v1/files/:key/nodes` |
| Export rendered images | REST `GET /v1/images/:key` |
| Extract design token variables (Enterprise) | REST `GET /v1/files/:key/variables/local` |
| Extract design token variables (non-Enterprise) | Plugin API or Tokens Studio |
| Rename nodes, update properties | Plugin API (runs inside Figma) |
| Trigger pipeline on library publish | Webhook `LIBRARY_PUBLISH` event |
| Read component styles and names | REST `GET /v1/files/:key/styles` |
| Feed design context to an AI coding agent | MCP server |
| Read published library components | REST `GET /v1/files/:key/components` |
| Fix bulk naming violations | Plugin API (Chapter 6) |

When in doubt: start with the REST API for reading, Plugin API for writing, and webhook for triggering. MCP is for the AI coding agent, not for pipelines.

---

## Failure Modes of `figma-ping.js`

The ping tool itself has failure modes worth knowing:

**The ping passes but the pipeline still fails.** A shallow file fetch (`?depth=1`) succeeds even on files that are too large to fully fetch. A very large file may time out or return a partial response on a full `GET /v1/files/:key`. The ping is a health check, not a load test.

**Rate limit state changes between ping and pipeline run.** The ping measures headroom at a moment in time. If another process is hitting the same token concurrently, the pipeline may hit rate limits immediately after a passing ping. Use a dedicated token for each pipeline.

**The variables endpoint returns 200 with an empty payload.** Some configurations return a successful response with an empty variable set rather than a 403. This can happen if the file has no published variables, or if there is a subtle permission configuration. Empty variables are not the same as no access. `figma-ping.js` should ideally distinguish between "403 — access denied" and "200 — empty collection." [verify — current API behavior for empty variable sets]

**Token expiry during a long pipeline run.** PATs do not expire on a short schedule, but if a PAT is rotated, revoked, or if the user account loses access to the file mid-run, the pipeline will fail with a mid-run 403. The ping catches the state before the run; it cannot catch changes during the run.

---

## Decision Rules: Which API Surface to Use

**Use the REST API when** you are building a CLI that runs outside of Figma, needs to read file structure, needs to export images, or needs to run in CI without a human at a Figma application instance.

**Use the Plugin API when** you need to write to the canvas, need access to variables on a non-Enterprise plan, or need to automate bulk operations that REST cannot perform. Covered in Chapter 6.

**Use the Variables API REST endpoint when** you are on Enterprise and need programmatic access to the full variable graph, including alias chains and mode values, from a CI pipeline.

**Use webhooks when** you want pipeline runs triggered by Figma events (library publish, file update) rather than on a schedule or manually.

**Use the MCP server when** you are configuring an AI coding agent to use your design system as context. Do not use MCP as a pipeline data source — it is designed for interactive agent sessions, not batch extraction.

---

## Try This

**Exercise 1: Run `figma-ping.js` against your own file.**

Set up `FIGMA_TOKEN` and `FIGMA_FILE_KEY` in a `.env` file for a Figma file you can access. Run `figma-ping.js`. Read the output carefully. Does the variables endpoint return data or a 403? If it returns a 403, you are on a non-Enterprise plan — make a note, because Chapter 8 has two paths and you will use the Tokens Studio one. If it returns data, you are on Enterprise — you can use the REST extraction path.

**Exercise 2: Map your API surfaces.**

List three pipeline tasks you want to build for your design system — for example: extract color tokens, export icon SVGs, trigger a CI run when the library is published. For each task, look up the decision table and identify which API surface you will use. Check whether that surface has a plan gate you need to be aware of. Write it down before you write any code.

---

## The AI Wayback Machine: REST APIs and the Document Graph Model

When Figma launched their API in 2019 [verify — launch year and initial capabilities], it exposed the file graph for reading: the document structure, component metadata, styles. This was a significant departure from the design tool APIs that preceded it, which were primarily export-oriented — give me a PNG of this artboard.

The document graph model was borrowed from an older tradition: the DOM. Web browsers had long represented HTML documents as traversable trees where any node could be inspected programmatically. Figma applied the same model to design files. The implication — that a design file is a data structure, not just a picture — was not obvious to most practitioners at the time, and many still have not internalized it.

The 2023–2024 period added the Variables API and the MCP server, expanding the query model to include design tokens and AI agent context. The direction of travel is consistent: Figma is becoming more queryable, not less. The document graph model is not going away. The specific endpoints and rate limits will change — flag everything with [verify] — but the conceptual model of "Figma as a queryable document graph" is stable enough to build on.

---

## What Comes Next

Chapter 3 goes inside the file response: the document graph in detail, what the node types mean, how to find variables, components, and styles, and how to build a local fixture so you can develop and test your extraction code without hammering the API. The first real reading tool, `figma-read.mjs`, is built there.

You have a healthy session. Let's read a file.

---

*Tags: api-surfaces, authentication, rate-limits, figma-ping, enterprise-gate, cli-contract*
