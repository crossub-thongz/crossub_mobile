import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useInspections } from '@/src/inspections/inspections-context';
import { compressPhotoForUpload } from '@/src/jobs/compress-photo';
import { JobCamera } from '@/src/jobs/job-camera';
import type { WorkspaceTab } from '@/src/jobs/workspace-nav';
import {
  formatHandoverNotes,
  type HandoverParty,
  type KeyCondition,
} from '@/src/lib/handover-notes';
import { isInspectionWorkflowFinished, isKeyCollectComplete } from '@/src/lib/key-access';
import type { InspectionJob } from '@/src/lib/types';
import { queueKeyCustody, queueKeyCustodyPhoto } from '@/src/offline/sync';
import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';

const MAX_PHOTOS = 5;
const NOTES_MAX = 200;
const TENANT = '#34d399';
const TENANT_BG = 'rgba(16,185,129,0.1)';
const AGENT = '#38bdf8';
const AGENT_BG = 'rgba(14,165,233,0.1)';
const TENANT_BTN = '#10b981';
const AGENT_BTN = '#0ea5e9';

const COPY = {
  collect: {
    selectWho: 'Select who you are receiving the keys from.',
    tenantHint: 'You have met the tenant and received the keys.',
    agentHint: 'You have received the keys from the agent.',
    keysHeading: (party: HandoverParty) => `Keys received from ${party}`,
    keySets: 'Number of key sets received',
  },
  return: {
    selectWho: 'Select who you are handing the keys back to.',
    tenantHint: 'You have returned the keys to the tenant.',
    agentHint: 'You have returned the keys to the agent.',
    keysHeading: (party: HandoverParty) => `Keys returned to ${party}`,
    keySets: 'Number of key sets returned',
  },
} as const;

function dash(value: string): string {
  return value.trim() || '-';
}

function PartyCard({
  party,
  selected,
  hint,
  onPress,
}: {
  party: HandoverParty;
  selected: boolean;
  hint: string;
  onPress: () => void;
}) {
  const accent = party === 'agent' ? AGENT : TENANT;
  const bg = party === 'agent' ? AGENT_BG : TENANT_BG;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.partyCard,
        selected ? { borderColor: accent, backgroundColor: bg } : null,
      ]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={16} color={accent} style={styles.partyCheck} />
      ) : null}
      <Ionicons
        name={party === 'agent' ? 'business-outline' : 'people-outline'}
        size={20}
        color={accent}
      />
      <Text style={styles.partyTitle}>
        {party === 'tenant' ? 'Handover with tenant' : 'Handover with agent'}
      </Text>
      <Text style={styles.partyHint}>{hint}</Text>
    </Pressable>
  );
}

function contactsFor(job: InspectionJob, party: HandoverParty) {
  if (party === 'agent') {
    return {
      contactName: job.agentName ?? '',
      contactPhone: job.agentPhone ?? '',
      contactEmail: job.agentEmail ?? '',
      agencyName: job.agentCompany ?? '',
    };
  }
  return {
    contactName: job.tenantName ?? '',
    contactPhone: job.tenantPhone ?? '',
    contactEmail: job.tenantEmail ?? '',
    agencyName: '',
  };
}

export function JobHandoverPanel({
  id,
  phase,
  onChangeTab,
  onFinished,
}: {
  id: string;
  phase: 'collect' | 'return';
  onChangeTab: (tab: WorkspaceTab) => void;
  onFinished?: () => void;
}) {
  const { getJob, patchJob } = useInspections();
  const { refreshPending } = useOffline();
  const job = getJob(id);
  const copy = COPY[phase];
  const defaultParty: HandoverParty = job?.type === 'open' ? 'agent' : 'tenant';
  const start = job ? contactsFor(job, defaultParty) : null;
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [party, setParty] = useState<HandoverParty>(defaultParty);
  const [condition, setCondition] = useState<KeyCondition>('good');
  const [keySets, setKeySets] = useState(1);
  const [contactName, setContactName] = useState(start?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(start?.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(start?.contactEmail ?? '');
  const [agencyName, setAgencyName] = useState(start?.agencyName ?? '');
  const [notes, setNotes] = useState('');

  if (!job) {
    return <Text style={styles.body}>This job could not be found.</Text>;
  }

  if (!job.keyAccess) {
    return <Text style={styles.body}>No key collection required for this job.</Text>;
  }

  const collectDone = isKeyCollectComplete(job);
  const finished = isInspectionWorkflowFinished(job);
  const returnLocked = phase === 'return' && (!collectDone || !finished);
  const accent = party === 'agent' ? AGENT : TENANT;
  const accentBtn = party === 'agent' ? AGENT_BTN : TENANT_BTN;
  const actionBg = party === 'agent' ? 'rgba(14,165,233,0.15)' : 'rgba(16,185,129,0.15)';

  const applyParty = (next: HandoverParty) => {
    setParty(next);
    const nextContacts = contactsFor(job, next);
    setContactName(nextContacts.contactName);
    setContactPhone(nextContacts.contactPhone);
    setContactEmail(nextContacts.contactEmail);
    setAgencyName(nextContacts.agencyName);
  };

  const submit = async () => {
    if (phase === 'return' && returnLocked) {
      setError('Finish the inspection before returning keys.');
      return;
    }
    if (photoCount < 1) {
      setError('Add at least one handover photo before completing this step.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const packed = formatHandoverNotes(
        {
          handoverParty: party,
          keyCondition: condition,
          keySets,
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
        onChangeTab(job.type === 'open' ? 'start' : 'areas');
      } else {
        onFinished?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record handover.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>{copy.selectWho}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {returnLocked ? (
          <Text style={styles.error}>Finish the inspection before returning keys.</Text>
        ) : null}

        <View style={styles.partyRow}>
          <PartyCard
            party="tenant"
            selected={party === 'tenant'}
            hint={copy.tenantHint}
            onPress={() => applyParty('tenant')}
          />
          <PartyCard
            party="agent"
            selected={party === 'agent'}
            hint={copy.agentHint}
            onPress={() => applyParty('agent')}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons
              name={party === 'agent' ? 'business-outline' : 'people-outline'}
              size={14}
              color={accent}
            />
            <Text style={styles.cardTitle}>
              {party === 'tenant' ? 'Tenant details' : 'Agent details'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>{party === 'tenant' ? 'Tenant name' : 'Agent name'}</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {dash(contactName)}
            </Text>
          </View>
          {party === 'agent' ? (
            <View style={styles.detailRow}>
              <Text style={styles.muted}>Agency</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {dash(agencyName)}
              </Text>
            </View>
          ) : null}
          <Text style={styles.muted}>Phone</Text>
          <View style={styles.contactLine}>
            <Text style={styles.contactValue} numberOfLines={1}>
              {dash(contactPhone)}
            </Text>
            {contactPhone.trim() ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${contactPhone.trim()}`)}
                style={[styles.contactBtn, { backgroundColor: actionBg }]}
              >
                <Ionicons name="call-outline" size={14} color={accent} />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.muted}>Email</Text>
          <View style={styles.contactLine}>
            <Text style={styles.contactValue} numberOfLines={1}>
              {dash(contactEmail)}
            </Text>
            {contactEmail.trim() ? (
              <Pressable
                onPress={() => void Linking.openURL(`mailto:${contactEmail.trim()}`)}
                style={[styles.contactBtn, { backgroundColor: actionBg }]}
              >
                <Ionicons name="mail-outline" size={14} color={accent} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{copy.keysHeading(party)}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>{copy.keySets}</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setKeySets((value) => Math.max(0, value - 1))}
                style={styles.stepBtn}
              >
                <Ionicons name="remove" size={14} color={colors.text} />
              </Pressable>
              <Text style={styles.stepValue}>{keySets}</Text>
              <Pressable
                onPress={() => setKeySets((value) => Math.min(20, value + 1))}
                style={[styles.stepBtnOn, { backgroundColor: accentBtn }]}
              >
                <Ionicons name="add" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>
          <Text style={styles.muted}>Condition of keys</Text>
          <View style={styles.conditionRow}>
            {(['good', 'damaged'] as const).map((value) => {
              const on = condition === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setCondition(value)}
                  style={[
                    styles.condition,
                    on ? { backgroundColor: accentBtn } : styles.conditionOff,
                  ]}
                >
                  <Text style={[styles.conditionText, on && styles.conditionTextOn]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
            placeholder="Add any notes about the handover..."
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, styles.notes]}
          />
          <Text style={styles.counter}>
            {notes.length}/{NOTES_MAX}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="camera-outline" size={14} color={colors.text} />
            <Text style={[styles.cardTitle, { flex: 1 }]}>Handover photos</Text>
            <Text style={styles.muted}>
              {photoCount}/{MAX_PHOTOS}
            </Text>
          </View>
          <Text style={styles.hint}>At least one photo is required to record the handover.</Text>
          <Pressable
            onPress={() => setCameraOpen(true)}
            disabled={photoCount >= MAX_PHOTOS}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>
              {photoCount > 0
                ? `${photoCount} photo${photoCount === 1 ? '' : 's'} attached`
                : 'Take proof photos'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            void submit();
          }}
          disabled={busy || returnLocked}
          style={[styles.primary, { backgroundColor: accentBtn }, (busy || returnLocked) && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.primaryText}>Handover Completed</Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
  kicker: { color: colors.muted, fontSize: 12 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: 11 },
  error: { color: colors.destructive, fontSize: 13 },
  partyRow: { flexDirection: 'row', gap: 8 },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    minHeight: 118,
  },
  partyCheck: { position: 'absolute', top: 8, right: 8 },
  partyTitle: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 8 },
  partyHint: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  detailValue: { color: colors.text, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  contactLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactValue: {
    flex: 1,
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  contactBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { width: 24, textAlign: 'center', color: colors.text, fontWeight: '700' },
  conditionRow: { flexDirection: 'row', gap: 8 },
  condition: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  conditionOff: { backgroundColor: colors.secondary },
  conditionText: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  conditionTextOn: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  counter: { color: colors.muted, fontSize: 10, textAlign: 'right' },
  primary: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
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
