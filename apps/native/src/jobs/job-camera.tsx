import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  INSPECTION_BURST_MAX,
  deleteLocalPhoto,
  type LocalPhoto,
} from '@/src/jobs/compress-photo';
import { pickInspectionPhotos } from '@/src/jobs/pick-inspection-photos';
import {
  isDurableLocalPhoto,
  localPhotoExists,
  persistQueuedPhoto,
} from '@/src/offline/queued-photo';
import { applyPhotoUriRewrites, deleteQueueItemsByLocalUri } from '@/src/offline/db';
import { enqueuePhotoUpload, syncOfflineQueue } from '@/src/offline/sync';
import { isRemotePhotoUrl } from '@/src/lib/local-file';

type Lens = 0.5 | 1 | 2;

type JobCameraProps = {
  visible: boolean;
  onClose: () => void;
  onCapture?: (photo: LocalPhoto) => void;
  onBurstComplete?: (photos: LocalPhoto[]) => void;
  mode?: 'single' | 'burst';
  maxPhotos?: number;
  /** When set, each snapped JPEG is queued for upload immediately. */
  jobId?: string;
  uploadAreaName?: string;
};

function cameraIsBusy(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  return lower.includes('not ready yet') || lower.includes('cameranotready');
}

function cameraErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message.trim() : '';
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (
    lower.includes('could not reach') ||
    lower.includes('network') ||
    lower.includes('internet') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('offline') ||
    lower.includes('failed to fetch') ||
    lower.includes('not a function')
  ) {
    return fallback;
  }
  return raw.length > 140 ? fallback : raw;
}

function zoomForLens(lens: Lens): number {
  if (lens === 0.5) return 0;
  if (lens === 2) return 0.45;
  return 0.08;
}

export function JobCamera({
  visible,
  onClose,
  onCapture,
  onBurstComplete,
  mode = 'single',
  maxPhotos = INSPECTION_BURST_MAX,
  jobId,
  uploadAreaName,
}: JobCameraProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const shotsRef = useRef<LocalPhoto[]>([]);
  const pendingRef = useRef<Map<string, Promise<LocalPhoto>>>(new Map());
  const handedOffRef = useRef(false);
  const cancelledRef = useRef(false);
  const readyRef = useRef(false);
  const snappingRef = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>(1);
  const [shots, setShots] = useState<LocalPhoto[]>([]);
  const burst = mode === 'burst';
  const jobIdRef = useRef(jobId);
  const uploadAreaNameRef = useRef(uploadAreaName);
  jobIdRef.current = jobId;
  uploadAreaNameRef.current = uploadAreaName;
  const room = Math.max(0, maxPhotos - shots.length);
  const canAskAgain = permission?.canAskAgain !== false;
  const noRoom = burst && maxPhotos < 1;

  useEffect(() => {
    if (!visible) return;
    handedOffRef.current = false;
    cancelledRef.current = false;
    setError(null);
    setLens(1);
  }, [visible]);

  useEffect(() => {
    if (!visible || !permission?.granted || noRoom) return;
    readyRef.current = false;
    setReady(false);
    setStalled(false);
    const timer = setTimeout(() => {
      if (!readyRef.current) setStalled(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [visible, permission?.granted, noRoom]);

  const setShotList = (next: LocalPhoto[]) => {
    shotsRef.current = next;
    setShots(next);
  };

  const replaceShot = (fromUri: string, photo: LocalPhoto) => {
    setShotList(
      shotsRef.current.map((shot) => (shot.uri === fromUri ? photo : shot)),
    );
  };

  const persistAndQueue = async (captured: LocalPhoto): Promise<LocalPhoto> => {
    const alreadyUploaded = applyPhotoUriRewrites(captured.uri);
    if (isRemotePhotoUrl(alreadyUploaded)) {
      return { ...captured, uri: alreadyUploaded };
    }
    let photo = captured;
    try {
      const keepLocal =
        isDurableLocalPhoto(captured.uri) && (await localPhotoExists(captured.uri));
      photo = keepLocal
        ? captured
        : { ...captured, uri: await persistQueuedPhoto(captured.uri) };
    } catch (err) {
      const uploaded = applyPhotoUriRewrites(captured.uri);
      if (isRemotePhotoUrl(uploaded)) return { ...captured, uri: uploaded };
      if (await localPhotoExists(captured.uri)) return captured;
      throw err;
    }
    const inspectionId = jobIdRef.current;
    const areaName = uploadAreaNameRef.current;
    if (inspectionId) {
      try {
        const queued = await enqueuePhotoUpload(inspectionId, photo.uri, areaName);
        photo = { ...photo, uri: queued };
      } catch {
        // The JPEG is already on disk; upload continues when the queue drains.
      }
    }
    return photo;
  };

  const dropQueuedShot = async (uri: string) => {
    if (jobIdRef.current) await deleteQueueItemsByLocalUri(uri);
    await deleteLocalPhoto(uri);
  };

  const closeWithoutSaving = () => {
    cancelledRef.current = true;
    if (!handedOffRef.current) {
      void Promise.all(shotsRef.current.map((photo) => dropQueuedShot(photo.uri)));
    }
    handedOffRef.current = false;
    pendingRef.current.clear();
    setShotList([]);
    onClose();
  };

  const queueCompress = (captured: LocalPhoto) => {
    const job = persistAndQueue(captured)
      .then((photo) => {
        if (cancelledRef.current || handedOffRef.current) {
          if (cancelledRef.current) void dropQueuedShot(photo.uri);
          else if (photo.uri !== captured.uri) void deleteLocalPhoto(captured.uri);
          return photo;
        }
        if (photo.uri !== captured.uri) {
          replaceShot(captured.uri, photo);
          void deleteLocalPhoto(captured.uri);
        }
        return photo;
      })
      .finally(() => {
        pendingRef.current.delete(captured.uri);
      });
    pendingRef.current.set(captured.uri, job);
  };

  const finish = async (photos: LocalPhoto[]) => {
    if (photos.length === 0 || handedOffRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.allSettled([...pendingRef.current.values()]);
      const shots = [...shotsRef.current];
      const savedShots: Array<LocalPhoto | undefined> = new Array(shots.length);
      let cursor = 0;
      const workers = Math.min(4, shots.length);
      await Promise.all(
        Array.from({ length: workers }, async () => {
          while (cursor < shots.length) {
            const index = cursor;
            cursor += 1;
            const shot = shots[index];
            try {
              const photo = await persistAndQueue(shot);
              if (photo.uri !== shot.uri) await deleteLocalPhoto(shot.uri);
              savedShots[index] = photo;
            } catch {
              if (isRemotePhotoUrl(shot.uri) || (await localPhotoExists(shot.uri))) {
                savedShots[index] = shot;
              }
            }
          }
        }),
      );
      const compressed = savedShots.filter((photo): photo is LocalPhoto => Boolean(photo));
      if (compressed.length === 0) {
        setError('Could not save the photo on this device.');
        return;
      }
      handedOffRef.current = true;
      pendingRef.current.clear();
      setShotList([]);
      try {
        if (burst && onBurstComplete) onBurstComplete(compressed);
        else if (onCapture) onCapture(compressed[compressed.length - 1]);
      } catch {
        // Photos are already on disk and in the queue.
      }
      onClose();
      void syncOfflineQueue();
    } catch {
      setError('Could not save the photo on this device.');
    } finally {
      setBusy(false);
    }
  };

  const snap = async () => {
    if (snappingRef.current || !cameraRef.current || busy || !ready || room < 1) return;
    snappingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      let picture: { uri?: string; width?: number; height?: number } | undefined;
      let lastError: unknown;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          picture = await cameraRef.current.takePictureAsync({
            quality: 0.72,
            exif: false,
            skipProcessing: true,
          });
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
          if (!cameraIsBusy(err) || attempt === 3) throw err;
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
      if (lastError) throw lastError;
      if (!picture?.uri) throw new Error('Camera did not return a photo.');
      const captured: LocalPhoto = {
        uri: picture.uri,
        width: picture.width ?? 0,
        height: picture.height ?? 0,
      };
      if (!burst) {
        const photo = await persistAndQueue(captured);
        if (photo.uri !== captured.uri) await deleteLocalPhoto(captured.uri);
        handedOffRef.current = true;
        onCapture?.(photo);
        onClose();
        return;
      }
      setShotList([...shotsRef.current, captured]);
      queueCompress(captured);
    } catch (err) {
      if (cameraIsBusy(err)) {
        setError('The camera is still finishing the last photo. Tap the shutter again.');
      } else {
        setError(cameraErrorMessage(err, 'Could not take photo.'));
      }
    } finally {
      snappingRef.current = false;
      setBusy(false);
    }
  };

  const addFromLibrary = async () => {
    const remaining = Math.max(0, maxPhotos - shotsRef.current.length);
    if (remaining < 1) {
      setError('No photo slots left on this step.');
      return;
    }
    setError(null);
    try {
      const picked = await pickInspectionPhotos(remaining);
      if (picked.length === 0) return;
      if (!burst) {
        const photo = await persistAndQueue(picked[0]);
        handedOffRef.current = true;
        setShotList([]);
        onCapture?.(photo);
        onClose();
        return;
      }
      setShotList([...shotsRef.current, ...picked]);
      for (const photo of picked) queueCompress(photo);
    } catch (err) {
      setError(cameraErrorMessage(err, 'Could not open the photo library.'));
    }
  };

  const shutterDisabled = busy || !ready || room < 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={closeWithoutSaving}
    >
      <View style={styles.root}>
        {!permission ? (
          <View style={[styles.permission, { paddingTop: insets.top + 24 }]}>
            <ActivityIndicator color="#00d4a4" />
          </View>
        ) : noRoom ? (
          <View style={[styles.permission, { paddingTop: insets.top + 24 }]}>
            <Text style={styles.title}>Photo limit reached</Text>
            <Text style={styles.body}>
              This step already has the maximum number of photos. Remove one to take more.
            </Text>
            <Pressable onPress={closeWithoutSaving} style={styles.secondaryWide}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        ) : !permission.granted ? (
          <View style={[styles.permission, { paddingTop: insets.top + 24 }]}>
            <Text style={styles.title}>Camera access</Text>
            <Text style={styles.body}>
              CROSSUB Inspector needs the camera to photograph inspection evidence.
              You can also attach photos from the library.
            </Text>
            {canAskAgain ? (
              <Pressable
                onPress={() => {
                  void requestPermission();
                }}
                style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>Allow camera</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  void Linking.openSettings();
                }}
                style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>Open Settings</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                void addFromLibrary();
              }}
              style={styles.secondaryWide}
            >
              <Text style={styles.secondaryText}>Use library</Text>
            </Pressable>
            <Pressable onPress={closeWithoutSaving} style={styles.secondaryWide}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            {error ? <Text style={styles.permissionError}>{error}</Text> : null}
          </View>
        ) : visible ? (
          <>
            <CameraView
              ref={cameraRef}
              style={styles.preview}
              facing="back"
              zoom={zoomForLens(lens)}
              onCameraReady={() => {
                readyRef.current = true;
                setReady(true);
                setStalled(false);
              }}
            />
            {!ready ? (
              <View style={styles.readyMask} pointerEvents="none">
                <ActivityIndicator color="#00d4a4" />
                <Text style={styles.readyText}>Starting camera...</Text>
              </View>
            ) : null}
            <View style={[styles.topBar, { top: insets.top + 12 }]} pointerEvents="box-none">
              <Pressable
                onPress={() => {
                  void addFromLibrary();
                }}
                style={styles.libraryChip}
              >
                <Text style={styles.libraryChipText}>Use library</Text>
              </Pressable>
              <View style={styles.lensRow}>
                {([0.5, 1, 2] as const).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setLens(value)}
                    style={[styles.lens, lens === value && styles.lensOn]}
                  >
                    <Text style={[styles.lensText, lens === value && styles.lensTextOn]}>
                      {value}x
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.topSpacer} />
            </View>
            {burst && shots.length > 0 ? (
              <ScrollView
                horizontal
                style={styles.strip}
                contentContainerStyle={styles.stripInner}
              >
                {shots.map((shot) => (
                  <Image
                    key={shot.uri}
                    source={{ uri: shot.uri }}
                    style={styles.thumb}
                    contentFit="cover"
                    cachePolicy="memory"
                    recyclingKey={shot.uri}
                    transition={0}
                  />
                ))}
              </ScrollView>
            ) : null}
            <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable onPress={closeWithoutSaving} style={styles.secondary}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void snap();
                }}
                disabled={shutterDisabled}
                style={({ pressed }) => [
                  styles.shutter,
                  pressed && styles.pressed,
                  shutterDisabled && styles.disabled,
                ]}
              >
                {busy && ready ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <View style={styles.shutterInner} />
                )}
              </Pressable>
              {burst && shots.length > 0 ? (
                <Pressable
                  onPress={() => {
                    void finish(shotsRef.current);
                  }}
                  disabled={busy}
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                >
                  <Text style={styles.useText}>{`Use ${shots.length}`}</Text>
                </Pressable>
              ) : (
                <View style={styles.spacer} />
              )}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {stalled && !ready ? (
              <Pressable onPress={() => void addFromLibrary()} style={styles.fallback}>
                <Text style={styles.fallbackText}>
                  Preview not ready. Tap to use the photo library instead.
                </Text>
              </Pressable>
            ) : null}
            {burst ? (
              <Text style={styles.hint}>
                {shots.length > 0
                  ? `Tap Use ${shots.length} to attach these photos.`
                  : 'Snap photos with the shutter, then attach them.'}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  preview: { flex: 1 },
  readyMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  readyText: { color: '#f4f4f4', fontSize: 13, fontWeight: '600' },
  permission: { flex: 1, paddingHorizontal: 24, backgroundColor: '#111111' },
  title: { color: '#f4f4f4', fontSize: 28, fontWeight: '700' },
  body: { color: '#b8b8b8', fontSize: 16, marginTop: 10, lineHeight: 22 },
  primary: {
    marginTop: 24,
    alignSelf: 'flex-start',
    backgroundColor: '#00d4a4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryText: { color: '#111111', fontWeight: '700' },
  secondary: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryWide: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 12,
  },
  secondaryText: { color: '#f4f4f4', fontWeight: '600' },
  useText: { color: '#00d4a4', fontWeight: '700' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#111111',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f4f4f4',
  },
  spacer: { minWidth: 72 },
  error: {
    color: '#f07171',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    backgroundColor: '#111111',
  },
  permissionError: {
    color: '#f07171',
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
  },
  fallback: {
    backgroundColor: '#111111',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  fallbackText: {
    color: '#00d4a4',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  topBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libraryChip: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  libraryChipText: { color: '#f4f4f4', fontSize: 12, fontWeight: '600' },
  topSpacer: { minWidth: 88 },
  lensRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    padding: 4,
  },
  lens: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  lensOn: { backgroundColor: '#00d4a4' },
  lensText: { color: '#f4f4f4', fontWeight: '700', fontSize: 13 },
  lensTextOn: { color: '#111111' },
  strip: { maxHeight: 72, backgroundColor: '#111111' },
  stripInner: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#333333' },
  hint: {
    color: '#b8b8b8',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 8,
    backgroundColor: '#111111',
  },
});
