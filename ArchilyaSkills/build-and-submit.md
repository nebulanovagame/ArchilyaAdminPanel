# Skill: Archilya Android Build & Submit

## Description
Automate the complete Android production build, Google Play Console submission, and Firebase test account creation pipeline for the Archilya mobile app.

## Trigger Keywords
- "build and submit"
- "deploy android"
- "play store upload"
- "new release"
- "aab build"
- "test hesabi olustur"

## Context
- Project: `ArchilyaMobil/` (Expo 55 + React Native)
- Package: `com.archilya.app`
- Firebase Project: `nng-toma`
- Keystore: `android/app/archilya-release.keystore` (EAS remote credentials downloaded)

## Preconditions (Auto-verify)
1. `google-services-key.json` exists in project root (Play Store submission)
2. `android/app/archilya-release.keystore` exists with correct SHA1 (`03:7C:0E:C1...`)
3. `google-services.json` exists in `android/app/` (Firebase config) and contains BOTH debug + release SHA entries
4. `.env.local` contains `EXPO_PUBLIC_RC_GOOGLE_API_KEY`
5. RevenueCat products active in Play Console
6. Play Console country targets configured

## CRITICAL: Firebase SHA-1 / Google Sign-In Verification
Before ANY build, verify the `google-services.json` has both fingerprints:

```json
"oauth_client": [
  {
    "client_id": "...",  // debug keystore (5e8f1606...)
    "client_type": 1,
    "android_info": {
      "package_name": "com.archilya.app",
      "certificate_hash": "5e8f16062ea3cd2c4a0d547876baa6f38cabf625"
    }
  },
  {
    "client_id": "...",  // release keystore (037c0ec1...)
    "client_type": 1,
    "android_info": {
      "package_name": "com.archilya.app",
      "certificate_hash": "037c0ec137d50ee9a92e1909bd0388c124326a36"
    }
  }
]
```

If missing debug fingerprint, Google Sign-In will fail with:
> "Google OAuth ayarlari gecersiz. Android package adi, SHA-1/SHA-256 ve client ID eslesmesini kontrol edin."

### Fix Missing SHA-1 (One-command)
```bash
cd ArchilyaMobil/android/app

# Extract debug SHA-1
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android | findstr SHA1

# Add to Firebase (replace APP_ID with full Android app ID from Firebase Console)
firebase apps:android:sha:create "APP_ID" "DEBUG_SHA1_HERE" --project nng-toma --non-interactive

# Download fresh google-services.json
rm android/app/google-services.json
firebase apps:sdkconfig android "APP_ID" --out "android/app/google-services.json" --project nng-toma --non-interactive
```

## Step 1: Sync versionCode
Read `app.json` and `android/app/build.gradle`, increment `versionCode` by 1 in BOTH files.

Current reference (last deployed): `versionCode: 11`

## Step 2: Build AAB
```bash
cd ArchilyaMobil/android
.\gradlew.bat bundleRelease --no-daemon
```
- Output: `android/app/build/outputs/bundle/release/app-release.aab`
- If `clean` fails with CMake errors, run `npm install` first then retry.

## Step 3: Verify Signing
Check SHA1 matches Play Console expected key:
```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab | findstr SHA1
```
Expected: `03:7C:0E:C1:37:D5:0E:E9:A9:2E:19:09:BD:03:88:C1:24:32:6A:36`

## Step 4: Submit to Google Play
```bash
cd ArchilyaMobil
npx eas-cli submit --platform android --path "android/app/build/outputs/bundle/release/app-release.aab" --profile internal --non-interactive
```

For production track instead of internal:
```bash
npx eas-cli submit --platform android --path "android/app/build/outputs/bundle/release/app-release.aab" --profile production --non-interactive
```

## Step 5: Create Firebase Test Account (if requested)
Use Firebase REST API with stored access token from `~/.config/configstore/firebase-tools.json`:
- Email: `google_test@archilya.com`
- Password: `Archilya2026!`
- Firestore doc: `users/{uid}` with `plan: 'studio'`, `credits: 10000`

## Error Handling
| Error | Solution |
|-------|----------|
| "signed with wrong key" | Download correct keystore from EAS: `npx eas-cli credentials -p android` |
| "versionCode already used" | Increment both `app.json` and `build.gradle` versionCode |
| "targeting no countries" | User must set countries in Play Console first |
| "Free plan build limit" | Use local gradle build instead of EAS cloud build |
| "Invalid credentials" for Firestore | Refresh access token via firebase-tools OAuth |
| Google Sign-In "developer_error" / "config mismatch" | Run SHA-1 verification step above; add missing debug fingerprint to Firebase Console; re-download `google-services.json` |
| CMake / codegen build failures after clean | Run `npm install` in project root, then rebuild |

## Files to Modify
- `ArchilyaMobil/app.json` — versionCode
- `ArchilyaMobil/android/app/build.gradle` — versionCode + signing config (if keystore changed)
- `ArchilyaMobil/eas.json` — temporarily change track to "internal" if needed

## Post-Submit Checklist
- [ ] Play Console shows new version in target track
- [ ] Internal testing link/QR available for phone install
- [ ] Test account `google_test@archilya.com` exists with studio plan
- [ ] RevenueCat webhook receiving events
- [ ] `eas.json` track restored to "production"
- [ ] `google-services.json` contains both debug + release SHA entries
- [ ] Google Sign-In works on physical device / emulator
