import { Redirect, useLocalSearchParams } from 'expo-router';

export default function IngoingRedirect() {
  const { id, view } = useLocalSearchParams<{ id: string; view?: string }>();
  if (!id) return null;
  return <Redirect href={`/jobs/${id}?tab=${view === 'inspect' ? 'start' : 'areas'}`} />;
}
