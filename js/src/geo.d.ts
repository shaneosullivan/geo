export interface Place {
  /** GeoNames id. */
  id: number;
  name: string;
  /**
   * First-level admin division (state, province), may be empty. In Ireland it
   * is the county, and in the UK the council area.
   */
  region: string;
  /**
   * Second-level admin division (county, district), set only when another place
   * in the country has the same name and region.
   */
  district?: string;
  /**
   * The name in the country's own language, such as "서울" for Seoul or "München"
   * for Munich. Absent when that language is English, GeoNames has no name in
   * it, or it is the same as `name`.
   */
  localName?: string;
  country: string;
  /**
   * ISO 3166-1 alpha-2, except for the UK's nations, which use ISO 3166-2:
   * "GB-ENG", "GB-SCT", "GB-WLS" and "GB-NIR" (also for a search of "GB").
   */
  countryCode: string;
  lat: number;
  lng: number;
  population: number;
  /** "Name, Region, Country", or "Name, District, Region, Country" when `district` is set. */
  label: string;
  /** Set when the query matched an alternate name rather than `name`. */
  matched?: string;
}

export interface Country {
  code: string;
  name: string;
  count: number;
  /** Other names to match in a country picker, such as "United Kingdom" and "UK" for England. */
  altNames?: string[];
}

export interface GeoOptions {
  /** URL of the versioned data folder. Defaults to "https://geo.chofter.com/v1". */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface Geo {
  search(countryCode: string, query: string, options?: { limit?: number }): Promise<Place[]>;
  countries(): Promise<Country[]>;
  preload(countryCode: string): Promise<void>;
}

export function createGeo(options?: GeoOptions): Geo;
