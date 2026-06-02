# Add Face ID / Biometric Login (iOS + Android)

Wrap the existing web app with **Capacitor** so it runs as a real native app, then add **biometric unlock** (Face ID on iPhone, Touch ID / fingerprint / face unlock on Android) for the employee dashboard login.

## How it will work for the user

1. Employee installs the native app (one-time, from TestFlight / Play Store / dev build).
2. First launch → logs in normally with email + password.
3. App asks: *"Use Face ID to sign in next time?"* → yes.
4. Credentials are stored encrypted in the device's **Keychain (iOS)** / **Keystore (Android)** — never in plain text, never on our servers.
5. Every future launch → Face ID prompt → instant login. Password fallback always available.

## What I'll build

### 1. Capacitor setup
- Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- Create `capacitor.config.ts` with:
  - appId: `app.lovable.b03b40e402014016b119ee4d336cfb7b`
  - appName: `LTR Employee`
  - Hot-reload pointing at the Lovable sandbox URL (for dev)

### 2. Biometric plugin
- Install `capacitor-native-biometric` (handles Face ID, Touch ID, Android fingerprint/face)
- Wraps iOS Keychain + Android Keystore for secure credential storage

### 3. Auth UI changes (employee login page only)
- After successful password login → prompt "Enable Face ID for faster sign-in?"
- On next app launch → if biometrics enrolled, auto-prompt and sign in
- Settings toggle to disable biometric login + clear stored credentials
- Graceful fallback to password if biometrics fail / unavailable / web browser

### 4. Platform detection
- Use `Capacitor.isNativePlatform()` so biometric code only runs in the native app — web users see the normal login unchanged.

## What you'll need to do (one-time, on your own machine)

I can't build the iOS/Android binaries from Lovable — Apple and Google require local tooling. After I push the code:

1. Click **Export to GitHub** → `git clone` your repo
2. `npm install`
3. `npx cap add ios && npx cap add android`
4. `npm run build && npx cap sync`
5. iOS: `npx cap run ios` (needs **Mac + Xcode**, free; **Apple Developer $99/yr** to install on real devices or ship to App Store)
6. Android: `npx cap run android` (needs **Android Studio**, free; **Google Play $25 one-time** to publish)

Full walkthrough: https://lovable.dev/blog/2025-03-25-capacitor-guide

## Technical details

- `BiometricAuth.isAvailable()` → check device support + enrollment
- `BiometricAuth.setCredentials({ username, password, server: 'ltrvc' })` → save to Keychain/Keystore
- `BiometricAuth.verifyIdentity({ reason: 'Sign in to LTR' })` → trigger Face ID prompt
- `BiometricAuth.getCredentials({ server: 'ltrvc' })` → retrieve after successful biometric
- Then call existing `supabase.auth.signInWithPassword(...)` with retrieved creds
- iOS `Info.plist` needs `NSFaceIDUsageDescription` — handled in Capacitor config

## Out of scope (ask if you want these)

- Magic-link / passwordless biometric (would need a refresh-token flow instead of stored password)
- Push notifications, camera, etc. — easy to add later, just more plugins
- App Store / Play Store submission assets (icons, screenshots, listing copy)
