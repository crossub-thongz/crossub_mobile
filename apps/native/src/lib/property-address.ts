import type { InspectionJob } from '@/src/lib/types';

export function propertyAddressLines(job: InspectionJob): {
  street: string;
  locality: string;
} {
  const full = job.propertyAddress.trim();
  const suburb = job.suburb?.trim();
  if (suburb && full.toLowerCase().includes(suburb.toLowerCase())) {
    const index = full.toLowerCase().indexOf(suburb.toLowerCase());
    return {
      street: full.slice(0, index).replace(/,\s*$/, '').trim() || full,
      locality: full.slice(index).trim(),
    };
  }
  const comma = full.lastIndexOf(',');
  if (comma > 0) {
    return {
      street: full.slice(0, comma).trim(),
      locality: full.slice(comma + 1).trim() || suburb || '',
    };
  }
  return { street: full, locality: suburb ?? '' };
}

export function formatJobRefId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function googleMapsUrl(
  job: InspectionJob,
  origin?: { latitude: number; longitude: number } | null,
): string {
  const destination =
    job.latitude != null && job.longitude != null
      ? `${job.latitude},${job.longitude}`
      : encodeURIComponent(job.propertyAddress);
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}
