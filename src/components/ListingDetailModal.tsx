import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  Star,
  ExternalLink,
  Bookmark,
  Flag,
  Send,
  ShieldCheck,
  AlertTriangle,
  Droplets,
  Utensils,
  Edit3,
} from 'lucide-react';
import {
  Language,
  LocalListing,
  ReviewItem,
  TourismPackage,
  TouristAttraction,
  User,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';

export type DetailModalTarget =
  | { type: 'listing'; item: LocalListing }
  | { type: 'attraction'; item: TouristAttraction }
  | { type: 'package'; item: TourismPackage };

interface ListingDetailModalProps {
  target: DetailModalTarget | null;
  language: Language;
  currentUser: User | null;
  authToken: string | null;
  isSavedOffline: boolean;
  onToggleSaveOffline: (id: string) => void;
  onListingUpdated?: (updated: LocalListing) => void;
  onClose: () => void;
}

export default function ListingDetailModal({
  target,
  language,
  currentUser,
  authToken,
  isSavedOffline,
  onToggleSaveOffline,
  onListingUpdated,
  onClose,
}: ListingDetailModalProps) {
  const t = TRANSLATIONS[language];
  const [imgError, setImgError] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  const [showEnquiry, setShowEnquiry] = useState(false);
  const [enqName, setEnqName] = useState(currentUser?.name || '');
  const [enqContact, setEnqContact] = useState('');
  const [enqMsg, setEnqMsg] = useState('');
  const [enqStatus, setEnqStatus] = useState('');

  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Outdated price or timings');
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatus, setReportStatus] = useState('');

  const [showOwnerEdit, setShowOwnerEdit] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editWater, setEditWater] = useState('');
  const [editFood, setEditFood] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editLuggage, setEditLuggage] = useState(false);
  const [ownerMsg, setOwnerMsg] = useState('');

  useEffect(() => {
    setImgError(false);
    setReviewMsg('');
    setEnqStatus('');
    setReportStatus('');
    setOwnerMsg('');
    setShowEnquiry(false);
    setShowReport(false);
    setShowOwnerEdit(false);

    if (!target) return;

    if (target.type === 'listing') {
      setEditPrice(target.item.priceRangeText || '');
      setEditWater(target.item.waterSupplyTimings || '');
      setEditFood(target.item.foodAvailability || '');
      setEditHours(target.item.openingHours || '');
      setEditLuggage(Boolean(target.item.luggageStorageConfirmed));
    }

    const rType =
      target.type === 'listing'
        ? target.item.category === 'native_guides'
          ? 'guide'
          : target.item.category === 'local_brokers'
            ? 'broker'
            : 'listing'
        : target.type;

    fetch(`/api/reviews?targetType=${rType}&targetId=${target.item.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.reviews)) {
          setReviews(
            d.reviews.map((row: Record<string, unknown>) => ({
              id: String(row.id),
              targetType: String(row.target_type) as ReviewItem['targetType'],
              targetId: String(row.target_id),
              userId: String(row.user_id),
              userName: String(row.user_name),
              rating: Number(row.rating),
              comment: String(row.comment),
              isVerifiedVisit: Boolean(row.is_verified_visit),
              createdAt: String(row.created_at),
            }))
          );
        }
      })
      .catch(() => setReviews([]));
  }, [target]);

  if (!target) return null;

  const item = target.item;
  const title =
    language === 'ta' && 'nameTa' in item && item.nameTa
      ? item.nameTa
      : language === 'ta' && 'titleTa' in item
        ? item.titleTa
        : 'title' in item
          ? item.title
          : item.name;

  const subtitle =
    target.type === 'attraction'
      ? `${language === 'ta' ? target.item.districtTa : target.item.district} · ${target.item.state} · PIN ${target.item.pincode}`
      : target.type === 'listing'
        ? `${target.item.cityOrTown}, ${target.item.district} · ${target.item.dataSource}`
        : `${target.item.destinationDistrict} · ${target.item.durationDays} Days · ${target.item.operatorName}`;

  const imageUrl = item.imageUrl;
  const isIllustrative = 'isIllustrativeImage' in item ? item.isIllustrativeImage : true;

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewMsg('');
    const rType =
      target.type === 'listing'
        ? target.item.category === 'native_guides'
          ? 'guide'
          : target.item.category === 'local_brokers'
            ? 'broker'
            : 'listing'
        : target.type;

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          targetType: rType,
          targetId: item.id,
          rating,
          comment,
          guestName: guestName || 'Visitor',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewMsg(data.error || 'Could not save review.');
        return;
      }
      setReviews((prev) => [data.review, ...prev]);
      setComment('');
      setReviewMsg(language === 'ta' ? 'உங்கள் மதிப்பீடு சேமிக்கப்பட்டது!' : 'Thank you! Review published.');
    } catch {
      setReviewMsg('Offline: cannot submit review right now.');
    }
  };

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          listingId: item.id,
          senderName: enqName || currentUser?.name || 'Traveller',
          senderContact: enqContact,
          message: enqMsg,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnqStatus(data.message);
        setEnqMsg('');
      } else {
        setEnqStatus(data.error || 'Could not send enquiry.');
      }
    } catch {
      setEnqStatus('Offline: connect to internet to send an enquiry.');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          targetType: target.type,
          targetId: item.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      if (res.ok) {
        setReportStatus(
          language === 'ta'
            ? 'புகார் பதிவு செய்யப்பட்டது. எங்கள் குழு சரிபார்க்கும்.'
            : 'Report submitted for moderation review.'
        );
        setReportDetails('');
      }
    } catch {
      setReportStatus('Unable to submit report while offline.');
    }
  };

  const handleOwnerUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (target.type !== 'listing') return;
    try {
      const res = await fetch(`/api/listings/${item.id}/owner-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceRangeText: editPrice,
          waterSupplyTimings: editWater,
          foodAvailability: editFood,
          openingHours: editHours,
          luggageStorageConfirmed: editLuggage,
        }),
      });
      const data = await res.json();
      if (res.ok && data.listing) {
        onListingUpdated?.(data.listing);
        setOwnerMsg(
          language === 'ta'
            ? 'உரிமையாளர் தகவல் புதுப்பிக்கப்பட்டது.'
            : 'Provider details updated in SQLite.'
        );
      }
    } catch {
      setOwnerMsg('Update failed while offline.');
    }
  };

  const osmDirectionUrl =
    'lat' in item && 'lng' in item
      ? `https://www.openstreetmap.org/directions?to=${item.lat}%2C${item.lng}`
      : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header image */}
        <div className="relative h-56 w-full overflow-hidden bg-slate-900">
          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt={title}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-blue-950 to-slate-900 px-6 text-center text-white">
              <MapPin className="h-8 w-8 text-amber-400" />
              <p className="mt-2 text-sm font-medium text-slate-200">{title}</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="absolute right-4 top-4 rounded-lg bg-slate-950/60 p-2 text-white backdrop-blur hover:bg-slate-900"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 text-white">
            <p className="text-xs font-medium text-amber-300">{subtitle}</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">{title}</h2>
            {isIllustrative && (
              <p className="mt-1 text-[11px] text-slate-300">{t.illustrativeImageNote}</p>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-blue-800" />
                {target.type === 'attraction'
                  ? target.item.verificationStatus
                  : target.type === 'listing'
                    ? target.item.verificationStatus
                    : target.item.verificationStatus}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {t.lastUpdated}: {item.lastUpdated.slice(0, 10)}
              </span>
              {'avgRating' in item && item.avgRating ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-amber-700">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {item.avgRating} ({item.reviewCount})
                  </span>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleSaveOffline(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isSavedOffline
                    ? 'border-blue-800 bg-blue-50 text-blue-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                {isSavedOffline ? t.savedOffline : t.saveOffline}
              </button>

              {osmDirectionUrl && (
                <a
                  href={osmDirectionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t.getDirections}
                </a>
              )}
            </div>
          </div>

          {/* Core Content by Type */}
          {target.type === 'attraction' && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-700">
                {language === 'ta' ? target.item.descriptionTa : target.item.description}
              </p>
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Opening Hours</span>
                  <p className="mt-0.5 text-sm text-slate-900">{target.item.openingHours}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Entry Fee</span>
                  <p className="mt-0.5 text-sm text-slate-900">{target.item.entryFee}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Recommended Duration</span>
                  <p className="mt-0.5 text-sm text-slate-900">{target.item.recommendedDuration}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Best Season</span>
                  <p className="mt-0.5 text-sm text-slate-900">{target.item.bestSeason}</p>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
                <p className="font-semibold">Travel Advice & Restrictions</p>
                <p className="mt-1">{language === 'ta' ? target.item.travelAdviceTa : target.item.travelAdvice}</p>
                <p className="mt-1 text-xs text-amber-800">{target.item.visitingRestrictions}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Facilities & Nearby Places</p>
                <p className="mt-1 text-sm text-slate-700">
                  {target.item.facilities.join(' · ')} — Nearby: {target.item.nearbyPlaces.join(', ')}
                </p>
              </div>
            </div>
          )}

          {target.type === 'listing' && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-slate-700">
                {language === 'ta' && target.item.descriptionTa
                  ? target.item.descriptionTa
                  : target.item.description}
              </p>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Address</span>
                  <p className="mt-0.5 text-sm text-slate-900">{target.item.address}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Hours / Check-in</span>
                  <p className="mt-0.5 text-sm text-slate-900">
                    {target.item.checkInOut || target.item.openingHours || 'Confirm directly'}
                  </p>
                </div>
                {target.item.priceRangeText && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500">Rates / Charges</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                      {target.item.priceRangeText}
                    </p>
                  </div>
                )}
                {target.item.serviceCharges && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500">Service Fee</span>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">
                      {target.item.serviceCharges}
                    </p>
                  </div>
                )}
                {target.item.languagesSpoken && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500">Languages Spoken</span>
                    <p className="mt-0.5 text-sm text-slate-900">
                      {target.item.languagesSpoken.join(', ')}
                    </p>
                  </div>
                )}
                {target.item.waterSupplyTimings && (
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Droplets className="h-3.5 w-3.5 text-blue-700" /> Water Supply
                    </span>
                    <p className="mt-0.5 text-sm text-slate-900">{target.item.waterSupplyTimings}</p>
                  </div>
                )}
                {target.item.foodAvailability && (
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Utensils className="h-3.5 w-3.5 text-amber-700" /> Meal Timings
                    </span>
                    <p className="mt-0.5 text-sm text-slate-900">{target.item.foodAvailability}</p>
                  </div>
                )}
              </div>

              {target.item.rooms && target.item.rooms.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Room Categories & Occupancy</h3>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Room Type</th>
                          <th className="px-4 py-2.5 font-semibold">Max Guests</th>
                          <th className="px-4 py-2.5 font-semibold">Nightly Rate</th>
                          <th className="px-4 py-2.5 font-semibold">Reported Availability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {target.item.rooms.map((rm) => (
                          <tr key={rm.type}>
                            <td className="px-4 py-2.5 font-medium text-slate-900">{rm.type}</td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-700">{rm.maxOccupancy}</td>
                            <td className="px-4 py-2.5 font-mono tabular-nums text-slate-900">
                              {rm.pricePerNightInr ? `₹${rm.pricePerNightInr}` : 'Enquire'}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-700">
                              {rm.availableRooms !== null ? `${rm.availableRooms} rooms (verify)` : 'Confirm'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {target.item.menu && target.item.menu.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Provider Menu & Prices</h3>
                  <div className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
                    {target.item.menu.map((m) => (
                      <div key={m.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">
                            {language === 'ta' && m.nameTa ? m.nameTa : m.name}
                          </p>
                          <p className="text-xs text-slate-500">{m.category}</p>
                        </div>
                        <span className="font-mono font-semibold tabular-nums text-slate-900">
                          ₹{m.priceInr}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowEnquiry((s) => !s)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900"
                >
                  <Send className="h-3.5 w-3.5" /> {t.sendEnquiry}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOwnerEdit((s) => !s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" /> {t.ownerUpdateBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReport((s) => !s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Flag className="h-3.5 w-3.5" /> {t.reportListing}
                </button>
              </div>
            </div>
          )}

          {target.type === 'package' && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Starting Point & Timing</span>
                  <p className="mt-0.5 text-sm text-slate-900">{target.item.plannedArrivalDeparture}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Package Price</span>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                    {target.item.pricePerPersonInr
                      ? `₹${target.item.pricePerPersonInr} / person`
                      : 'Enquiry Required'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Transport & Vehicle</span>
                  <p className="mt-0.5 text-sm text-slate-900">{target.item.transportType}</p>
                  <p className="text-xs text-slate-500">{target.item.vehicleInfo}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Operator & Availability</span>
                  <p className="mt-0.5 text-sm text-slate-900">{target.item.operatorName}</p>
                  <p className="text-xs text-slate-600">{target.item.availabilityStatus}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">Planned Stops</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                  {target.item.itineraryStops.map((s) => (
                    <li key={s} className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-800" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-xs font-bold text-emerald-800">Inclusions</h4>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    {target.item.inclusions.map((i) => (
                      <li key={i}>• {i}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-800">Exclusions</h4>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    {target.item.exclusions.map((ex) => (
                      <li key={ex}>• {ex}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <strong>Cancellation Terms:</strong> {target.item.cancellationPolicy}
              </p>

              <button
                type="button"
                onClick={() => setShowEnquiry((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900"
              >
                <Send className="h-3.5 w-3.5" /> Request Operator Confirmation
              </button>
            </div>
          )}

          {/* Private Enquiry Drawer */}
          {showEnquiry && (
            <form onSubmit={handleEnquirySubmit} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <p className="text-xs font-semibold text-blue-950">
                Send Private Enquiry (Your contact is shared only with this provider)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  value={enqName}
                  onChange={(e) => setEnqName(e.target.value)}
                  placeholder="Your name"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  value={enqContact}
                  onChange={(e) => setEnqContact(e.target.value)}
                  placeholder="Email or preferred callback time"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <textarea
                required
                rows={2}
                value={enqMsg}
                onChange={(e) => setEnqMsg(e.target.value)}
                placeholder="Dates, group size, room/guide questions..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900"
              >
                Submit Enquiry
              </button>
              {enqStatus && <p className="text-xs font-medium text-blue-900">{enqStatus}</p>}
            </form>
          )}

          {/* Owner / Provider Live Update Form */}
          {showOwnerEdit && target.type === 'listing' && (
            <form onSubmit={handleOwnerUpdate} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-900">
                Property Owner / Authorized Provider Live Update
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Current Rates</label>
                  <input
                    type="text"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Opening / Check-in Hours</label>
                  <input
                    type="text"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Water Supply Timings</label>
                  <input
                    type="text"
                    value={editWater}
                    onChange={(e) => setEditWater(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Food / Meal Timings</label>
                  <input
                    type="text"
                    value={editFood}
                    onChange={(e) => setEditFood(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={editLuggage}
                  onChange={(e) => setEditLuggage(e.target.checked)}
                />
                Confirm luggage storage available for early arrivals
              </label>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Save Provider Update
              </button>
              {ownerMsg && <p className="text-xs font-medium text-emerald-700">{ownerMsg}</p>}
            </form>
          )}

          {/* Report Drawer */}
          {showReport && (
            <form onSubmit={handleReportSubmit} className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                <AlertTriangle className="h-4 w-4" /> Report Misleading or Outdated Information
              </p>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option>Outdated price or timings</option>
                <option>Closed permanently or temporarily</option>
                <option>Misleading verification / duplicate listing</option>
                <option>Inappropriate provider behavior</option>
              </select>
              <textarea
                rows={2}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Optional details..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Submit Report
              </button>
              {reportStatus && <p className="text-xs font-medium text-rose-900">{reportStatus}</p>}
            </form>
          )}

          {/* Reviews Section */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-base font-bold text-slate-900">Traveller Reviews & Trust</h3>
            <form onSubmit={handleReviewSubmit} className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-slate-700">Rating:</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className="p-0.5"
                      aria-label={`Rate ${n} stars`}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          n <= rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {!currentUser && (
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs"
                  />
                )}
              </div>
              <textarea
                required
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share real, helpful experience details..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {t.submitReview}
                </button>
                {reviewMsg && <span className="text-xs font-medium text-blue-800">{reviewMsg}</span>}
              </div>
            </form>

            <div className="mt-4 space-y-3">
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-500">No community reviews yet — be the first to contribute.</p>
              ) : (
                reviews.map((rev) => (
                  <div key={rev.id} className="border-b border-slate-100 pb-3 last:border-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        {rev.userName}{' '}
                        {rev.isVerifiedVisit && (
                          <span className="font-normal text-blue-800">· Verified Member</span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums text-amber-700">{rev.rating}/5 ★</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{rev.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
