import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapPin {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  kind: 'attraction' | 'stay' | 'service' | 'selected';
}

interface InteractiveMapProps {
  center: [number, number];
  zoom?: number;
  pins: MapPin[];
  onMapClick?: (lat: number, lng: number) => void;
  onPinSelect?: (id: string) => void;
  heightClass?: string;
}

export default function InteractiveMap({
  center,
  zoom = 8,
  pins,
  onMapClick,
  onPinSelect,
  heightClass = 'h-80 md:h-96',
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, zoom, { animate: true });
    }
  }, [center[0], center[1], zoom]);

  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    for (const pin of pins) {
      const color =
        pin.kind === 'selected'
          ? '#dc2626'
          : pin.kind === 'attraction'
            ? '#1e40af'
            : pin.kind === 'stay'
              ? '#b45309'
              : '#0f766e';

      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: pin.kind === 'selected' ? 9 : 7,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.92,
      });

      marker.bindPopup(
        `<div style="font-family: system-ui, sans-serif; min-width: 160px;">
          <strong style="font-size: 13px; color: #0f172a;">${pin.title}</strong><br/>
          <span style="font-size: 11px; color: #475569;">${pin.subtitle}</span>
        </div>`
      );

      if (onPinSelect) {
        marker.on('click', () => onPinSelect(pin.id));
      }

      marker.addTo(group);
    }
  }, [pins, onPinSelect]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div ref={containerRef} className={`w-full ${heightClass}`} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-800" /> Attractions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-700" /> Stays & Food
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-700" /> Services & Guides
          </span>
        </div>
        <span className="font-mono tabular-nums text-slate-500">
          {center[0].toFixed(4)}, {center[1].toFixed(4)}
        </span>
      </div>
    </div>
  );
}
