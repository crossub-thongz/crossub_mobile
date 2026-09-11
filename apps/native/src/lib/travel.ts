export const AVG_URBAN_SPEED_KMH = 35;

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type TravelEstimate = {
  distanceKm: number;
  travelMinutes: number;
};

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateTravelMinutes(distanceKm: number): number {
  if (!Number.isFinite(distanceKm)) return 0;
  return Math.max(5, Math.round((distanceKm / AVG_URBAN_SPEED_KMH) * 60));
}

export function computeTravelEstimate(
  origin: GeoPoint | null | undefined,
  destination: GeoPoint | null | undefined,
): TravelEstimate | null {
  if (
    !origin ||
    !destination ||
    !Number.isFinite(origin.latitude) ||
    !Number.isFinite(origin.longitude) ||
    !Number.isFinite(destination.latitude) ||
    !Number.isFinite(destination.longitude)
  ) {
    return null;
  }
  const distanceKm = haversineKm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );
  return {
    distanceKm,
    travelMinutes: estimateTravelMinutes(distanceKm),
  };
}

export function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export function jobDestination(job: {
  latitude?: number;
  longitude?: number;
}): GeoPoint | null {
  if (job.latitude == null || job.longitude == null) return null;
  return { latitude: job.latitude, longitude: job.longitude };
}
