# Conformance cases

Every client in this repo must produce the same results from the same files.
`cases.json` holds the shared cases and `v1/` a small hand-made data set in the
real file format. Each client's test suite loads both: serve or stub `v1/` as the
base URL, then check

- `normalize`: `[input, expected]`. Lowercase, decompose (NFD), drop combining
  marks, fold `ß→ss æ→ae œ→oe ø→o đ→d ð→d þ→th ł→l ı→i ħ→h`, delete apostrophes
  (`' ’ ‘ ʼ` and backtick), turn every run of other non-letter, non-digit
  characters into one space, trim.
- `fileKey`: `[prefix, expected]`. `a-z` and `0-9` stay, a space becomes `-`,
  anything else becomes `~` plus its code point in lowercase hex.
- `search`: the result names in order (`limit` defaults to 10), the first
  result's `matched` alternate name, and the data file that answers the query
  (`null` when no file is listed, so the client returns nothing without a request).
- `errors`: searches that must fail.

The data format and the search algorithm are described in the repo README.
Change these cases only together with every client.
