# geo

Town and city search clients for [geo.chofter.com](https://geo.chofter.com):
about 237,000 places in 246 countries from [GeoNames](https://www.geonames.org/),
served as static JSON files. There is no API and no key. A client works out which
file holds the answer, fetches it from the CDN and ranks the results itself.

| Language   | Folder       | Package                                                      |
| ---------- | ------------ | ------------------------------------------------------------ |
| JavaScript | [`js/`](js/) | [`@chofter/geo`](https://www.npmjs.com/package/@chofter/geo) |

The landing page has sample code for Python, Ruby, Go, C# and Java in the
meantime.

## Data format

Everything is relative to the base URL, `https://geo.chofter.com/v1`.

- `countries.json`: `[code, name, count, altNames?]` per country. The UK is
  listed as its four nations, `GB-ENG`, `GB-SCT`, `GB-WLS` and `GB-NIR`, each
  with `altNames` `["United Kingdom", "UK"]`.
- `{cc}/_.json`: `{ name, depth, count, shards, top }`, where `cc` is the
  lowercase ISO 3166-1 alpha-2 code, or a nation's code such as `gb-eng`. For
  a small country `depth` is 0, `shards` is empty and `top` holds every place.
- `{cc}/{key}.json`: an array of places for one prefix.
- A place is `[name, region, lat, lng, population, geonameId, altNames?, district?, localName?, city?]`.
  Trailing items are left out, and one that is missing before a present one is
  `[]` (`altNames`) or `""`.
  - `district` (a county or district) is there only when another place in the
    country has the same name and region. Show it in the label, as in
    "Plantation, Broward County, Florida, United States".
  - `localName` is the name in the country's first official language, such as
    "서울" for Seoul, when that language is not English and the name differs
    from `name`. It is searchable like an alternate name.
  - `city` is set for a suburb: the city it is part of. Show it after the
    name, as in "Leichhardt, Sydney, New South Wales, Australia". The label is
    `name`, `city`, `district`, `region` and the country, leaving out empty ones.
- In Ireland a place's region is its county, and in the UK its council area.
- `gb/_.json` holds the whole UK. It also has `parts`, each nation's code and
  name, and `regionParts`, the nation of each region, so a search of `GB` can
  report each place's nation as its country.

## Search algorithm

1. `q = normalize(query)`. If `q` is empty, return the first `limit` places of `top`.
2. If `depth` is 0, the candidates are `top`. Otherwise, for `n` from
   `min(depth, length of q in code points)` down to 1, take the first `n` code
   points of `q`; the first whose `fileKey` is in `shards` names the file to
   fetch. If none is listed, return nothing.
3. A candidate matches if `normalize` of its name, an alternate name or its
   `localName` equals
   `q` (tier 0), or starts with `q` or contains `" " + q` (tier 1). Use the best
   tier over all its names, and remember which name gave it.
4. Sort by tier, then by population descending (a stable sort), and return the
   first `limit` (default 10). Report the alternate name that matched, if it was
   not the main name. If the index has `regionParts`, a place's country is the
   part its region maps to.

`normalize` and `fileKey` are defined in [`conformance/`](conformance/), which
also holds the cases every client must pass.

## Contributing

This repository is mirrored from a private one, so pull requests are applied by
hand. Issues are welcome.

Code style is checked with [oxlint](https://oxc.rs/docs/guide/usage/linter)
(`npm run lint` in `js/`, using `.oxlintrc.json`): every `if`, `else`, `for`,
`while` and `do` body uses braces. Formatting is
[oxfmt](https://oxc.rs/docs/guide/usage/formatter) (`npm run format`, using `.oxfmtrc.json`).

## Licence

Code: MIT. Data: GeoNames, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/);
credit GeoNames wherever you show results.
