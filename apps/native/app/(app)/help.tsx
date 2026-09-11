import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { messagesPath } from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

const FAQS = [
  {
    q: 'How do I receive pool jobs?',
    a: 'Tap Receiving in the header. Break hides new pool claims. Open-batch selection also needs Receiving on.',
  },
  {
    q: 'When can I pick Saturday opens?',
    a: 'The list is visible all week. Selection opens Wednesday at 12:00pm Sydney. Pick a set of properties together so the route (and times) are planned as one day, then confirm. Agents are emailed only after you confirm.',
  },
  {
    q: 'Why are travel times estimates?',
    a: 'Pool distance uses a straight-line estimate from your GPS or the area you searched. Open-batch legs that only have a suburb are labelled as estimates.',
  },
  {
    q: 'How do I update licence or bank details?',
    a: 'More ? Professional profile ? Update registration. Bank numbers are never shown in full after save.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  return (
    <View style={styles.safe}>
      <AppHeader title="Help & support" backHref="/more" />
      <ScrollView contentContainerStyle={styles.inner}>
        {FAQS.map((item) => (
          <View key={item.q} style={styles.card}>
            <Text style={styles.q}>{item.q}</Text>
            <Text style={styles.a}>{item.a}</Text>
          </View>
        ))}
        <Pressable onPress={() => router.push(messagesPath)} style={styles.cta}>
          <Text style={styles.ctaText}>Message CROSSUB</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  q: { color: colors.text, fontSize: 14, fontWeight: '600' },
  a: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: { color: colors.primaryFg, fontWeight: '700' },
});
