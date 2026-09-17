import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
} from 'react-native';

import {
  mapTile,
  mapsSearchUrl,
  reverseGeocodeLabel,
  searchPlaces,
  type GeocodeHit,
  type PoolOrigin,
  type PoolRadiusKm,
  type PoolSort,
  POOL_RADIUS_OPTIONS,
  POOL_SORT_LABEL,
} from '@/src/lib/pool-location';
import type { GeoPoint } from '@/src/lib/travel';
import { colors } from '@/src/theme';

export {
  POOL_RADIUS_OPTIONS,
  POOL_SORT_LABEL,
  type PoolRadiusKm,
  type PoolSort,
} from '@/src/lib/pool-location';

export function PoolLocationBar({
  origin,
  gps,
  radiusKm,
  sort,
  onOriginChange,
  onRadiusChange,
  onSortChange,
}: {
  origin: PoolOrigin | null;
  gps: GeoPoint | null;
  radiusKm: PoolRadiusKm;
  sort: PoolSort;
  onOriginChange: (origin: PoolOrigin) => void;
  onRadiusChange: (radiusKm: PoolRadiusKm) => void;
  onSortChange: (sort: PoolSort) => void;
}) {
  const searchRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const tile = mapTile(origin ?? gps);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      setSearching(true);
      void searchPlaces(q)
        .then((next) => setHits(next))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!gps || origin?.source === 'custom') return;
    if (origin?.label && origin.label !== 'Current location') return;
    let cancelled = false;
    void reverseGeocodeLabel(gps).then((label) => {
      if (cancelled || !label) return;
      onOriginChange({
        latitude: gps.latitude,
        longitude: gps.longitude,
        label,
        source: 'gps',
      });
    });
    return () => {
      cancelled = true;
    };
    // Reverse-geocode when GPS first arrives, not on every origin label write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps?.latitude, gps?.longitude]);

  const applyGps = () => {
    if (!gps) return;
    onOriginChange({
      latitude: gps.latitude,
      longitude: gps.longitude,
      label: origin?.source === 'gps' ? origin.label : 'Current location',
      source: 'gps',
    });
    setQuery('');
    setHits([]);
  };

  const applyHit = (hit: GeocodeHit) => {
    onOriginChange({
      latitude: hit.latitude,
      longitude: hit.longitude,
      label: hit.label,
      source: 'custom',
    });
    setQuery('');
    setHits([]);
  };

  const openMaps = () => {
    void Linking.openURL(mapsSearchUrl(origin ?? gps));
  };

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <View style={styles.kickerRow}>
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.kicker}>Current location</Text>
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {origin?.label ?? (gps ? 'Current location' : 'Set a location')}
          </Text>
          <Text style={styles.hint}>
            {origin?.source === 'custom'
              ? 'Using the area you set'
              : 'Using your current location'}{' '}
            <Text style={styles.change} onPress={() => searchRef.current?.focus()}>
              Change
            </Text>
          </Text>
        </View>
        <Pressable onPress={openMaps} style={styles.map}>
          {tile.url ? (
            <Image
              source={{ uri: tile.url, headers: tile.headers }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}
          {origin || gps ? (
            <View
              style={[
                styles.marker,
                {
                  left: tile.markerLeft as DimensionValue,
                  top: tile.markerTop as DimensionValue,
                },
              ]}
            />
          ) : (
            <Ionicons name="map-outline" size={22} color={colors.muted} />
          )}
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>View on map</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.block}>
        {gps && origin?.source === 'custom' ? (
          <Pressable onPress={applyGps} style={styles.gpsBtn}>
            <Ionicons name="navigate-outline" size={14} color={colors.primary} />
            <Text style={styles.gpsText}>Use my current location</Text>
          </Pressable>
        ) : null}

        <Text style={styles.meta}>Show jobs within</Text>
        <View style={styles.chips}>
          {POOL_RADIUS_OPTIONS.map((km) => (
            <Pressable
              key={km}
              onPress={() => onRadiusChange(km)}
              style={[styles.chip, radiusKm === km && styles.chipOn]}
            >
              <Text style={[styles.chipText, radiusKm === km && styles.chipTextOn]}>{km} km</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => onRadiusChange(null)}
            style={[styles.chip, radiusKm == null && styles.chipOn]}
          >
            <Text style={[styles.chipText, radiusKm == null && styles.chipTextOn]}>Any</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search another area, suburb, postcode or address"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        {searching ? <Text style={styles.meta}>Searchingù</Text> : null}
        {hits.length > 0 ? (
          <View style={styles.hits}>
            {hits.map((hit) => (
              <Pressable
                key={`${hit.latitude},${hit.longitude},${hit.label}`}
                onPress={() => applyHit(hit)}
                style={styles.hit}
              >
                <Text style={styles.hitText}>{hit.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.sortRow}>
          <Text style={styles.meta}>Sort</Text>
          {(Object.keys(POOL_SORT_LABEL) as PoolSort[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => onSortChange(value)}
              style={[styles.chip, sort === value && styles.chipOn]}
            >
              <Text style={[styles.chipText, sort === value && styles.chipTextOn]}>
                {POOL_SORT_LABEL[value]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12 },
  copy: { flex: 1, minWidth: 0 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kicker: { color: colors.muted, fontSize: 11 },
  label: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 2 },
  hint: { color: colors.muted, fontSize: 11, marginTop: 4 },
  change: { color: colors.primary, fontWeight: '700' },
  map: {
    width: 116,
    height: 88,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(0,212,164,0.8)',
  },
  mapBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mapBadgeText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  block: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gpsText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(28,35,38,0.4)',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  chipTextOn: { color: colors.primaryFg },
  searchWrap: { position: 'relative', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  search: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(28,35,38,0.6)',
    borderRadius: 12,
    paddingLeft: 36,
    paddingRight: 12,
    color: colors.text,
    fontSize: 14,
  },
  hits: { gap: 4 },
  hit: {
    borderRadius: 8,
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hitText: { color: colors.text, fontSize: 13 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
});
