// Builds the published files from src/geo.js. Run with Bun: `bun build.mjs`.
//   dist/geo.js             ES module exporting only createGeo
//   dist/geo.min.js         the same, minified
//   dist/geo.global.js      classic script that sets one global, `choftergeo`
//   dist/geo.global.min.js  the same, minified
//   dist/geo.d.ts           types
// src/geo.js also exports the helpers that define the file-naming scheme so the
// data build can share them; they are not part of the public API.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

if (typeof Bun === "undefined") throw new Error("build.mjs needs Bun for minification: run `bun build.mjs`");

const here = import.meta.dir;
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, "dist");
const { version } = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8"));
const banner = `// @chofter/geo ${version} · MIT · https://geo.chofter.com · data © GeoNames (CC BY 4.0)`;
const source = fs.readFileSync(path.join(here, "src/geo.js"), "utf8");

fs.mkdirSync(out, { recursive: true });
const write = (name, text) => fs.writeFileSync(path.join(out, name), text);

// Readable builds: the source with its exports adjusted, comments kept.
write("geo.js", `${banner}\n${source.replace(/^export (?!function createGeo\b)/gm, "")}`);
write(
  "geo.global.js",
  `${banner}\n(function () {\n"use strict";\n${source.replace(/^export /gm, "")}\nglobalThis.choftergeo = { createGeo };\n})();\n`
);
write("geo.d.ts", fs.readFileSync(path.join(here, "src/geo.d.ts"), "utf8"));

// Minified builds, bundled by Bun from small entry files. The entries live outside
// the package: inside it, Bun 1.4 applies the package's `"sideEffects": false` to
// the entry itself and tree-shakes the whole library away.
const entries = fs.mkdtempSync(path.join(os.tmpdir(), "chofter-geo-"));
const src = JSON.stringify(path.join(here, "src/geo.js"));
fs.writeFileSync(path.join(entries, "module.js"), `import { createGeo } from ${src};\nexport { createGeo };\n`);
fs.writeFileSync(path.join(entries, "global.js"), `import { createGeo } from ${src};\nglobalThis.choftergeo = { createGeo };\n`);
try {
  for (const [entry, format, name] of [
    ["module.js", "esm", "geo.min.js"],
    ["global.js", "iife", "geo.global.min.js"],
  ]) {
    const result = await Bun.build({
      entrypoints: [path.join(entries, entry)],
      format,
      minify: true,
      target: "browser",
      banner,
    });
    if (!result.success) throw new AggregateError(result.logs, `bun build failed for ${name}`);
    write(name, await result.outputs[0].text());
  }
} finally {
  fs.rmSync(entries, { recursive: true, force: true });
}

console.log(`wrote ${path.relative(process.cwd(), out) || "."}`);
