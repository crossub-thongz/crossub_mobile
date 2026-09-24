import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';

import { apiErrorMessage } from '@/src/api/client';
import { useAccount } from '@/src/account/account-context';
import { useAuth } from '@/src/auth/auth-context';
import { useInspections } from '@/src/inspections/inspections-context';
import {
  deleteLocalPhoto,
  preparePhotoUpload,
  prepareStoredPhotoUpload,
  type LocalPhoto,
} from '@/src/jobs/compress-photo';
import { InspectionPhotosField } from '@/src/jobs/inspection-photos-field';
import { JobCamera } from '@/src/jobs/job-camera';
import { JobLookupFallback } from '@/src/jobs/job-lookup-fallback';
import { JobPropertyHeader } from '@/src/jobs/job-property-header';
import { LeasingKeyCollectionPanel } from '@/src/jobs/leasing-key-collection-panel';
import { NoImageDialog } from '@/src/jobs/no-image-dialog';
import type { WorkspaceTab } from '@/src/jobs/workspace-nav';
import { displayName, formatDateTime } from '@/src/lib/datetime';
import {
  formatHandoverNotes,
  type HandoverParty,
  type KeyCondition,
  type KeyPhaseRecord,
} from '@/src/lib/handover-notes';
import {
  canAccessKeyReturnTab,
  getKeyWorkflow,
  isKeyCollectComplete,
  isKeyReturnComplete,
  withKeyPhase,
} from '@/src/lib/key-access';
import { jobLookupMiss } from '@/src/lib/job-lookup';
import type { InspectionJob } from '@/src/lib/types';
import {
  deleteHandoverDraft,
  loadHandoverDraft,
  loadOfflineQueue,
  saveHandoverDraft,
  subscribeDraftsChanged,
  type HandoverFormDraft,
} from '@/src/offline/db';
import {
  deleteQueuedPhoto,
  isRemotePhotoUrl,
  localPhotoExists,
  persistQueuedPhoto,
  resolveLocalFileUri,
} from '@/src/offline/queued-photo';
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

function CompletedHandoverCard({
  phaseLabel,
  record,
  continueLabel,
  onContinue,
  onEmptyPhotos,
}: {
  phaseLabel: string;
  record: KeyPhaseRecord | undefined;
  continueLabel: string;
  onContinue: () => void;
  onEmptyPhotos: () => void;
}) {
  const when = record?.completedAt ? formatDateTime(record.completedAt) : null;
  const partyLine = record?.handoverParty
    ? `With ${record.handoverParty}${record.contactName ? ` - ${record.contactName}` : ''}`
    : null;
  return (
    <View style={styles.doneCard}>
      <View style={styles.doneStatusRow}>
        <Ionicons name="checkmark-circle" size={16} color={TENANT} />
        <Text style={styles.doneStatus}>
          Handover completed - {phaseLabel}
          {when ? ` - ${when}` : ''}
        </Text>
      </View>
      {partyLine ? <Text style={styles.doneParty}>{partyLine}</Text> : null}
      <InspectionPhotosField
        label="Submitted photos"
        photoUrls={record?.photoUrls ?? []}
        disabled
        emptyLabel="Add at least one photo before completing this step."
        onTakePhotos={() => undefined}
        onEmptyPress={onEmptyPhotos}
      />
      {record?.notes ? <Text style={styles.doneNotes}>{record.notes}</Text> : null}
      <Text style={styles.doneHint}>This step cannot be edited after submission.</Text>
      <Pressable onPress={onContinue} style={styles.doneCta}>
        <Text style={styles.doneCtaText}>{continueLabel}</Text>
      </Pressable>
    </View>
  );
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

async function keepHandoverPhotos(urls: string[]): Promise<string[]> {
  const next: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    if (isRemotePhotoUrl(url) || (await localPhotoExists(url))) next.push(url);
  }
  return next;
}

async function queuedHandoverPhotos(
  jobId: string,
  phase: 'collect' | 'return',
): Promise<string[]> {
  const items = await loadOfflineQueue();
  const urls: string[] = [];
  for (const item of items) {
    if (item.jobId !== jobId || item.action !== 'key_photo') continue;
    if (item.payload.phase !== phase) continue;
    const uri = typeof item.payload.localUri === 'string' ? item.payload.localUri : '';
    if (uri && (await localPhotoExists(uri)) && !urls.includes(uri)) urls.push(uri);
  }
  return urls;
}

export function JobHandoverPanel({
  id,
  phase,
  onChangeTab,
  onFinished,
}: {
  id: string;
  phase: 'collect' | 'return';
  onChangeTab: (tab: WorkspaceTab, extras?: { keys?: 'collect' | 'return' }) => void;
  onFinished?: () => void;
}) {
  const { getJob, getDraft, patchJob, deviceLocation, jobsHydrated, draftsHydrated } = useInspections();
  const { user } = useAuth();
  const { profile } = useAccount();
  const { refreshPending } = useOffline();
  const job = getJob(id);
  const copy = COPY[phase];
  const defaultParty: HandoverParty = job?.type === 'open' ? 'agent' : 'tenant';
  const start = job ? contactsFor(job, defaultParty) : null;
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [noImageOpen, setNoImageOpen] = useState(false);
  const [party, setParty] = useState<HandoverParty>(defaultParty);
  const [condition, setCondition] = useState<KeyCondition>('good');
  const [keySets, setKeySets] = useState(1);
  const [contactName, setContactName] = useState(start?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(start?.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(start?.contactEmail ?? '');
  const [agencyName, setAgencyName] = useState(start?.agencyName ?? '');
  const [notes, setNotes] = useState('');
  const formKey = `${id}:${phase}`;
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const photoUrlsRef = useRef<string[]>([]);
  photoUrlsRef.current = photoUrls;

  const collectDone = job ? isKeyCollectComplete(job) : false;
  const returnDone = job ? isKeyReturnComplete(job) : false;
  const draft = id ? getDraft(id) : undefined;
  const returnUnlocked = job ? canAccessKeyReturnTab(job, draft) : false;
  const returnLocked = phase === 'return' && !returnUnlocked;
  const phaseDone = phase === 'collect' ? collectDone : returnDone;
  const jobReady = Boolean(job);
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    if (phase !== 'return' || returnUnlocked || !draftsHydrated) return;
    onChangeTab('handover', { keys: 'collect' });
  }, [phase, returnUnlocked, onChangeTab, draftsHydrated]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const current = jobRef.current;
      if (!current) return;
      const done =
        phase === 'collect' ? isKeyCollectComplete(current) : isKeyReturnComplete(current);
      const nextParty: HandoverParty = current.type === 'open' ? 'agent' : 'tenant';
      const nextContacts = contactsFor(current, nextParty);
      let saved: HandoverFormDraft | null = null;
      let photos: string[] = [];
      if (!done) {
        saved = await loadHandoverDraft(id, phase);
        const queued = await queuedHandoverPhotos(id, phase);
        photos = await keepHandoverPhotos([
          ...(saved?.photoUrls ?? []),
          ...queued,
          ...photoUrlsRef.current,
        ]);
      }
      if (cancelled) return;
      setCameraOpen(false);
      setBusy(false);
      setError(null);
      setPhotoBusy(false);
      setNoImageOpen(false);
      setPhotoUrls(photos);
      setParty(saved?.party ?? nextParty);
      setCondition(saved?.condition ?? 'good');
      setKeySets(saved?.keySets && saved.keySets > 0 ? saved.keySets : 1);
      setContactName(saved?.contactName ?? nextContacts.contactName);
      setContactPhone(saved?.contactPhone ?? nextContacts.contactPhone);
      setContactEmail(saved?.contactEmail ?? nextContacts.contactEmail);
      setAgencyName(saved?.agencyName ?? nextContacts.agencyName);
      setNotes(saved?.notes ?? '');
      setHydratedKey(`${id}:${phase}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, id, jobReady]);

  useEffect(() => {
    return subscribeDraftsChanged((rewrite) => {
      if (!rewrite) return;
      setPhotoUrls((current) =>
        current.map((url) => (url === rewrite.from ? rewrite.to : url)),
      );
    });
  }, []);

  useEffect(() => {
    if (hydratedKey !== formKey || !id || phaseDone) return;
    const draft: HandoverFormDraft = {
      photoUrls,
      party,
      condition,
      keySets,
      contactName,
      contactPhone,
      contactEmail,
      agencyName,
      notes,
    };
    void saveHandoverDraft(id, phase, draft);
  }, [
    hydratedKey,
    formKey,
    id,
    phase,
    phaseDone,
    photoUrls,
    party,
    condition,
    keySets,
    contactName,
    contactPhone,
    contactEmail,
    agencyName,
    notes,
  ]);

  if (!job) {
    return <JobLookupFallback state={jobLookupMiss(jobsHydrated)} />;
  }

  if (!job.keyAccess) {
    return <Text style={styles.body}>No key collection required for this job.</Text>;
  }

  const keyAccess = job.keyAccess;
  const accent = party === 'agent' ? AGENT : TENANT;
  const accentBtn = party === 'agent' ? AGENT_BTN : TENANT_BTN;
  const actionBg = party === 'agent' ? 'rgba(14,165,233,0.15)' : 'rgba(16,185,129,0.15)';

  const switchPhase = (next: 'collect' | 'return') => {
    if (next === phase) return;
    if (next === 'return' && !returnUnlocked) {
      setError('Finish the inspection before returning keys.');
      return;
    }
    setError(null);
    onChangeTab('handover', { keys: next });
  };

  const applyParty = (next: HandoverParty) => {
    setParty(next);
    const nextContacts = contactsFor(job, next);
    setContactName(nextContacts.contactName);
    setContactPhone(nextContacts.contactPhone);
    setContactEmail(nextContacts.contactEmail);
    setAgencyName(nextContacts.agencyName);
  };

  const phaseRecord = getKeyWorkflow(job)?.[phase];
  const phaseLabel = phase === 'collect' ? 'Collecting keys' : 'Returning keys';

  const attachPhotos = async (photos: LocalPhoto[]) => {
    const room = MAX_PHOTOS - photoUrls.length;
    if (room <= 0) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const added: string[] = [];
      for (const photo of photos.slice(0, room)) {
        const prepared = await preparePhotoUpload(photo);
        const durable = await persistQueuedPhoto(prepared.localUri);
        const readable = (await resolveLocalFileUri(durable)) ?? durable;
        added.push(readable);
        if (photo.uri !== readable) await deleteLocalPhoto(photo.uri);
        if (prepared.localUri !== readable) await deleteLocalPhoto(prepared.localUri);
      }
      setPhotoUrls((current) => [...current, ...added]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add proof photo.'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoUrls((current) => {
      const uri = current[index];
      if (uri && !isRemotePhotoUrl(uri)) {
        void deleteQueuedPhoto(uri);
        void deleteLocalPhoto(uri);
      }
      return current.filter((_, i) => i !== index);
    });
  };

  const submit = async () => {
    if (phaseDone) return;
    if (phase === 'return' && returnLocked) {
      setError('Finish the inspection before returning keys.');
      return;
    }
    if (photoUrls.length < 1) {
      setNoImageOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const existing: string[] = [];
      for (const url of photoUrls) {
        if (!url) continue;
        if (isRemotePhotoUrl(url)) {
          existing.push(url);
          continue;
        }
        const resolved = await resolveLocalFileUri(url);
        if (resolved) existing.push(resolved);
      }
      if (existing.length !== photoUrls.length) setPhotoUrls(existing);
      if (existing.length < 1) {
        setNoImageOpen(true);
        setError('Could not read the handover photo. Take it again.');
        return;
      }
      const extras = {
        handoverParty: party,
        keyCondition: condition,
        keySets,
        contactName,
        contactPhone,
        contactEmail,
        agencyName: party === 'agent' ? agencyName : undefined,
        notes,
      };
      const packed = formatHandoverNotes(extras, phase);
      const uploaded: string[] = [];
      for (const [index, uri] of existing.entries()) {
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          uploaded.push(uri);
          continue;
        }
        const prepared = await prepareStoredPhotoUpload(uri);
        const saved = await queueKeyCustodyPhoto(
          id,
          {
            ...prepared.body,
            phase,
            fileName: `key-${phase}-${index + 1}.jpg`,
          },
          prepared.localUri,
        );
        uploaded.push(saved.url || prepared.localUri);
        if (saved.url !== uri && saved.url.startsWith('http')) {
          await deleteLocalPhoto(uri);
          await deleteLocalPhoto(prepared.localUri);
        }
      }
      const alreadyFiled =
        job.status === 'completed' || job.status === 'awaiting_approval';
      const custody = await queueKeyCustody(
        id,
        phase,
        packed ? { notes: packed } : {},
        {
          estimatedHours: job.estimatedHours,
          alreadyCompleted: alreadyFiled,
        },
      );
      void refreshPending();
      const record: KeyPhaseRecord = {
        ...extras,
        completedAt:
          custody === 'queued'
            ? new Date().toISOString()
            : (phase === 'collect' ? custody.collectedAt : custody.returnedAt) ??
              new Date().toISOString(),
        photoUrls:
          custody === 'queued'
            ? uploaded
            : phase === 'collect'
              ? custody.collectPhotos
              : custody.returnPhotos,
        notes: extras.notes?.trim() || undefined,
      };
      const collectComplete =
        custody === 'queued'
          ? phase === 'collect' || keyAccess.collectComplete
          : custody.collectComplete;
      const returnComplete =
        custody === 'queued'
          ? phase === 'return' || keyAccess.returnComplete
          : custody.returnComplete;
      const statusPatch =
        phase === 'return' && !alreadyFiled
          ? {
              status:
                (job.type === 'ingoing' || job.type === 'outgoing') && !job.approvedAt
                  ? ('awaiting_approval' as const)
                  : ('completed' as const),
            }
          : {};
      patchJob(id, {
        ...withKeyPhase(job, phase, record, { collectComplete, returnComplete }),
        ...statusPatch,
      });
      await deleteHandoverDraft(id, phase);
      if (custody === 'queued') {
        Alert.alert('Saved on this phone', 'Handover will upload when you are back online.');
      }
      if (phase === 'collect') {
        onChangeTab(job.type === 'open' ? 'start' : 'areas');
      } else {
        onFinished?.();
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not record handover.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.phaseSwitch}>
          <Pressable
            onPress={() => switchPhase('collect')}
            style={[styles.phaseBtn, phase === 'collect' && styles.phaseBtnOn]}
          >
            <View style={styles.phaseTitleRow}>
              <Text style={[styles.phaseTitle, phase === 'collect' && styles.phaseTitleOn]}>
                Handover
              </Text>
              {collectDone ? (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={phase === 'collect' ? colors.primaryFg : colors.primary}
                />
              ) : null}
            </View>
            <Text style={[styles.phaseSub, phase === 'collect' && styles.phaseSubOn]}>
              Collecting keys
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchPhase('return')}
            style={[
              styles.phaseBtn,
              phase === 'return' && styles.phaseBtnOn,
              !returnUnlocked && styles.phaseBtnLocked,
            ]}
          >
            <View style={styles.phaseTitleRow}>
              <Text style={[styles.phaseTitle, phase === 'return' && styles.phaseTitleOn]}>
                Handover
              </Text>
              {returnDone ? (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={phase === 'return' ? colors.primaryFg : colors.primary}
                />
              ) : null}
            </View>
            <Text style={[styles.phaseSub, phase === 'return' && styles.phaseSubOn]}>
              Returning keys
            </Text>
          </Pressable>
        </View>

        {job.leasingKeyCollection ? (
          <LeasingKeyCollectionPanel context={job.leasingKeyCollection} />
        ) : null}

        <JobPropertyHeader
          job={job}
          inspectorName={user ? displayName(user) : displayName(profile ?? {})}
          showDirections
          origin={deviceLocation}
        />

        {phaseDone ? (
          <CompletedHandoverCard
            phaseLabel={phaseLabel}
            record={phaseRecord}
            continueLabel={
              phase === 'collect' && job.type === 'open'
                ? 'Continue Inspection'
                : phase === 'collect'
                  ? 'Continue to Areas'
                  : 'Back to job details'
            }
            onContinue={() => {
              if (phase === 'collect') {
                onChangeTab(job.type === 'open' ? 'start' : 'areas');
                return;
              }
              onChangeTab('details');
            }}
            onEmptyPhotos={() => setNoImageOpen(true)}
          />
        ) : (
          <>
        {job.keyAccess.code ? (
          <Text style={styles.accessCode}>{job.keyAccess.code}</Text>
        ) : null}
        {job.keyAccess.location ? (
          <Text style={styles.accessLocation}>{job.keyAccess.location}</Text>
        ) : null}
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
          <AppTextInput
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
          <Text style={styles.hint}>At least one photo is required to record the handover.</Text>
          <InspectionPhotosField
            label="Handover photos"
            photoUrls={photoUrls}
            uploading={photoBusy}
            maxPhotos={MAX_PHOTOS}
            emptyLabel="Add at least one photo before completing this step."
            onTakePhotos={() => {
              if (photoUrls.length >= MAX_PHOTOS) return;
              setCameraOpen(true);
            }}
            onAddPhotos={(photos) => {
              void attachPhotos(photos);
            }}
            onRemove={removePhoto}
          />
        </View>

        <Pressable
          onPress={() => {
            void submit();
          }}
          disabled={busy || photoBusy || returnLocked}
          style={[
            styles.primary,
            { backgroundColor: accentBtn },
            (busy || photoBusy || returnLocked) && styles.disabled,
          ]}
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
          </>
        )}
      </ScrollView>
      <JobCamera
        visible={cameraOpen}
        mode="burst"
        maxPhotos={Math.max(0, MAX_PHOTOS - photoUrls.length)}
        onClose={() => setCameraOpen(false)}
        onBurstComplete={(photos) => {
          void attachPhotos(photos);
        }}
      />
      <NoImageDialog
        open={noImageOpen}
        onClose={() => setNoImageOpen(false)}
        message="Add at least one photo before completing this step."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
  phaseSwitch: {
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 6,
  },
  phaseBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  phaseBtnOn: { backgroundColor: colors.primary },
  phaseBtnLocked: { opacity: 0.4 },
  phaseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phaseTitle: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  phaseTitleOn: { color: colors.primaryFg },
  phaseSub: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  phaseSubOn: { color: colors.primaryFg },
  kicker: { color: colors.muted, fontSize: 12 },
  accessCode: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,212,164,0.4)',
    backgroundColor: 'rgba(0,212,164,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
  },
  accessLocation: { color: colors.muted, fontSize: 12, lineHeight: 16 },
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
  doneCard: {
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  doneStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneStatus: { color: TENANT, fontSize: 12, flex: 1 },
  doneParty: { color: colors.text, fontSize: 12 },
  doneNotes: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  doneHint: { color: colors.muted, fontSize: 10 },
  doneCta: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneCtaText: { color: colors.primaryFg, fontWeight: '700' },
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
