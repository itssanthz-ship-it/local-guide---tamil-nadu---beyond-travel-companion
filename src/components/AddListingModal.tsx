import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ALL_DISTRICTS } from '../data/seedData';
import { Language, ListingCategory, LocalListing } from '../types';

interface AddListingModalProps {
  isOpen: boolean;
  language: Language;
  authToken: string | null;
  onCreated: (listing: LocalListing) => void;
  onClose: () => void;
}

export default function AddListingModal({
  isOpen,
  language,
  authToken,
  onCreated,
  onClose,
}: AddListingModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ListingCategory>('rental_homestays');
  const [district, setDistrict] = useState('Madurai');
  const [cityOrTown, setCityOrTown] = useState('');
  const [address, setAddress] = useState('');
  const [priceRangeText, setPriceRangeText] = useState('');
  const [waterSupplyTimings, setWaterSupplyTimings] = useState('');
  const [foodAvailability, setFoodAvailability] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          name,
          category,
          district,
          cityOrTown: cityOrTown || district,
          address,
          priceRangeText,
          waterSupplyTimings,
          foodAvailability,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save listing.');
        return;
      }
      onCreated(data.listing);
      setName('');
      setAddress('');
      setDescription('');
      onClose();
    } catch {
      setError('Network error submitting listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-lg font-bold text-slate-900">
            {language === 'ta' ? 'புதிய உள்ளூர் சேவை / தங்குமிடம் சேர்க்க' : 'Submit Local Stay, Food or Service'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-600">
          Submitted entries are saved to SQLite and transparently labeled as Unverified Community Listings until verified.
        </p>

        {error && <p className="mt-3 text-xs font-semibold text-red-700">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cauvery Breeze Homestay or Anbu Tea Stall"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ListingCategory)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="hotels_restaurants">Hotels & Restaurants</option>
                <option value="lodges_hostels">Lodges & Hostels</option>
                <option value="rental_homestays">Rental Homes & Homestays</option>
                <option value="tea_cafes">Tea Shops & Cafés</option>
                <option value="theatres_entertainment">Theatres & Entertainment</option>
                <option value="hospitals_emergency">Hospitals & Emergency</option>
                <option value="local_brokers">Local Brokers</option>
                <option value="native_guides">Native Guides</option>
                <option value="transport_services">Transportation Services</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">District</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {ALL_DISTRICTS.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.state})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Town / Village</label>
              <input
                value={cityOrTown}
                onChange={(e) => setCityOrTown(e.target.value)}
                placeholder="Town or village name"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Rate / Price Range</label>
              <input
                value={priceRangeText}
                onChange={(e) => setPriceRangeText(e.target.value)}
                placeholder="e.g. ₹1,500 / night"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Full Address</label>
            <input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, landmark, PIN code"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Water Supply Timings</label>
              <input
                value={waterSupplyTimings}
                onChange={(e) => setWaterSupplyTimings(e.target.value)}
                placeholder="Optional (if confirmed)"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Meal / Food Timings</label>
              <input
                value={foodAvailability}
                onChange={(e) => setFoodAvailability(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Facilities, suitability for families/couples, languages spoken..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-800 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-900"
            >
              {submitting ? 'Saving...' : 'Submit Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
