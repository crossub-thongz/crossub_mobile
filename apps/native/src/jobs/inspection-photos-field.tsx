import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';

import type { LocalPhoto } from '@/src/jobs/compress-photo';
import { pickInspectionPhotos } from '@/src/jobs/pick-inspection-photos';
import { apiErrorMessage } from '@/src/api/client';
import { asFileUri, isRemotePhotoUrl, resolveLocalFileUri } from '@/src/lib/local-file';
import { colors } from '@/src/theme';

const CELL_GAP = 8;
const VISIBLE_ROWS = 4;
const ADD_ITEM = { type: 'add' as const };

type GridItem = { type: 'photo'; url: string; index: number } | { type: 'add' };

function photoCachePolicy(uri: string) {
  return isRemotePhotoUrl(uri) ? ('disk' as const) : ('memory' as const);
}

function PhotoThumb({
  uri,
  onPress,
}: {
  uri: string;
  onPress: () => void;
}) {
  const [src, setSrc] = useState(uri);

  useEffect(() => {
    let cancelled = false;
    setSrc(uri);
    if (!uri || isRemotePhotoUrl(uri)) return;
    void resolveLocalFileUri(uri).then((resolved) => {
      if (!cancelled && resolved) setSrc(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const display = isRemotePhotoUrl(src) ? src : asFileUri(src);
  return (
    <Pressable onPress={onPress} style={styles.thumbBtn}>
      <Image
        source={{ uri: display }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy={photoCachePolicy(display)}
        recyclingKey={display}
        allowDownscaling
        transition={0}
      />
    </Pressable>
  );
}

export function InspectionPhotosField({
  label = 'Photos',
  photoUrls,
  uploading: _uploading = false,
  disabled = false,
  emptyLabel = 'Add at least one photo for this area.',
  compact = false,
  maxPhotos,
  onTakePhotos,
  onAddPhotos,
  onRemove,
  onEmptyPress,
}: {
  label?: string;
  photoUrls: string[];
  uploading?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  compact?: boolean;
  maxPhotos?: number;
  onTakePhotos: () => void;
  onAddPhotos?: (photos: LocalPhoto[]) => void;
  onRemove?: (index: number) => void;
  onEmptyPress?: () => void;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [picking, setPicking] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const listRef = useRef<FlatList<GridItem>>(null);
  const previewUrl = previewIndex != null ? photoUrls[previewIndex] : null;
  const prevCountRef = useRef(photoUrls.length);
  const atLimit = maxPhotos != null && photoUrls.length >= maxPhotos;
  const canAdd = !disabled && !atLimit;
  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = photoUrls.map((url, index) => ({ type: 'photo', url, index }));
    if (canAdd) items.push(ADD_ITEM);
    return items;
  }, [photoUrls, canAdd]);
  const cellSize = gridWidth > 0 ? Math.floor((gridWidth - CELL_GAP * 2) / 3) : 0;
  const rows = Math.ceil(Math.max(gridItems.length, 1) / 3);
  const visibleRows = Math.min(rows, VISIBLE_ROWS);
  const gridHeight =
    cellSize > 0 ? visibleRows * cellSize + Math.max(0, visibleRows - 1) * CELL_GAP : 0;
  const scrollable = rows > VISIBLE_ROWS;

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = photoUrls.length;
    if (photoUrls.length > prev && scrollable) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [photoUrls.length, scrollable]);

  const uploadFromLibrary = async () => {
    if (disabled || !onAddPhotos || picking) return;
    setPicking(true);
    try {
      const photos = await pickInspectionPhotos();
      if (photos.length > 0) onAddPhotos(photos);
    } catch (err) {
      Alert.alert('Upload photos', apiErrorMessage(err, 'Could not open the photo library.'));
    } finally {
      setPicking(false);
    }
  };

  const renderGridItem: ListRenderItem<GridItem> = ({ item }) => {
    if (item.type === 'add') {
      return (
        <Pressable
          onPress={onTakePhotos}
          style={[styles.addCell, { width: cellSize, height: cellSize }]}
          accessibilityLabel="Add photo"
        >
          <View style={styles.addCellInner} pointerEvents="none">
            <Ionicons name="camera-outline" size={22} color={colors.muted} />
          </View>
        </Pressable>
      );
    }
    return (
      <View style={[styles.cell, { width: cellSize, height: cellSize }]}>
        <PhotoThumb uri={item.url} onPress={() => setPreviewIndex(item.index)} />
        {!disabled && onRemove ? (
          <Pressable
            onPress={() => onRemove(item.index)}
            style={styles.remove}
            hitSlop={8}
            accessibilityLabel="Remove photo"
          >
            <Ionicons name="close" size={12} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        {maxPhotos != null || photoUrls.length > 0 ? (
          <View style={styles.count}>
            <Text style={styles.countText}>
              {maxPhotos != null ? `${photoUrls.length}/${maxPhotos}` : photoUrls.length}
            </Text>
          </View>
        ) : null}
      </View>

      {!disabled && !atLimit ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onTakePhotos}
            disabled={picking}
            style={[styles.takeBtn, compact && styles.takeBtnCompact, picking && styles.actionDisabled]}
          >
            <Ionicons name="camera-outline" size={16} color={colors.primaryFg} />
            <Text style={styles.takeText}>Take photos</Text>
          </Pressable>
          {onAddPhotos ? (
            <Pressable
              onPress={() => {
                void uploadFromLibrary();
              }}
              disabled={picking}
              style={[styles.uploadBtn, compact && styles.takeBtnCompact, picking && styles.actionDisabled]}
            >
              {picking ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="images-outline" size={16} color={colors.text} />
                  <Text style={styles.uploadText}>Upload</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {photoUrls.length === 0 ? (
        <Pressable
          onPress={disabled ? onEmptyPress : onTakePhotos}
          disabled={disabled ? !onEmptyPress : false}
          style={styles.empty}
        >
          <Ionicons name="add" size={16} color={colors.muted} />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </Pressable>
      ) : (
        <>
          <View
            onLayout={(event) => {
              const next = event.nativeEvent.layout.width;
              if (next > 0 && next !== gridWidth) setGridWidth(next);
            }}
          >
            {cellSize > 0 ? (
              <FlatList
                ref={listRef}
                data={gridItems}
                numColumns={3}
                extraData={`${cellSize}:${disabled}:${photoUrls.join('\n')}`}
                keyExtractor={(item) =>
                  item.type === 'add' ? 'add' : `${item.index}:${item.url.slice(-32)}`
                }
                renderItem={renderGridItem}
                scrollEnabled={scrollable}
                nestedScrollEnabled={scrollable}
                style={{ height: gridHeight }}
                columnWrapperStyle={styles.inlineRow}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={8}
                removeClippedSubviews={false}
              />
            ) : (
              <View style={{ height: 96 }} />
            )}
          </View>
          {scrollable ? (
            <Pressable onPress={() => setShowAll(true)} style={styles.viewAll}>
              <Text style={styles.viewAllText}>Expand {photoUrls.length} photos</Text>
            </Pressable>
          ) : null}
        </>
      )}

      <Modal
        visible={showAll}
        animationType="slide"
        onRequestClose={() => setShowAll(false)}
      >
        <View style={styles.allRoot}>
          <View style={styles.allHead}>
            <Text style={styles.allTitle}>{photoUrls.length} photos</Text>
            <Pressable onPress={() => setShowAll(false)} accessibilityLabel="Close photo list">
              <Text style={styles.allClose}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={photoUrls}
            numColumns={3}
            keyExtractor={(url, index) => `${index}:${url.slice(-32)}`}
            contentContainerStyle={styles.allList}
            columnWrapperStyle={styles.allRow}
            initialNumToRender={12}
            maxToRenderPerBatch={9}
            windowSize={8}
            removeClippedSubviews={false}
            renderItem={({ item, index }) => (
              <View style={styles.allCell}>
                <PhotoThumb
                  uri={item}
                  onPress={() => {
                    setShowAll(false);
                    setPreviewIndex(index);
                  }}
                />
                {!disabled && onRemove ? (
                  <Pressable
                    onPress={() => onRemove(index)}
                    style={styles.remove}
                    hitSlop={8}
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            )}
          />
        </View>
      </Modal>

      <Modal visible={previewUrl != null} transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
        <Pressable style={styles.preview} onPress={() => setPreviewIndex(null)}>
          <Pressable onPress={() => setPreviewIndex(null)} style={styles.previewClose} accessibilityLabel="Close preview">
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          {previewUrl ? (
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              contentFit="contain"
              cachePolicy={photoCachePolicy(previewUrl)}
              recyclingKey={previewUrl}
              transition={0}
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

export function BeforeAfterPhotoColumn({
  title,
  photoUrls,
  uploading: _uploading = false,
  disabled = false,
  onTakePhotos,
  onAddPhotos,
  onRemove,
}: {
  title: string;
  photoUrls: string[];
  uploading?: boolean;
  disabled?: boolean;
  onTakePhotos: () => void;
  onAddPhotos?: (photos: LocalPhoto[]) => void;
  onRemove?: (index: number) => void;
}) {
  const primaryUrl = photoUrls[0];
  const [picking, setPicking] = useState(false);
  const pickingBusy = picking;

  const uploadFromLibrary = async () => {
    if (disabled || !onAddPhotos || picking) return;
    setPicking(true);
    try {
      const photos = await pickInspectionPhotos();
      if (photos.length > 0) onAddPhotos(photos);
    } catch (err) {
      Alert.alert('Upload photos', apiErrorMessage(err, 'Could not open the photo library.'));
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={styles.column}>
      <Pressable
        onPress={primaryUrl ? onTakePhotos : disabled ? undefined : onTakePhotos}
        disabled={disabled && !primaryUrl}
        style={styles.square}
      >
        {primaryUrl ? (
          <Image
            source={{ uri: primaryUrl }}
            style={styles.squareImage}
            contentFit="cover"
            cachePolicy={photoCachePolicy(primaryUrl)}
            recyclingKey={primaryUrl}
            allowDownscaling
            transition={0}
          />
        ) : (
          <Text style={styles.squareLabel}>{title}</Text>
        )}
        {primaryUrl && !disabled && onRemove ? (
          <Pressable
            onPress={() => onRemove(0)}
            style={styles.squareRemove}
            accessibilityLabel="Remove photo"
          >
            <Ionicons name="close" size={12} color={colors.text} />
          </Pressable>
        ) : null}
      </Pressable>
      <Text style={styles.columnTitle}>{title}</Text>
      {!disabled ? (
        <View style={styles.columnActions}>
          <Pressable onPress={onTakePhotos} style={styles.columnSnap} disabled={pickingBusy}>
            <Text style={styles.columnSnapText}>Snap</Text>
          </Pressable>
          {onAddPhotos ? (
            <Pressable
              onPress={() => {
                void uploadFromLibrary();
              }}
              style={styles.columnUpload}
              disabled={pickingBusy}
            >
              {picking ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.columnUploadText}>Upload</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {photoUrls.length > 1 ? (
        <Text style={styles.columnMore}>+{photoUrls.length - 1} more</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  count: {
    backgroundColor: 'rgba(0,212,164,0.2)',
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  takeBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  uploadText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  actionDisabled: { opacity: 0.55 },
  takeBtnCompact: { height: 36 },
  takeText: { color: colors.primaryFg, fontWeight: '700', fontSize: 13 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  emptyText: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  inlineRow: { gap: CELL_GAP, marginBottom: CELL_GAP, justifyContent: 'flex-start' },
  cell: { borderRadius: 8, overflow: 'hidden', position: 'relative' },
  thumbBtn: { flex: 1, width: '100%', height: '100%', backgroundColor: colors.secondary },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCell: {
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    overflow: 'hidden',
  },
  addCellInner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAll: { alignSelf: 'flex-start', paddingVertical: 4 },
  viewAllText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  allRoot: { flex: 1, backgroundColor: colors.background, paddingTop: 52 },
  allHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  allTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  allClose: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  allList: { paddingHorizontal: 16, paddingBottom: 32 },
  allRow: { gap: 8, marginBottom: 8, justifyContent: 'flex-start' },
  allCell: { width: '31%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  preview: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewImage: { width: '100%', height: '85%' },
  column: { flex: 1, gap: 6 },
  square: {
    aspectRatio: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  squareImage: { width: '100%', height: '100%' },
  squareLabel: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 8 },
  squareRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(11,15,16,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTitle: { color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  columnSnap: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  columnSnapText: { color: colors.primaryFg, fontWeight: '700', fontSize: 12 },
  columnActions: { flexDirection: 'row', gap: 6 },
  columnUpload: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  columnUploadText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  columnMore: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
