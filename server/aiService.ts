import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getAllAttractions, getAllListings, getAllPackages } from './db';
import { GeneratedItinerary, Language, TravelGroupType } from '../src/types';

const MODEL_NAME = 'gemini-2.5-flash';

let cachedClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return cachedClient;
}

export interface TripPlanInput {
  startingLocation: string;
  destination: string;
  arrivalDate?: string;
  departureDate?: string;
  travellersCount: number;
  travelGroup: TravelGroupType;
  budgetInr?: string;
  interests?: string[];
  accommodationPref?: string;
  transportPref?: string;
  daysCount?: number;
  language: Language;
  resuggestInstruction?: string;
  previousPlan?: GeneratedItinerary | null;
}

function buildFallbackItinerary(input: TripPlanInput): GeneratedItinerary {
  const attractions = getAllAttractions();
  const listings = getAllListings();
  const packages = getAllPackages();
  const destLower = input.destination.toLowerCase();

  const matchingAttractions = attractions.filter(
    (a) =>
      a.district.toLowerCase().includes(destLower) ||
      a.cityOrTown.toLowerCase().includes(destLower) ||
      a.state.toLowerCase().includes(destLower) ||
      a.name.toLowerCase().includes(destLower)
  );
  const pool = matchingAttractions.length > 0 ? matchingAttractions : attractions.slice(0, 6);

  const matchingStays = listings.filter(
    (l) =>
      (l.category === 'hotels_restaurants' ||
        l.category === 'lodges_hostels' ||
        l.category === 'rental_homestays') &&
      (l.district.toLowerCase().includes(destLower) ||
        l.state.toLowerCase().includes(destLower) ||
        l.cityOrTown.toLowerCase().includes(destLower))
  );

  const staysToUse =
    matchingStays.length > 0 ? matchingStays.slice(0, 2) : listings.filter((l) => l.rooms).slice(0, 2);

  const matchingPackages = packages.filter(
    (p) =>
      p.destinationDistrict.toLowerCase().includes(destLower) ||
      p.state.toLowerCase().includes(destLower) ||
      p.title.toLowerCase().includes(destLower)
  );

  const numDays = Math.min(Math.max(input.daysCount || 2, 1), 5);
  const days = [];
  for (let d = 1; d <= numDays; d++) {
    const startIdx = (d - 1) * 2;
    const daySpots = pool.slice(startIdx, startIdx + 2);
    const chosenSpots = daySpots.length > 0 ? daySpots : [pool[(d - 1) % pool.length]];
    days.push({
      dayNumber: d,
      title:
        input.language === 'ta'
          ? `நாள் ${d}: ${chosenSpots[0]?.districtTa || input.destination} ஆய்வு`
          : `Day ${d}: Exploring ${chosenSpots[0]?.district || input.destination}`,
      baseLocation: chosenSpots[0]?.cityOrTown || input.destination,
      mealBreaks:
        input.language === 'ta'
          ? 'காலை 08:30 உள்ளூர் டிபன் · மதியம் 01:00 பாரம்பரிய சாப்பாடு'
          : '08:30 AM local tiffin breakfast · 01:00 PM regional lunch break',
      stops: chosenSpots.map((spot, idx) => ({
        order: idx + 1,
        attractionName: input.language === 'ta' ? spot.nameTa : spot.name,
        attractionId: spot.id,
        whyRecommended:
          input.language === 'ta'
            ? `${spot.descriptionTa} (${input.travelGroup} பயணத்திற்கு ஏற்றது)`
            : `${spot.description} Suited for ${input.travelGroup} travellers.`,
        arrivalTime: idx === 0 ? '09:00 AM' : '03:00 PM',
        visitDuration: spot.recommendedDuration,
        departureTime: idx === 0 ? '11:45 AM' : '05:30 PM',
        travelToNext: idx === 0 ? 'Estimated 25–45 mins local road transit' : 'Return to accommodation',
        entryFeeNote: `${spot.entryFee} (Confirm at gate)`,
        nearbyFoodStay: staysToUse[0]?.name || 'Local eateries near site entrance',
        isEstimated: true,
      })),
    });
  }

  return {
    title:
      input.language === 'ta'
        ? `${input.startingLocation} → ${input.destination} (${numDays} நாள் திட்டம்)`
        : `${input.startingLocation} to ${input.destination} (${numDays}-Day Plan)`,
    startingLocation: input.startingLocation,
    destination: input.destination,
    travelGroup: input.travelGroup,
    travellersCount: input.travellersCount,
    estimatedBudgetInr: input.budgetInr || '₹4,500 – ₹9,500 (Estimated)',
    paceWarning:
      numDays === 1 && pool.length > 3
        ? input.language === 'ta'
          ? 'ஒரு நாளில் அனைத்து இடங்களையும் பார்ப்பது அவசரமாக இருக்கலாம்; முக்கிய 2 இடங்களை மட்டும் தேர்வு செய்யவும்.'
          : 'Schedule is compact for 1 day; focus on 2 core stops to avoid rushed road transit.'
        : undefined,
    availabilityNotice:
      input.language === 'ta'
        ? 'நேரம் மற்றும் கட்டணங்கள் தோராயமானவை. பயணத்திற்கு முன் தங்குமிட அறை மற்றும் நுழைவு நேரத்தை உறுதிப்படுத்தவும்.'
        : 'Travel times and entry fees are estimates grounded in Local Guide records. Confirm room availability and seasonal hours before departure.',
    arrivalStayRecommendations: staysToUse.map((s) => ({
      name: input.language === 'ta' && s.nameTa ? s.nameTa : s.name,
      area: `${s.cityOrTown}, ${s.district}`,
      priceNote: s.priceRangeText || 'Confirm rate on enquiry',
      facilities: s.amenities.slice(0, 4),
      luggageStorageNote: s.luggageStorageConfirmed
        ? 'Luggage storage confirmed by property'
        : 'Luggage storage not pre-confirmed — ask front desk before arrival',
      isVerified: s.verificationStatus === 'Verified',
    })),
    days,
    relevantPackages: matchingPackages.map((p) => ({
      packageId: p.id,
      title: input.language === 'ta' ? p.titleTa : p.title,
      priceNote: p.pricePerPersonInr ? `₹${p.pricePerPersonInr} / person` : 'Enquiry pricing',
      operator: p.operatorName,
      status: `${p.availabilityStatus} (${p.verificationStatus})`,
    })),
    selfGuidedTips: [
      input.language === 'ta'
        ? 'அரசு விரைவுப் பேருந்து (TNSTC/SETC) அல்லது அங்கீகரிக்கப்பட்ட உள்ளூர் டாக்ஸி வழியாகப் பயணிக்கலாம்.'
        : 'Combine TNSTC/SETC inter-district coaches or verified local cabs for flexible pacing.',
      input.language === 'ta'
        ? 'கோவில் மற்றும் மலைத்தள நேரங்களைக் காலையிலேயே திட்டமிடுங்கள்.'
        : 'Schedule temples and hill viewpoints in the morning for cooler temperatures and lighter queues.',
    ],
    sourceMode: 'local-engine',
    createdAt: new Date().toISOString(),
  };
}

export async function generateGroundedTripPlan(input: TripPlanInput): Promise<GeneratedItinerary> {
  const aiClient = getAiClient();
  if (!aiClient) {
    console.warn('GEMINI_API_KEY is missing; using local fallback engine.');
    return buildFallbackItinerary(input);
  }

  const attractions = getAllAttractions();
  const listings = getAllListings();
  const packages = getAllPackages();
  const destLower = input.destination.toLowerCase();

  const relevantAttractions = attractions
    .filter(
      (a) =>
        a.district.toLowerCase().includes(destLower) ||
        a.state.toLowerCase().includes(destLower) ||
        a.cityOrTown.toLowerCase().includes(destLower) ||
        a.name.toLowerCase().includes(destLower)
    )
    .slice(0, 12);

  const contextAttractions =
    relevantAttractions.length > 0 ? relevantAttractions : attractions.slice(0, 12);

  const relevantStays = listings
    .filter(
      (l) =>
        (l.category === 'hotels_restaurants' ||
          l.category === 'lodges_hostels' ||
          l.category === 'rental_homestays') &&
        (l.district.toLowerCase().includes(destLower) || l.state.toLowerCase().includes(destLower))
    )
    .slice(0, 5);

  const relevantPackages = packages
    .filter(
      (p) =>
        p.destinationDistrict.toLowerCase().includes(destLower) ||
        p.state.toLowerCase().includes(destLower)
    )
    .slice(0, 4);

  const prompt = `
You are Local Guide's AI Trip Advisor for Tamil Nadu and Kerala tourism.
Create a realistic, honest, practical day-by-day trip itinerary.
Respond in ${input.language === 'ta' ? 'Tamil (தமிழ் script) with clear place names' : 'English'}.

TRAVELLER PROFILE:
- Starting Location: ${input.startingLocation}
- Destination: ${input.destination}
- Dates: ${input.arrivalDate || 'Flexible'} to ${input.departureDate || 'Flexible'}
- Days requested: ${input.daysCount || 2}
- Travel Group: ${input.travelGroup} (${input.travellersCount} travellers)
- Budget: ${input.budgetInr || 'Moderate / Flexible'}
- Interests: ${(input.interests || ['Heritage', 'Nature', 'Local Food']).join(', ')}
- Stay preference: ${input.accommodationPref || 'Clean family-friendly stay'}
- Transport preference: ${input.transportPref || 'Mixed public transit / cab'}
${input.resuggestInstruction ? `\nUSER RESUGGESTION REQUEST: ${input.resuggestInstruction}\n` : ''}
${input.previousPlan ? `\nPREVIOUS PLAN TITLE: ${input.previousPlan.title}\n` : ''}

GROUNDED DATABASE ATTRACTIONS (prefer these real spots & exact facts):
${JSON.stringify(
  contextAttractions.map((a) => ({
    id: a.id,
    name: a.name,
    nameTa: a.nameTa,
    district: a.district,
    state: a.state,
    category: a.category,
    openingHours: a.openingHours,
    entryFee: a.entryFee,
    duration: a.recommendedDuration,
    advice: a.travelAdvice,
  }))
)}

GROUNDED ACCOMMODATIONS (ONLY claim luggage storage confirmed if luggageStorageConfirmed is true!):
${JSON.stringify(
  relevantStays.map((s) => ({
    name: s.name,
    city: s.cityOrTown,
    district: s.district,
    priceRange: s.priceRangeText,
    amenities: s.amenities,
    luggageStorageConfirmed: Boolean(s.luggageStorageConfirmed),
    verified: s.verificationStatus === 'Verified',
  }))
)}

GROUNDED PACKAGES (do NOT invent fake packages if none match; offer self-guided tips instead):
${JSON.stringify(
  relevantPackages.map((p) => ({
    id: p.id,
    title: p.title,
    pricePerPersonInr: p.pricePerPersonInr,
    operator: p.operatorName,
    status: p.availabilityStatus,
    verification: p.verificationStatus,
  }))
)}

RULES:
- Never fabricate hotel prices, phone numbers, driver details, or confirm luggage storage unless luggageStorageConfirmed is true.
- Warn clearly if the trip pace looks rushed for the chosen days.
- Include realistic transit times between stops.
`;

  try {
    const response = await aiClient.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            estimatedBudgetInr: { type: Type.STRING },
            paceWarning: { type: Type.STRING },
            availabilityNotice: { type: Type.STRING },
            arrivalStayRecommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  area: { type: Type.STRING },
                  priceNote: { type: Type.STRING },
                  facilities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  luggageStorageNote: { type: Type.STRING },
                  isVerified: { type: Type.BOOLEAN },
                },
              },
            },
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  baseLocation: { type: Type.STRING },
                  mealBreaks: { type: Type.STRING },
                  stops: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        order: { type: Type.INTEGER },
                        attractionName: { type: Type.STRING },
                        attractionId: { type: Type.STRING },
                        whyRecommended: { type: Type.STRING },
                        arrivalTime: { type: Type.STRING },
                        visitDuration: { type: Type.STRING },
                        departureTime: { type: Type.STRING },
                        travelToNext: { type: Type.STRING },
                        entryFeeNote: { type: Type.STRING },
                        nearbyFoodStay: { type: Type.STRING },
                        isEstimated: { type: Type.BOOLEAN },
                      },
                    },
                  },
                },
              },
            },
            relevantPackages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  packageId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  priceNote: { type: Type.STRING },
                  operator: { type: Type.STRING },
                  status: { type: Type.STRING },
                },
              },
            },
            selfGuidedTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim()) as Partial<GeneratedItinerary>;
    if (!parsed.days || !parsed.days.length) {
      return buildFallbackItinerary(input);
    }

    return {
      title: parsed.title || `${input.startingLocation} → ${input.destination}`,
      startingLocation: input.startingLocation,
      destination: input.destination,
      travelGroup: input.travelGroup,
      travellersCount: input.travellersCount,
      estimatedBudgetInr: parsed.estimatedBudgetInr || input.budgetInr || 'Estimated based on group size',
      paceWarning: parsed.paceWarning || undefined,
      availabilityNotice:
        parsed.availabilityNotice ||
        'Estimated itinerary times and entry notes. Confirm live timings and stays prior to travel.',
      arrivalStayRecommendations: parsed.arrivalStayRecommendations || [],
      days: parsed.days,
      relevantPackages: parsed.relevantPackages || [],
      selfGuidedTips: parsed.selfGuidedTips || [],
      sourceMode: 'gemini-ai',
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Gemini trip plan error, using grounded fallback:', err);
    return buildFallbackItinerary(input);
  }
}

export async function askFloatingCompanion(params: {
  message: string;
  language: Language;
  currentDistrict?: string;
  travelGroup?: string;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<{ reply: string; mode: 'gemini-ai' | 'local-engine' }> {
  const attractions = getAllAttractions();
  const listings = getAllListings();
  const packages = getAllPackages();

  const districtFilter = params.currentDistrict?.toLowerCase() || '';
  const localAttractions = districtFilter
    ? attractions.filter((a) => a.district.toLowerCase().includes(districtFilter)).slice(0, 8)
    : attractions.slice(0, 10);

  const localListings = districtFilter
    ? listings.filter((l) => l.district.toLowerCase().includes(districtFilter)).slice(0, 8)
    : listings.slice(0, 8);

  const aiClient = getAiClient();
  if (!aiClient) {
    const names = localAttractions.slice(0, 3).map((a) => (params.language === 'ta' ? a.nameTa : a.name));
    const reply =
      params.language === 'ta'
        ? `உங்கள் கேள்விக்கான உள்ளூர் தகவல்: ${names.join(', ')} ஆகிய இடங்களைப் பார்க்கலாம். AI சேவை இணைக்கப்படாததால் உள்ளூர் தரவுத்தளத்திலிருந்து பதில் வழங்கப்படுகிறது.`
        : `Based on Local Guide’s verified database${params.currentDistrict ? ` for ${params.currentDistrict}` : ''}: consider ${names.join(', ')}. Live AI key is currently offline, so recommendations come directly from verified local listings.`;
    return { reply, mode: 'local-engine' };
  }

  const systemInstruction = `You are Local Guide Companion, a friendly, trustworthy travel assistant for Tamil Nadu and beyond.
Always reply in ${params.language === 'ta' ? 'Tamil (தமிழ்)' : 'English'}.
Current active district context: ${params.currentDistrict || 'All Tamil Nadu'}.
User travel group: ${params.travelGroup || 'General traveller'}.
Ground your recommendations in these verified records and NEVER fabricate phone numbers, prices, or live availability:
Attractions: ${JSON.stringify(localAttractions.map((a) => ({ name: a.name, district: a.district, hours: a.openingHours, fee: a.entryFee, advice: a.travelAdvice })))}
Stays/Food/Hospitals/Guides: ${JSON.stringify(localListings.map((l) => ({ name: l.name, category: l.category, district: l.district, price: l.priceRangeText, verified: l.verificationStatus })))}
Packages: ${JSON.stringify(packages.map((p) => ({ title: p.title, district: p.destinationDistrict, price: p.pricePerPersonInr, status: p.availabilityStatus })))}
Keep answers practical, concise, and warm.`;

  try {
    const historyBlock = params.history
      .slice(-6)
      .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
      .join('\n');

    const response = await aiClient.models.generateContent({
      model: MODEL_NAME,
      contents: `${historyBlock ? historyBlock + '\n' : ''}User: ${params.message}`,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    return {
      reply:
        response.text?.trim() ||
        (params.language === 'ta' ? 'மன்னிக்கவும், மீண்டும் முயற்சிக்கவும்.' : 'Please try asking again.'),
      mode: 'gemini-ai',
    };
  } catch (err) {
    console.error('Gemini companion error:', err);
    return {
      reply:
        params.language === 'ta'
          ? 'தற்போது நேரடி AI இணைப்பில் தாமதம் உள்ளது. மேலே உள்ள தேடல் மற்றும் ஆஃப்லைன் பட்டியல்களைப் பயன்படுத்தி இடங்களைப் பார்க்கலாம்.'
          : 'The live AI service is temporarily busy. You can still browse all 38 Tamil Nadu districts, verified stays, and saved itineraries directly from our local database.',
      mode: 'local-engine',
    };
  }
}