import { Redirect, useLocalSearchParams } from 'expo-router';

export default function KeysRedirect() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const keys = tab === 'return' ? 'return' : 'collect';
  if (!id) return null;
  return <Redirect href={`/jobs/${id}?tab=handover&keys=${keys}`} />;
}
