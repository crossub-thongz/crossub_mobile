import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  recordKeyCustody,
  uploadKeyCustodyPhoto,
} from '@/src/api/inspector';
import { useInspections } from '@/src/inspections/inspections-context';
import { compressPhotoForUpload } from '@/src/jobs/compress-photo';
import { JobCamera } from '@/src/jobs/job-camera';
import { JobWorkspaceNav } from '@/src/jobs/workspace-nav';
import { isInspectionWorkflowFinished, isKeyCollectComplete } from '@/src/lib/key-access';
import { jobAreas, jobInspect } from '@/src/lib/routes';
import { colors } from '@/src/theme';

export default function KeysScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { getJob, patchJob } = useInspections();
  const job = getJob(id);
  const phase: 'collect' | 'return' = tab === 'return' ? 'return' : 'collect';
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  if (!job || !id) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.body}>This job could not be found.</Text>
      </SafeAreaView>
    );
  }

  if (!job.keyAccess) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Handover', headerBackTitle: 'Back' }} />
        <JobWorkspaceNav job={job} active="handover" />
        <Text style={styles.body}>No key collection required for this job.</Text>
      </SafeAreaView>
    );
  }

  const collectDone = isKeyCollectComplete(job);
  const finished = isInspectionWorkflowFinished(job);
  const returnLocked = phase === 'return' && (!collectDone || !finished);

  const submit = async () => {
    if (phase === 'return' && returnLocked) {
      setError('Finish the inspection before returning keys.');
      return;
    }
    if (job.keyAccess?.photoRequired && !uploaded) {
      setError('Record the keys in hand — including the proof photo — before you start the inspection.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const custody = await recordKeyCustody(id, phase);
      if (job.keyAccess) {
        patchJob(id, {
          keyAccess: {
            ...job.keyAccess,
            collectComplete: custody.collectComplete,
            returnComplete: custody.returnComplete,
          },
        });
      }
      if (phase === 'collect') {
        router.replace(
          (job.type === 'open' ? jobInspect(id, job.type) : jobAreas(id, job.type)) as never,
        );
      } else {
        router.replace('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record handover.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Handover', headerBackTitle: 'Back' }} />
      <JobWorkspaceNav job={job} active="handover" />
      <View style={styles.inner}>
        <Text style={styles.title}>
          {phase === 'collect' ? 'Collect the keys first' : 'Return the keys'}
        </Text>
        <Text style={styles.body}>
          {phase === 'collect'
            ? 'Record the keys in hand — including the proof photo — before you start the inspection. Anything captured before that is not saved against the job.'
            : 'Hand the keys back — the job is only complete after that handover is recorded.'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {returnLocked ? (
          <Text style={styles.error}>Finish the inspection before returning keys.</Text>
        ) : null}
        <Pressable onPress={() => setCameraOpen(true)} style={styles.secondary}>
          <Text style={styles.secondaryText}>{uploaded ? 'Photo attached' : 'Take proof photo'}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void submit();
          }}
          disabled={busy || returnLocked}
          style={[styles.primary, (busy || returnLocked) && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryFg} />
          ) : (
            <Text style={styles.primaryText}>
              {phase === 'collect' ? 'Record handover' : 'Record key return'}
            </Text>
          )}
        </Pressable>
      </View>
      <JobCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(photo) => {
          void (async () => {
            try {
              const body = await compressPhotoForUpload(photo);
              await uploadKeyCustodyPhoto(id, { ...body, phase });
              setUploaded(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not upload proof photo.');
            }
          })();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20, padding: 16 },
  error: { color: colors.destructive, fontSize: 13 },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.primaryFg, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  disabled: { opacity: 0.55 },
});
