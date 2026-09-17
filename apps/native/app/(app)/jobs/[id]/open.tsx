import { Redirect, useLocalSearchParams } from 'expo-router';

export default function OpenRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <Redirect href={`/jobs/${id}?tab=start`} />;
}
