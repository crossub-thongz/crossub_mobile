import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LocalPhoto } from '@/src/jobs/compress-photo';

type JobCameraProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: (photo: LocalPhoto) => void;
};

export function JobCamera({ visible, onClose, onCapture }: JobCameraProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snap = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!picture?.uri) {
        throw new Error('Camera did not return a photo.');
      }
      onCapture({
        uri: picture.uri,
        width: picture.width,
        height: picture.height,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not take photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
            <CameraView ref={cameraRef} style={styles.preview} facing="back" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable onPress={onClose} style={styles.secondary}>
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
                {busy ? <ActivityIndicator color="#111111" /> : <View style={styles.shutterInner} />}
              </Pressable>
              <View style={styles.spacer} />
            </View>
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
    bottom: 120,
    color: '#f07171',
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
});
