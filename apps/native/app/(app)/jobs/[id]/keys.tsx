import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useInspections } from '@/src/inspections/inspections-context';
import { compressPhotoForUpload } from '@/src/jobs/compress-photo';
import { JobCamera } from '@/src/jobs/job-camera';
import { JobWorkspaceNav } from '@/src/jobs/workspace-nav';
import {
  formatHandoverNotes,
  type HandoverParty,
  type KeyCondition,
} from '@/src/lib/handover-notes';
import { isInspectionWorkflowFinished, isKeyCollectComplete } from '@/src/lib/key-access';
import { queueKeyCustody, queueKeyCustodyPhoto } from '@/src/offline/sync';
import { useOffline } from '@/src/offline/offline-context';
import { jobAreas, jobInspect } from '@/src/lib/routes';
import { colors } from '@/src/theme';

const MAX_PHOTOS = 5;

export default function KeysScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { getJob, patchJob } = useInspections();
  const { refreshPending } = useOffline();
  const job = getJob(id);
  const phase: 'collect' | 'return' = tab === 'return' ? 'return' : 'collect';
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [party, setParty] = useState<HandoverParty | null>(null);
  const [condition, setCondition] = useState<KeyCondition>('good');
  const [keySets, setKeySets] = useState('1');
  const [contactName, setContactName] = useState(job?.tenantName ?? '');
  const [contactPhone, setContactPhone] = useState(job?.tenantPhone ?? '');
  const [contactEmail, setContactEmail] = useState(job?.tenantEmail ?? '');
  const [agencyName, setAgencyName] = useState(job?.agentCompany ?? '');
  const [notes, setNotes] = useState('');

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
    if (!party) {
      setError(
        phase === 'collect'
          ? 'Select who you are receiving the keys from.'
          : 'Select who you are handing the keys back to.',
      );
      return;
    }
    if (job.keyAccess?.photoRequired && photoCount < 1) {
      setError('At least one photo is required to record the handover.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const packed = formatHandoverNotes(
        {
          handoverParty: party,
          keyCondition: condition,
          keySets: Number(keySets) || 1,
          contactName,
          contactPhone,
          contactEmail,
          agencyName: party === 'agent' ? agencyName : undefined,
          notes,
        },
        phase,
      );
      const custody = await queueKeyCustody(id, phase, packed ? { notes: packed } : {});
      void refreshPending();
      if (job.keyAccess) {
        patchJob(id, {
          keyAccess: {
            ...job.keyAccess,
            collectComplete:
              custody === 'queued'
                ? phase === 'collect' || job.keyAccess.collectComplete
                : custody.collectComplete,
            returnComplete:
              custody === 'queued'
                ? phase === 'return' || job.keyAccess.returnComplete
                : custody.returnComplete,
          },
        });
      }
      if (custody === 'queued') {
        Alert.alert('Saved on this phone', 'Handover will upload when you are back online.');
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
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {phase === 'collect' ? 'Collecting keys' : 'Returning keys'}
        </Text>
        <Text style={styles.body}>
          {phase === 'collect'
            ? 'Select who you are receiving the keys from.'
            : 'Select who you are handing the keys back to.'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {returnLocked ? (
          <Text style={styles.error}>Finish the inspection before returning keys.</Text>
        ) : null}

        <View style={styles.row}>
          {(['tenant', 'agent'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setParty(value)}
              style={[styles.chip, party === value && styles.chipOn]}
            >
              <Text style={[styles.chipText, party === value && styles.chipTextOn]}>
                {value === 'tenant' ? 'Handover with tenant' : 'Handover with agent'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{party === 'agent' ? 'Agent details' : 'Tenant details'}</Text>
        <TextInput
          value={contactName}
          onChangeText={setContactName}
          placeholder="Contact name"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <TextInput
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Phone"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <TextInput
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {party === 'agent' ? (
          <TextInput
            value={agencyName}
            onChangeText={setAgencyName}
            placeholder="Agency"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        ) : null}

        <Text style={styles.label}>Number of key sets {phase === 'collect' ? 'received' : 'returned'}</Text>
        <TextInput
          value={keySets}
          onChangeText={setKeySets}
          keyboardType="number-pad"
          style={styles.input}
        />

        <Text style={styles.label}>Condition of keys</Text>
        <View style={styles.row}>
          {(['good', 'damaged'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setCondition(value)}
              style={[styles.chip, condition === value && styles.chipOn]}
            >
              <Text style={[styles.chipText, condition === value && styles.chipTextOn]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={(value) => setNotes(value.slice(0, 200))}
          placeholder="Add any notes about the handover..."
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.notes]}
        />

        <Text style={styles.label}>Handover photos {photoCount}/{MAX_PHOTOS}</Text>
        <Pressable
          onPress={() => setCameraOpen(true)}
          disabled={photoCount >= MAX_PHOTOS}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>
            {photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'} attached` : 'Take proof photos'}
          </Text>
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
            <Text style={styles.primaryText}>Handover Completed</Text>
          )}
        </Pressable>
      </ScrollView>
      <JobCamera
        visible={cameraOpen}
        mode="burst"
        maxPhotos={MAX_PHOTOS - photoCount}
        onClose={() => setCameraOpen(false)}
        onBurstComplete={(photos) => {
          void (async () => {
            try {
              for (const photo of photos.slice(0, MAX_PHOTOS - photoCount)) {
                const body = await compressPhotoForUpload(photo);
                await queueKeyCustodyPhoto(id, { ...body, phase });
                setPhotoCount((count) => count + 1);
              }
              void refreshPending();
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
  inner: { padding: 16, paddingBottom: 40, gap: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.destructive, fontSize: 13 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
  chipTextOn: { color: colors.primaryFg },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
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
