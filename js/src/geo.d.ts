export interface Place {
  /** GeoNames id. */
  id: number;
  name: string;
  /** First-level admin division (state, province, county), may be empty. */
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  population: number;
  /** "Name, Region, Country". */
  label: string;
  /** Set when the query matched an alternate name rather than `name`. */
  matched?: string;
}

export interface Country {
  code: string;
  name: string;
  count: number;
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
