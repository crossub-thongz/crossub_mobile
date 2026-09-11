import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/src/auth/auth-context';
import { useInbox } from '@/src/inbox/inbox-context';
import { displayName, formatDateTime } from '@/src/lib/datetime';
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
    if (!body || !id) return;
    void sendReply(id, body);
    setDraft('');
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
            {[thread.propertyAddress, thread.inspectionTrackingNumber].filter(Boolean).join(' ù ')}
          </Text>
        ) : null}

        <ScrollView ref={scroller} contentContainerStyle={styles.list}>
          {threadMessages.length === 0 ? (
            <Text style={styles.empty}>No messages yet ù say hello below.</Text>
          ) : (
            threadMessages.map((msg) => {
              const isSelf = msg.fromSelf ?? msg.from === displayName(user ?? { email: '' });
              return (
                <View key={msg.id} style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
                  <Text style={styles.from}>
                    {cleanDisplayName(msg.from)} ù {formatDateTime(msg.at)}
                  </Text>
                  <Text style={styles.body}>{msg.body}</Text>
                  {msg.attachments?.map((file) => (
                    <Text key={`${file.url}-${file.name}`} style={styles.attach}>
                      {file.name}
                    </Text>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
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
  composer: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
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
