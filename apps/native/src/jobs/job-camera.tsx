import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LocalPhoto } from '@/src/jobs/compress-photo';

type Lens = 0.5 | 1 | 2;

type JobCameraProps = {
  visible: boolean;
  onClose: () => void;
  onCapture?: (photo: LocalPhoto) => void;
  onBurstComplete?: (photos: LocalPhoto[]) => void;
  mode?: 'single' | 'burst';
  maxPhotos?: number;
};

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
  maxPhotos = 20,
}: JobCameraProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>(1);
  const [shots, setShots] = useState<LocalPhoto[]>([]);
  const burst = mode === 'burst';

  const finish = (photos: LocalPhoto[]) => {
    if (photos.length === 0) {
      onClose();
      return;
    }
    if (burst && onBurstComplete) onBurstComplete(photos);
    else if (onCapture) onCapture(photos[photos.length - 1]);
    setShots([]);
    onClose();
  };

  const snap = async () => {
    if (!cameraRef.current || busy) return;
    if (burst && shots.length >= maxPhotos) {
      setError(`At most ${maxPhotos} photos.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!picture?.uri) throw new Error('Camera did not return a photo.');
      const photo: LocalPhoto = {
        uri: picture.uri,
        width: picture.width,
        height: picture.height,
      };
      if (!burst) {
        finish([photo]);
        return;
      }
      setShots((current) => [...current, photo]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not take photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        setShots([]);
        onClose();
      }}
    >
      <View style={styles.root}>
        {!permission ? (
          <View style={[styles.permission, { paddingTop: insets.top + 24 }]}>
            <ActivityIndicator color="#00d4a4" />
          </View>
        ) : !permission.granted ? (
          <View style={[styles.permission, { paddingTop: insets.top + 24 }]}>
            <Text style={styles.title}>Camera access</Text>
            <Text style={styles.body}>
              CROSSUB Inspector needs the camera to photograph inspection evidence.
            </Text>
            <Pressable
              onPress={() => {
                void requestPermission();
              }}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Allow camera</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.secondary}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        ) : visible ? (
          <>
            <CameraView
              ref={cameraRef}
              style={styles.preview}
              facing="back"
              zoom={zoomForLens(lens)}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={[styles.lenses, { top: insets.top + 12 }]}>
              {([0.5, 1, 2] as const).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setLens(value)}
                  style={[styles.lens, lens === value && styles.lensOn]}
                >
                  <Text style={[styles.lensText, lens === value && styles.lensTextOn]}>
                    {value}×
                  </Text>
                </Pressable>
              ))}
            </View>
            {burst && shots.length > 0 ? (
              <ScrollView
                horizontal
                style={styles.strip}
                contentContainerStyle={styles.stripInner}
              >
                {shots.map((shot) => (
                  <View key={shot.uri} style={styles.thumb} />
                ))}
              </ScrollView>
            ) : null}
            <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable
                onPress={() => {
                  setShots([]);
                  onClose();
                }}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void snap();
                }}
                disabled={busy}
                style={({ pressed }) => [
                  styles.shutter,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <View style={styles.shutterInner} />
                )}
              </Pressable>
              {burst ? (
                <Pressable
                  onPress={() => finish(shots)}
                  style={styles.secondary}
                  disabled={shots.length === 0}
                >
                  <Text style={styles.secondaryText}>
                    {shots.length === 0 ? 'Use photos' : `Use ${shots.length}`}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.spacer} />
              )}
            </View>
            {burst ? (
              <Text style={styles.hint}>
                Snap as many as you need. Use 0.5× / 1× / 2×, then Use photos.
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
  secondaryText: { color: '#f4f4f4', fontWeight: '600' },
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
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 140,
    color: '#f07171',
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  lenses: {
    position: 'absolute',
    alignSelf: 'center',
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
  strip: { maxHeight: 56, backgroundColor: '#111111' },
  stripInner: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#333333' },
  hint: {
    color: '#b8b8b8',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 8,
    backgroundColor: '#111111',
  },
});
