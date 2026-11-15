import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import {
  createSession,
  db,
  getAllAttractions,
  getAllListings,
  getAllPackages,
  getUserByToken,
  hashPassword,
  initDatabase,
  saveItineraryForUser,
  verifyPassword,
} from './db';
import { geocodeLocationOSM, searchLiveOsmNearby } from './osmProvider';
import { askFloatingCompanion, generateGroundedTripPlan } from './aiService';
import { ALL_DISTRICTS } from '../src/data/seedData';
import { LocalListing, TravelGroupProfile } from '../src/types';

let dbInitialized = false;
function ensureDb() {
  if (!dbInitialized) {
    initDatabase();
    dbInitialized = true;
  }
}

export function createApiApp() {
  ensureDb();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const getAuthToken = (req: express.Request) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return undefined;
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, preferredLanguage } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      preferredLanguage?: 'en' | 'ta';
    };

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid full name (at least 2 characters).' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const userId = `usr-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const lang = preferredLanguage === 'ta' ? 'ta' : 'en';
    const passwordHash = hashPassword(password);

    db.prepare(
      'INSERT INTO users (id, name, email, password_hash, preferred_language, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, name.trim(), normalizedEmail, passwordHash, lang, now);

    const token = createSession(userId);
    return res.status(201).json({
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        preferredLanguage: lang,
        createdAt: now,
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const row = db
      .prepare(
        'SELECT id, name, email, password_hash, preferred_language, travel_group_json, created_at FROM users WHERE email = ?'
      )
      .get(email.trim().toLowerCase()) as
      | {
          id: string;
          name: string;
          email: string;
          password_hash: string;
          preferred_language: 'en' | 'ta';
          travel_group_json: string | null;
          created_at: string;
        }
      | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createSession(row.id);
    return res.json({
      token,
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        preferredLanguage: row.preferred_language,
        travelGroup: row.travel_group_json ? JSON.parse(row.travel_group_json) : undefined,
        createdAt: row.created_at,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getAuthToken(req);
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getUserByToken(getAuthToken(req));
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ user });
  });

  app.put('/api/auth/profile', (req, res) => {
    const user = getUserByToken(getAuthToken(req));
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { preferredLanguage, travelGroup } = req.body as {
      preferredLanguage?: 'en' | 'ta';
      travelGroup?: TravelGroupProfile;
    };

    const nextLang = preferredLanguage || user.preferredLanguage;
    const nextGroup = travelGroup
      ? JSON.stringify(travelGroup)
      : user.travelGroup
        ? JSON.stringify(user.travelGroup)
        : null;

    db.prepare('UPDATE users SET preferred_language = ?, travel_group_json = ? WHERE id = ?').run(
      nextLang,
      nextGroup,
      user.id
    );

    res.json({
      user: {
        ...user,
        preferredLanguage: nextLang,
        travelGroup: travelGroup || user.travelGroup,
      },
    });
  });

  app.get('/api/districts', (_req, res) => {
    res.json({ districts: ALL_DISTRICTS });
  });

  app.get('/api/attractions', (req, res) => {
    const { district, state, category, q } = req.query as Record<string, string | undefined>;
    let items = getAllAttractions();
    if (state && state !== 'All') {
      items = items.filter((a) => a.state.toLowerCase() === state.toLowerCase());
    }
    if (district && district !== 'All') {
      items = items.filter((a) => a.district.toLowerCase() === district.toLowerCase());
    }
    if (category && category !== 'All') {
      items = items.filter((a) => a.category.toLowerCase() === category.toLowerCase());
    }
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      items = items.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          a.nameTa.includes(q.trim()) ||
          a.district.toLowerCase().includes(term) ||
          a.cityOrTown.toLowerCase().includes(term) ||
          a.pincode.includes(term) ||
          a.description.toLowerCase().includes(term)
      );
    }
    res.json({ attractions: items });
  });

  app.get('/api/listings', (req, res) => {
    const { district, category, state, q, groupType } = req.query as Record<string, string | undefined>;
    let items = getAllListings();
    if (state && state !== 'All') {
      items = items.filter((l) => l.state.toLowerCase() === state.toLowerCase());
    }
    if (district && district !== 'All') {
      items = items.filter((l) => l.district.toLowerCase() === district.toLowerCase());
    }
    if (category && category !== 'all') {
      items = items.filter((l) => l.category === category);
    }
    if (groupType && groupType !== 'all') {
      items = items.filter((l) => !l.suitability || l.suitability.includes(groupType as never));
    }
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      items = items.filter(
        (l) =>
          l.name.toLowerCase().includes(term) ||
          (l.nameTa && l.nameTa.includes(q.trim())) ||
          l.district.toLowerCase().includes(term) ||
          l.cityOrTown.toLowerCase().includes(term) ||
          (l.pincode && l.pincode.includes(term)) ||
          l.address.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term)
      );
    }
    res.json({ listings: items });
  });

  app.post('/api/listings', (req, res) => {
    const user = getUserByToken(getAuthToken(req));
    const body = req.body as Partial<LocalListing>;
    if (!body.name || !body.category || !body.district || !body.address) {
      return res.status(400).json({ error: 'Name, category, district, and address are required.' });
    }
    const id = `list-user-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString().slice(0, 10);
    const distMatch = ALL_DISTRICTS.find((d) => d.name === body.district);
    const newListing: LocalListing = {
      id,
      name: body.name.trim(),
      nameTa: body.nameTa?.trim(),
      category: body.category,
      district: body.district,
      state: body.state || distMatch?.state || 'Tamil Nadu',
      cityOrTown: body.cityOrTown || body.district,
      pincode: body.pincode,
      address: body.address.trim(),
      lat: typeof body.lat === 'number' ? body.lat : distMatch?.lat || 10.787,
      lng: typeof body.lng === 'number' ? body.lng : distMatch?.lng || 79.1378,
      description: body.description?.trim() || 'Community-contributed local service listing.',
      openingHours: body.openingHours || 'Confirm directly',
      priceRangeText: body.priceRangeText || 'Enquire for current rate',
      amenities: Array.isArray(body.amenities) ? body.amenities : [],
      waterSupplyTimings: body.waterSupplyTimings,
      foodAvailability: body.foodAvailability,
      luggageStorageConfirmed: Boolean(body.luggageStorageConfirmed),
      languagesSpoken: body.languagesSpoken,
      serviceArea: body.serviceArea,
      serviceCharges: body.serviceCharges,
      dataSource: 'Unverified Community Listing',
      verificationStatus: 'Unverified',
      isIllustrativeImage: true,
      lastUpdated: now,
      avgRating: 0,
      reviewCount: 0,
    };

    db.prepare(
      'INSERT INTO listings (id, category, district, state, pincode, lat, lng, data_source, verification_status, data_json, owner_user_id, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      newListing.id,
      newListing.category,
      newListing.district,
      newListing.state,
      newListing.pincode || '',
      newListing.lat,
      newListing.lng,
      newListing.dataSource,
      newListing.verificationStatus,
      JSON.stringify(newListing),
      user?.id || null,
      now
    );

    res.status(201).json({ listing: newListing });
  });

  app.patch('/api/listings/:id/owner-update', (req, res) => {
    const { id } = req.params;
    const row = db.prepare('SELECT data_json FROM listings WHERE id = ?').get(id) as { data_json: string } | undefined;
    if (!row) return res.status(404).json({ error: 'Listing not found.' });

    const existing = JSON.parse(row.data_json) as LocalListing;
    const updates = req.body as Partial<LocalListing>;
    const now = new Date().toISOString().slice(0, 10);

    const updated: LocalListing = {
      ...existing,
      priceRangeText: updates.priceRangeText ?? existing.priceRangeText,
      waterSupplyTimings: updates.waterSupplyTimings ?? existing.waterSupplyTimings,
      foodAvailability: updates.foodAvailability ?? existing.foodAvailability,
      openingHours: updates.openingHours ?? existing.openingHours,
      luggageStorageConfirmed:
        typeof updates.luggageStorageConfirmed === 'boolean'
          ? updates.luggageStorageConfirmed
          : existing.luggageStorageConfirmed,
      rooms: updates.rooms ?? existing.rooms,
      menu: updates.menu ?? existing.menu,
      lastUpdated: now,
    };

    db.prepare('UPDATE listings SET data_json = ?, last_updated = ? WHERE id = ?').run(
      JSON.stringify(updated),
      now,
      id
    );
    res.json({ listing: updated });
  });

  app.get('/api/places/live', async (req, res) => {
    const { q, lat, lng, district } = req.query as Record<string, string | undefined>;
    let targetLat = lat ? parseFloat(lat) : NaN;
    let targetLng = lng ? parseFloat(lng) : NaN;
    let resolvedLabel = district || q || 'Tamil Nadu';

    if ((Number.isNaN(targetLat) || Number.isNaN(targetLng)) && q && q.trim()) {
      const geo = await geocodeLocationOSM(`${q.trim()}, India`);
      if (geo) {
        targetLat = geo.lat;
        targetLng = geo.lng;
        resolvedLabel = q.trim();
      }
    }

    if (Number.isNaN(targetLat) || Number.isNaN(targetLng)) {
      const distMatch = ALL_DISTRICTS.find((d) =>
        district ? d.name.toLowerCase() === district.toLowerCase() : false
      );
      targetLat = distMatch?.lat || 10.787;
      targetLng = distMatch?.lng || 79.1378;
      resolvedLabel = distMatch?.name || 'Thanjavur';
    }

    const queryKey = `${targetLat.toFixed(2)},${targetLng.toFixed(2)}`;
    const result = await searchLiveOsmNearby({
      lat: targetLat,
      lng: targetLng,
      districtLabel: resolvedLabel,
      queryKey,
    });

    res.json({
      center: { lat: targetLat, lng: targetLng, label: resolvedLabel },
      ...result,
    });
  });

  app.get('/api/packages', (req, res) => {
    const { destination, state, groupType, maxDays } = req.query as Record<string, string | undefined>;
    let items = getAllPackages();
    if (state && state !== 'All') {
      items = items.filter((p) => p.state.toLowerCase() === state.toLowerCase());
    }
    if (destination && destination.trim() && destination !== 'All') {
      const d = destination.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.destinationDistrict.toLowerCase().includes(d) ||
          p.title.toLowerCase().includes(d) ||
          p.startingPoint.toLowerCase().includes(d)
      );
    }
    if (groupType && groupType !== 'all') {
      items = items.filter((p) => p.groupSuitability.includes(groupType as never));
    }
    if (maxDays) {
      const max = parseInt(maxDays, 10);
      if (!Number.isNaN(max)) items = items.filter((p) => p.durationDays <= max);
    }
    res.json({ packages: items });
  });

  app.get('/api/reviews', (req, res) => {
    const { targetType, targetId } = req.query as Record<string, string | undefined>;
    let rows;
    if (targetType && targetId) {
      rows = db
        .prepare('SELECT * FROM reviews WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC')
        .all(targetType, targetId);
    } else {
      rows = db.prepare('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 40').all();
    }
    res.json({ reviews: rows });
  });

  app.post('/api/reviews', (req, res) => {
    const user = getUserByToken(getAuthToken(req));
    const { targetType, targetId, rating, comment, guestName } = req.body as {
      targetType?: string;
      targetId?: string;
      rating?: number;
      comment?: string;
      guestName?: string;
    };

    if (!targetType || !targetId || !rating || rating < 1 || rating > 5 || !comment || comment.trim().length < 5) {
      return res.status(400).json({ error: 'Valid rating (1-5) and comment (min 5 chars) are required.' });
    }

    const reviewerId = user?.id || `guest-${(guestName || 'anon').trim().toLowerCase().replace(/\s+/g, '-')}`;
    const reviewerName = user?.name || guestName?.trim() || 'Traveller';

    const existing = db
      .prepare('SELECT id FROM reviews WHERE target_type = ? AND target_id = ? AND user_id = ?')
      .get(targetType, targetId, reviewerId);

    if (existing) {
      return res.status(409).json({ error: 'You have already submitted a review for this item.' });
    }

    const id = `rev-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO reviews (id, target_type, target_id, user_id, user_name, rating, comment, is_verified_visit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, targetType, targetId, reviewerId, reviewerName, Math.round(rating), comment.trim(), user ? 1 : 0, now);

    res.status(201).json({
      review: {
        id,
        targetType,
        targetId,
        userId: reviewerId,
        userName: reviewerName,
        rating: Math.round(rating),
        comment: comment.trim(),
        isVerifiedVisit: Boolean(user),
        createdAt: now,
      },
    });
  });

  app.post('/api/enquiries', (req, res) => {
    const user = getUserByToken(getAuthToken(req));
    const { listingId, senderName, senderContact, message } = req.body as {
      listingId?: string;
      senderName?: string;
      senderContact?: string;
      message?: string;
    };
    if (!listingId || !senderName || !senderContact || !message) {
      return res.status(400).json({ error: 'All enquiry fields are required.' });
    }
    const id = `enq-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(
      'INSERT INTO enquiries (id, listing_id, user_id, sender_name, sender_contact, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, listingId, user?.id || null, senderName.trim(), senderContact.trim(), message.trim(), new Date().toISOString());

    res.status(201).json({
      ok: true,
      enquiryId: id,
      message: 'Enquiry securely forwarded to the provider without exposing your or their private details publicly.',
    });
  });

  app.post('/api/reports', (req, res) => {
    const user = getUserByToken(getAuthToken(req));
    const { targetType, targetId, reason, details } = req.body as {
      targetType?: string;
      targetId?: string;
      reason?: string;
      details?: string;
    };
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: 'Target and reason are required.' });
    }
    const id = `rep-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(
      'INSERT INTO reports (id, target_type, target_id, user_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, targetType, targetId, user?.id || null, reason, details || '', new Date().toISOString());

    res.status(201).json({ ok: true, reportId: id });
  });

  app.get('/api/itineraries', (req, res) => {
    const user = getUserByToken(getAuthToken(req));
    if (!user) return res.json({ itineraries: [] });
    const rows = db
      .prepare('SELECT data_json FROM saved_itineraries WHERE user_id = ? ORDER BY created_at DESC')
      .all(user.id) as { data_json: string }[];
    res.json({ itineraries: rows.map((r) => JSON.parse(r.data_json)) });
  });

  app.post('/api/itineraries', (req, res) => {
    const user = getUserByToken(getAuthToken(req));
    if (!user) return res.status(401).json({ error: 'Please sign in to save itineraries to your account.' });
    const id = saveItineraryForUser(user.id, req.body);
    res.status(201).json({ ok: true, id });
  });

  app.post('/api/ai/trip-plan', async (req, res) => {
    const body = req.body;
    if (!body?.destination) {
      return res.status(400).json({ error: 'Destination is required.' });
    }
    const plan = await generateGroundedTripPlan({
      startingLocation: body.startingLocation || 'Chennai',
      destination: body.destination,
      arrivalDate: body.arrivalDate,
      departureDate: body.departureDate,
      travellersCount: Number(body.travellersCount) || 2,
      travelGroup: body.travelGroup || 'family',
      budgetInr: body.budgetInr,
      interests: Array.isArray(body.interests) ? body.interests : undefined,
      accommodationPref: body.accommodationPref,
      transportPref: body.transportPref,
      daysCount: Number(body.daysCount) || 2,
      language: body.language === 'ta' ? 'ta' : 'en',
      resuggestInstruction: body.resuggestInstruction,
      previousPlan: body.previousPlan,
    });
    res.json({ plan });
  });

  app.post('/api/ai/assistant', async (req, res) => {
    const { message, language, currentDistrict, travelGroup, history } = req.body as {
      message?: string;
      language?: 'en' | 'ta';
      currentDistrict?: string;
      travelGroup?: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    };
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    const result = await askFloatingCompanion({
      message: message.trim(),
      language: language === 'ta' ? 'ta' : 'en',
      currentDistrict,
      travelGroup,
      history: Array.isArray(history) ? history : [],
    });
    res.json(result);
  });

  return app;
}
