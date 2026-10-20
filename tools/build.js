#!/usr/bin/env node
// Inlines css/ and js/ into one self-contained HTML file: dist/slashyslash.html
// Usage: node tools/build.js [--fragment out.html]
//   --fragment writes the page without <html>/<head>/<body> wrappers (for hosts that add their own).
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, href) => `<style>\n${read(href)}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const full = path.join(outDir, 'slashyslash.html');
fs.writeFileSync(full, html);
console.log(`wrote ${path.relative(root, full)} (${(html.length / 1024).toFixed(1)} KB)`);

const fi = process.argv.indexOf('--fragment');
if (fi !== -1 && process.argv[fi + 1]) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
    .replace(/<meta charset[^>]*>\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '');
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];
  const frag = `${head.trim()}\n${body.trim()}\n`;
  fs.writeFileSync(path.resolve(process.argv[fi + 1]), frag);
  console.log(`wrote fragment ${process.argv[fi + 1]} (${(frag.length / 1024).toFixed(1)} KB)`);
}
