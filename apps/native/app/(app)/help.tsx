import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  keyManagementPath,
  messagesPath,
  profilePath,
  registerPath,
  settingsPath,
} from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

type FaqLink = { label: string; href: Href };

type Faq = {
  q: string;
  a: string;
  links?: FaqLink[];
};

const FAQS: Faq[] = [
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
    a: 'More > Professional profile > Update registration. Bank numbers are never shown in full after save.',
    links: [
      { label: 'Open Professional profile', href: profilePath },
      { label: 'Update registration', href: registerPath },
    ],
  },
  {
    q: 'How do I photograph a job?',
    a: 'On an area or checklist item, tap Take. Wait for the live preview, snap with the shutter, then tap Use N. Upload picks photos you already have. Shots compress on the phone before they upload.',
  },
  {
    q: 'The camera preview stays grey. What now?',
    a: 'Wait a few seconds for Starting camera to finish. If it does not, tap Use library in the camera, or Allow camera / Open Settings if access was denied. Photos from the library attach the same way as a burst.',
  },
  {
    q: 'How do I collect or return keys?',
    a: 'Open the job Handover tab. Collect first, then return after the inspection is finished. Pickup location and access code show when the agent provided them. Key management under More lists assigned jobs.',
    links: [{ label: 'Open Key management', href: keyManagementPath }],
  },
  {
    q: 'What if I am offline?',
    a: 'Photos are saved on this phone as soon as you take them, even before they upload. Login and logout both sync the queue. Settings shows how many changes are waiting. Tap Sync now when you have a connection.',
    links: [{ label: 'Open Settings', href: settingsPath }],
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(FAQS[0]?.q ?? null);

  return (
    <View style={styles.safe}>
      <AppHeader title="Help & support" backHref="/more" />
      <ScrollView contentContainerStyle={styles.inner}>
        {FAQS.map((item) => {
          const expanded = open === item.q;
          return (
            <View key={item.q} style={styles.card}>
              <Pressable
                onPress={() => setOpen(expanded ? null : item.q)}
                style={styles.header}
              >
                <Text style={styles.q}>{item.q}</Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
              {expanded ? (
                <View style={styles.body}>
                  <Text style={styles.a}>{item.a}</Text>
                  {item.links?.map((link) => (
                    <Pressable
                      key={link.href.toString()}
                      onPress={() => router.push(link.href)}
                      style={styles.link}
                    >
                      <Text style={styles.linkText}>{link.label}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
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
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
  },
  q: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  a: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: { color: colors.primaryFg, fontWeight: '700' },
});
