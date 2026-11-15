import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  SEED_ATTRACTIONS,
  SEED_LISTINGS,
  SEED_PACKAGES,
} from '../src/data/seedData';
import {
  GeneratedItinerary,
  LocalListing,
  ReviewItem,
  TourismPackage,
  TouristAttraction,
  TravelGroupProfile,
  User,
} from '../src/types';

const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'local_guide_data')
  : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(path.join(dataDir, 'local_guide.db'));

export function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      preferred_language TEXT NOT NULL DEFAULT 'en',
      travel_group_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attractions (
      id TEXT PRIMARY KEY,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      category TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      data_json TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attractions_district ON attractions(district);
    CREATE INDEX IF NOT EXISTS idx_attractions_category ON attractions(category);

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      data_source TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      data_json TEXT NOT NULL,
      owner_user_id TEXT,
      last_updated TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_listings_district_cat ON listings(district, category);

    CREATE TABLE IF NOT EXISTS cached_osm_places (
      id TEXT PRIMARY KEY,
      query_key TEXT NOT NULL,
      category TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_osm_query ON cached_osm_places(query_key);

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      destination_district TEXT NOT NULL,
      state TEXT NOT NULL,
      data_json TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      is_verified_visit INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(target_type, target_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);

    CREATE TABLE IF NOT EXISTS enquiries (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      user_id TEXT,
      sender_name TEXT NOT NULL,
      sender_contact TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      user_id TEXT,
      reason TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_itineraries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      destination TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favourites (
      user_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, item_type, item_id)
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  const attrCount = (db.prepare('SELECT COUNT(*) as c FROM attractions').get() as { c: number }).c;
  if (attrCount === 0) {
    const insertAttr = db.prepare(
      'INSERT INTO attractions (id, district, state, pincode, category, lat, lng, data_json, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const a of SEED_ATTRACTIONS) {
      insertAttr.run(a.id, a.district, a.state, a.pincode, a.category, a.lat, a.lng, JSON.stringify(a), a.lastUpdated);
    }
  }

  const listCount = (db.prepare('SELECT COUNT(*) as c FROM listings').get() as { c: number }).c;
  if (listCount === 0) {
    const insertList = db.prepare(
      'INSERT INTO listings (id, category, district, state, pincode, lat, lng, data_source, verification_status, data_json, owner_user_id, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const l of SEED_LISTINGS) {
      insertList.run(
        l.id,
        l.category,
        l.district,
        l.state,
        l.pincode || '',
        l.lat,
        l.lng,
        l.dataSource,
        l.verificationStatus,
        JSON.stringify(l),
        null,
        l.lastUpdated
      );
    }
  }

  const pkgCount = (db.prepare('SELECT COUNT(*) as c FROM packages').get() as { c: number }).c;
  if (pkgCount === 0) {
    const insertPkg = db.prepare(
      'INSERT INTO packages (id, destination_district, state, data_json, last_updated) VALUES (?, ?, ?, ?, ?)'
    );
    for (const p of SEED_PACKAGES) {
      insertPkg.run(p.id, p.destinationDistrict, p.state, JSON.stringify(p), p.lastUpdated);
    }
  }

  const revCount = (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as { c: number }).c;
  if (revCount === 0) {
    const seedReviews: ReviewItem[] = [
      {
        id: 'rev-1',
        targetType: 'listing',
        targetId: 'list-chettinad-courtyard',
        userId: 'seed-user-1',
        userName: 'Kavitha R.',
        rating: 5,
        comment: 'Authentic Athangudi courtyard, warm hosts, and safe luggage holding before our afternoon train.',
        isVerifiedVisit: true,
        createdAt: '2026-11-01T10:00:00Z',
      },
      {
        id: 'rev-2',
        targetType: 'listing',
        targetId: 'guide-selvam-thanjavur',
        userId: 'seed-user-2',
        userName: 'Suresh & Family',
        rating: 5,
        comment: 'Explained Chola stone inscriptions clearly in both Tamil and English at an easy pace for grandparents.',
        isVerifiedVisit: true,
        createdAt: '2026-11-04T16:30:00Z',
      },
      {
        id: 'rev-3',
        targetType: 'package',
        targetId: 'pkg-chola-heritage-2d',
        userId: 'seed-user-3',
        userName: 'Ananya M.',
        rating: 5,
        comment: 'Punctual pickup from Thanjavur Junction and clean AC Innova with transparent pricing.',
        isVerifiedVisit: true,
        createdAt: '2026-11-06T12:15:00Z',
      },
    ];
    const insertRev = db.prepare(
      'INSERT INTO reviews (id, target_type, target_id, user_id, user_name, rating, comment, is_verified_visit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const r of seedReviews) {
      insertRev.run(r.id, r.targetType, r.targetId, r.userId, r.userName, r.rating, r.comment, r.isVerifiedVisit ? 1 : 0, r.createdAt);
    }
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

export function getUserByToken(token?: string): User | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.preferred_language, u.travel_group_json, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?`
    )
    .get(token) as
    | {
        id: string;
        name: string;
        email: string;
        preferred_language: 'en' | 'ta';
        travel_group_json: string | null;
        created_at: string;
        expires_at: string;
      }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    preferredLanguage: row.preferred_language,
    travelGroup: row.travel_group_json ? (JSON.parse(row.travel_group_json) as TravelGroupProfile) : undefined,
    createdAt: row.created_at,
  };
}

export function getAllAttractions(): TouristAttraction[] {
  const rows = db.prepare('SELECT id, data_json FROM attractions').all() as { id: string; data_json: string }[];
  const reviewStats = getReviewStatsMap('attraction');
  return rows.map((r) => {
    const attr = JSON.parse(r.data_json) as TouristAttraction;
    const stats = reviewStats.get(attr.id);
    if (stats) {
      attr.avgRating = stats.avgRating;
      attr.reviewCount = stats.count;
    }
    return attr;
  });
}

export function getAllListings(): LocalListing[] {
  const rows = db.prepare('SELECT id, data_json FROM listings').all() as { id: string; data_json: string }[];
  const reviewStats = getReviewStatsMap('listing');
  const guideStats = getReviewStatsMap('guide');
  const brokerStats = getReviewStatsMap('broker');

  return rows.map((r) => {
    const item = JSON.parse(r.data_json) as LocalListing;
    const stats = reviewStats.get(item.id) || guideStats.get(item.id) || brokerStats.get(item.id);
    if (stats) {
      const baseTotal = item.avgRating * item.reviewCount;
      const combinedCount = item.reviewCount + stats.count;
      item.avgRating = Number(((baseTotal + stats.sumRating) / combinedCount).toFixed(1));
      item.reviewCount = combinedCount;
    }
    return item;
  });
}

export function getAllPackages(): TourismPackage[] {
  const rows = db.prepare('SELECT id, data_json FROM packages').all() as { id: string; data_json: string }[];
  const reviewStats = getReviewStatsMap('package');
  return rows.map((r) => {
    const pkg = JSON.parse(r.data_json) as TourismPackage;
    const stats = reviewStats.get(pkg.id);
    if (stats) {
      const baseTotal = pkg.avgRating * pkg.reviewCount;
      const combinedCount = pkg.reviewCount + stats.count;
      pkg.avgRating = Number(((baseTotal + stats.sumRating) / combinedCount).toFixed(1));
      pkg.reviewCount = combinedCount;
    }
    return pkg;
  });
}

function getReviewStatsMap(targetType: string) {
  const rows = db
    .prepare(
      'SELECT target_id, COUNT(*) as count, SUM(rating) as sumRating, AVG(rating) as avgRating FROM reviews WHERE target_type = ? GROUP BY target_id'
    )
    .all(targetType) as { target_id: string; count: number; sumRating: number; avgRating: number }[];
  const map = new Map<string, { count: number; sumRating: number; avgRating: number }>();
  for (const r of rows) {
    map.set(r.target_id, {
      count: r.count,
      sumRating: r.sumRating,
      avgRating: Number(r.avgRating.toFixed(1)),
    });
  }
  return map;
}

export function saveItineraryForUser(userId: string, itinerary: GeneratedItinerary): string {
  const id = itinerary.id || `itin-${crypto.randomUUID().slice(0, 8)}`;
  const payload = { ...itinerary, id };
  db.prepare(
    `INSERT INTO saved_itineraries (id, user_id, title, destination, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, destination=excluded.destination, data_json=excluded.data_json`
  ).run(id, userId, payload.title, payload.destination, JSON.stringify(payload), new Date().toISOString());
  return id;
}