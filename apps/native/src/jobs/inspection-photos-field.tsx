import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/src/theme';

const INLINE_THUMB_LIMIT = 9;

function PhotoThumb({
  uri,
  onPress,
}: {
  uri: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.thumbBtn}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={uri}
        allowDownscaling
        transition={0}
      />
    </Pressable>
  );
}

export function InspectionPhotosField({
  label = 'Photos',
  photoUrls,
  uploading = false,
  disabled = false,
  emptyLabel = 'Add at least one photo for this area.',
  compact = false,
  onTakePhotos,
  onRemove,
}: {
  label?: string;
  photoUrls: string[];
  uploading?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  compact?: boolean;
  onTakePhotos: () => void;
  onRemove?: (index: number) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const previewUrl = previewIndex != null ? photoUrls[previewIndex] : null;
  const overflow = photoUrls.length > INLINE_THUMB_LIMIT;
  const visible = useMemo(
    () => (overflow ? photoUrls.slice(photoUrls.length - INLINE_THUMB_LIMIT) : photoUrls),
    [overflow, photoUrls],
  );
  const visibleOffset = overflow ? photoUrls.length - INLINE_THUMB_LIMIT : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        {photoUrls.length > 0 ? (
          <View style={styles.count}>
            <Text style={styles.countText}>{photoUrls.length}</Text>
          </View>
        ) : null}
      </View>

      {!disabled ? (
        <Pressable
          onPress={onTakePhotos}
          disabled={disabled}
          style={[styles.takeBtn, compact && styles.takeBtnCompact]}
        >
          {uploading ? (
            <ActivityIndicator color={colors.primaryFg} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={16} color={colors.primaryFg} />
              <Text style={styles.takeText}>Take photos</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {photoUrls.length === 0 ? (
        <Pressable
          onPress={disabled ? undefined : onTakePhotos}
          disabled={disabled}
          style={styles.empty}
        >
          <Ionicons name="add" size={16} color={colors.muted} />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.grid}>
            {visible.map((url, index) => {
              const actualIndex = visibleOffset + index;
              return (
                <View key={`${url.slice(-48)}-${actualIndex}`} style={styles.cell}>
                  <PhotoThumb uri={url} onPress={() => setPreviewIndex(actualIndex)} />
                  {!disabled && onRemove ? (
                    <Pressable
                      onPress={() => onRemove(actualIndex)}
                      style={styles.remove}
                      hitSlop={8}
                      accessibilityLabel="Remove photo"
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {!disabled ? (
              <Pressable onPress={onTakePhotos} style={styles.addCell} accessibilityLabel="Add photo">
                <Ionicons name="camera-outline" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          {overflow ? (
            <Pressable onPress={() => setShowAll(true)} style={styles.viewAll}>
              <Text style={styles.viewAllText}>View all {photoUrls.length} photos</Text>
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
            windowSize={5}
            removeClippedSubviews
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
              cachePolicy="disk"
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
  uploading = false,
  disabled = false,
  onTakePhotos,
  onRemove,
}: {
  title: string;
  photoUrls: string[];
  uploading?: boolean;
  disabled?: boolean;
  onTakePhotos: () => void;
  onRemove?: (index: number) => void;
}) {
  const primaryUrl = photoUrls[0];
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
            cachePolicy="disk"
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
        <Pressable onPress={onTakePhotos} style={styles.columnSnap}>
          {uploading ? (
            <ActivityIndicator color={colors.primaryFg} size="small" />
          ) : (
            <Text style={styles.columnSnapText}>Snap</Text>
          )}
        </Pressable>
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
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', position: 'relative' },
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
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
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
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  columnSnapText: { color: colors.primaryFg, fontWeight: '700', fontSize: 12 },
  columnMore: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
