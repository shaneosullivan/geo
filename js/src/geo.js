// Client for the static place-search files. No dependencies; works in browsers,
// Node 18+, Workers and React Native.
//
// Naming scheme (everything is relative to baseUrl, e.g. https://geo.example.com/v1):
//   {countryCode}/_.json        country index: name, list of prefix files, top places.
//                               Small countries have no prefix files; `top` is every place.
//   {countryCode}/{prefix}.json places whose search key starts with `prefix`
// For a query, the file to read is the longest listed prefix of the normalised
// query. Busy prefixes are split further: "s" may hold only the most populous
// places starting with s, while "sa" or "san" hold everything for that prefix.

const LETTER_FOLDS = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  þ: "th",
  ł: "l",
  ı: "i",
  ħ: "h",
};

// normalize, prefixOf and fileKey are exported only so the data build can share
// them; the package's public entry point exposes nothing but createGeo.

/** Lowercase, strip accents and punctuation. Build script and client must agree on this. */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[ßæœøđðþłıħ]/g, (letter) => LETTER_FOLDS[letter])
    .replace(/['’‘ʼ`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** First `length` characters (code points) of a normalised key. */
export function prefixOf(key, length) {
  return Array.from(key).slice(0, length).join("");
}

/** URL-safe file name for a prefix: a-z0-9 as is, space as "-", anything else as ~hex. */
export function fileKey(prefix) {
  let fileName = "";
  for (const character of prefix) {
    if (/[a-z0-9]/.test(character)) {
      fileName += character;
    } else if (character === " ") {
      fileName += "-";
    } else {
      fileName += "~" + character.codePointAt(0).toString(16);
    }
  }
  return fileName;
}

// A place in the JSON files is an array:
//   [name, region, lat, lng, population, id, altNames?]
const NAME = 0;
const POPULATION = 4;
const ALT_NAMES = 6;

const EXACT_MATCH = 0;
const PREFIX_MATCH = 1;
const NO_MATCH = -1;

/** Pair each place with its names and their normalised search keys. */
function prepare(records) {
  return records.map((record) => {
    const names = [record[NAME], ...(record[ALT_NAMES] || [])];
    return { record, names, searchKeys: names.map(normalize) };
  });
}

function matchTier(searchKey, query) {
  if (searchKey === query) {
    return EXACT_MATCH;
  }
  // A match at the start of the name or of a later word ranks the same, so
  // "york" lists New York City above small towns that merely start with York.
  if (searchKey.startsWith(query) || searchKey.includes(" " + query)) {
    return PREFIX_MATCH;
  }
  return NO_MATCH;
}

/** The best tier over all of a place's names, and which name gave it. */
function bestMatch(place, query) {
  let tier = NO_MATCH;
  let nameIndex = 0;
  place.searchKeys.forEach((searchKey, index) => {
    const candidate = matchTier(searchKey, query);
    if (candidate !== NO_MATCH && (tier === NO_MATCH || candidate < tier)) {
      tier = candidate;
      nameIndex = index;
    }
  });
  return { tier, nameIndex };
}

const DEFAULT_BASE_URL = "https://geo.chofter.com/v1";
const DEFAULT_LIMIT = 10;

export function createGeo(options = {}) {
  const baseUrl = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchFile = options.fetch || globalThis.fetch.bind(globalThis);
  const cache = new Map(); // path -> Promise of the transformed file contents

  /** Fetch and transform a file once; failed fetches are dropped so they are retried. */
  function load(path, transform) {
    let pending = cache.get(path);
    if (!pending) {
      pending = fetchFile(`${baseUrl}/${path}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`geo: ${path} returned ${response.status}`);
          }
          return response.json();
        })
        .then(transform);
      pending.catch(() => cache.delete(path));
      cache.set(path, pending);
    }
    return pending;
  }

  function loadCountry(countryCode) {
    return load(`${countryCode}/_.json`, (index) => ({
      code: countryCode.toUpperCase(),
      name: index.name,
      depth: index.depth,
      count: index.count,
      prefixFiles: new Set(index.shards),
      topPlaces: prepare(index.top),
    }));
  }

  function toResult(country, place, nameIndex) {
    const [name, region, lat, lng, population, id] = place.record;
    const result = {
      id,
      name,
      region,
      country: country.name,
      countryCode: country.code,
      lat,
      lng,
      population,
      label: [name, region, country.name].filter(Boolean).join(", "),
    };
    if (nameIndex > 0) {
      result.matched = place.names[nameIndex];
    }
    return result;
  }

  /** The prefix file holding every place that could match `query`, or null if none is listed. */
  function prefixFileFor(country, query) {
    const longest = Math.min(country.depth, Array.from(query).length);
    for (let length = longest; length > 0; length--) {
      const candidate = fileKey(prefixOf(query, length));
      if (country.prefixFiles.has(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /** Search one country. `countryCode` is an ISO 3166-1 alpha-2 code. */
  async function search(countryCode, query, searchOptions = {}) {
    const limit = searchOptions.limit || DEFAULT_LIMIT;
    const country = await loadCountry(String(countryCode).toLowerCase());
    const normalizedQuery = normalize(query || "");
    if (!normalizedQuery) {
      return country.topPlaces.slice(0, limit).map((place) => toResult(country, place, 0));
    }

    let candidates = country.topPlaces;
    if (country.depth > 0) {
      const prefixFile = prefixFileFor(country, normalizedQuery);
      if (prefixFile === null) {
        return [];
      }
      candidates = await load(`${country.code.toLowerCase()}/${prefixFile}.json`, prepare);
    }

    const matches = [];
    for (const place of candidates) {
      const { tier, nameIndex } = bestMatch(place, normalizedQuery);
      if (tier !== NO_MATCH) {
        matches.push({ place, tier, nameIndex });
      }
    }
    matches.sort(
      (a, b) => a.tier - b.tier || b.place.record[POPULATION] - a.place.record[POPULATION],
    );
    return matches.slice(0, limit).map((match) => toResult(country, match.place, match.nameIndex));
  }

  /** Countries that have data: [{ code, name, count }]. */
  function countries() {
    return load("countries.json", (rows) =>
      rows.map(([code, name, count]) => ({ code, name, count })),
    );
  }

  /** Warm the cache for a country, e.g. when the user picks it. */
  function preload(countryCode) {
    return loadCountry(String(countryCode).toLowerCase()).then(() => undefined);
  }

  return { search, countries, preload };
}
