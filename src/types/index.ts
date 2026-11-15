export type Language = 'en' | 'ta';

export type TravelGroupType = 'individual' | 'family' | 'couple' | 'friends';

export interface TravelGroupProfile {
  groupType: TravelGroupType;
  memberCount: number;
  hasChildren?: boolean;
  hasSeniors?: boolean;
  budgetTier?: 'budget' | 'moderate' | 'premium';
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  preferredLanguage: Language;
  travelGroup?: TravelGroupProfile;
  createdAt: string;
}

export type AttractionCategory =
  | 'Temple'
  | 'Beach'
  | 'Hill Station'
  | 'Waterfall'
  | 'Heritage'
  | 'Wildlife'
  | 'Cultural';

export interface DistrictSummary {
  name: string;
  nameTa: string;
  state: 'Tamil Nadu' | 'Kerala';
  headquarters: string;
  pincodePrefix: string;
  lat: number;
  lng: number;
  highlights: string;
  highlightsTa: string;
}

export interface TouristAttraction {
  id: string;
  name: string;
  nameTa: string;
  district: string;
  districtTa: string;
  state: 'Tamil Nadu' | 'Kerala';
  cityOrTown: string;
  pincode: string;
  category: AttractionCategory;
  lat: number;
  lng: number;
  description: string;
  descriptionTa: string;
  openingHours: string;
  visitingRestrictions: string;
  entryFee: string;
  recommendedDuration: string;
  bestSeason: string;
  facilities: string[];
  nearbyPlaces: string[];
  travelAdvice: string;
  travelAdviceTa: string;
  verificationStatus: 'Verified Public Source' | 'Community Submitted';
  imageUrl: string;
  isIllustrativeImage: boolean;
  lastUpdated: string;
  avgRating?: number;
  reviewCount?: number;
}

export type ListingCategory =
  | 'hotels_restaurants'
  | 'lodges_hostels'
  | 'rental_homestays'
  | 'tea_cafes'
  | 'theatres_entertainment'
  | 'hospitals_emergency'
  | 'local_brokers'
  | 'native_guides'
  | 'tourist_attractions'
  | 'transport_services';

export interface MenuItem {
  name: string;
  nameTa?: string;
  priceInr: number;
  category: string;
}

export interface RoomCategory {
  type: string;
  pricePerNightInr: number | null;
  maxOccupancy: number;
  availableRooms: number | null;
}

export interface LocalListing {
  id: string;
  name: string;
  nameTa?: string;
  category: ListingCategory;
  district: string;
  state: string;
  cityOrTown: string;
  pincode?: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  descriptionTa?: string;
  phoneMasked?: string;
  website?: string;
  openingHours?: string;
  priceRangeText?: string;
  amenities: string[];
  suitability?: TravelGroupType[];
  checkInOut?: string;
  policies?: string;
  waterSupplyTimings?: string;
  foodAvailability?: string;
  luggageStorageConfirmed?: boolean;
  rooms?: RoomCategory[];
  menu?: MenuItem[];
  languagesSpoken?: string[];
  experienceYears?: number;
  serviceArea?: string;
  serviceCharges?: string;
  dataSource: 'Verified Provider' | 'Live OSM Data' | 'Cached OSM Data' | 'Unverified Community Listing';
  verificationStatus: 'Verified' | 'Unverified' | 'Cached';
  imageUrl?: string;
  isIllustrativeImage: boolean;
  lastUpdated: string;
  avgRating: number;
  reviewCount: number;
}

export interface TourismPackage {
  id: string;
  title: string;
  titleTa: string;
  destinationDistrict: string;
  state: 'Tamil Nadu' | 'Kerala';
  startingPoint: string;
  durationDays: number;
  pricePerPersonInr: number | null;
  groupSuitability: TravelGroupType[];
  minGroupSize: number;
  maxGroupSize: number;
  plannedArrivalDeparture: string;
  itineraryStops: string[];
  inclusions: string[];
  exclusions: string[];
  transportType: string;
  vehicleInfo: string;
  driverDetails: string;
  operatorName: string;
  cancellationPolicy: string;
  availabilityStatus: 'Available' | 'Seasonal' | 'Enquiry Only' | 'Unavailable';
  verificationStatus: 'Verified Operator' | 'Unverified Listing';
  imageUrl: string;
  lastUpdated: string;
  avgRating: number;
  reviewCount: number;
}

export interface ItineraryStop {
  order: number;
  attractionName: string;
  attractionId?: string;
  whyRecommended: string;
  arrivalTime: string;
  visitDuration: string;
  departureTime: string;
  travelToNext: string;
  entryFeeNote: string;
  nearbyFoodStay: string;
  isEstimated: boolean;
}

export interface ItineraryDay {
  dayNumber: number;
  title: string;
  dateLabel?: string;
  baseLocation: string;
  stops: ItineraryStop[];
  mealBreaks: string;
}

export interface GeneratedItinerary {
  id?: string;
  title: string;
  startingLocation: string;
  destination: string;
  travelGroup: TravelGroupType;
  travellersCount: number;
  estimatedBudgetInr: string;
  paceWarning?: string;
  availabilityNotice: string;
  arrivalStayRecommendations: {
    name: string;
    area: string;
    priceNote: string;
    facilities: string[];
    luggageStorageNote: string;
    isVerified: boolean;
  }[];
  days: ItineraryDay[];
  relevantPackages: {
    packageId?: string;
    title: string;
    priceNote: string;
    operator: string;
    status: string;
  }[];
  selfGuidedTips: string[];
  sourceMode: 'gemini-ai' | 'local-engine';
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  targetType: 'listing' | 'attraction' | 'package' | 'guide' | 'broker' | 'platform' | 'ai_advisor';
  targetId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  isVerifiedVisit: boolean;
  createdAt: string;
}
