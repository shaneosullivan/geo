// Builds the published files from src/geo.js:
//   dist/geo.js         ES module exporting only createGeo
//   dist/geo.global.js  classic script that sets one global, `choftergeo`
//   dist/geo.d.ts       types
// src/geo.js also exports the helpers that define the file-naming scheme so the
// data build can share them; they are not part of the public API.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = () => fs.readFileSync(path.join(here, "src/geo.js"), "utf8");
const banner = (version) =>
  `// @chofter/geo ${version} · MIT · https://geo.chofter.com · data © GeoNames (CC BY 4.0)\n`;

/** ES module with every export but createGeo made private. */
export function moduleSource(version = pkgVersion()) {
  return banner(version) + source().replace(/^export (?!function createGeo\b)/gm, "");
}

/** Classic script that exposes createGeo as `choftergeo.createGeo`. */
export function globalSource(version = pkgVersion()) {
  const body = source().replace(/^export /gm, "");
  return `${banner(version)}(function () {\n"use strict";\n${body}\nglobalThis.choftergeo = { createGeo };\n})();\n`;
}

export function typesSource() {
  return fs.readFileSync(path.join(here, "src/geo.d.ts"), "utf8");
}

function pkgVersion() {
  return JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8")).version;
}

/** Write geo.js, geo.global.js and geo.d.ts into `out`. */
export function writeDist(out = path.join(here, "dist")) {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "geo.js"), moduleSource());
  fs.writeFileSync(path.join(out, "geo.global.js"), globalSource());
  fs.writeFileSync(path.join(out, "geo.d.ts"), typesSource());
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`wrote ${path.relative(process.cwd(), writeDist()) || "."}`);
}
