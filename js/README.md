<p align="center">
  <a href="https://geo.chofter.com"
    ><img
      src="https://geo.chofter.com/icon.svg"
      width="112"
      height="112"
      alt="Chofter Geo logo: a green dot with a C to its left"
  /></a>
</p>

<h1 align="center">@chofter/geo</h1>

<p align="center">
  <b>Every town and city, one small file away.</b><br />
  <a href="https://geo.chofter.com">Website and live demo</a> ·
  <a href="https://github.com/shaneosullivan/geo#data-format">Data format</a> ·
  <a href="https://github.com/shaneosullivan/geo/tree/main/js">Source</a>
</p>

Town and city search for any country, as a tiny dependency-free client. There is
no API and no key. The data is served as static JSON files from
[geo.chofter.com](https://geo.chofter.com), built monthly from
[GeoNames](https://www.geonames.org/). The client works out which file holds the
answer, fetches it from the CDN and ranks the results locally.

- About 237,000 towns, cities and suburbs in 246 countries, with coordinates.
- One small request per keystroke at most, often none (files are cached).
- About 1.4 KB minified and gzipped. Works in browsers, Node 18+, Deno, Bun, Workers and React Native.

## Install

```bash
npm install @chofter/geo
```

```js
import { createGeo } from "@chofter/geo";

const geo = createGeo();
const places = await geo.search("IE", "dub", { limit: 5 });
// [{ id: 2964574, name: "Dublin", region: "County Dublin", country: "Ireland",
//    countryCode: "IE", lat: 53.3331, lng: -6.2489, population: 1024027,
//    label: "Dublin, County Dublin, Ireland" }, ...]
```

Without a bundler, import it straight from the CDN:

```html
<script type="module">
  import { createGeo } from "https://geo.chofter.com/geo.js";
</script>
```

Or load the classic script, which adds one global, `choftergeo`:

```html
<script src="https://geo.chofter.com/geo.global.min.js"></script>
<script>
  const geo = choftergeo.createGeo();
</script>
```

### Files

Every build is in the npm package and on the CDN (`https://geo.chofter.com/<file>`),
and npm CDNs such as jsDelivr and unpkg serve the package too.

| File                     | Format                        | Import from npm           | Size (gzip) |
| ------------------------ | ----------------------------- | ------------------------- | ----------- |
| `dist/geo.js`            | ES module, readable           | `@chofter/geo`            | 2.8 KB      |
| `dist/geo.min.js`        | ES module, minified           | `@chofter/geo/min`        | 1.4 KB      |
| `dist/geo.global.js`     | classic script, readable      | `@chofter/geo/global`     | 2.8 KB      |
| `dist/geo.global.min.js` | classic script, minified      | `@chofter/geo/global.min` | 1.4 KB      |
| `dist/geo.d.ts`          | TypeScript types (all builds) |                           |             |

Bundlers should use the default `@chofter/geo` entry and minify it themselves.
The minified files are for loading directly in a page.

## API

### `createGeo(options?)`

- `baseUrl`: where the data lives. Defaults to `https://geo.chofter.com/v1`;
  set it if you host the files yourself.
- `fetch`: a custom `fetch` implementation.

Returns an object with:

- `search(countryCode, query, { limit = 10 })`: places in that country whose
  name or an alternate name (including local spellings, such as "München" for
  Munich) starts with the query, or has a later word that does. Case, accents
  and punctuation are ignored. Exact matches come first, then larger places.
  An empty query returns the largest places.
- `countries()`: `[{ code, name, count, altNames? }]` for a country picker.
- `preload(countryCode)`: fetches the country's index early, for example when
  the user picks a country.

`countryCode` is an ISO 3166-1 alpha-2 code such as `"US"` or `"ie"`, or for the
UK one of its nations (`"GB-ENG"`, `"GB-SCT"`, `"GB-WLS"`, `"GB-NIR"`) or `"GB"`
for all four.
Results include `matched` when the query matched an alternate name,
`district` when another place in the country has the same name and region,
`city` when the place is a suburb (the city it is part of), and `localName` when the country's own language has a different name for the place.

## Examples

These are real results from the live data. Long ones are cut down to the
fields that matter, with `// …` marking what was left out.

### A full result

```js
await geo.search("IE", "dub", { limit: 3 });
```

```json
[
  {
    "id": 2964574,
    "name": "Dublin",
    "region": "County Dublin",
    "country": "Ireland",
    "countryCode": "IE",
    "lat": 53.3331,
    "lng": -6.2489,
    "population": 1024027,
    "label": "Dublin, County Dublin, Ireland"
  },
  {
    "id": 2964690,
    "name": "Douglas",
    "region": "County Cork",
    "country": "Ireland",
    "countryCode": "IE",
    "lat": 51.8744,
    "lng": -8.435,
    "population": 26883,
    "label": "Douglas, County Cork, Ireland",
    "matched": "Dúbhglas"
  },
  {
    "id": 2966131,
    "name": "Blackrock",
    "region": "County Dublin",
    "country": "Ireland",
    "countryCode": "IE",
    "lat": 53.3015,
    "lng": -6.1778,
    "population": 8821,
    "label": "Blackrock, County Dublin, Ireland",
    "matched": "Carraig Dubh"
  }
]
```

`id` is the GeoNames id. `label` is ready to display. Douglas and Blackrock are
found by their Irish names, so `matched` says which name was hit. You might show
it as "Douglas (Dúbhglas)".

### Local spellings and other scripts

```js
await geo.search("DE", "München", { limit: 2 });
await geo.search("RU", "Москва", { limit: 1 });
```

```jsonc
[
  { "name": "Munich", "label": "Munich, Bavaria, Germany", "localName": "München", "matched": "München" /* … */ },
  { "name": "Münchenbernsdorf", "label": "Münchenbernsdorf, Thuringia, Germany" /* … */ }
]
[
  { "name": "Moscow", "label": "Moscow, Moscow, Russia", "localName": "Москва", "matched": "Москва" /* … */ }
]
```

Accents are optional: `"munchen"` and `"sao pau"` work just as well.

### Local names

`name` is in English where English has its own name for the place, and
otherwise in the local spelling in Latin letters. `localName` gives the name in
the country's own language, whatever you searched for:

```js
(await geo.search("KR", "", { limit: 3 })).map((p) => [p.name, p.localName]);
```

```json
[
  ["Seoul", "서울"],
  ["Busan", "부산"],
  ["Incheon", "인천"]
]
```

It is left out when there is nothing to add: when the country's first language
is English (the US, Ireland, India), when GeoNames has no name in it, or when it
is the same as `name` (Paris, Berlin). Countries with several languages use the
first one GeoNames lists, so Geneva's `localName` is German, "Genf".

### Same name, different places

```js
(await geo.search("US", "springfield", { limit: 4 })).map((p) => p.label);
```

```json
[
  "Springfield, Missouri, United States",
  "Springfield, Massachusetts, United States",
  "Springfield, Illinois, United States",
  "Springfield, Oregon, United States"
]
```

Exact matches come first, largest first. When two places share a name and a
region, they also get a `district` (a county or district), and the label
includes it:

```js
(await geo.search("US", "plantation", { limit: 3 })).map((p) => p.label);
```

```json
[
  "Plantation, Broward County, Florida, United States",
  "Plantation, Sarasota County, Florida, United States",
  "Plantation, Monroe County, Florida, United States"
]
```

Suburbs are included, and their label names their city, in `city`:

```js
(await geo.search("AU", "leichhardt")).map((p) => p.label);
```

```json
["Leichhardt, Sydney, New South Wales, Australia", "Leichhardt, Queensland, Australia"]
```

A suburb's city is the large city nearby with the strongest pull (population
divided by distance squared). A suburb with no large city nearby, like the
Leichhardt near Ipswich, has no `city`.

So `label` tells namesakes apart in nearly every case. A few small places share
their name, region and district too; use `lat` and `lng` (or `id`) for those.

### Ireland and the UK

In Ireland the region is the county. The UK is four countries, England,
Scotland, Wales and Northern Ireland, with codes `GB-ENG`, `GB-SCT`, `GB-WLS`
and `GB-NIR`, and the region is the council area. Searching `"GB"`, which is
what browsers and IP lookups report, covers all four, and each result says
which nation it is in:

```js
(await geo.search("IE", "blackrock", { limit: 2 })).map((p) => p.label);
(await geo.search("GB", "newport", { limit: 2 })).map((p) => [p.label, p.countryCode]);
```

```json
["Blackrock, County Dublin, Ireland", "Blackrock, County Louth, Ireland"]
[
  ["Newport, Newport, Wales", "GB-WLS"],
  ["Newport, Isle of Wight, England", "GB-ENG"]
]
```

### Ranking: exact names, then prefixes and later words

```js
(await geo.search("US", "york")).map((p) => p.name);
```

```json
[
  "York",
  "York",
  "York",
  "York",
  "York",
  "New York City",
  "West New York",
  "Yorkville",
  "York Beach",
  "Yorktown"
]
```

The five towns called exactly "York" rank first. After them come names that
start with "york", or that have a later word starting with it, ordered by
population. That's how New York City appears.

### An empty query

```js
(await geo.search("FR", "", { limit: 5 })).map((p) => p.name);
```

```json
["Paris", "Marseille", "Lyon", "Toulouse", "Nice"]
```

The country's largest places, which are handy to show before the user types.

### Countries

```js
await geo.countries();
```

```jsonc
[
  { "code": "AF", "name": "Afghanistan", "count": 319 },
  { "code": "AX", "name": "Aland Islands", "count": 21 },
  { "code": "AL", "name": "Albania", "count": 418 },
  // …
  { "code": "GB-SCT", "name": "Scotland", "count": 667, "altNames": ["United Kingdom", "UK"] },
  // … 249 in all, sorted by name
]
```

`count` is the number of places in that country. The UK's four nations are
listed instead of the UK itself, each with `altNames` "United Kingdom" and "UK", so
a picker that matches those can offer all four.

### No match and errors

```js
await geo.search("IE", "zzz"); // []
await geo.search("XX", "a"); // rejects: Error("geo: xx/_.json returned 404")
```

No match is an empty array, not an error. An unknown country code or a network
failure rejects, and the failed file is fetched again on the next call.

## How it works

Each country has an index file, `/v1/{cc}/_.json`, that lists its prefix files.
A small country fits in its index. For a larger one, the client reads the file
for the longest listed prefix of the query, such as `/v1/us/sa.json` for "San Fr".
Busy prefixes are split further, and the shorter file keeps the most populous
places, so every keystroke stays one small request.

## Licence

The code is MIT. The data comes from GeoNames under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): if you show results,
credit GeoNames, for example "Place data © GeoNames".

Clients for other languages live alongside this one in
[shaneosullivan/geo](https://github.com/shaneosullivan/geo) and share its
conformance tests.
