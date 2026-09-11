# @crossub/inspector-native

Expo (SDK 57) inspector app. The Next website in `apps/inspector` is unchanged.

## Run

```bash
cd ~/Documents/Local/crossub_mobile_inspector
pnpm install
pnpm dev:native
```

Scan the QR with Expo Go 57. Default API is staging Nest
(`EXPO_PUBLIC_API_URL` in `apps/native/.env`). A phone cannot use `localhost`.

## What is wired

- Sign in: `POST /api/v1/auth/login` → SecureStore Bearer tokens
- Session restore: `GET /api/auth/me`
- Home / Pool / Inspect tabs
- Pool claim: `GET /inspector/inspections/pool` + `POST .../claim`
- Assigned list: `GET /inspector/inspections`

## Next (step 4)

One field workflow (findings, one photo, complete). Not camera/offline yet.
