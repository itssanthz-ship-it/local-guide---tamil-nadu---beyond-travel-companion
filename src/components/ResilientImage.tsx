import { useState } from 'react';
import { MapPin } from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export default function ResilientImage({
  src,
  alt,
  className = 'h-48 w-full object-cover',
  fallbackTitle,
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-blue-950 to-slate-900 p-4 text-center text-white ${className}`}
      >
        <MapPin className="h-6 w-6 text-amber-400" />
        {fallbackTitle && (
          <span className="mt-2 line-clamp-2 text-xs font-medium text-slate-200">{fallbackTitle}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
