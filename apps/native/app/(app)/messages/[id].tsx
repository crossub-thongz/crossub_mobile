import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';

import { useAuth } from '@/src/auth/auth-context';
import { useInbox } from '@/src/inbox/inbox-context';
import { displayName, formatDateTime } from '@/src/lib/datetime';
import {
  MAX_MESSAGE_ATTACHMENTS,
  pickMessageAttachments,
  type PendingAttachment,
} from '@/src/lib/message-attachments';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

function cleanDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const mid = Math.floor(parts.length / 2);
    const left = parts.slice(0, mid).join(' ');
    const right = parts.slice(mid).join(' ');
    if (left.toLowerCase() === right.toLowerCase()) return left;
  }
  return name.trim();
}

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { messages, getThreadMessages, sendReply } = useInbox();
  const thread = messages.find((item) => item.id === id);
  const threadMessages = id ? getThreadMessages(id) : [];
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [threadMessages.length]);

  if (!thread) {
    return (
      <View style={styles.safe}>
        <AppHeader title="Not found" backHref="/messages" />
        <Text style={styles.missing}>Thread not found.</Text>
      </View>
    );
  }

  const handleSend = () => {
    const body = draft.trim();
    if ((!body && pendingFiles.length === 0) || !id) return;
    void sendReply(
      id,
      body || pendingFiles[0]?.fileName || 'Attachment',
      pendingFiles.length > 0 ? pendingFiles : undefined,
    );
    setDraft('');
    setPendingFiles([]);
  };

  return (
    <View style={styles.safe}>
      <AppHeader title={thread.subject} backHref="/messages" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {thread.propertyAddress || thread.inspectionTrackingNumber ? (
          <Text style={styles.caseLine}>
            {[thread.propertyAddress, thread.inspectionTrackingNumber].filter(Boolean).join(' ? ')}
          </Text>
        ) : null}

        <ScrollView ref={scroller} contentContainerStyle={styles.list}>
          {threadMessages.length === 0 ? (
            <Text style={styles.empty}>No messages yet ? say hello below.</Text>
          ) : (
            threadMessages.map((msg) => {
              const isSelf = msg.fromSelf ?? msg.from === displayName(user ?? { email: '' });
              return (
                <View key={msg.id} style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
                  <Text style={styles.from}>
                    {cleanDisplayName(msg.from)} ? {formatDateTime(msg.at)}
                  </Text>
                  <Text style={styles.body}>{msg.body}</Text>
                  {msg.attachments?.map((file) => (
                    <Pressable
                      key={`${file.url}-${file.name}`}
                      onPress={() => {
                        if (file.url) void Linking.openURL(file.url);
                      }}
                    >
                      <Text style={styles.attach}>{file.name}</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composerWrap}>
          {pendingFiles.length > 0 ? (
            <Text style={styles.pending}>
              {pendingFiles.map((file) => file.fileName).join(' ? ')}
            </Text>
          ) : null}
          <View style={styles.composer}>
            <Pressable
              onPress={() => {
                void pickMessageAttachments(pendingFiles.length)
                  .then((files) => setPendingFiles((current) => [...current, ...files]))
                  .catch((err) =>
                    Alert.alert("Couldn't attach file", err instanceof Error ? err.message : ''),
                  );
              }}
              style={styles.attachBtn}
            >
              <Text style={styles.attachText}>+</Text>
            </Pressable>
            <AppTextInput
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              style={styles.input}
              returnKeyType="send"
            />
            <Pressable onPress={handleSend} style={styles.send}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
          <Text style={styles.attachHint}>
            Attach {pendingFiles.length}/{MAX_MESSAGE_ATTACHMENTS} ? image, video, PDF or doc, 10 MB
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  missing: { color: colors.muted, padding: 16, fontSize: 14 },
  caseLine: { color: colors.muted, fontSize: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 32, fontSize: 14 },
  bubble: { borderWidth: 1, borderRadius: 12, padding: 12 },
  bubbleSelf: {
    marginLeft: 16,
    borderColor: 'rgba(0,212,164,0.3)',
    backgroundColor: 'rgba(0,212,164,0.05)',
  },
  bubbleOther: {
    marginRight: 16,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  from: { color: colors.muted, fontSize: 10, fontWeight: '500', marginBottom: 4 },
  body: { color: colors.text, fontSize: 14 },
  attach: { color: colors.primary, fontSize: 12, marginTop: 8, textDecorationLine: 'underline' },
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 6,
  },
  pending: { color: colors.muted, fontSize: 11 },
  composer: {
    flexDirection: 'row',
    gap: 8,
  },
  attachBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachText: { color: colors.text, fontSize: 20, fontWeight: '600' },
  attachHint: { color: colors.muted, fontSize: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendText: { color: colors.primaryFg, fontWeight: '700' },
});
