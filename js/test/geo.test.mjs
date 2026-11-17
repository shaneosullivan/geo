// Runs the built package against the shared conformance cases in ../conformance,
// plus checks specific to the JavaScript package. `npm test` builds dist/ first.
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
const conformance = path.join(here, "../../conformance");
const cases = JSON.parse(fs.readFileSync(path.join(conformance, "cases.json"), "utf8"));

const requests = [];
function fixtureFetch(url) {
  requests.push(url);
  const file = path.join(conformance, new URL(url).pathname);
  if (!fs.existsSync(file)) {
    return Promise.resolve({ ok: false, status: 404 });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => JSON.parse(fs.readFileSync(file, "utf8")),
  });
}
const geo = createGeo({ baseUrl: "https://geo.test/v1/", fetch: fixtureFetch });
const names = (list) => list.map((p) => p.name);

test("the modules export only createGeo", async () => {
  for (const file of ["geo.js", "geo.min.js"]) {
    assert.deepEqual(Object.keys(await import(path.join(dist, file))), ["createGeo"], file);
  }
});

// The minified builds must behave exactly like the readable ones.
for (const file of ["geo.min.js", "geo.global.min.js"]) {
  test(`conformance: ${file}`, async () => {
    let make;
    if (file.includes("global")) {
      const context = vm.createContext({ fetch: fixtureFetch });
      vm.runInContext(fs.readFileSync(path.join(dist, file), "utf8"), context);
      assert.deepEqual(
        Object.keys(context).filter((k) => k !== "fetch"),
        ["choftergeo"],
      );
      make = context.choftergeo.createGeo;
    } else {
      make = (await import(path.join(dist, file))).createGeo;
    }
    const g = make({ baseUrl: "https://geo.test/v1", fetch: fixtureFetch });
    for (const c of cases.search) {
      const found = await g.search(c.country, c.query, c.limit ? { limit: c.limit } : undefined);
      // Copy into this realm: arrays from the vm context have their own Array prototype.
      assert.deepEqual(names([...found]), c.names, `${c.country} ${c.query}`);
      if (c.labels) {
        assert.deepEqual(
          [...found].map((p) => p.label),
          c.labels,
        );
      }
    }
    for (const c of cases.errors) {
      await assert.rejects(g.search(c.country, c.query));
    }
    assert.ok(
      fs.readFileSync(path.join(dist, file), "utf8").startsWith("// @chofter/geo "),
      "banner kept",
    );
  });
}

test("conformance: normalize and fileKey", () => {
  for (const [input, expected] of cases.normalize) {
    assert.equal(internals.normalize(input), expected, input);
  }
  for (const [input, expected] of cases.fileKey) {
    assert.equal(internals.fileKey(input), expected, input);
  }
  assert.equal(internals.prefixOf("münchen", 2), "mü");
});

for (const c of cases.search) {
  test(`conformance: search ${c.country} ${JSON.stringify(c.query)}`, async () => {
    const g = createGeo({ baseUrl: "https://geo.test/v1", fetch: fixtureFetch });
    const before = requests.length;
    const found = await g.search(c.country, c.query, c.limit ? { limit: c.limit } : undefined);
    assert.deepEqual(names(found), c.names);
    if (c.labels) {
      assert.deepEqual(
        found.map((p) => p.label),
        c.labels,
      );
    }
    if (found.length) {
      assert.equal(found[0].matched ?? null, c.matched);
    }
    if (c.localName) {
      assert.equal(found[0].localName, c.localName);
    }
    const files = requests.slice(before).map((u) => new URL(u).pathname.replace(/^\/v1\//, ""));
    const index = `${c.country.toLowerCase()}/_.json`;
    assert.equal(files[0], index);
    assert.deepEqual(files.slice(1), c.file && c.file !== index ? [c.file] : []);
  });
}

for (const c of cases.errors) {
  test(`conformance: ${c.country} ${JSON.stringify(c.query)} fails`, async () => {
    await assert.rejects(geo.search(c.country, c.query));
  });
}

test("result shape", async () => {
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
  // Munich's row is [..., [], "", "München"]: the empty placeholders add nothing.
  const [munich] = await geo.search("DE", "munich");
  assert.equal(munich.localName, "München");
  assert.equal("district" in munich, false);
  assert.equal(munich.label, "Munich, Bavaria, Germany");
  const before = requests.length;
  await geo.search("ie", "cork");
  assert.equal(requests.length, before, "a second search in a small country needs no fetch");
});

test("countries and preload", async () => {
  assert.deepEqual(await geo.countries(), [
    { code: "DE", name: "Germany", count: 7 },
    { code: "IE", name: "Ireland", count: 6 },
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
  assert.deepEqual(
    Object.keys(context).filter((k) => k !== "fetch"),
    ["choftergeo"],
  );
  assert.deepEqual(Object.keys(context.choftergeo), ["createGeo"]);
  const g = context.choftergeo.createGeo({ baseUrl: "https://geo.test/v1" });
  assert.equal((await g.search("IE", "cork"))[0].name, "Cork");
});
