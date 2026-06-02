#!/usr/bin/env node
// svg-overflow-check.mjs — static text-overflow linter for textbook figure SVGs.
// Flags <text> that drops below its containing <rect> (descenders crossing the
// border) or runs past a box's right edge or the canvas. Heuristic glyph-width
// model — a strong first-pass filter, not pixel-perfect.
//
// Usage:
//   node SCRIPTS/svg-overflow-check.mjs            # scans ./images
//   node SCRIPTS/svg-overflow-check.mjs path/dir   # scans a specific dir
//   TOL=2 node SCRIPTS/svg-overflow-check.mjs       # overflow tolerance in px (default 2)
// Exit code: 0 if clean, 1 if any flags (CI-friendly).

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const DIR = process.argv[2] || 'images';
const TOL = Number(process.env.TOL ?? 2);

// per-character width in em units, approximating a humanist sans (Lato/Inter/Real Head Pro)
const NARROW = new Set("iIl.,:;'|!ftrj()[]-/ ");
const WIDE   = new Set("mwMW@");
const UPPER  = new Set("ABCDEFGHJKLNOPQRSTUVXYZ");
const charEm = c => NARROW.has(c) ? 0.30 : WIDE.has(c) ? 0.88 : UPPER.has(c) ? 0.66 : /[0-9]/.test(c) ? 0.55 : 0.52;
const textW = (s, fs, ls = 0) => [...s].reduce((a, c) => a + charEm(c) * fs, 0) + Math.max(0, s.length - 1) * ls;
const num = (v, d = 0) => { const n = parseFloat(String(v ?? '').replace(/[a-z%]+$/i, '')); return Number.isFinite(n) ? n : d; };
const attr = (tag, name) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`)); return m ? m[1] : null; };
const decode = s => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (e.toLowerCase().endsWith('.svg')) out.push(p);
  }
  return out;
}

function scan(file) {
  const svg = readFileSync(file, 'utf8');
  const vb = (attr(svg.match(/<svg[^>]*>/i)?.[0] || '', 'viewBox') || '0 0 700 420').trim().split(/\s+/).map(Number);
  const [vw, vh] = [vb[2] || 700, vb[3] || 420];

  const rects = [];
  for (const m of svg.matchAll(/<rect\b[^>]*>/gi)) {
    const t = m[0], w = num(attr(t, 'width')), h = num(attr(t, 'height'));
    if (w > 0 && h > 0) rects.push({ x: num(attr(t, 'x')), y: num(attr(t, 'y')), w, h });
  }
  const texts = [];
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)) {
    const open = '<text ' + m[1] + '>';
    if (/transform\s*=/.test(open)) continue;                 // skip rotated/translated labels
    const s = decode(m[2].replace(/<[^>]*>/g, '')).trim();    // strip nested tspans
    if (!s) continue;
    const fs = num(attr(open, 'font-size'), 12), x = num(attr(open, 'x')), y = num(attr(open, 'y'));
    const anchor = attr(open, 'text-anchor') || 'start', ls = num(attr(open, 'letter-spacing'));
    const w = textW(s, fs, ls);
    let left, right;
    if (anchor === 'middle') { left = x - w / 2; right = x + w / 2; }
    else if (anchor === 'end') { left = x - w; right = x; }
    else { left = x; right = x + w; }
    texts.push({ s, x, y, fs, left, right, bottom: y + fs * 0.22, top: y - fs * 0.80 });
  }

  const issues = [];
  for (const t of texts) {
    const short = t.s.length > 44 ? t.s.slice(0, 44) + '…' : t.s;
    if (t.right > vw + TOL) issues.push(['H-CANVAS', `'${short}'  right=${t.right.toFixed(0)} > ${vw}`]);
    if (t.bottom > vh + TOL) issues.push(['V-CANVAS', `'${short}'  bottom=${t.bottom.toFixed(0)} > ${vh}`]);
    // innermost box that actually contains the text vertically (not a sibling below it)
    let owner = null;
    for (const r of rects) {
      const insideX = t.x >= r.x - 0.5 && t.x <= r.x + r.w + 0.5;
      const insideY = t.y >= r.y - 1 && t.y <= r.y + r.h + t.fs * 0.35; // baseline at/just-past bottom, not far below
      if (insideX && insideY && (!owner || r.w * r.h < owner.w * owner.h)) owner = r;
    }
    if (owner) {
      const rb = owner.y + owner.h, rr = owner.x + owner.w;
      if (t.bottom > rb + TOL) issues.push(['V-BOX', `'${short}'  bottom=${t.bottom.toFixed(0)} > box=${rb.toFixed(0)} (+${(t.bottom - rb).toFixed(0)})`]);
      if (t.right > rr + TOL)  issues.push(['H-BOX', `'${short}'  right=${t.right.toFixed(0)} > box=${rr.toFixed(0)} (+${(t.right - rr).toFixed(0)})`]);
    }
  }
  return issues;
}

const files = walk(DIR).sort();
let flaggedFiles = 0, flaggedItems = 0;
for (const f of files) {
  let iss;
  try { iss = scan(f); } catch (e) { console.log(`\n### ${f}\n  PARSE ERROR: ${e.message}`); flaggedFiles++; continue; }
  if (iss.length) {
    flaggedFiles++; flaggedItems += iss.length;
    console.log(`\n### ${f.replace(DIR + '/', '')}`);
    for (const [k, m] of iss) console.log(`  ${k.padEnd(9)} ${m}`);
  }
}
console.log(`\n==== ${flaggedFiles}/${files.length} SVGs flagged, ${flaggedItems} items (tol ${TOL}px) ====`);
console.log('Legend: V-BOX/H-BOX = text past its box; V-CANVAS/H-CANVAS = past the page edge.');
console.log('Heuristic glyph widths — treat <=5px as noise; verify large/structural flags by eye.');
process.exit(flaggedItems > 0 ? 1 : 0);
