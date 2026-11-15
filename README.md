# Local Guide — Tamil Nadu & Beyond Travel Companion

A bilingual (**English & தமிழ்**) travel, tourism, and local assistance web application covering all 38 districts of Tamil Nadu with Kerala expansion routes, OpenStreetMap live discovery, SQLite offline caching, verified local provider listings, and Gemini-powered AI trip planning.

## Features

- **Bilingual Interface (`English` & `தமிழ்`)**: Instant switching across navigation, auth, discovery, attractions, AI Trip Advisor, and the floating companion.
- **Authentication & Travel Group Profiles**: Registration/login with salted `scrypt` password hashing and travel-group personalization (Individual, Family, Couple, Group of Friends).
- **All 38 Tamil Nadu Districts & Kerala**: Searchable directory of attractions (temples, beaches, hill stations, waterfalls, heritage sites, wildlife, cultural) plus local stays, restaurants, tea shops, hospitals, theatres, transport, native guides, and local brokers.
- **OpenStreetMap & Offline Cache**: Interactive Leaflet map, browser geolocation, live Overpass/Nominatim queries cached in SQLite (`data/local_guide.db`), and offline localStorage search with staleness notices.
- **AI Trip Advisor & Floating Assistant**: Server-side `@google/genai` (`gemini-4-hydrogen`) itinerary planning with 11 resuggestion/regeneration options and a grounded fallback engine.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Set `GEMINI_API_KEY` in `.env` (optional; falls back to the grounded local itinerary engine if omitted).
3. Start the full-stack server (port `3000`):
   ```bash
   npm run dev
   ```
4. Build and type-check:
   ```bash
   npm run lint
   npm run build
   ```

## Push to GitHub

1. Create a new empty repository on GitHub (without README/license).
2. Add your GitHub repository as `origin` and push:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git branch -M main
   git push -u origin main
   ```
