import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)/);
    if (!match) return;
    const [, key, host, project] = match;
    void fetch(`https://${host}/api/${project}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}`,
      },
      body: JSON.stringify({
        message: error.message,
        level: 'error',
        platform: 'javascript',
      }),
    }).catch(() => undefined);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>Close this screen and open the job again.</Text>
        <Pressable onPress={() => this.setState({ error: null })} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  button: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { color: colors.primaryFg, fontWeight: '600' },
});
