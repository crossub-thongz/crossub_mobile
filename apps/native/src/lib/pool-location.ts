import * as SecureStore from 'expo-secure-store';

import type { GeoPoint } from '@/src/lib/travel';

export const POOL_RADIUS_OPTIONS = [10, 25, 50, 100] as const;
export type PoolRadiusKm = (typeof POOL_RADIUS_OPTIONS)[number] | null;
export type PoolSort = 'nearest' | 'soonest' | 'newest';

export const POOL_SORT_LABEL: Record<PoolSort, string> = {
  nearest: 'Nearest',
  soonest: 'Soonest',
  newest: 'Newest',
};

export type PoolOrigin = GeoPoint & {
  label: string;
  source: 'gps' | 'custom';
};

export type PoolLocationPrefs = {
  origin: PoolOrigin | null;
  radiusKm: PoolRadiusKm;
  sort: PoolSort;
};

export type GeocodeHit = GeoPoint & { label: string };

const STORAGE_KEY = 'csb_pool_location';
const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'CROSSUB-Inspector/0.1',
};

export const DEFAULT_POOL_PREFS: PoolLocationPrefs = {
  origin: null,
  radiusKm: 25,
  sort: 'nearest',
};

export function liveOrigin(
  saved: PoolOrigin | null,
  gps: GeoPoint | null,
): PoolOrigin | null {
  if (saved?.source === 'custom') return saved;
  if (gps) {
    return {
      latitude: gps.latitude,
      longitude: gps.longitude,
      label: saved?.source === 'gps' ? saved.label : 'Current location',
      source: 'gps',
    };
  }
  return saved;
}

export async function loadPoolLocationPrefs(): Promise<PoolLocationPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return DEFAULT_POOL_PREFS;
    const parsed = JSON.parse(raw) as Partial<PoolLocationPrefs>;
    const radius =
      parsed.radiusKm === null ||
      (typeof parsed.radiusKm === 'number' &&
        (POOL_RADIUS_OPTIONS as readonly number[]).includes(parsed.radiusKm))
        ? (parsed.radiusKm as PoolRadiusKm)
        : DEFAULT_POOL_PREFS.radiusKm;
    const origin =
      parsed.origin &&
      Number.isFinite(parsed.origin.latitude) &&
      Number.isFinite(parsed.origin.longitude)
        ? parsed.origin
        : null;
    return {
      origin,
      radiusKm: radius,
      sort:
        parsed.sort === 'soonest' || parsed.sort === 'newest'
          ? parsed.sort
          : 'nearest',
    };
  } catch {
    return DEFAULT_POOL_PREFS;
  }
}

export async function savePoolLocationPrefs(prefs: PoolLocationPrefs): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Expo web / locked device: location prefs stay in memory.
  }
}

export async function searchPlaces(query: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'au',
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: NOMINATIM_HEADERS },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
    name?: string;
    address?: {
      suburb?: string;
      city?: string;
      town?: string;
      state?: string;
      postcode?: string;
    };
  }>;
  return rows
    .map((row) => {
      const latitude = Number(row.lat);
      const longitude = Number(row.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const address = row.address;
      const label =
        [address?.suburb ?? address?.city ?? address?.town, address?.state, address?.postcode]
          .filter(Boolean)
          .join(' ') ||
        row.name ||
        row.display_name ||
        q;
      return { latitude, longitude, label };
    })
    .filter((hit): hit is GeocodeHit => hit != null);
}

export async function reverseGeocodeLabel(point: GeoPoint): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(point.latitude),
    lon: String(point.longitude),
    format: 'jsonv2',
    zoom: '14',
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    { headers: NOMINATIM_HEADERS },
  );
  if (!res.ok) return null;
  const row = (await res.json()) as {
    address?: {
      suburb?: string;
      city?: string;
      town?: string;
      municipality?: string;
      state?: string;
    };
    name?: string;
  };
  const suburb =
    row.address?.suburb ??
    row.address?.town ??
    row.address?.city ??
    row.address?.municipality ??
    row.name;
  const state = row.address?.state;
  if (suburb && state) return `${suburb} ${state}`;
  return suburb ?? state ?? null;
}

export function mapsSearchUrl(origin: GeoPoint | null): string {
  if (!origin) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${origin.latitude},${origin.longitude}`;
}

function lon2tile(lon: number, zoom: number) {
  return ((lon + 180) / 360) * 2 ** zoom;
}

function lat2tile(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

export function mapTile(origin: GeoPoint | null): {
  url: string | null;
  markerLeft: string;
  markerTop: string;
} {
  if (!origin) {
    return { url: null, markerLeft: '50%', markerTop: '50%' };
  }
  const zoom = 13;
  const tileXf = lon2tile(origin.longitude, zoom);
  const tileYf = lat2tile(origin.latitude, zoom);
  const tileX = Math.floor(tileXf);
  const tileY = Math.floor(tileYf);
  return {
    url: `https://basemaps.cartocdn.com/dark_all/${zoom}/${tileX}/${tileY}@2x.png`,
    markerLeft: `${(tileXf - tileX) * 100}%`,
    markerTop: `${(tileYf - tileY) * 100}%`,
  };
}
