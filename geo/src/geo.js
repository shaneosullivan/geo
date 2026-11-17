// Client for the static place-search files. No dependencies; works in browsers,
// Node 18+, Workers and React Native.
//
// Naming scheme (everything is relative to baseUrl, e.g. https://geo.example.com/v1):
//   {cc}/_.json        country index: name, list of prefix files, top places.
//                      Small countries have no prefix files; `top` is every place.
//   {cc}/{prefix}.json places whose search key starts with `prefix`
// For a query, the file to read is the longest listed prefix of the normalised
// query. Busy prefixes are split further: "s" may hold only the most populous
// places starting with s, while "sa" or "san" hold everything for that prefix.

const FOLD = {
  ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ð: "d", þ: "th", ł: "l", ı: "i", ħ: "h",
};

// normalize, prefixOf and fileKey are exported only so the data build can share
// them; the package's public entry point exposes nothing but createGeo.

/** Lowercase, strip accents and punctuation. Build script and client must agree on this. */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[ßæœøđðþłıħ]/g, (c) => FOLD[c])
    .replace(/['’‘ʼ`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** First `n` characters (code points) of a normalised key. */
export function prefixOf(key, n) {
  return Array.from(key).slice(0, n).join("");
}

/** URL-safe file name for a prefix: a-z0-9 as is, space as "-", anything else as ~hex. */
export function fileKey(prefix) {
  let out = "";
  for (const ch of prefix) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch === " ") out += "-";
    else out += "~" + ch.codePointAt(0).toString(16);
  }
  return out;
}

// Record layout in the JSON files: [name, region, lat, lng, population, id, altNames?]
function prepare(rows) {
  return rows.map((r) => {
    const names = [r[0], ...(r[6] || [])];
    return { r, names, keys: names.map(normalize) };
  });
}

function matchTier(key, q) {
  if (key === q) return 0;
  // A match at the start of the name or of a later word ranks the same, so
  // "york" lists New York City above small towns that merely start with York.
  if (key.startsWith(q) || key.includes(" " + q)) return 1;
  return -1;
}

const DEFAULT_BASE_URL = "https://geo.chofter.com/v1";

export function createGeo(options = {}) {
  const base = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const doFetch = options.fetch || globalThis.fetch.bind(globalThis);
  const cache = new Map();

  function load(path, transform) {
    let p = cache.get(path);
    if (!p) {
      p = doFetch(`${base}/${path}`)
        .then((res) => {
          if (!res.ok) throw new Error(`geo: ${path} returned ${res.status}`);
          return res.json();
        })
        .then(transform);
      p.catch(() => cache.delete(path));
      cache.set(path, p);
    }
    return p;
  }

  function country(cc) {
    return load(`${cc}/_.json`, (j) => ({
      code: cc.toUpperCase(),
      name: j.name,
      depth: j.depth,
      count: j.count,
      shards: new Set(j.shards),
      top: prepare(j.top),
    }));
  }

  function toResult(meta, entry, matchedIndex) {
    const [name, region, lat, lng, population, id] = entry.r;
    const out = {
      id,
      name,
      region,
      country: meta.name,
      countryCode: meta.code,
      lat,
      lng,
      population,
      label: [name, region, meta.name].filter(Boolean).join(", "),
    };
    if (matchedIndex > 0) out.matched = entry.names[matchedIndex];
    return out;
  }

  /** Search one country. `cc` is an ISO 3166-1 alpha-2 code. */
  async function search(cc, query, opts = {}) {
    const limit = opts.limit || 10;
    const meta = await country(String(cc).toLowerCase());
    const q = normalize(query || "");
    if (!q) return meta.top.slice(0, limit).map((e) => toResult(meta, e, 0));

    let entries = meta.top;
    if (meta.depth > 0) {
      let key = null;
      for (let n = Math.min(meta.depth, Array.from(q).length); n > 0 && key === null; n--) {
        const candidate = fileKey(prefixOf(q, n));
        if (meta.shards.has(candidate)) key = candidate;
      }
      if (key === null) return [];
      entries = await load(`${meta.code.toLowerCase()}/${key}.json`, prepare);
    }

    const hits = [];
    for (const e of entries) {
      let best = -1;
      let bestIndex = 0;
      for (let i = 0; i < e.keys.length; i++) {
        const t = matchTier(e.keys[i], q);
        if (t !== -1 && (best === -1 || t < best)) {
          best = t;
          bestIndex = i;
        }
      }
      if (best !== -1) hits.push({ e, tier: best, i: bestIndex });
    }
    hits.sort((a, b) => a.tier - b.tier || b.e.r[4] - a.e.r[4]);
    return hits.slice(0, limit).map((h) => toResult(meta, h.e, h.i));
  }

  /** Countries that have data: [{ code, name, count }]. */
  function countries() {
    return load("countries.json", (rows) =>
      rows.map(([code, name, count]) => ({ code, name, count }))
    );
  }

  /** Warm the cache for a country, e.g. when the user picks it. */
  function preload(cc) {
    return country(String(cc).toLowerCase()).then(() => undefined);
  }

  return { search, countries, preload };
}
