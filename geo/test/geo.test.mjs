// Runs the built package against a small hand-made data set in test/fixture.
// `npm test` builds dist/ first.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "../dist");
const { createGeo } = await import(path.join(dist, "geo.js"));
const internals = await import(path.join(here, "../src/geo.js"));

const requests = [];
function fixtureFetch(url) {
  requests.push(url);
  const file = path.join(here, "fixture", new URL(url).pathname);
  if (!fs.existsSync(file)) return Promise.resolve({ ok: false, status: 404 });
  return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) });
}
const geo = createGeo({ baseUrl: "https://geo.test/v1/", fetch: fixtureFetch });
const names = (list) => list.map((p) => p.name);

test("the module exports only createGeo", async () => {
  assert.deepEqual(Object.keys(await import(path.join(dist, "geo.js"))), ["createGeo"]);
});

test("normalize and fileKey define the file scheme", () => {
  const { normalize, fileKey, prefixOf } = internals;
  assert.equal(normalize("  São Paulo "), "sao paulo");
  assert.equal(normalize("St. John's"), "st johns");
  assert.equal(normalize("Straße"), "strasse");
  assert.equal(normalize("Saint-Malo"), "saint malo");
  assert.equal(fileKey("a "), "a-");
  assert.equal(fileKey("мо"), "~43c~43e");
  assert.equal(prefixOf("münchen", 2), "mü");
});

test("small country: one file, full result shape", async () => {
  const [dublin] = await geo.search("IE", "dub");
  assert.deepEqual(dublin, {
    id: 2964574,
    name: "Dublin",
    region: "Leinster",
    country: "Ireland",
    countryCode: "IE",
    lat: 53.3331,
    lng: -6.2489,
    population: 1024027,
    label: "Dublin, Leinster, Ireland",
  });
  const before = requests.length;
  assert.deepEqual(names(await geo.search("ie", "dun")), ["Dún Laoghaire", "Dunboyne"]);
  assert.equal(requests.length, before, "a second search in a small country needs no fetch");
});

test("empty query returns the most populous places", async () => {
  assert.deepEqual(names(await geo.search("IE", "", { limit: 2 })), ["Dublin", "Cork"]);
});

test("sharded country reads the longest listed prefix", async () => {
  assert.deepEqual(names(await geo.search("DE", "m")), ["Munich", "Mannheim"]);
  assert.ok(requests.at(-1).endsWith("/de/m.json"));
  assert.deepEqual(names(await geo.search("DE", "mur")), ["Murnau"]);
  assert.ok(requests.at(-1).endsWith("/de/mu.json"));
  assert.deepEqual(await geo.search("DE", "zz"), []);
});

test("accents and alternate names", async () => {
  const [munich] = await geo.search("DE", "München");
  assert.equal(munich.name, "Munich");
  assert.equal(munich.matched, "München");
  assert.equal((await geo.search("DE", "koln"))[0].name, "Cologne");
  assert.equal((await geo.search("IE", "baile atha"))[0].name, "Dublin");
  assert.equal((await geo.search("IE", "dun laoghaire"))[0].name, "Dún Laoghaire");
});

test("exact matches rank first, then population", async () => {
  assert.deepEqual(names(await geo.search("DE", "mu")), ["Munich", "Münster", "Murnau"]);
});

test("countries and preload", async () => {
  assert.deepEqual(await geo.countries(), [
    { code: "DE", name: "Germany", count: 7 },
    { code: "IE", name: "Ireland", count: 4 },
  ]);
  await geo.preload("IE");
});

test("unknown country rejects, and is retried next time", async () => {
  await assert.rejects(geo.search("XX", "a"), /xx\/_\.json returned 404/);
  const before = requests.length;
  await assert.rejects(geo.search("XX", "a"));
  assert.equal(requests.length, before + 1);
});

test("baseUrl defaults to geo.chofter.com", async () => {
  const seen = [];
  const g = createGeo({ fetch: (url) => (seen.push(url), fixtureFetch(url)) });
  await g.countries();
  assert.equal(seen[0], "https://geo.chofter.com/v1/countries.json");
});

test("classic script exposes a single global with createGeo", async () => {
  const context = vm.createContext({ fetch: fixtureFetch });
  vm.runInContext(fs.readFileSync(path.join(dist, "geo.global.js"), "utf8"), context);
  assert.deepEqual(Object.keys(context).filter((k) => k !== "fetch"), ["choftergeo"]);
  assert.deepEqual(Object.keys(context.choftergeo), ["createGeo"]);
  const g = context.choftergeo.createGeo({ baseUrl: "https://geo.test/v1" });
  assert.equal((await g.search("IE", "cork"))[0].name, "Cork");
});
