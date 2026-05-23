# Google Cloud Console OAuth Client SHA-1 Checklist
# ArchilyaMobil - nng-toma project
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Problem
Google Cloud Console OAuth 2.0 Client IDs must have the SAME SHA-1 fingerprints
as Firebase Console. If they don't match, Google Sign-In fails with:
"Google OAuth ayarlari gecersiz. Android package adi, SHA-1/SHA-256 ve client ID eslesmesini kontrol edin."

## Why I Cannot Do This Automatically
The service account key (google-services-key.json) is for project "opencode-playstore"
and only has Play Store API access. It does NOT have permission to manage OAuth clients
in the "nng-toma" project's Google Cloud Console.

## Required SHA-1 Fingerprints (10 total)

The following SHA-1 hashes MUST be registered in Google Cloud Console
for Android OAuth client IDs:

### Local Keystore Hashes (2)
1. Debug keystore:     5e8f16062ea3cd2c4a0d547876baa6f38cabf625
2. Release keystore:   037c0ec137d50ee9a92e1909bd0388c124326a36

### Play Store Bundle Hashes (9 bundles)
3.  Bundle v2:         f88a3ee811a88858f4c355b652add7fff77a56f2
4.  Bundle v4:         5be18783292daa7547ca7fa910b946dd61a384f3
5.  Bundle v5:         e3bdca201531f37457569c1f47be180380f3df57
6.  Bundle v6:         ecf45186c90c3a94655212b26b1800fd4a8519a1
7.  Bundle v7:         b5964f643328854b4382a2523bedbb64687091a8
8.  Bundle v9:         ddfd285bbfb40ea189239abfdc3396e1926063e4
9.  Bundle v10:        e452e7af6b026dc1290875adccdc5a45b51332a2
10. Bundle v11:        1f09e8324632145833288bda14f60b0046fefd58
11. Bundle v12:        e053fa3d483b8dd500bd3d14d4a6a43ad00b1cbc

## Manual Steps

### Step 1: Open Google Cloud Console
URL: https://console.cloud.google.com/apis/credentials?project=nng-toma

### Step 2: Find Android OAuth Clients
Look for OAuth 2.0 Client IDs of type "Android".
You should see clients like:
- 782938691094-aovg2r9d70pnkk5j57hrj9j5mv5ln5to.apps.googleusercontent.com
- 782938691094-5qv6vkdkdejbb5oqt2f6un2l5c2i2egf.apps.googleusercontent.com
- (and 9 more with different IDs)

### Step 3: Check SHA-1 Fingerprints
For EACH Android OAuth client:
1. Click the client name
2. Look at "SHA-1 certificate fingerprint" field
3. Compare with the list above

### Step 4: Add Missing SHA-1
If any SHA-1 from the list above is missing:
1. Click "EDIT" (pencil icon)
2. In "Restrictions" section, find "SHA-1 certificate fingerprint"
3. Click "ADD AN ITEM"
4. Paste the missing SHA-1 hash
5. Click "SAVE"

### Step 5: Verify All Hashes
After adding all missing hashes:
- You should have 11 Android OAuth clients (or more)
- Each client has 1 SHA-1 fingerprint
- Total: 11 SHA-1 fingerprints registered

## Important Notes

1. It is OK to have multiple Android OAuth clients for the same package name
   (com.archilya.app) with different SHA-1 fingerprints.

2. Do NOT delete existing clients unless you are certain they are not used.

3. If a SHA-1 hash is already present in one client, you don't need to add it again.

4. The Web client (client_type: 3) does NOT need SHA-1 fingerprints.

5. Changes take effect immediately (no propagation delay).

## Verification After Manual Update

Run this command to verify Firebase has all hashes:
```bash
firebase apps:android:sha:list "1:782938691094:android:c872ea938f1e1bbf54c737" --project nng-toma
```

Expected output: 11 SHA_1 entries (or more if you added extras).

## Quick Reference: Android OAuth Client IDs

Currently registered in google-services.json:
- 782938691094-42iqe0igm1ioudq2gf1bqljp84i403u5 (bundle v11)
- 782938691094-5qv6vkdkdejbb5oqt2f6un2l5c2i2egf (debug)
- 782938691094-7u3ud0rc35egg075shk29j1jirb9eeem (bundle v4)
- 782938691094-aovg2r9d70pnkk5j57hrj9j5mv5ln5to (release)
- 782938691094-cq7f0bivimp0903h4q8ec3ittki2flfj (bundle v10)
- 782938691094-dr5j3qv5fskqltie65h9as0m0dhphsdc (bundle v6)
- 782938691094-f3md93sj409gi42f2n01rd58e96v1nmj (bundle v12)
- 782938691094-hu782vmt7ulnvqh7ddu7sjtrnq9lo1qs (bundle v5)
- 782938691094-ifv2n67pkat4rcskr61vkm96n72ulhef (bundle v9)
- 782938691094-pevp6j21jf7k9d8l4hfdl7728n4ki29t (bundle v7)

## Need Help?

If you cannot access Google Cloud Console or need assistance:
1. Make sure you're logged in with the correct Google account
2. The account must have "Editor" or "Owner" role in the nng-toma project
3. If using a work/school account, admin might need to enable Google Cloud Console access

## After Google Cloud Console Update

1. Download fresh google-services.json from Firebase Console
2. Replace: ArchilyaMobil/android/app/google-services.json
3. Rebuild the app: eas build --profile production --platform android
4. Test Google Sign-In on the new build
