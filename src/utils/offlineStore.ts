import { GeneratedItinerary, LocalListing, TourismPackage, TouristAttraction } from '../types';

const KEYS = {
  ATTRACTIONS: 'lg_cache_attractions_v1',
  LISTINGS: 'lg_cache_listings_v1',
  PACKAGES: 'lg_cache_packages_v1',
  SAVED_ITEMS: 'lg_saved_offline_items_v1',
  SAVED_ITINERARIES: 'lg_saved_itineraries_v1',
  LAST_SYNC: 'lg_last_sync_v1',
  AUTH_TOKEN: 'lg_auth_token_v1',
};

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(KEYS.AUTH_TOKEN);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEYS.AUTH_TOKEN, token);
    else localStorage.removeItem(KEYS.AUTH_TOKEN);
  } catch {
    // ignore storage errors
  }
}

export function cacheCatalogSnapshot(data: {
  attractions?: TouristAttraction[];
  listings?: LocalListing[];
  packages?: TourismPackage[];
}) {
  try {
    if (data.attractions) localStorage.setItem(KEYS.ATTRACTIONS, JSON.stringify(data.attractions));
    if (data.listings) localStorage.setItem(KEYS.LISTINGS, JSON.stringify(data.listings));
    if (data.packages) localStorage.setItem(KEYS.PACKAGES, JSON.stringify(data.packages));
    localStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  } catch {
    // quota fallback
  }
}

export function readCachedCatalogSnapshot(): {
  attractions: TouristAttraction[];
  listings: LocalListing[];
  packages: TourismPackage[];
  lastSync: string | null;
} {
  try {
    return {
      attractions: JSON.parse(localStorage.getItem(KEYS.ATTRACTIONS) || '[]'),
      listings: JSON.parse(localStorage.getItem(KEYS.LISTINGS) || '[]'),
      packages: JSON.parse(localStorage.getItem(KEYS.PACKAGES) || '[]'),
      lastSync: localStorage.getItem(KEYS.LAST_SYNC),
    };
  } catch {
    return { attractions: [], listings: [], packages: [], lastSync: null };
  }
}

export function getSavedOfflineIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SAVED_ITEMS) || '[]');
  } catch {
    return [];
  }
}

export function toggleSavedOfflineId(id: string): string[] {
  const current = getSavedOfflineIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  try {
    localStorage.setItem(KEYS.SAVED_ITEMS, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function getLocalItineraries(): GeneratedItinerary[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SAVED_ITINERARIES) || '[]');
  } catch {
    return [];
  }
}

export function saveLocalItinerary(itinerary: GeneratedItinerary): GeneratedItinerary[] {
  const current = getLocalItineraries();
  const item = { ...itinerary, id: itinerary.id || `local-${Date.now()}` };
  const next = [item, ...current.filter((x) => x.id !== item.id)].slice(0, 15);
  try {
    localStorage.setItem(KEYS.SAVED_ITINERARIES, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
