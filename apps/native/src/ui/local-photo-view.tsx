import { Image as ExpoImage } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  Image as NativeImage,
  Platform,
  type StyleProp,
  type ImageStyle,
} from 'react-native';

import { asFileUri, isRemotePhotoUrl, resolveLocalFileUri } from '@/src/lib/local-file';

function displayUri(uri: string): string {
  if (!uri || isRemotePhotoUrl(uri)) return uri;
  return asFileUri(uri);
}

/** Local camera files on Android. expo-image leaves these blank; the native image view does not. */
function usePhotoUri(uri: string): string {
  const [src, setSrc] = useState(() => displayUri(uri));

  useEffect(() => {
    let cancelled = false;
    setSrc(displayUri(uri));
    if (!uri || isRemotePhotoUrl(uri)) return;
    void resolveLocalFileUri(uri).then((resolved) => {
      if (!cancelled && resolved) setSrc(asFileUri(resolved));
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return src;
}

export function LocalPhotoView({
  uri,
  style,
  contentFit = 'cover',
}: {
  uri: string;
  style: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
}) {
  const src = usePhotoUri(uri);
  if (Platform.OS === 'android' && src && !isRemotePhotoUrl(src)) {
    return <NativeImage source={{ uri: src }} style={style} resizeMode={contentFit} />;
  }
  return (
    <ExpoImage
      source={{ uri: src }}
      style={style}
      contentFit={contentFit}
      cachePolicy={isRemotePhotoUrl(src) ? 'disk' : 'memory'}
      recyclingKey={src}
      allowDownscaling
      transition={0}
    />
  );
}
