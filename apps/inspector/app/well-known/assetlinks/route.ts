const PACKAGE_NAME = 'com.crossub.inspector';

function fingerprints(): string[] {
  return (process.env.ANDROID_APP_LINK_SHA256 ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** Android App Link verification. Empty until ANDROID_APP_LINK_SHA256 is set to the Play signing certificate. */
export function GET() {
  const sha256 = fingerprints();
  if (sha256.length === 0) return Response.json([]);
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: sha256,
      },
    },
  ]);
}
