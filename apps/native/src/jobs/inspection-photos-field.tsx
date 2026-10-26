import Ionicons from '@expo/vector-icons/Ionicons';
import { LocalPhotoView } from '@/src/ui/local-photo-view';
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { LocalPhoto } from '@/src/jobs/compress-photo';
import { pickInspectionPhotos } from '@/src/jobs/pick-inspection-photos';
import { apiErrorMessage } from '@/src/api/client';
import { colors } from '@/src/theme';

const CELL_GAP = 8;

function uploadAlertMessage(err: unknown): string {
  const message = apiErrorMessage(err, 'Could not add those photos. Try again.');
  if (
    message.toLowerCase().includes('not a function') ||
    message.toLowerCase().includes('could not open the photo library')
  ) {
    return 'Could not add those photos. Try again.';
  }
  return message;
}

export type LibrarySave = { label: string; completed: number; total: number };

type LibrarySaveReporter = (next: LibrarySave | null, token: number) => void;

function reportLibrarySaveNowhere(_next: LibrarySave | null, _token: number) {}

const LibrarySaveContext = createContext<LibrarySaveReporter>(reportLibrarySaveNowhere);

let librarySaveSerial = 0;

export function LibrarySaveProvider({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange: (next: LibrarySave | null) => void;
}) {
  const activeToken = useRef(0);
  const report = useCallback<LibrarySaveReporter>(
    (next, token) => {
      if (next) {
        if (token < activeToken.current) return;
        activeToken.current = token;
        onChange(next);
        return;
      }
      if (token !== activeToken.current) return;
      onChange(null);
    },
    [onChange],
  );
  return <LibrarySaveContext.Provider value={report}>{children}</LibrarySaveContext.Provider>;
}

export function LibrarySaveBanner({ save }: { save: LibrarySave | null }) {
  if (!save || save.total <= 0 || save.completed >= save.total) return null;
  const ratio = Math.min(1, save.completed / save.total);
  return (
    <View style={styles.progressWrap}>
      <Text style={styles.progressText}>
        {`Saving ${save.label} ${save.completed} of ${save.total}`}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

function UploadProgress({ completed, total }: { completed: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, completed / total) : 0;
  return (
    <View style={styles.progressWrap}>
      <Text style={styles.progressText}>{`Saving ${completed} of ${total}`}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

function PhotoThumb({
  uri,
  onPress,
}: {
  uri: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.thumbBtn}>
      <LocalPhotoView uri={uri} style={StyleSheet.absoluteFill} />
    </Pressable>
  );
}

function PhotoSetSheet({
  visible,
  title,
  photoUrls,
  disabled,
  onClose,
  onOpen,
  onRemove,
}: {
  visible: boolean;
  title: string;
  photoUrls: string[];
  disabled?: boolean;
  onClose: () => void;
  onOpen: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.allRoot}>
        <View style={styles.allHead}>
          <Text style={styles.allTitle}>{title}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close photos">
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
          removeClippedSubviews={false}
          renderItem={({ item, index }) => (
            <View style={styles.allCell}>
              <PhotoThumb
                uri={item}
                onPress={() => {
                  onClose();
                  onOpen(index);
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
  );
}

export function InspectionPhotosField({
  label = 'Photos',
  saveLabel,
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
  saveLabel?: string;
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
  const [pickProgress, setPickProgress] = useState<{ completed: number; total: number } | null>(null);
  const previewUrl = previewIndex != null ? photoUrls[previewIndex] : null;
  const coverUrl = photoUrls[photoUrls.length - 1];
  const atLimit = maxPhotos != null && photoUrls.length >= maxPhotos;

  const reportLibrarySave = useContext(LibrarySaveContext);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const uploadFromLibrary = async () => {
    if (disabled || !onAddPhotos || picking) return;
    const addPhotos = onAddPhotos;
    const progressLabel = saveLabel || label;
    const token = ++librarySaveSerial;
    const reportsHere = reportLibrarySave === reportLibrarySaveNowhere;
    setPicking(true);
    setPickProgress(null);
    try {
      await pickInspectionPhotos(
        maxPhotos != null ? Math.max(1, maxPhotos - photoUrls.length) : undefined,
        (completed, total) => {
          reportLibrarySave({ label: progressLabel, completed, total }, token);
          if (!mountedRef.current) return;
          setPicking(false);
          if (reportsHere) setPickProgress({ completed, total });
        },
        (photo) => addPhotos([photo]),
      );
    } catch (err) {
      Alert.alert('Upload photos', uploadAlertMessage(err));
    } finally {
      reportLibrarySave(null, token);
      if (mountedRef.current) {
        setPicking(false);
        setPickProgress(null);
      }
    }
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
      {pickProgress ? (
        <UploadProgress completed={pickProgress.completed} total={pickProgress.total} />
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
      ) : coverUrl ? (
        <Pressable
          onPress={() => setShowAll(true)}
          style={styles.roll}
          collapsable={false}
          accessibilityLabel={`View ${photoUrls.length} photos`}
        >
          <LocalPhotoView uri={coverUrl} style={styles.rollImage} />
          <View style={styles.rollCount} pointerEvents="none">
            <Text style={styles.rollCountText}>{photoUrls.length}</Text>
          </View>
        </Pressable>
      ) : null}

      <PhotoSetSheet
        visible={showAll}
        title={`${photoUrls.length} photo${photoUrls.length === 1 ? '' : 's'}`}
        photoUrls={photoUrls}
        disabled={disabled}
        onClose={() => setShowAll(false)}
        onOpen={setPreviewIndex}
        onRemove={onRemove}
      />

      <Modal visible={previewUrl != null} transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
        <Pressable style={styles.preview} onPress={() => setPreviewIndex(null)}>
          <Pressable onPress={() => setPreviewIndex(null)} style={styles.previewClose} accessibilityLabel="Close preview">
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          {previewUrl ? (
            <LocalPhotoView uri={previewUrl} style={styles.previewImage} contentFit="contain" />
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
  onTakePhotos?: () => void;
  onAddPhotos?: (photos: LocalPhoto[]) => void;
  onRemove?: (index: number) => void;
}) {
  const primaryUrl = photoUrls[0];
  const [picking, setPicking] = useState(false);
  const [pickProgress, setPickProgress] = useState<{ completed: number; total: number } | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const pickingBusy = picking;
  const canCapture = !disabled && Boolean(onTakePhotos);
  const previewUrl = previewIndex != null ? photoUrls[previewIndex] : null;

  const reportLibrarySave = useContext(LibrarySaveContext);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const uploadFromLibrary = async () => {
    if (!canCapture || !onAddPhotos || picking) return;
    const addPhotos = onAddPhotos;
    const token = ++librarySaveSerial;
    const reportsHere = reportLibrarySave === reportLibrarySaveNowhere;
    setPicking(true);
    setPickProgress(null);
    try {
      await pickInspectionPhotos(
        undefined,
        (completed, total) => {
          reportLibrarySave({ label: title, completed, total }, token);
          if (!mountedRef.current) return;
          setPicking(false);
          if (reportsHere) setPickProgress({ completed, total });
        },
        (photo) => addPhotos([photo]),
      );
    } catch (err) {
      Alert.alert('Upload photos', uploadAlertMessage(err));
    } finally {
      reportLibrarySave(null, token);
      if (mountedRef.current) {
        setPicking(false);
        setPickProgress(null);
      }
    }
  };

  const openPreview = (index: number) => {
    if (!photoUrls[index]) return;
    setPreviewIndex(index);
  };

  const stepPreview = (delta: number) => {
    if (previewIndex == null || photoUrls.length === 0) return;
    const next = (previewIndex + delta + photoUrls.length) % photoUrls.length;
    setPreviewIndex(next);
  };

  return (
    <View style={styles.column}>
      <Pressable
        onPress={
          primaryUrl ? () => setShowAll(true) : canCapture ? onTakePhotos : undefined
        }
        disabled={!primaryUrl && !canCapture}
        style={styles.square}
        accessibilityLabel={
          primaryUrl ? `View ${title} photos, ${photoUrls.length} total` : title
        }
      >
        {primaryUrl ? (
          <LocalPhotoView uri={primaryUrl} style={styles.squareImage} />
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
        {photoUrls.length > 1 ? (
          <View style={styles.squareCount} pointerEvents="none">
            <Text style={styles.squareCountText}>{photoUrls.length}</Text>
          </View>
        ) : null}
      </Pressable>
      <Text style={styles.columnTitle}>{title}</Text>
      {canCapture ? (
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
      {pickProgress ? (
        <UploadProgress completed={pickProgress.completed} total={pickProgress.total} />
      ) : null}
      <PhotoSetSheet
        visible={showAll}
        title={`${photoUrls.length} ${title} photo${photoUrls.length === 1 ? '' : 's'}`}
        photoUrls={photoUrls}
        disabled={disabled}
        onClose={() => setShowAll(false)}
        onOpen={openPreview}
        onRemove={onRemove}
      />

      <Modal
        visible={previewUrl != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
      >
        <View style={styles.preview}>
          <Pressable
            onPress={() => setPreviewIndex(null)}
            style={styles.previewClose}
            accessibilityLabel="Close preview"
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          {photoUrls.length > 1 ? (
            <Pressable
              onPress={() => stepPreview(-1)}
              style={styles.previewNavLeft}
              accessibilityLabel="Previous photo"
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </Pressable>
          ) : null}
          {previewUrl ? (
            <LocalPhotoView uri={previewUrl} style={styles.previewImage} contentFit="contain" />
          ) : null}
          {photoUrls.length > 1 ? (
            <Pressable
              onPress={() => stepPreview(1)}
              style={styles.previewNavRight}
              accessibilityLabel="Next photo"
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </Pressable>
          ) : null}
          {previewIndex != null ? (
            <Text style={styles.previewCount}>
              {previewIndex + 1} / {photoUrls.length}
            </Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  progressWrap: { gap: 4 },
  progressText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.secondary,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: colors.primary },
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
  roll: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: colors.secondary,
  },
  rollImage: { width: 88, height: 88, borderRadius: 10 },
  rollCount: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  rollCountText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  previewNavLeft: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewNavRight: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  previewCount: {
    position: 'absolute',
    bottom: 36,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
  squareCount: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(11,15,16,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
  columnMoreBtn: { alignSelf: 'center', paddingVertical: 2 },
  columnMore: { color: colors.primary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
