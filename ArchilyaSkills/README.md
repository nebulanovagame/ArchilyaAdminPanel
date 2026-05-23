# Archilya Skill Set

## Available Skills

### 1. `build-and-submit`
**Trigger:** "Build and submit Android", "Deploy to Play Store", "New release"  
**File:** `skills/build-and-submit.md`  
**Scope:** Full AAB build, signing verification, Firebase SHA-1 check, and Google Play Console submission.

### 2. `fix-google-signin`
**Trigger:** "Google login not working", "developer_error", "config mismatch", "Google OAuth ayarlari gecersiz"  
**File:** `skills/fix-google-signin.md`  
**Scope:** Diagnose and fix Firebase SHA-1 / package name / client ID mismatches that break Google Sign-In on Android. Self-healing: extracts keystores, adds fingerprints to Firebase Console, refreshes `google-services.json`.

### 3. `create-test-user` (integrated in build-and-submit)
**Trigger:** "Create test account", "Google Play tester", "Firebase test user"  
**Scope:** Creates Auth user + Firestore document with studio plan and 10,000 credits.

## How to Use

Simply tell the agent:
```
"Build and submit the Android app"
```

The agent will:
1. Auto-detect all required files and credentials
2. Verify Firebase SHA-1 fingerprints (debug + release) are registered
3. Download fresh `google-services.json` if needed
4. Increment versionCode in both `app.json` and `build.gradle`
5. Run local Gradle build
6. Verify signing fingerprint
7. Submit to Play Console (production or internal track)
8. Report status with submission URL

If Google Sign-In is broken:
```
"Fix Google login"
```

The agent will:
1. Extract SHA-1 from all keystores (debug, release, EAS)
2. Compare against Firebase Console registrations
3. Add any missing fingerprints
4. Refresh `google-services.json`
5. Rebuild and submit if requested

If you also need a test account:
```
"Build, submit, and create a test user"
```

## Manual Override Flags
- **Internal testing:** Add "to internal track" to submit to Internal Testing instead of Production
- **Skip build:** Add "resubmit existing" if AAB is already built
- **Force keystore update:** Add "update keystore" if EAS remote credentials changed
- **Fix auth only:** Add "just fix Google login" to skip build/submit

## Skill Dependency Graph
```
build-and-submit
├── fix-google-signin (pre-build SHA verification)
├── versionCode sync
├── Gradle build
├── signing verification
└── Play Console submit

fix-google-signin
├── keystore extraction
├── Firebase SHA comparison
├── SHA registration (if missing)
└── google-services.json refresh
```
