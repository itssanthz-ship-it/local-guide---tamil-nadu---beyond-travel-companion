import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Navigation,
  Wifi,
  WifiOff,
  Star,
  Globe,
  Plus,
  Compass,
  ShieldCheck,
  Bookmark,
  ChevronRight,
  Users,
  Menu,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  ALL_DISTRICTS,
  IMG_CHETTINAD_STAY,
  IMG_FILTER_COFFEE,
  IMG_HERO_TEMPLE,
  IMG_KANYAKUMARI,
  IMG_NILGIRI_HILLS,
  SEED_ATTRACTIONS,
  SEED_LISTINGS,
  SEED_PACKAGES,
} from './data/seedData';
import { TRANSLATIONS } from './i18n/translations';
import {
  AttractionCategory,
  Language,
  ListingCategory,
  LocalListing,
  TourismPackage,
  TouristAttraction,
  TravelGroupProfile,
  User,
} from './types';
import {
  cacheCatalogSnapshot,
  getSavedOfflineIds,
  getStoredToken,
  readCachedCatalogSnapshot,
  setStoredToken,
  toggleSavedOfflineId,
} from './utils/offlineStore';
import InteractiveMap, { MapPin as MapMarkerPin } from './components/InteractiveMap';
import AuthTravelGroupModal from './components/AuthTravelGroupModal';
import ListingDetailModal, { DetailModalTarget } from './components/ListingDetailModal';
import AddListingModal from './components/AddListingModal';
import AITripAdvisorView from './components/AITripAdvisorView';
import FloatingAssistant from './components/FloatingAssistant';
import ResilientImage from './components/ResilientImage';

type ActiveSection = 'explore' | 'attractions' | 'packages' | 'planner' | 'guides';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const t = TRANSLATIONS[language];

  const [activeSection, setActiveSection] = useState<ActiveSection>('explore');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth & Travel Group
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [guestGroup, setGuestGroup] = useState<TravelGroupProfile>({
    groupType: 'family',
    memberCount: 4,
    hasChildren: false,
    hasSeniors: false,
    budgetTier: 'moderate',
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalStep, setAuthModalStep] = useState<'auth' | 'group'>('auth');

  // Offline & Network
  const [offlineMode, setOfflineMode] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [savedOfflineIds, setSavedOfflineIds] = useState<string[]>(() => getSavedOfflineIds());
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(
    () => readCachedCatalogSnapshot().lastSync
  );

  // Core Datasets
  const [attractions, setAttractions] = useState<TouristAttraction[]>(SEED_ATTRACTIONS);
  const [listings, setListings] = useState<LocalListing[]>(SEED_LISTINGS);
  const [liveOsmListings, setLiveOsmListings] = useState<LocalListing[]>([]);
  const [packages, setPackages] = useState<TourismPackage[]>(SEED_PACKAGES);

  // Discovery Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All');
  const [selectedState, setSelectedState] = useState<'All' | 'Tamil Nadu' | 'Kerala'>('All');
  const [selectedListingCategory, setSelectedListingCategory] = useState<'all' | ListingCategory>('all');
  const [selectedAttractionCategory, setSelectedAttractionCategory] = useState<'All' | AttractionCategory>('All');
  const [onlySavedOffline, setOnlySavedOffline] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);

  // Map & Live Lookup
  const [mapCenter, setMapCenter] = useState<[number, number]>([10.787, 79.1378]);
  const [mapZoom, setMapZoom] = useState(7);
  const [locating, setLocating] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveNotice, setLiveNotice] = useState('');

  // Modals
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null);
  const [addListingOpen, setAddListingOpen] = useState(false);

  // Platform feedback
  const [platformFeedbackTarget, setPlatformFeedbackTarget] = useState<'platform' | 'ai_advisor'>('platform');
  const [platformRating, setPlatformRating] = useState(5);
  const [platformComment, setPlatformComment] = useState('');
  const [platformStatus, setPlatformStatus] = useState('');

  const activeTravelGroup = currentUser?.travelGroup || guestGroup;

  // Hydrate user session & backend datasets
  useEffect(() => {
    const handleOnline = () => setOfflineMode(false);
    const handleOffline = () => setOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (authToken) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.user) {
            setCurrentUser(d.user);
            if (d.user.preferredLanguage) setLanguage(d.user.preferredLanguage);
          } else {
            setStoredToken(null);
            setAuthToken(null);
          }
        })
        .catch(() => {});
    }

    Promise.all([
      fetch('/api/attractions').then((r) => r.json()),
      fetch('/api/listings').then((r) => r.json()),
      fetch('/api/packages').then((r) => r.json()),
    ])
      .then(([attrRes, listRes, pkgRes]) => {
        if (attrRes.attractions?.length) setAttractions(attrRes.attractions);
        if (listRes.listings?.length) setListings(listRes.listings);
        if (pkgRes.packages?.length) setPackages(pkgRes.packages);
        cacheCatalogSnapshot({
          attractions: attrRes.attractions,
          listings: listRes.listings,
          packages: pkgRes.packages,
        });
        setLastSyncTime(new Date().toISOString());
      })
      .catch(() => {
        const cached = readCachedCatalogSnapshot();
        if (cached.attractions.length) setAttractions(cached.attractions);
        if (cached.listings.length) setListings(cached.listings);
        if (cached.packages.length) setPackages(cached.packages);
        setOfflineMode(true);
      });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [authToken]);

  const handleDistrictSelect = (districtName: string) => {
    setSelectedDistrict(districtName);
    if (districtName === 'All') {
      setMapCenter([10.787, 79.1378]);
      setMapZoom(7);
      return;
    }
    const found = ALL_DISTRICTS.find((d) => d.name === districtName);
    if (found) {
      setMapCenter([found.lat, found.lng]);
      setMapZoom(11);
      setSelectedState(found.state);
    }
  };

  const fetchLiveOsm = useCallback(
    async (opts?: { lat?: number; lng?: number; q?: string; label?: string }) => {
      if (offlineMode) {
        setLiveNotice(t.offlineBanner);
        return;
      }
      setLiveLoading(true);
      setLiveNotice('');
      try {
        const params = new URLSearchParams();
        if (opts?.lat !== undefined && opts?.lng !== undefined) {
          params.set('lat', String(opts.lat));
          params.set('lng', String(opts.lng));
        }
        if (opts?.q) params.set('q', opts.q);
        if (opts?.label) params.set('district', opts.label);
        else if (selectedDistrict !== 'All') params.set('district', selectedDistrict);

        const res = await fetch(`/api/places/live?${params.toString()}`);
        const data = await res.json();
        if (data.center) {
          setMapCenter([data.center.lat, data.center.lng]);
          setMapZoom(12);
        }
        if (Array.isArray(data.listings)) {
          setLiveOsmListings(data.listings);
          setLiveNotice(
            data.warning ||
              `${data.source === 'live' ? t.liveOsmLabel : t.cachedLabel}: ${data.listings.length} OpenStreetMap places near ${data.center?.label || selectedDistrict}.`
          );
        }
      } catch {
        setLiveNotice('Could not reach OpenStreetMap right now; showing local SQLite/cached records.');
      } finally {
        setLiveLoading(false);
      }
    },
    [offlineMode, selectedDistrict, t]
  );

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLiveNotice('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        setMapCenter([latitude, longitude]);
        setMapZoom(13);
        fetchLiveOsm({ lat: latitude, lng: longitude, label: 'Current Location' });
      },
      () => {
        setLocating(false);
        setLiveNotice('Location permission declined. You can select any district or click on the map.');
      },
      { timeout: 8000 }
    );
  };

  const handleToggleOfflineSave = (id: string) => {
    setSavedOfflineIds(toggleSavedOfflineId(id));
  };

  const handleSignOut = async () => {
    if (authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    setStoredToken(null);
    setAuthToken(null);
    setCurrentUser(null);
  };

  const combinedListings = useMemo(() => {
    const map = new Map<string, LocalListing>();
    for (const l of listings) map.set(l.id, l);
    for (const l of liveOsmListings) {
      if (!map.has(l.id)) map.set(l.id, l);
    }
    return Array.from(map.values());
  }, [listings, liveOsmListings]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedListings.filter((l) => {
      if (selectedState !== 'All' && l.state !== selectedState) return false;
      if (selectedDistrict !== 'All' && l.district !== selectedDistrict && l.district !== 'Current Location') {
        return false;
      }
      if (selectedListingCategory !== 'all' && l.category !== selectedListingCategory) return false;
      if (onlySavedOffline && !savedOfflineIds.includes(l.id)) return false;
      if (onlyVerified && l.verificationStatus !== 'Verified') return false;
      if (q) {
        const hay = `${l.name} ${l.nameTa || ''} ${l.district} ${l.cityOrTown} ${l.pincode || ''} ${l.address} ${l.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    combinedListings,
    selectedState,
    selectedDistrict,
    selectedListingCategory,
    onlySavedOffline,
    onlyVerified,
    savedOfflineIds,
    searchQuery,
  ]);

  const filteredAttractions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return attractions.filter((a) => {
      if (selectedState !== 'All' && a.state !== selectedState) return false;
      if (selectedDistrict !== 'All' && a.district !== selectedDistrict) return false;
      if (selectedAttractionCategory !== 'All' && a.category !== selectedAttractionCategory) return false;
      if (onlySavedOffline && !savedOfflineIds.includes(a.id)) return false;
      if (q) {
        const hay = `${a.name} ${a.nameTa} ${a.district} ${a.districtTa} ${a.cityOrTown} ${a.pincode} ${a.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    attractions,
    selectedState,
    selectedDistrict,
    selectedAttractionCategory,
    onlySavedOffline,
    savedOfflineIds,
    searchQuery,
  ]);

  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return packages.filter((p) => {
      if (selectedState !== 'All' && p.state !== selectedState) return false;
      if (selectedDistrict !== 'All' && p.destinationDistrict !== selectedDistrict) return false;
      if (q) {
        const hay = `${p.title} ${p.titleTa} ${p.destinationDistrict} ${p.startingPoint} ${p.operatorName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [packages, selectedState, selectedDistrict, searchQuery]);

  const guideAndBrokerListings = useMemo(
    () =>
      combinedListings.filter(
        (l) => l.category === 'native_guides' || l.category === 'local_brokers'
      ),
    [combinedListings]
  );

  const mapPins = useMemo<MapMarkerPin[]>(() => {
    const pins: MapMarkerPin[] = [];
    for (const a of filteredAttractions.slice(0, 35)) {
      pins.push({
        id: a.id,
        title: language === 'ta' ? a.nameTa : a.name,
        subtitle: `${a.category} · ${a.district}`,
        lat: a.lat,
        lng: a.lng,
        kind: 'attraction',
      });
    }
    for (const l of filteredListings.slice(0, 30)) {
      pins.push({
        id: l.id,
        title: language === 'ta' && l.nameTa ? l.nameTa : l.name,
        subtitle: `${l.cityOrTown} · ${l.dataSource}`,
        lat: l.lat,
        lng: l.lng,
        kind:
          l.category === 'hotels_restaurants' ||
          l.category === 'lodges_hostels' ||
          l.category === 'rental_homestays' ||
          l.category === 'tea_cafes'
            ? 'stay'
            : 'service',
      });
    }
    return pins;
  }, [filteredAttractions, filteredListings, language]);

  const categoryButtons: Array<{ id: 'all' | ListingCategory; label: string }> = [
    { id: 'all', label: t.catAll },
    { id: 'hotels_restaurants', label: t.catHotelsRestaurants },
    { id: 'lodges_hostels', label: t.catLodgesHostels },
    { id: 'rental_homestays', label: t.catRentalHomestays },
    { id: 'tea_cafes', label: t.catTeaCafes },
    { id: 'hospitals_emergency', label: t.catHospitalsEmergency },
    { id: 'local_brokers', label: t.catLocalBrokers },
    { id: 'native_guides', label: t.catNativeGuides },
    { id: 'theatres_entertainment', label: t.catTheatresEntertainment },
    { id: 'transport_services', label: t.catTransportServices },
  ];

  const handlePlatformFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlatformStatus('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          targetType: platformFeedbackTarget,
          targetId: 'local-guide-core',
          rating: platformRating,
          comment: platformComment,
          guestName: currentUser?.name || 'Local Guide Visitor',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlatformStatus(data.error || 'Unable to submit feedback.');
        return;
      }
      setPlatformComment('');
      setPlatformStatus(
        language === 'ta'
          ? 'உங்கள் கருத்திற்கு மிக்க நன்றி!'
          : 'Thank you! Your platform feedback has been recorded.'
      );
    } catch {
      setPlatformStatus('Feedback could not be submitted while offline.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveSection('explore')}
            className="text-left text-xl font-extrabold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
          >
            {t.brand}
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {(
              [
                ['explore', t.navExplore],
                ['attractions', t.navAttractions],
                ['packages', t.navPackages],
                ['planner', t.navPlanner],
                ['guides', t.navGuides],
              ] as Array<[ActiveSection, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeSection === key
                    ? 'border-blue-800 font-semibold text-slate-950'
                    : 'border-transparent hover:text-slate-950'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary action + mobile menu trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAuthModalStep(currentUser ? 'group' : 'auth');
                setAuthModalOpen(true);
              }}
              className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-900 whitespace-nowrap shrink-0"
            >
              {currentUser ? currentUser.name.split(' ')[0] : t.signIn}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((m) => !m)}
              aria-label="Toggle navigation"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2 text-sm font-medium">
              {(
                [
                  ['explore', t.navExplore],
                  ['attractions', t.navAttractions],
                  ['packages', t.navPackages],
                  ['planner', t.navPlanner],
                  ['guides', t.navGuides],
                ] as Array<[ActiveSection, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveSection(key);
                    setMobileMenuOpen(false);
                  }}
                  className={`rounded-lg px-3 py-2 text-left ${
                    activeSection === key ? 'bg-blue-50 font-semibold text-blue-800' : 'text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Workspace Control Strip (Bilingual Switch, Offline Mode, Travel Group, Add Listing) */}
      <div className="border-b border-slate-200 bg-slate-100/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            {/* English / Tamil Language Switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  language === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ta')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  language === 'ta' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                தமிழ்
              </button>
            </div>

            {/* Online / Offline Toggle */}
            <button
              type="button"
              onClick={() => setOfflineMode((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                offlineMode
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {offlineMode ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5 text-emerald-700" />}
              {offlineMode ? t.offlineMode : t.onlineMode}
            </button>

            {/* Travel Group Context */}
            <button
              type="button"
              onClick={() => {
                setAuthModalStep('group');
                setAuthModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-800 whitespace-nowrap"
            >
              <Users className="h-3.5 w-3.5 text-blue-800" />
              <span className="capitalize">{activeTravelGroup.groupType}</span>
              <span className="font-mono tabular-nums text-slate-500">
                ({activeTravelGroup.memberCount})
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddListingOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" /> {t.addListingBtn}
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
              >
                {t.signOut}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Offline Warning Banner */}
      {offlineMode && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-xs font-medium text-amber-950">
          {t.offlineBanner}{' '}
          {lastSyncTime && (
            <span className="font-mono tabular-nums">
              (Cached: {lastSyncTime.slice(0, 16).replace('T', ' ')})
            </span>
          )}
        </div>
      )}

      {/* 3D-Inspired Depth Hero Stage (shown cleanly on Explore view) */}
      {activeSection === 'explore' && (
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid items-stretch gap-10 lg:grid-cols-12">
              <div className="flex flex-col justify-center lg:col-span-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  {t.heroKicker}
                </p>
                <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
                  {t.heroTitle}
                </h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
                  {t.heroSubtitle}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('discovery-workspace');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
                  >
                    {t.startExploring}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('planner')}
                    className="rounded-lg border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 whitespace-nowrap"
                  >
                    {t.openTripAdvisor}
                  </button>
                </div>
              </div>

              {/* Layered 3D-inspired visual collage (Reference A + B) */}
              <div className="depth-stage grid grid-cols-2 gap-4 lg:col-span-6">
                <div className="depth-card col-span-2 overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl">
                  <div className="relative h-52 sm:h-60">
                    <ResilientImage
                      src={IMG_HERO_TEMPLE}
                      alt="Brihadeeswarar Temple Thanjavur"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-amber-300">Thanjavur · UNESCO Heritage</p>
                        <p className="text-base font-bold text-white">
                          {language === 'ta' ? 'தஞ்சாவூர் பெருவுடையார் கோவில்' : 'Brihadeeswarar Big Temple'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleDistrictSelect('Thanjavur');
                          document.getElementById('discovery-workspace')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-white"
                      >
                        Explore
                      </button>
                    </div>
                  </div>
                </div>

                <div className="depth-card overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-xl">
                  <div className="relative h-36">
                    <ResilientImage
                      src={IMG_NILGIRI_HILLS}
                      alt="Nilgiris Ooty Tea Hills"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 left-3 right-3">
                      <p className="text-[11px] text-amber-300">Nilgiris & Kerala</p>
                      <p className="text-xs font-bold text-white">Ooty · Coonoor · Vagamon</p>
                    </div>
                  </div>
                </div>

                <div className="depth-card overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-xl">
                  <div className="relative h-36">
                    <ResilientImage
                      src={IMG_CHETTINAD_STAY}
                      alt="Chettinad Courtyard Homestay"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 left-3 right-3">
                      <p className="text-[11px] text-amber-300">Verified Stays & Food</p>
                      <p className="text-xs font-bold text-white">Karaikudi · Madurai · Chennai</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4-column metric strip placed cleanly below the hero split */}
            <div className="mt-10 grid grid-cols-2 gap-4 border-t border-white/15 pt-8 lg:grid-cols-4">
              <div>
                <p className="text-lg font-bold tabular-nums text-white">{t.statDistricts}</p>
                <p className="text-xs text-slate-300">{t.statDistrictsSub}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{t.statBilingual}</p>
                <p className="text-xs text-slate-300">{t.statBilingualSub}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{t.statOffline}</p>
                <p className="text-xs text-slate-300">{t.statOfflineSub}</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{t.statVerified}</p>
                <p className="text-xs text-slate-300">{t.statVerifiedSub}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* MAIN VIEW 1: DESTINATION SELECTION & EXPLORATION DASHBOARD */}
      {activeSection === 'explore' && (
        <main id="discovery-workspace" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Location Entry & Map Selector */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t.selectDestTitle}</h2>
                <p className="mt-1 text-sm text-slate-600">{t.selectDestSubtitle}</p>
              </div>
              {selectedDistrict !== 'All' && (
                <button
                  type="button"
                  onClick={() => handleDistrictSelect('All')}
                  className="text-xs font-semibold text-blue-800 hover:underline self-start md:self-auto"
                >
                  {t.clearLocationFilter}
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-12">
              <div className="relative md:col-span-5">
                <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <select
                  aria-label={t.districtSelectLabel}
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                >
                  <option value="All">{t.allDistricts}</option>
                  {ALL_DISTRICTS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {language === 'ta' ? `${d.nameTa} (${d.name})` : `${d.name} (${d.state})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2 md:col-span-4">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Navigation className="h-3.5 w-3.5 text-blue-800" />
                  {locating ? t.locating : t.useCurrentLocation}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    fetchLiveOsm({
                      q: searchQuery.trim() || (selectedDistrict !== 'All' ? selectedDistrict : 'Madurai, Tamil Nadu'),
                      label: searchQuery.trim() || selectedDistrict,
                    })
                  }
                  disabled={liveLoading || offlineMode}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
                  {liveLoading ? t.fetchingLive : t.fetchLiveOsm}
                </button>
              </div>
            </div>

            {liveNotice && (
              <p className="mt-3 text-xs font-medium text-blue-900">{liveNotice}</p>
            )}

            <div className="mt-5">
              <p className="mb-2 text-xs text-slate-500">{t.mapPickHint}</p>
              <InteractiveMap
                center={mapCenter}
                zoom={mapZoom}
                pins={mapPins}
                onMapClick={(lat, lng) => fetchLiveOsm({ lat, lng, label: 'Selected Map Point' })}
                onPinSelect={(id) => {
                  const attr = attractions.find((a) => a.id === id);
                  if (attr) return setDetailTarget({ type: 'attraction', item: attr });
                  const list = combinedListings.find((l) => l.id === id);
                  if (list) return setDetailTarget({ type: 'listing', item: list });
                }}
              />
            </div>
          </div>

          {/* 10-Category Filter Bar */}
          <div className="mt-8 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {categoryButtons.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedListingCategory(cat.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      selectedListingCategory === cat.id
                        ? 'bg-blue-800 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlyVerified}
                    onChange={(e) => setOnlyVerified(e.target.checked)}
                  />
                  Verified only
                </label>
                <label className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={onlySavedOffline}
                    onChange={(e) => setOnlySavedOffline(e.target.checked)}
                  />
                  Saved offline ({savedOfflineIds.length})
                </label>
              </div>
            </div>
          </div>

          {/* Local Stays, Food, Hospitals, Tea Shops, Guides & Live OSM Results */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {language === 'ta'
                  ? 'உள்ளூர் தங்குமிடங்கள், உணவகங்கள் & சேவைகள்'
                  : 'Local Stays, Food, Emergency & Services'}
              </h3>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {filteredListings.length} results
              </span>
            </div>

            {filteredListings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No local services match this exact filter yet. Try clicking “Search Live OpenStreetMap” above or resetting filters.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((item) => {
                  const isSaved = savedOfflineIds.includes(item.id);
                  return (
                    <article
                      key={item.id}
                      className="depth-card flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    >
                      <div className="relative h-44 w-full bg-slate-100">
                        <ResilientImage
                          src={item.imageUrl || IMG_FILTER_COFFEE}
                          alt={item.name}
                          fallbackTitle={item.name}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleOfflineSave(item.id)}
                          aria-label="Save offline"
                          className={`absolute right-3 top-3 rounded-lg p-2 backdrop-blur ${
                            isSaved ? 'bg-blue-800 text-white' : 'bg-white/90 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        {/* Clean unboxed metadata with typographic separators */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{item.district}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.dataSource}</span>
                          {item.avgRating > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 font-semibold tabular-nums text-amber-700">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                {item.avgRating}
                              </span>
                            </>
                          )}
                        </div>

                        <h4 className="mt-1.5 text-base font-bold leading-snug text-slate-900">
                          {language === 'ta' && item.nameTa ? item.nameTa : item.name}
                        </h4>

                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                          {language === 'ta' && item.descriptionTa ? item.descriptionTa : item.description}
                        </p>

                        <div className="mt-auto pt-4">
                          {item.priceRangeText && (
                            <p className="mb-2 font-mono text-xs font-semibold tabular-nums text-blue-900">
                              {item.priceRangeText}
                            </p>
                          )}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="font-mono text-[11px] tabular-nums text-slate-400">
                              {t.lastUpdated}: {item.lastUpdated.slice(0, 10)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDetailTarget({ type: 'listing', item })}
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:underline"
                            >
                              {t.viewDetails} <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Highlighted Tourist Attractions Preview for Current Selection */}
          <div className="mt-12 border-t border-slate-200 pt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {language === 'ta'
                    ? 'சுற்றுலாத் தலங்கள் (தமிழ்நாடு & கேரளா)'
                    : 'Nearby & Featured Tourist Attractions'}
                </h3>
                <p className="text-xs text-slate-600">
                  Showing {filteredAttractions.length} destinations across Tamil Nadu’s 38 districts & Kerala
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('attractions')}
                className="text-xs font-bold text-blue-800 hover:underline"
              >
                View All 38 Districts Directory →
              </button>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAttractions.slice(0, 6).map((attr) => (
                <article
                  key={attr.id}
                  className="depth-card flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <div className="relative h-44 bg-slate-100">
                    <ResilientImage
                      src={attr.imageUrl}
                      alt={attr.name}
                      fallbackTitle={attr.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="font-semibold text-blue-900">{attr.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{language === 'ta' ? attr.districtTa : attr.district}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{attr.pincode}</span>
                    </div>
                    <h4 className="mt-1.5 text-base font-bold text-slate-900">
                      {language === 'ta' ? attr.nameTa : attr.name}
                    </h4>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {language === 'ta' ? attr.descriptionTa : attr.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                      <span className="text-[11px] text-slate-500">{attr.bestSeason}</span>
                      <button
                        type="button"
                        onClick={() => setDetailTarget({ type: 'attraction', item: attr })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:underline"
                      >
                        {t.viewDetails} <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* MAIN VIEW 2: ALL 38 TAMIL NADU DISTRICTS & TOURISM ATTRACTIONS */}
      {activeSection === 'attractions' && (
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t.tourismTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">{t.tourismSubtitle}</p>
          </div>

          {/* Interactive Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
              />
            </div>

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value as 'All' | 'Tamil Nadu' | 'Kerala')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="All">Tamil Nadu + Kerala</option>
              <option value="Tamil Nadu">Tamil Nadu (38 Districts)</option>
              <option value="Kerala">Kerala Expansion</option>
            </select>

            <select
              value={selectedAttractionCategory}
              onChange={(e) => setSelectedAttractionCategory(e.target.value as 'All' | AttractionCategory)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="All">{t.allCategories}</option>
              {(['Temple', 'Beach', 'Hill Station', 'Waterfall', 'Heritage', 'Wildlife', 'Cultural'] as AttractionCategory[]).map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                )
              )}
            </select>
          </div>

          {/* All 38 Tamil Nadu Districts Quick Selector */}
          <div className="mb-10">
            <h2 className="text-base font-bold text-slate-900">
              {language === 'ta'
                ? 'தமிழ்நாட்டின் 38 மாவட்டங்கள் & கேரள பகுதிகள்'
                : 'Browse by District (All 38 Tamil Nadu Districts + Kerala)'}
            </h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {ALL_DISTRICTS.filter((d) => selectedState === 'All' || d.state === selectedState).map((d) => {
                const active = selectedDistrict === d.name;
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => handleDistrictSelect(active ? 'All' : d.name)}
                    className={`rounded-xl border p-3.5 text-left transition-colors ${
                      active
                        ? 'border-blue-800 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">
                        {language === 'ta' ? d.nameTa : d.name}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">PIN {d.pincodePrefix}xxx</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-600">
                      {language === 'ta' ? d.highlightsTa : d.highlights}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtered Attractions Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAttractions.map((attr) => (
              <article
                key={attr.id}
                className="depth-card flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="relative h-48 bg-slate-100">
                  <ResilientImage
                    src={attr.imageUrl}
                    alt={attr.name}
                    fallbackTitle={attr.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleOfflineSave(attr.id)}
                    aria-label="Save offline"
                    className={`absolute right-3 top-3 rounded-lg p-2 backdrop-blur ${
                      savedOfflineIds.includes(attr.id)
                        ? 'bg-blue-800 text-white'
                        : 'bg-white/90 text-slate-700'
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-semibold text-blue-900">{attr.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{language === 'ta' ? attr.districtTa : attr.district}</span>
                    <span aria-hidden="true">·</span>
                    <span>{attr.verificationStatus}</span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-bold text-slate-900">
                    {language === 'ta' ? attr.nameTa : attr.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">
                    {language === 'ta' ? attr.descriptionTa : attr.description}
                  </p>
                  <div className="mt-auto space-y-2 pt-4">
                    <p className="text-xs text-slate-600">
                      <strong>Hours:</strong> {attr.openingHours}
                    </p>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="font-mono text-[11px] tabular-nums text-slate-500">
                        {attr.recommendedDuration}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetailTarget({ type: 'attraction', item: attr })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:underline"
                      >
                        {t.viewDetails} <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}

      {/* MAIN VIEW 3: TOURISM PACKAGES */}
      {activeSection === 'packages' && (
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t.packagesSectionTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{t.packagesHonestNote}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('planner')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-900 self-start"
            >
              <Compass className="h-4 w-4" /> Build Custom AI Itinerary
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {filteredPackages.map((pkg) => (
              <article
                key={pkg.id}
                className="depth-card flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="relative h-52 bg-slate-100">
                  <ResilientImage
                    src={pkg.imageUrl}
                    alt={pkg.title}
                    fallbackTitle={pkg.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-blue-900">{pkg.destinationDistrict}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{pkg.durationDays} Days</span>
                    <span aria-hidden="true">·</span>
                    <span>{pkg.verificationStatus}</span>
                    <span aria-hidden="true">·</span>
                    <span>{pkg.availabilityStatus}</span>
                  </div>

                  <h2 className="mt-2 text-lg font-bold text-slate-900">
                    {language === 'ta' ? pkg.titleTa : pkg.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Start: {pkg.startingPoint} · Operator: {pkg.operatorName}
                  </p>

                  <ul className="mt-3 space-y-1 text-xs text-slate-700">
                    {pkg.itineraryStops.slice(0, 3).map((stop) => (
                      <li key={stop}>• {stop}</li>
                    ))}
                  </ul>

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 mt-5">
                    <div>
                      <span className="font-mono text-base font-bold tabular-nums text-slate-900">
                        {pkg.pricePerPersonInr ? `₹${pkg.pricePerPersonInr}` : 'Enquiry'}
                      </span>
                      <span className="text-xs text-slate-500"> / person</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailTarget({ type: 'package', item: pkg })}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      {t.viewDetails}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}

      {/* MAIN VIEW 4: AI TRIP ADVISOR */}
      {activeSection === 'planner' && (
        <AITripAdvisorView
          language={language}
          travelGroup={activeTravelGroup}
          authToken={authToken}
          defaultDestination={selectedDistrict !== 'All' ? selectedDistrict : 'Madurai & Thanjavur'}
        />
      )}

      {/* MAIN VIEW 5: NATIVE GUIDES & LOCAL BROKERS */}
      {activeSection === 'guides' && (
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t.guidesTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{t.guidesSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setAddListingOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 self-start"
            >
              <Plus className="h-4 w-4" /> Register Guide / Broker Profile
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {guideAndBrokerListings.map((person) => (
              <article
                key={person.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                        <ShieldCheck
                          className={`h-4 w-4 ${
                            person.verificationStatus === 'Verified' ? 'text-blue-800' : 'text-amber-600'
                          }`}
                        />
                        {person.verificationStatus === 'Verified' ? t.verifiedLabel : t.unverifiedLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{person.category === 'native_guides' ? 'Native Guide' : 'Local Broker'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{person.district}</span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-bold text-slate-900">
                      {language === 'ta' && person.nameTa ? person.nameTa : person.name}
                    </h2>
                  </div>

                  {person.avgRating > 0 && (
                    <span className="inline-flex items-center gap-1 font-mono text-sm font-bold tabular-nums text-amber-700">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      {person.avgRating}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {language === 'ta' && person.descriptionTa ? person.descriptionTa : person.description}
                </p>

                <div className="mt-4 grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-700 sm:grid-cols-2">
                  <div>
                    <strong>Service Area:</strong> {person.serviceArea || person.cityOrTown}
                  </div>
                  <div>
                    <strong>Languages:</strong> {(person.languagesSpoken || ['Tamil', 'English']).join(', ')}
                  </div>
                  <div>
                    <strong>Experience:</strong> {person.experienceYears ? `${person.experienceYears} years` : 'Local resident'}
                  </div>
                  <div>
                    <strong>Charges:</strong> {person.serviceCharges || person.priceRangeText || 'On enquiry'}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-500">{person.phoneMasked || 'Privacy protected'}</span>
                  <button
                    type="button"
                    onClick={() => setDetailTarget({ type: 'listing', item: person })}
                    className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900"
                  >
                    {t.sendEnquiry}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      )}

      {/* Platform & AI Advisor Feedback Strip */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'ta'
                  ? 'லோக்கல் கைடு & AI பயண ஆலோசகர் கருத்து'
                  : 'Rate Local Guide & AI Trip Advisor'}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">
                {language === 'ta'
                  ? 'உங்கள் பயண அனுபவம், வழிகாட்டிகள் அல்லது AI திட்டமிடல் குறித்த கருத்தைப் பகிரவும்.'
                  : 'Help keep Tamil Nadu & Kerala travel listings accurate and trustworthy by sharing feedback on the platform or AI Trip Advisor.'}
              </p>
            </div>

            <form onSubmit={handlePlatformFeedback} className="grid gap-3 sm:grid-cols-12 lg:col-span-7">
              <select
                value={platformFeedbackTarget}
                onChange={(e) => setPlatformFeedbackTarget(e.target.value as 'platform' | 'ai_advisor')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium sm:col-span-5"
              >
                <option value="platform">Local Guide Platform</option>
                <option value="ai_advisor">AI Trip Advisor Experience</option>
              </select>

              <select
                value={platformRating}
                onChange={(e) => setPlatformRating(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium sm:col-span-3"
              >
                <option value={5}>5 ★ Excellent</option>
                <option value={4}>4 ★ Good</option>
                <option value={3}>3 ★ Helpful</option>
                <option value={2}>2 ★ Needs Work</option>
                <option value={1}>1 ★ Issue</option>
              </select>

              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 sm:col-span-4"
              >
                Submit Feedback
              </button>

              <input
                type="text"
                required
                value={platformComment}
                onChange={(e) => setPlatformComment(e.target.value)}
                placeholder="Share what worked well or what listing needs verification..."
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-12"
              />
              {platformStatus && (
                <p className="text-xs font-semibold text-blue-800 sm:col-span-12">{platformStatus}</p>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <p className="text-lg font-extrabold text-white">{t.brand}</p>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-400">
                Built for confident exploration across all 38 Tamil Nadu districts, Kerala routes, and regional towns. Live POI data sourced via OpenStreetMap contributors and cached locally for offline resilience.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <button type="button" onClick={() => setActiveSection('explore')} className="hover:text-white">
                    {t.navExplore}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveSection('attractions')} className="hover:text-white">
                    {t.navAttractions}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveSection('packages')} className="hover:text-white">
                    {t.navPackages}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setActiveSection('planner')} className="hover:text-white">
                    {t.navPlanner}
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Language & Trust</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1 text-xs hover:border-white"
                >
                  <Globe className="h-3 w-3" /> English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ta')}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1 text-xs hover:border-white"
                >
                  தமிழ்
                </button>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Verified provider badges are distinct from unverified community submissions. Never relies on fabricated availability.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals & Floating AI Companion */}
      <AuthTravelGroupModal
        isOpen={authModalOpen}
        initialStep={authModalStep}
        language={language}
        onLanguageChange={setLanguage}
        currentUser={currentUser}
        onAuthSuccess={(user, token) => {
          setCurrentUser(user);
          setAuthToken(token);
          setStoredToken(token);
        }}
        onProfileSaved={(user) => setCurrentUser(user)}
        onGuestGroupSaved={(group) => setGuestGroup(group)}
        onClose={() => setAuthModalOpen(false)}
      />

      <ListingDetailModal
        target={detailTarget}
        language={language}
        currentUser={currentUser}
        authToken={authToken}
        isSavedOffline={detailTarget ? savedOfflineIds.includes(detailTarget.item.id) : false}
        onToggleSaveOffline={handleToggleOfflineSave}
        onListingUpdated={(updated) => {
          setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          setDetailTarget({ type: 'listing', item: updated });
        }}
        onClose={() => setDetailTarget(null)}
      />

      <AddListingModal
        isOpen={addListingOpen}
        language={language}
        authToken={authToken}
        onCreated={(created) => setListings((prev) => [created, ...prev])}
        onClose={() => setAddListingOpen(false)}
      />

      <FloatingAssistant
        language={language}
        currentDistrict={selectedDistrict === 'All' ? 'Tamil Nadu' : selectedDistrict}
        travelGroupLabel={`${activeTravelGroup.groupType} (${activeTravelGroup.memberCount})`}
      />
    </div>
  );
}
