import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useInbox } from '@/src/inbox/inbox-context';
import { useInspections } from '@/src/inspections/inspections-context';
import { formatRelative } from '@/src/lib/datetime';
import {
  MAX_MESSAGE_ATTACHMENTS,
  pickMessageAttachments,
  type PendingAttachment,
} from '@/src/lib/message-attachments';
import { messageDetail } from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

export default function MessagesScreen() {
  const router = useRouter();
  const { messages, loading, refreshing, error, refresh, createThread } = useInbox();
  const { jobs } = useInspections();
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [inspectionId, setInspectionId] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);

  const cases = useMemo(
    () =>
      jobs
        .filter((job) => job.status !== 'available' && job.status !== 'declined')
        .map((job) => ({ id: job.id, label: `${job.type} ù ${job.propertyAddress}` })),
    [jobs],
  );

  const handleCreate = async () => {
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject) {
      Alert.alert('Add a subject');
      return;
    }
    if (!trimmedBody && pendingFiles.length === 0) {
      Alert.alert('Add a message or attachment');
      return;
    }
    setSending(true);
    try {
      const id = await createThread({
        subject: trimmedSubject,
        body: trimmedBody || pendingFiles[0]?.fileName || 'Attachment',
        inspectionId: inspectionId || undefined,
        attachments: pendingFiles.length > 0 ? pendingFiles : undefined,
      });
      setComposing(false);
      setSubject('');
      setBody('');
      setInspectionId('');
      setPendingFiles([]);
      router.push(messageDetail(id));
    } catch (err) {
      Alert.alert("Couldn't start the conversation", err instanceof Error ? err.message : '');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.safe}>
      <AppHeader title="Messages" />
      <ScrollView
        contentContainerStyle={styles.inner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.toolbar}>
          <Text style={styles.hint}>Message the office ù pick a case when it relates to a job.</Text>
          <Pressable
            onPress={() => setComposing((open) => !open)}
            style={[styles.newBtn, composing && styles.newBtnOutline]}
          >
            <Text style={[styles.newBtnText, composing && styles.newBtnTextOutline]}>
              {composing ? 'Cancel' : '+ New message'}
            </Text>
          </Pressable>
        </View>

        {composing ? (
          <View style={styles.compose}>
            <Text style={styles.label}>Case</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.caseRow}>
              <Pressable
                onPress={() => setInspectionId('')}
                style={[styles.caseChip, !inspectionId && styles.caseChipOn]}
              >
                <Text style={[styles.caseText, !inspectionId && styles.caseTextOn]}>
                  General (no case)
                </Text>
              </Pressable>
              {cases.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setInspectionId(item.id)}
                  style={[styles.caseChip, inspectionId === item.id && styles.caseChipOn]}
                >
                  <Text
                    style={[styles.caseText, inspectionId === item.id && styles.caseTextOn]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              placeholder="Subject"
              placeholderTextColor={colors.muted}
              value={subject}
              onChangeText={setSubject}
              style={styles.input}
            />
            <TextInput
              placeholder="Write your messageù"
              placeholderTextColor={colors.muted}
              value={body}
              onChangeText={setBody}
              style={[styles.input, styles.textarea]}
              multiline
            />
            {pendingFiles.length > 0 ? (
              <Text style={styles.hint}>
                {pendingFiles.map((file) => file.fileName).join(' ∑ ')}
              </Text>
            ) : null}
            <View style={styles.composeActions}>
              <Pressable
                onPress={() => {
                  void pickMessageAttachments(pendingFiles.length)
                    .then((files) => setPendingFiles((current) => [...current, ...files]))
                    .catch((err) =>
                      Alert.alert(
                        "Couldn't attach file",
                        err instanceof Error ? err.message : '',
                      ),
                    );
                }}
                style={styles.attachBtn}
              >
                <Text style={styles.attachText}>
                  Attach ({pendingFiles.length}/{MAX_MESSAGE_ATTACHMENTS})
                </Text>
              </Pressable>
              <Pressable
                disabled={sending}
                onPress={() => {
                  void handleCreate();
                }}
                style={[styles.send, sending && { opacity: 0.55 }]}
              >
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {messages.length === 0 && !composing && !loading ? (
          <EmptyState
            icon="chatbox-outline"
            title="No messages"
            description="Tap New message to contact the office."
          />
        ) : (
          messages.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(messageDetail(item.id))}
              style={styles.card}
            >
              <View style={styles.cardHead}>
                <Text style={styles.subject} numberOfLines={1}>
                  {item.subject}
                </Text>
                {item.unread > 0 ? (
                  <View style={styles.unread}>
                    <Text style={styles.unreadText}>{item.unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.preview} numberOfLines={2}>
                {item.lastMessage}
              </Text>
              <Text style={styles.meta}>
                {formatRelative(item.lastAt)} ù {item.category}
                {item.inspectionTrackingNumber ? ` ù #${item.inspectionTrackingNumber}` : ''}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { flex: 1, color: colors.muted, fontSize: 12 },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  newBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  newBtnText: { color: colors.primaryFg, fontSize: 12, fontWeight: '600' },
  newBtnTextOutline: { color: colors.text },
  compose: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  caseRow: { gap: 8 },
  caseChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 220,
  },
  caseChipOn: { borderColor: colors.primary, backgroundColor: 'rgba(0,212,164,0.1)' },
  caseText: { color: colors.text, fontSize: 12 },
  caseTextOn: { color: colors.primary, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  composeActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attachBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  send: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendText: { color: colors.primaryFg, fontWeight: '700' },
  error: { color: colors.destructive, fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(28,35,38,0.8)',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  subject: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  unread: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  preview: { color: colors.muted, fontSize: 12, marginTop: 4 },
  meta: { color: colors.muted, fontSize: 10, marginTop: 8 },
});
