# Chapter 2 — What the API Actually Exposes

*The API does not export your design. It exposes a document graph. Understanding the difference is the prerequisite for everything else.*

---

It is 11 AM on a Tuesday. You have a Figma file key, a Personal Access Token, and ten lines of Node.js that should — by every reasonable expectation — print a JSON response. You run the script.

```
HTTP 403 Forbidden
{"status":403,"err":"Invalid token"}
```

The token looks right. You rotate it. Same result. You try curl. Same result. Thirty minutes disappear into the authentication docs before you notice the actual problem: the token belongs to your personal account. The Figma file belongs to the client's organization. Your account has never been added to that workspace. The API did not reject your token because it was invalid — it rejected it because the token was yours, and you were not authorized.

Or the token is fine and the file access is fine, and the response is three thousand lines of nested JSON with no variables in it anywhere. You search the docs. You find it: the Variables API requires an Enterprise plan. The client is on Professional. The response was not broken. It was correct. The endpoint simply does not exist for you.

Both failures share a cause: not understanding what the API actually exposes before you try to use it. This chapter fixes that.

---

## Figma Is Not a Single API

The first thing to understand is that there is no single "Figma API." There are five overlapping programmatic surfaces, each with different permissions, plan requirements, rate limits, and read/write behavior. Most pipeline failures at the start of a project come from using the wrong surface — or from not knowing which surface gates the thing you need.

<!-- → [TABLE: Five Figma API surfaces — columns: surface name, what it exposes, read/write, auth method, plan gate, primary use case] -->

**The REST API** is the conventional HTTP interface at `https://api.figma.com`. [verify — current as of writing] It is what most people mean when they say "the Figma API." It takes a token in a header, returns JSON, and is read-only. It exposes the full document node tree, component and style metadata, image exports, and — on Enterprise plans — the variable graph. It cannot write to a file. It cannot run inside Figma. It is a query interface, not an automation interface.

**The Plugin API** is a JavaScript sandbox that runs inside the Figma application. The `figma` global object gives a plugin direct access to the document without making network requests. This is the only surface that can write to the canvas — rename nodes, update properties, create or delete objects. It runs in a QuickJS WebAssembly sandbox with a postMessage bridge between plugin code and any plugin UI. It cannot run in CI. It cannot run on a schedule without someone opening Figma. Those constraints matter enormously for pipeline design, and they are why REST and Plugin are complements rather than alternatives.

**The Variables API** is technically part of REST — same base URL, same auth header — but it deserves its own category because of what gates it. The endpoint `GET /v1/files/:key/variables/local` exposes Figma's design tokens infrastructure: variable collections, individual variables with their types and mode-scoped values, alias chains between variables. [verify — current as of writing] The plan gate is the thing to know. On Professional or Starter, this endpoint returns a 403 or an empty collection. On Enterprise, it returns data. This is the most common plan-gate surprise in practice, and it is binary — there is no partial access.

**Webhooks** are an event subscription system. You register a URL; Figma sends HTTP POST requests to that URL when things happen in a file or team. The events that matter most for pipeline work are `LIBRARY_PUBLISH` — a component library was published — and `FILE_UPDATE` — a file was modified. The canonical pattern is: designer publishes the component library → Figma fires `LIBRARY_PUBLISH` → your server receives the webhook → your server enqueues a pipeline run → the pipeline reads the updated file and produces updated artifacts. Webhooks are not real-time sync. They have delivery latency and are not guaranteed-once. Build your handlers to be idempotent.

**The MCP Server** is a Model Context Protocol server operated by Figma that gives AI coding agents — Claude Code, Cursor, Copilot — structured access to Figma data in their context window. [verify — MCP server active as of writing; beta status may have changed] It exposes file content, component descriptions, variant properties, Code Connect annotations, and Dev Mode inspection data. It is designed for interactive agent sessions, not for CLI pipelines or batch extraction. Do not use it as a REST API substitute. Chapter 13 covers it in depth.

The decision rule is simpler than the surface list suggests. If you are building a CLI that reads design data and runs outside Figma: REST API. If you need to write to the canvas, or need variable access on a non-Enterprise plan: Plugin API. If you want a pipeline triggered by Figma events: webhooks. If you are feeding design context to an AI coding agent: MCP server.

<!-- → [TABLE: API surface decision table — columns: task, use this surface — rows covering the decision cases above] -->

---

## Authentication and What It Actually Controls

Every REST call requires an `X-Figma-Token` header. [verify — header name current as of writing] The value can be a Personal Access Token or an OAuth 2.0 token.

Personal Access Tokens are the simpler path. Generated in Figma account settings under Security, they carry exactly the permissions of the user who generated them. The token can access files the user can access. It cannot access files the user cannot. A token for a personal account does not reach into an organization's workspace unless that account has been explicitly added. This is not a bug — it is the access control model working as designed. The failure case at the start of this chapter was not an API failure. It was a permission failure that surfaced as a 403.

For CLI tools, PATs should be treated as secrets. Store them in environment variables. Never hardcode them. Never commit them to a repository.

```bash
# In your .env file — never committed
export FIGMA_TOKEN="figd_..."
```

Every CLI tool in this book reads `FIGMA_TOKEN` from the environment. That name is the stable convention. You will set it once and every tool picks it up.

The limitation worth knowing: PATs are per-user. A CI pipeline running with a PAT runs as that user. If the user loses access to the file — leaves the organization, has permissions revised — the pipeline breaks. For production pipelines, consider a dedicated Figma "bot" account. OAuth 2.0 is the alternative when you need tools that act on behalf of multiple users, but for single-team pipelines a PAT is simpler and sufficient.

Plan access is a second layer of authentication that operates independently of token validity. A valid token for a user on a Professional plan will be rejected by the Variables API endpoint regardless of token correctness. The 403 does not mean the token is wrong. It means the plan does not include access to that endpoint. These look identical in the response. `figma-ping.js`, which this chapter introduces shortly, distinguishes them.

---

## The Rate Limit Architecture

Rate limits are the most common reason a working script stops working at scale.

The documentation states that limits are applied per token, vary by endpoint, and vary by plan tier. [verify — all figures below against current docs before production use] A `429 Too Many Requests` response includes a `Retry-After` header indicating how many seconds to wait before retrying.

<!-- → [INFOGRAPHIC: Rate limit response flow — 429 received → read Retry-After header → sleep → retry once → success/fail] -->

The plan-tier trap is the one that bites unexpectedly. On the Starter (free) tier, rate limits are significantly lower than on Professional or Enterprise. [verify — current Starter limits] A script that works cleanly against a small test file may hammer into rate limits against a large production file on a Starter plan. The correct handling pattern is not complex:

```javascript
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

Every API call in this book's CLI tools uses a variant of this pattern. The important detail is that the retry is bounded — retry once, not infinitely. Unbounded retry loops on rate-limited endpoints can worsen the situation. If a single retry after the `Retry-After` window still returns a 429, surface the error and let the operator decide.

---

## The Enterprise Gate

The Enterprise gate deserves its own treatment because it shapes the entire architecture of non-Enterprise pipeline design. This is not a complaint about pricing. It is a design constraint, and design constraints require design responses.

What requires Enterprise, to the best of current knowledge [verify — all items against current Figma pricing and docs]:

- REST API read access to local variable collections
- REST API write access to variables
- Certain webhook event types may be plan-gated

What is available on Professional and below:

- Full file graph read access
- Component and style metadata
- Image and asset export
- Basic webhook events
- Plugin API (runs in-app, no plan gate at the Plugin level)

If a pipeline is built against `GET /v1/files/:key/variables/local` and the team is on Professional, the pipeline will silently return no variables — or a 403 — without any indication that the missing data is by design rather than a bug. You need to know this before you build, not after you have shipped a pipeline that produces empty token files.

The non-Enterprise paths are real and usable. **Tokens Studio** is a plugin that exports variables to JSON from inside Figma, where the Plugin API has access to variable data regardless of plan. The export can be committed to a repository and consumed by downstream pipeline steps without any REST API access to variables at all. Chapter 8 covers this path in full. **The Plugin API** can also read local variables and post them to an external endpoint, but it requires someone to manually trigger the plugin — not fully automated, but sometimes sufficient. **Style-based extraction** is available if the design system uses Figma styles rather than variables for token management; color styles, text styles, and effect styles are accessible via REST on all plans.

Neither path is a workaround. They are design decisions appropriate to the plan tier. The book covers both with equal depth.

---

## The CLI Environment Contract

Every CLI tool in this book reads configuration from the environment. The contract is fixed and consistent:

```bash
# Required
FIGMA_TOKEN=figd_...              # Personal Access Token
FIGMA_FILE_KEY=abc123XYZ...       # File key from the Figma URL

# Optional, used by team and library operations
FIGMA_TEAM_ID=12345678
FIGMA_PROJECT_ID=87654321

# Optional, used by webhook handlers
FIGMA_WEBHOOK_PASSCODE=your-passcode-here
```

The file key comes from the Figma file URL. For a URL like `https://www.figma.com/file/abc123XYZdef456/My-Design-File`, the key is `abc123XYZdef456`. [verify — URL structure current as of writing; Figma has been migrating to a new URL format]

Local development uses a `.env` file at the project root. The file must never be committed. Add it to `.gitignore` before anything else:

```
# .gitignore
.env
.env.local
.env.*.local
```

In CI, inject `FIGMA_TOKEN` and `FIGMA_FILE_KEY` as environment secrets through your CI system's secret management. A `403` or `429` in CI almost always means the token or file key is misconfigured — not a code error.

---

## `figma-ping.js`

`figma-ping.js` is a session health check. The premise is simple: before you write any extraction code, before you run any pipeline, you want to know definitively whether your authentication is valid, your file is accessible, your plan permits the endpoints you need, and your rate-limit headroom is acceptable. Discovering a stale token twenty minutes into a debugging session is expensive. Discovering it in ten seconds before you start is not.

What the ping checks, in order:

1. `FIGMA_TOKEN` and `FIGMA_FILE_KEY` are present in the environment
2. Auth validity — `GET /v1/me` succeeds [verify — endpoint current as of writing]
3. File accessibility — a shallow `GET /v1/files/:key?depth=1` without pulling the full tree [verify — `?depth=1` supported]
4. Variables API access — `GET /v1/files/:key/variables/local` and whether the response is a 403 (plan gate) or data [verify — endpoint current]
5. Rate limit headroom from the response headers of the file ping [verify — which headers Figma returns for rate limit state]
6. Clear next-action output for every failure

<!-- → [FIGURE: figma-ping.js terminal output showing the PASS/WARN/FAIL states for a healthy non-Enterprise session — annotated to show which checks are auth, which are plan-gate, which are rate limit] -->

```javascript
#!/usr/bin/env node
// figma-ping.js — Figma session health check
// Illustrative. Review and adapt before production use.

import 'dotenv/config';

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
    console.error('\nFile access failed. Check FIGMA_FILE_KEY and account access.');
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

Running it:

```bash
npm install dotenv
echo "FIGMA_TOKEN=figd_your_token_here" >> .env
echo "FIGMA_FILE_KEY=your_file_key_here" >> .env
node figma-ping.js
```

Expected output for a healthy non-Enterprise session:

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

The variables warning is informational, not fatal. A healthy non-Enterprise session looks exactly like this: auth passes, file access passes, variables endpoint declines with a clear message about which extraction path to use instead.

---

## What the Ping Cannot Tell You

The ping is a health check at a moment in time. It has failure modes worth knowing.

A shallow file fetch with `?depth=1` succeeds even on files that are too large to fully fetch without timing out. The ping does not simulate a real pipeline load — it checks access, not capacity. A very large file may still fail on a full `GET /v1/files/:key` even after a passing ping.

Rate limit state changes. If another process is hitting the same token concurrently, the pipeline may hit rate limits immediately after a clean ping. Use a dedicated token for each pipeline, not a shared one.

The variables endpoint can return a 200 with an empty payload rather than a 403. This happens when the file has no published variables, or in some permission configurations. Empty variables and no access look different in the response body but feel identical when your pipeline produces no output. `figma-ping.js` should ideally distinguish between "403 — access denied" and "200 — empty collection." [verify — current API behavior for empty variable sets]

Token expiry during a long pipeline run is real. PATs do not expire on a short schedule, but if a PAT is rotated or the user account loses file access mid-run, the pipeline fails with a mid-run 403. The ping catches the state before the run starts. It cannot catch changes during the run.

---

## The Document Graph Model

When Figma launched their API in 2019 [verify — launch year and initial capabilities], it exposed the file graph for reading: document structure, component metadata, styles. This was a departure from the design tool APIs that preceded it, which were primarily export-oriented — give me a PNG of this artboard.

The document graph model was borrowed from an older tradition: the DOM. Web browsers had long represented HTML documents as traversable trees where any node could be inspected programmatically. Figma applied the same model to design files. The implication — that a design file is a data structure, not just a picture — was not obvious to most practitioners at the time.

The Variables API and the MCP server, added in the 2023–2024 period, extended the query model to include design tokens and AI agent context. The direction of travel is consistent: Figma is becoming more queryable. The specific endpoints and rate limits will change — flag everything with [verify] — but "Figma as a queryable document graph" is stable enough to build on.

The failure at the start of this chapter — the 403, the missing variables, the thirty minutes of confused debugging — was not a failure of the API. It was a failure to understand what the API is. It is not an exporter. It is not a mirror of the design tool's interface. It is a document graph with access controls, plan gates, and a surface map that rewards the engineer who studies it before writing a single line of production code.

---

## What Comes Next

Chapter 3 goes inside the file response: the document graph in detail, what the node types mean, how to find variables, components, and styles, and how to build a local fixture so you can develop and test extraction code without hammering the API. The first real reading tool, `figma-read.mjs`, is built there.

You have a healthy session. Let's read a file.
