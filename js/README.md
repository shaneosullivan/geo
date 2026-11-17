# @chofter/geo

Town and city search for any country, as a tiny dependency-free client. There is
no API and no key. The data is served as static JSON files from
[geo.chofter.com](https://geo.chofter.com), built monthly from
[GeoNames](https://www.geonames.org/). The client works out which file holds the
answer, fetches it from the CDN and ranks the results locally.

- About 226,000 towns and cities in 246 countries, with coordinates.
- One small request per keystroke at most, often none (files are cached).
- About 2.5 KB gzipped. Works in browsers, Node 18+, Deno, Bun, Workers and React Native.

## Install

```bash
npm install @chofter/geo
```

```js
import { createGeo } from "@chofter/geo";

const geo = createGeo();
const places = await geo.search("IE", "dub", { limit: 5 });
// [{ id: 2964574, name: "Dublin", region: "Leinster", country: "Ireland",
//    countryCode: "IE", lat: 53.3331, lng: -6.2489, population: 1024027,
//    label: "Dublin, Leinster, Ireland" }, ...]
```

Without a bundler, import it straight from the CDN:

```html
<script type="module">
  import { createGeo } from "https://geo.chofter.com/geo.js";
</script>
```

Or load the classic script, which adds one global, `choftergeo`:

```html
<script src="https://geo.chofter.com/geo.global.js"></script>
<script>
  const geo = choftergeo.createGeo();
</script>
```

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
- `countries()`: `[{ code, name, count }]` for a country picker.
- `preload(countryCode)`: fetches the country's index early, for example when
  the user picks a country.

`countryCode` is an ISO 3166-1 alpha-2 code such as `"US"` or `"ie"`.
Results include `matched` when the query matched an alternate name.

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
