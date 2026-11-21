import { Alert, Linking } from 'react-native';

import { googleMapsUrl } from '@/src/lib/property-address';
import { mapsSearchUrl } from '@/src/lib/pool-location';
import type { InspectionJob } from '@/src/lib/types';
import type { GeoPoint } from '@/src/lib/travel';

type MapPoint = { latitude: number; longitude: number };

function coord(point: MapPoint) {
  return `${point.latitude},${point.longitude}`;
}

function destinationToken(
  job: InspectionJob,
): string {
  if (job.latitude != null && job.longitude != null) {
    return `${job.latitude},${job.longitude}`;
  }
  return encodeURIComponent(job.propertyAddress);
}

function appleDirectionsUrl(job: InspectionJob, origin?: MapPoint | null) {
  const destination = destinationToken(job);
  const start = origin ? `&saddr=${coord(origin)}` : '';
  return `http://maps.apple.com/?daddr=${destination}${start}&dirflg=d`;
}

function appleSearchUrl(point: GeoPoint | null) {
  if (!point) return 'http://maps.apple.com/';
  const label = encodeURIComponent(`${point.latitude},${point.longitude}`);
  return `http://maps.apple.com/?ll=${coord(point)}&q=${label}`;
}

function chooseMap(appleUrl: string, googleUrl: string) {
  Alert.alert('Open in Maps', 'Choose a maps app', [
    {
      text: 'Apple Maps',
      onPress: () => {
        void Linking.openURL(appleUrl);
      },
    },
    {
      text: 'Google Maps',
      onPress: () => {
        void Linking.openURL(googleUrl);
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export function promptJobDirections(
  job: InspectionJob,
  origin?: MapPoint | null,
) {
  chooseMap(appleDirectionsUrl(job, origin), googleMapsUrl(job, origin));
}

export function promptMapSearch(point: GeoPoint | null) {
  chooseMap(appleSearchUrl(point), mapsSearchUrl(point));
}
