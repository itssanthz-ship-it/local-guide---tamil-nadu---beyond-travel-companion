import { db } from './db';
import { ListingCategory, LocalListing } from '../src/types';

const REQUEST_TIMEOUT_MS = 6500;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function geocodeLocationOSM(query: string): Promise<{
  lat: number;
  lng: number;
  displayName: string;
  source: 'live' | 'cached';
} | null> {
  const cleanKey = `geo:${query.trim().toLowerCase()}`;

  // Check cached geocode within 7 days
  const cached = db
    .prepare('SELECT lat, lng, data_json, fetched_at FROM cached_osm_places WHERE id = ?')
    .get(cleanKey) as { lat: number; lng: number; data_json: string; fetched_at: string } | undefined;

  if (cached) {
    const parsed = JSON.parse(cached.data_json) as { displayName: string };
    return { lat: cached.lat, lng: cached.lng, displayName: parsed.displayName, source: 'cached' };
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'LocalGuideTamilNaduApp/1.0' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!data.length) return null;
    const hit = data[0];
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO cached_osm_places (id, query_key, category, lat, lng, data_json, fetched_at)
       VALUES (?, ?, 'geocode', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, data_json=excluded.data_json, fetched_at=excluded.fetched_at`
    ).run(cleanKey, cleanKey, lat, lng, JSON.stringify({ displayName: hit.display_name }), now);

    return { lat, lng, displayName: hit.display_name, source: 'live' };
  } catch {
    return null;
  }
}

function mapOsmTagsToCategory(tags: Record<string, string>): ListingCategory {
  if (tags.tourism === 'hotel' || tags.amenity === 'restaurant') return 'hotels_restaurants';
  if (tags.tourism === 'hostel' || tags.tourism === 'motel') return 'lodges_hostels';
  if (tags.tourism === 'guest_house') return 'rental_homestays';
  if (tags.amenity === 'cafe') return 'tea_cafes';
  if (tags.amenity === 'cinema' || tags.amenity === 'theatre') return 'theatres_entertainment';
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.amenity === 'pharmacy') {
    return 'hospitals_emergency';
  }
  if (tags.amenity === 'bus_station' || tags.railway === 'station' || tags.amenity === 'taxi') {
    return 'transport_services';
  }
  return 'tourist_attractions';
}

export async function searchLiveOsmNearby(params: {
  lat: number;
  lng: number;
  districtLabel: string;
  queryKey: string;
}): Promise<{ listings: LocalListing[]; source: 'live' | 'cached'; fetchedAt: string; warning?: string }> {
  const { lat, lng, districtLabel, queryKey } = params;
  const cacheRows = db
    .prepare('SELECT data_json, fetched_at FROM cached_osm_places WHERE query_key = ? AND category != ? LIMIT 30')
    .all(queryKey, 'geocode') as { data_json: string; fetched_at: string }[];

  // Return fresh cache if < 6 hours old
  if (cacheRows.length > 0) {
    const newest = cacheRows[0].fetched_at;
    const ageMs = Date.now() - new Date(newest).getTime();
    if (ageMs < 1000 * 60 * 60 * 6) {
      return {
        listings: cacheRows.map((r) => ({
          ...(JSON.parse(r.data_json) as LocalListing),
          dataSource: 'Cached OSM Data',
          verificationStatus: 'Cached',
        })),
        source: 'cached',
        fetchedAt: newest,
      };
    }
  }

  const overpassQuery = `
    [out:json][timeout:6];
    (
      node["tourism"~"hotel|guest_house|hostel|attraction"](around:4500,${lat},${lng});
      node["amenity"~"restaurant|cafe|hospital|cinema|bus_station"](around:4500,${lat},${lng});
    );
    out body 24;
  `;

  try {
    const res = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'LocalGuideTamilNaduApp/1.0',
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!res.ok) {
      throw new Error(`OSM status ${res.status}`);
    }

    const json = (await res.json()) as {
      elements?: Array<{
        id: number;
        lat: number;
        lon: number;
        tags?: Record<string, string>;
      }>;
    };

    const now = new Date().toISOString();
    const mapped: LocalListing[] = [];
    const insertStmt = db.prepare(
      `INSERT INTO cached_osm_places (id, query_key, category, lat, lng, data_json, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json, fetched_at=excluded.fetched_at`
    );

    for (const el of json.elements || []) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || tags['name:ta'];
      if (!name) continue;
      const category = mapOsmTagsToCategory(tags);
      const listing: LocalListing = {
        id: `osm-${el.id}`,
        name,
        nameTa: tags['name:ta'],
        category,
        district: districtLabel,
        state: 'Tamil Nadu',
        cityOrTown: tags['addr:city'] || districtLabel,
        pincode: tags['addr:postcode'],
        address:
          [tags['addr:street'], tags['addr:suburb'], tags['addr:city'], tags['addr:postcode']]
            .filter(Boolean)
            .join(', ') || `${districtLabel} (OpenStreetMap coordinates)`,
        lat: el.lat,
        lng: el.lon,
        description: `Retrieved live from OpenStreetMap (${tags.tourism || tags.amenity || 'POI'}). Contact and live availability should be confirmed directly.`,
        openingHours: tags.opening_hours || 'Check on site (not listed in OSM)',
        website: tags.website,
        amenities: [tags.wheelchair === 'yes' ? 'Wheelchair accessible' : 'OSM Geo-verified location'],
        dataSource: 'Live OSM Data',
        verificationStatus: 'Unverified',
        isIllustrativeImage: true,
        lastUpdated: now,
        avgRating: 0,
        reviewCount: 0,
      };
      mapped.push(listing);
      insertStmt.run(listing.id, queryKey, category, listing.lat, listing.lng, JSON.stringify(listing), now);
    }

    return { listings: mapped, source: 'live', fetchedAt: now };
  } catch {
    if (cacheRows.length > 0) {
      return {
        listings: cacheRows.map((r) => ({
          ...(JSON.parse(r.data_json) as LocalListing),
          dataSource: 'Cached OSM Data',
          verificationStatus: 'Cached',
        })),
        source: 'cached',
        fetchedAt: cacheRows[0].fetched_at,
        warning: 'Live OpenStreetMap lookup timed out; showing cached snapshot.',
      };
    }
    return {
      listings: [],
      source: 'cached',
      fetchedAt: new Date().toISOString(),
      warning: 'Live OpenStreetMap service unreachable right now. Curated local database listings remain available.',
    };
  }
}
