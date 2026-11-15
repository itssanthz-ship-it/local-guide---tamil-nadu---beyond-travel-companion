import React, { useState } from 'react';
import {
  Compass,
  Calendar,
  MapPin,
  Clock,
  AlertTriangle,
  RefreshCw,
  Bookmark,
  Check,
  Trees,
  Landmark,
  VolumeX,
  Users,
  Wallet,
  Car,
  Home,
  ArrowRight,
} from 'lucide-react';
import {
  GeneratedItinerary,
  Language,
  TravelGroupProfile,
  TravelGroupType,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { saveLocalItinerary, getLocalItineraries } from '../utils/offlineStore';

interface AITripAdvisorViewProps {
  language: Language;
  travelGroup: TravelGroupProfile;
  authToken: string | null;
  defaultDestination?: string;
  onSelectSavedItinerary?: (plan: GeneratedItinerary) => void;
}

const INTEREST_OPTIONS = [
  'Temples & Heritage',
  'Hills & Tea Estates',
  'Waterfalls & Nature',
  'Beaches & Coast',
  'Local Food & Coffee',
  'Wildlife',
  'Quieter Villages',
];

export default function AITripAdvisorView({
  language,
  travelGroup,
  authToken,
  defaultDestination = 'Madurai & Thanjavur',
}: AITripAdvisorViewProps) {
  const t = TRANSLATIONS[language];

  const [startingLocation, setStartingLocation] = useState('Chennai');
  const [destination, setDestination] = useState(defaultDestination);
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [daysCount, setDaysCount] = useState(2);
  const [groupType, setGroupType] = useState<TravelGroupType>(travelGroup.groupType);
  const [travellersCount, setTravellersCount] = useState(travelGroup.memberCount);
  const [budgetInr, setBudgetInr] = useState('₹8,000 – ₹15,000');
  const [interests, setInterests] = useState<string[]>(['Temples & Heritage', 'Local Food & Coffee']);
  const [accommodationPref, setAccommodationPref] = useState('Clean family hotel / heritage homestay');
  const [transportPref, setTransportPref] = useState('Train / Bus + Local Cab');

  const [plan, setPlan] = useState<GeneratedItinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedFeedback, setSavedFeedback] = useState('');
  const [savedList, setSavedList] = useState<GeneratedItinerary[]>(() => getLocalItineraries());

  const toggleInterest = (item: string) => {
    setInterests((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const runPlanner = async (resuggestInstruction?: string, overrideDays?: number) => {
    setLoading(true);
    setError('');
    setSavedFeedback('');
    const targetDays = overrideDays ?? daysCount;

    try {
      const res = await fetch('/api/ai/trip-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startingLocation: startingLocation.trim() || 'Chennai',
          destination: destination.trim() || 'Tamil Nadu',
          arrivalDate: arrivalDate || undefined,
          departureDate: departureDate || undefined,
          daysCount: targetDays,
          travelGroup: groupType,
          travellersCount,
          budgetInr,
          interests,
          accommodationPref,
          transportPref,
          language,
          resuggestInstruction,
          previousPlan: resuggestInstruction ? plan : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not generate itinerary.');
        return;
      }
      setPlan(data.plan);
      if (overrideDays) setDaysCount(overrideDays);
    } catch {
      setError(
        language === 'ta'
          ? 'இணைய இணைப்பு இல்லை. சேமிக்கப்பட்ட ஆஃப்லைன் பயணத் திட்டங்களைக் கீழே பார்க்கலாம்.'
          : 'Offline or network timeout. Saved offline itineraries remain available below.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItinerary = async () => {
    if (!plan) return;
    const updatedLocal = saveLocalItinerary(plan);
    setSavedList(updatedLocal);

    if (authToken) {
      try {
        await fetch('/api/itineraries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(plan),
        });
      } catch {
        // local offline save already succeeded
      }
    }
    setSavedFeedback(t.savedItineraryMsg);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">
            {language === 'ta' ? 'அறிவார்ந்த பயணத் திட்டமிடல்' : 'Intelligent Grounded Trip Planning'}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{t.aiAdvisorTitle}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{t.aiAdvisorSubtitle}</p>
        </div>

        {/* Quick destination starter presets */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Kerala (Vagamon & Munnar)', dest: 'Kerala Vagamon Munnar' },
            { label: 'Thanjavur Chola Trail', dest: 'Thanjavur' },
            { label: 'Ooty & Nilgiris', dest: 'Nilgiris' },
            { label: 'Madurai & Rameswaram', dest: 'Madurai & Rameswaram' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDestination(preset.dest)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-800 hover:text-blue-800"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Step 1: Trip Input Form */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              {language === 'ta' ? 'படி 1: பயண விவரங்கள் (விருப்பமானதைத் தவிர்க்கலாம்)' : 'Step 1: Trip Details (Skip optional fields)'}
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runPlanner();
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700">{t.startingLocationLabel}</label>
                <input
                  type="text"
                  value={startingLocation}
                  onChange={(e) => setStartingLocation(e.target.value)}
                  placeholder="Chennai, Coimbatore, Madurai..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">{t.destinationLabel}</label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Kerala, Kanyakumari, Kolli Hills..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">{t.arrivalDateLabel}</label>
                  <input
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">{t.departureDateLabel}</label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Days</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={daysCount}
                    onChange={(e) => setDaysCount(Math.min(5, Math.max(1, parseInt(e.target.value || '2', 10))))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Group</label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value as TravelGroupType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
                  >
                    <option value="individual">Individual</option>
                    <option value="family">Family</option>
                    <option value="couple">Couple</option>
                    <option value="friends">Friends</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">People</label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={travellersCount}
                    onChange={(e) => setTravellersCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">{t.totalBudgetLabel}</label>
                <input
                  type="text"
                  value={budgetInr}
                  onChange={(e) => setBudgetInr(e.target.value)}
                  placeholder="e.g. ₹10,000 total or Economical"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">{t.interestsLabel}</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map((opt) => {
                    const active = interests.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleInterest(opt)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-blue-800 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">{t.accommodationPrefLabel}</label>
                  <input
                    type="text"
                    value={accommodationPref}
                    onChange={(e) => setAccommodationPref(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">{t.transportPrefLabel}</label>
                  <input
                    type="text"
                    value={transportPref}
                    onChange={(e) => setTransportPref(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-60"
              >
                <Compass className="h-4 w-4" />
                {loading ? t.generatingPlan : t.generatePlanBtn}
              </button>
            </form>

            {savedList.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-800">
                  {language === 'ta' ? 'ஆஃப்லைனில் சேமித்த திட்டங்கள்' : 'Saved Offline Itineraries'}
                </p>
                <div className="mt-2 space-y-2">
                  {savedList.slice(0, 4).map((saved) => (
                    <button
                      key={saved.id || saved.title}
                      type="button"
                      onClick={() => setPlan(saved)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:border-blue-800"
                    >
                      <span className="truncate font-medium text-slate-900">{saved.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2–6: Generated Itinerary & Resuggestion Controls */}
        <div className="lg:col-span-8">
          {error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {error}
            </div>
          )}

          {!plan && !loading && (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Compass className="h-10 w-10 text-blue-800" />
              <h3 className="mt-3 text-lg font-bold text-slate-900">
                {language === 'ta'
                  ? 'இன்னும் பயணத் திட்டம் உருவாக்கப்படவில்லை'
                  : 'Ready to build your grounded itinerary'}
              </h3>
              <p className="mt-1.5 max-w-md text-sm text-slate-600">
                {language === 'ta'
                  ? 'தமிழ்நாட்டின் எந்த மாவட்டத்தையோ அல்லது கேரளா போன்ற இடத்தையோ உள்ளிட்டு AI பயணத் திட்டத்தைப் பெறுங்கள்.'
                  : 'Enter any Tamil Nadu district, town, or Kerala destination on the left. We will recommend arrival stays, realistic stop timings, and available packages.'}
              </p>
            </div>
          )}

          {loading && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="h-6 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            </div>
          )}

          {plan && !loading && (
            <div className="space-y-6">
              {/* Plan Header */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{plan.startingLocation} → {plan.destination}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{plan.travellersCount} travellers ({plan.travelGroup})</span>
                      <span aria-hidden="true">·</span>
                      <span>{plan.sourceMode === 'gemini-ai' ? 'Gemini AI Grounded' : 'Local Database Engine'}</span>
                    </div>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">{plan.title}</h2>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-blue-900">
                      {plan.estimatedBudgetInr}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveItinerary}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    {t.saveItineraryBtn}
                  </button>
                </div>

                {savedFeedback && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <Check className="h-4 w-4" /> {savedFeedback}
                  </p>
                )}

                {plan.paceWarning && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>{plan.paceWarning}</span>
                  </div>
                )}

                <p className="mt-3 text-xs text-slate-600">{plan.availabilityNotice}</p>
              </div>

              {/* Step 5: Resuggest & Regenerate Bar */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.resuggestTitle}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runPlanner('Resuggest an alternate route and sequence of places')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Resuggest Itinerary
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Explore completely alternative places in this region')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Compass className="h-3.5 w-3.5" /> Alternative Places
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Make the trip more budget-friendly with public transit and economical stays')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Wallet className="h-3.5 w-3.5" /> Lower Budget
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Shorten the trip cleanly while keeping must-see highlights', Math.max(1, daysCount - 1))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Calendar className="h-3.5 w-3.5" /> Shorten (-1 Day)
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Extend the trip by 1 extra day with relaxed pacing', Math.min(5, daysCount + 1))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Calendar className="h-3.5 w-3.5" /> Extend (+1 Day)
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Focus more on waterfalls, hills, wildlife, and nature destinations')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Trees className="h-3.5 w-3.5" /> More Nature
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Focus more on historical temples, heritage monuments, and cultural sites')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Landmark className="h-3.5 w-3.5" /> Historical & Cultural
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Prefer quieter, lesser-known, crowd-free locations')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <VolumeX className="h-3.5 w-3.5" /> Quieter Spots
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Prioritize accessible, family-friendly attractions with gentle walking')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Users className="h-3.5 w-3.5" /> Family-Friendly
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Suggest staying at a calmer nearby town or alternate base accommodation area')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Home className="h-3.5 w-3.5" /> Change Stay Base
                  </button>
                  <button
                    type="button"
                    onClick={() => runPlanner('Switch transportation preference to self-drive or private cab with realistic drive times')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    <Car className="h-3.5 w-3.5" /> Change Transport
                  </button>
                </div>
              </div>

              {/* Step 2: Arrival Stays */}
              {plan.arrivalStayRecommendations.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900">
                    Step 2: Recommended Arrival Point & Stays
                  </h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {plan.arrivalStayRecommendations.map((stay) => (
                      <div key={stay.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{stay.area}</span>
                          <span>{stay.isVerified ? 'Verified Provider' : 'Verify on Arrival'}</span>
                        </div>
                        <p className="mt-1 font-bold text-slate-900">{stay.name}</p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums text-blue-900">{stay.priceNote}</p>
                        <p className="mt-2 text-xs text-slate-600">{stay.facilities.join(' · ')}</p>
                        <p className="mt-2 text-[11px] font-medium text-slate-700">{stay.luggageStorageNote}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3 & 6: Day-by-Day Schedule */}
              <div className="space-y-4">
                {plan.days.map((day) => (
                  <div key={day.dayNumber} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <h3 className="text-lg font-bold text-slate-900">{day.title}</h3>
                      <span className="text-xs font-medium text-slate-500">Base: {day.baseLocation}</span>
                    </div>

                    <div className="mt-4 space-y-4">
                      {day.stops.map((stop) => (
                        <div
                          key={`${day.dayNumber}-${stop.order}-${stop.attractionName}`}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <span className="font-mono text-xs font-semibold tabular-nums text-blue-800">
                                {stop.arrivalTime} – {stop.departureTime} ({stop.visitDuration})
                              </span>
                              <h4 className="mt-0.5 text-base font-bold text-slate-900">
                                {stop.order}. {stop.attractionName}
                              </h4>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                runPlanner(
                                  `Replace "${stop.attractionName}" on Day ${day.dayNumber} with a different nearby attraction while keeping the rest of my preferences`
                                )
                              }
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-blue-800 hover:text-blue-800"
                            >
                              Replace Stop
                            </button>
                          </div>

                          <p className="mt-1.5 text-sm text-slate-700">{stop.whyRecommended}</p>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" /> Next: {stop.travelToNext}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" /> Fee: {stop.entryFeeNote}
                            </span>
                            <span>Nearby: {stop.nearbyFoodStay}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 text-xs font-medium text-slate-600">Meal Breaks: {day.mealBreaks}</p>
                  </div>
                ))}
              </div>

              {/* Step 4: Relevant Packages or Self-Guided Advice */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900">
                  Step 4: Available Packages & Self-Guided Transport Options
                </h3>

                {plan.relevantPackages.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {plan.relevantPackages.map((pkg) => (
                      <div key={pkg.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-bold text-slate-900">{pkg.title}</p>
                        <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-blue-900">
                          {pkg.priceNote}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {pkg.operator} · {pkg.status}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">
                    No pre-packaged operator tour matches this exact custom route. Follow the self-guided transit options below instead of booking an unverified package:
                  </p>
                )}

                <ul className="mt-3 space-y-1.5 text-xs text-slate-700">
                  {plan.selfGuidedTips.map((tip) => (
                    <li key={tip}>• {tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
