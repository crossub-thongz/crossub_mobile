# @crossub/inspector-native

Expo SDK 57 inspector app for iOS and Android. The Next website stays in `apps/inspector` and is not this binary.

Screens, jobs, camera, and notifications are TypeScript. `ios/` and `android/` are generated locally and are not in git.

## Run

From the `crossub_mobile` repo root:

```bash
pnpm install
cp apps/native/.env.example apps/native/.env
pnpm dev:native
```

Scan the QR code with Expo Go. Default API is staging Nest (`EXPO_PUBLIC_API_URL`). A phone cannot use `localhost`.

Device builds:

```bash
pnpm ios
pnpm android
```
