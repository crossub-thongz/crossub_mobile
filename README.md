# crossub_mobile

CROSSUB Inspector for iPhone and Android, plus the inspector website in the same workspace. Both consume the [crossub_web](https://github.com/crossub-thongz/crossub_web) Nest API.

The phone app is **React Native / Expo** (TypeScript). It is not a handwritten Swift or Kotlin app. Expo generates the Xcode and Android projects locally. Those folders are gitignored (`apps/native/ios`, `apps/native/android`), so GitHub shows TypeScript, not an Xcode project.

> **Use pnpm only.** Run all scripts via `pnpm`.

## Apps

| Path | Package | What it is |
|------|---------|------------|
| `apps/native` | `@crossub/inspector-native` | Expo SDK 57 app. TestFlight and the future Android build. Bundle / package `com.crossub.inspector`. |
| `apps/inspector` | `@crossub/inspector` | Next.js inspector portal (port **3006**). This is the website, not the App Store binary. |

The older repo name `crossub_mobile_inspector` is this website only. The phone source lives here.

## Requirements

- Node.js `>=20`
- pnpm `>=9`
- Xcode (iOS) or Android Studio (Android) when you build a device binary
- Staging API: `https://crossub-api-staging.onrender.com`

## Phone app

```bash
pnpm install
cp apps/native/.env.example apps/native/.env
pnpm dev:native
```

Scan the QR code with Expo Go. A phone cannot use `localhost`. The default API is staging (`EXPO_PUBLIC_API_URL` in `apps/native/.env`).

Native run (generates `ios/` or `android/` on this machine):

```bash
pnpm ios
pnpm android
```

Store builds use EAS from `apps/native` (`eas.json`). The production profile points at the staging API. iOS App Store Connect app `6812279119`, team `KQ997HDJ7H`, TestFlight group Dev Test. Marketing version is `0.1.0`. The iOS build number is Xcode `CURRENT_PROJECT_VERSION` in the local `ios/` project, not `app.json`.

## Inspector website

```bash
pnpm install
cp apps/inspector/.env.example apps/inspector/.env
pnpm dev:inspector
```

Open [http://localhost:3006](http://localhost:3006).

## Deploy the website on Render

Deploy **after** the `crossub_web` API is live. The phone app is not a Render web service.

### Blueprint

1. Push this repo to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect `crossub_mobile`. Render reads `render.yaml`.
4. Set the environment variables below.

### Manual web service

| Setting | Value |
|---------|--------|
| **Name** | `crossub-mobile-inspector` |
| **Environment** | Node |
| **Region** | Singapore (or your preference) |
| **Branch** | `main` |
| **Root Directory** | *(blank)* |
| **Build Command** | `corepack pnpm install --frozen-lockfile && corepack pnpm build:inspector` |
| **Start Command** | `corepack pnpm --filter @crossub/inspector start` |
| **Health Check Path** | `/login` |

### Environment variables

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `NEXT_PUBLIC_API_URL` | `/api` | Yes |
| `API_INTERNAL_URL` | `https://crossub-api.onrender.com` | Yes |
| `NEXT_PUBLIC_WEB_URL` | `https://crossub-web.onrender.com` | Optional |
| `NEXT_PUBLIC_AGENT_PORTAL_URL` | `https://crossub-mobile-agent.onrender.com` | Optional |

Do **not** add `/api` to the end of `API_INTERNAL_URL`. Render injects `PORT`. The start script binds with `next start -H 0.0.0.0`.

On the API, password-reset links and CORS should include the inspector website host:

```bash
WEB_URL=https://crossub-mobile-inspector.onrender.com
CORS_ORIGINS=https://crossub-mobile-inspector.onrender.com,https://crossub-mobile-agent.onrender.com
```

Leave `COOKIE_DOMAIN` empty so auth cookies bind to the inspector website hostname.

**`Can't resolve '@crossub-thongz/api-contract'`** — the contract is vendored under `packages/api-contract/` and built during `pnpm build:inspector`. After the backend OpenAPI spec changes, copy the refreshed package from `crossub_web` and commit it.

**`EROFS: read-only file system, unlink '/usr/bin/pnpm'`** — do not run `corepack enable` on Render. Use `corepack pnpm` directly.

## Project structure

```
crossub_mobile/
├── apps/native/          Expo inspector app (iOS + Android)
├── apps/inspector/       Next.js inspector website
├── packages/api-contract Vendored Nest OpenAPI client
├── render.yaml           Render blueprint for the website only
└── package.json          Workspace root
```

## Ecosystem ports (local)

| App | Port |
|-----|------|
| crossub_web (web) | 3000 |
| crossub_web (api) | 3001 |
| crossub_mobile_agent | 3002 |
| crossub_tenant_app | 3003 |
| crossub_mobile_maintenance | 3004 |
| crossub_mobile_landlord_app | 3005 |
| inspector website (`apps/inspector`) | 3006 |
| Expo (`apps/native`) | 8081 |
