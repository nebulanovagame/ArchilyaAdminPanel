#!/usr/bin/env node
/**
 * Google Sign-In Build Automation
 * ArchilyaMobil - Play App Signing Edition
 * 
 * This script automates SHA-1 fingerprint verification and registration
 * for Google Sign-In on Android.
 * 
 * Usage:
 *   node build-google-auth-check.js --verify
 *   node build-google-auth-check.js --fix
 *   node build-google-auth-check.js --check-firebase
 *   node build-google-auth-check.js --check-playstore
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  projectId: 'nng-toma',
  packageName: 'com.archilya.app',
  androidAppId: '1:782938691094:android:c872ea938f1e1bbf54c737',
  googleServicesPath: 'android/app/google-services.json',
  serviceAccountKey: './google-services-key.json'
};

function log(message, color = 'white') {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
  };
  console.log(`${colors[color] || colors.white}${message}\x1b[0m`);
}

function runCommand(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      ...options 
    });
  } catch (error) {
    // Combine stdout and stderr
    return (error.stdout || '') + (error.stderr || '');
  }
}

function checkPrerequisites() {
  log('Checking prerequisites...', 'cyan');
  
  const checks = [
    { cmd: 'firebase --version', name: 'Firebase CLI' },
    { cmd: 'eas --version', name: 'EAS CLI' },
    { cmd: 'node --version', name: 'Node.js' }
  ];
  
  let allOk = true;
  for (const check of checks) {
    const result = runCommand(check.cmd);
    if (result.includes('not recognized') || result.includes('not found')) {
      log(`  ✗ ${check.name} not found`, 'red');
      allOk = false;
    } else {
      log(`  ✓ ${check.name}: ${result.trim()}`, 'green');
    }
  }
  
  if (!allOk) {
    log('\nPlease install missing tools:', 'yellow');
    log('  npm install -g firebase-tools eas-cli', 'gray');
    process.exit(1);
  }
}

function getLocalKeystoreSha1() {
  log('\nExtracting local keystore SHA-1...', 'cyan');
  
  const keystores = [
    {
      name: 'Debug',
      path: 'android/app/debug.keystore',
      alias: 'androiddebugkey',
      storepass: 'android'
    },
    {
      name: 'Release',
      path: 'android/app/archilya-release.keystore',
      alias: '82db165e9d4b4742e31d2398d22eb368',
      storepass: '321169352d7157e61999e733390622fe'
    }
  ];
  
  const results = {};
  
  for (const keystore of keystores) {
    if (!fs.existsSync(keystore.path)) {
      log(`  ✗ ${keystore.name} keystore not found: ${keystore.path}`, 'red');
      continue;
    }
    
    try {
      const output = runCommand(
        `keytool -list -v -keystore "${keystore.path}" -alias ${keystore.alias} -storepass ${keystore.storepass}`
      );
      
      const sha1Match = output.match(/SHA1:\s+([A-F0-9:]+)/i);
      if (sha1Match) {
        const sha1 = sha1Match[1].replace(/:/g, '').toLowerCase();
        results[keystore.name.toLowerCase()] = sha1;
        log(`  ✓ ${keystore.name} SHA-1: ${sha1}`, 'green');
      } else {
        log(`  ✗ Could not extract ${keystore.name} SHA-1`, 'red');
      }
    } catch (error) {
      log(`  ✗ Error reading ${keystore.name} keystore`, 'red');
    }
  }
  
  return results;
}

function getFirebaseShaHashes() {
  log('\nFetching registered SHA-1 hashes from Firebase...', 'cyan');
  
  try {
    const output = runCommand(
      `firebase apps:android:sha:list "${CONFIG.androidAppId}" --project ${CONFIG.projectId} --json`
    );
    
    // Remove ANSI color codes and progress messages
    const cleanOutput = output
      .replace(/\x1b\[[0-9;]*m/g, '')  // Remove ANSI codes
      .replace(/[┌┐└┘├┤┬┴┼─│]/g, '')   // Remove box drawing chars
      .replace(/^\s*[-√].*$/gm, '')     // Remove progress lines
      .trim();
    
    // Find JSON object
    const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log('  ✗ Could not parse Firebase output', 'red');
      log(`  Raw output: ${output.substring(0, 200)}...`, 'gray');
      return [];
    }
    
    const data = JSON.parse(jsonMatch[0]);
    
    if (data.error) {
      log(`  ✗ Firebase error: ${data.error.message}`, 'red');
      return [];
    }
    
    const hashes = data.result || [];
    const sha1Hashes = hashes
      .filter(h => h.certType === 'SHA_1' || h.shaHashType === 'SHA_1')
      .map(h => h.shaHash);
    
    log(`  ✓ Found ${sha1Hashes.length} SHA-1 hash(es)`, 'green');
    sha1Hashes.forEach(hash => log(`    - ${hash}`, 'gray'));
    
    return sha1Hashes;
  } catch (error) {
    log(`  ✗ Error fetching from Firebase: ${error.message}`, 'red');
    return [];
  }
}

function addShaToFirebase(shaHash) {
  log(`\nAdding SHA-1 to Firebase: ${shaHash}...`, 'yellow');
  
  try {
    const output = runCommand(
      `firebase apps:android:sha:create "${CONFIG.androidAppId}" "${shaHash}" --project ${CONFIG.projectId} --non-interactive`
    );
    
    if (output.includes('Error') || output.includes('error')) {
      log(`  ✗ Failed to add SHA-1`, 'red');
      log(`    ${output.trim()}`, 'gray');
      return false;
    }
    
    log(`  ✓ SHA-1 added successfully`, 'green');
    return true;
  } catch (error) {
    log(`  ✗ Error: ${error.message}`, 'red');
    return false;
  }
}

function refreshGoogleServicesJson() {
  log('\nRefreshing google-services.json...', 'cyan');
  
  try {
    if (fs.existsSync(CONFIG.googleServicesPath)) {
      fs.unlinkSync(CONFIG.googleServicesPath);
    }
    
    runCommand(
      `firebase apps:sdkconfig android "${CONFIG.androidAppId}" --out "${CONFIG.googleServicesPath}" --project ${CONFIG.projectId} --non-interactive`
    );
    
    if (fs.existsSync(CONFIG.googleServicesPath)) {
      log('  ✓ google-services.json refreshed', 'green');
      return true;
    } else {
      log('  ✗ Failed to refresh google-services.json', 'red');
      return false;
    }
  } catch (error) {
    log(`  ✗ Error: ${error.message}`, 'red');
    return false;
  }
}

function verifyGoogleServicesJson() {
  log('\nVerifying google-services.json...', 'cyan');
  
  if (!fs.existsSync(CONFIG.googleServicesPath)) {
    log('  ✗ google-services.json not found!', 'red');
    return false;
  }
  
  try {
    const content = fs.readFileSync(CONFIG.googleServicesPath, 'utf8');
    const data = JSON.parse(content);
    
    const client = data.client?.[0];
    if (!client) {
      log('  ✗ Invalid google-services.json structure', 'red');
      return false;
    }
    
    const androidClients = client.oauth_client?.filter(c => c.client_type === 1) || [];
    const webClients = client.oauth_client?.filter(c => c.client_type === 3) || [];
    
    log(`  ✓ Package name: ${client.client_info?.android_client_info?.package_name}`, 'green');
    log(`  ✓ Android OAuth clients: ${androidClients.length}`, 'green');
    log(`  ✓ Web OAuth clients: ${webClients.length}`, 'green');
    
    if (androidClients.length < 2) {
      log(`  ⚠ Warning: Expected at least 2 Android OAuth clients`, 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`  ✗ Error parsing google-services.json: ${error.message}`, 'red');
    return false;
  }
}

async function checkPlayStoreBundles() {
  log('\nChecking Play Store bundle SHA-1 hashes...', 'cyan');
  
  try {
    const { google } = require('googleapis');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: CONFIG.serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    
    const androidpublisher = google.androidpublisher({ version: 'v3', auth });
    
    const edit = await androidpublisher.edits.insert({
      packageName: CONFIG.packageName,
    });
    
    const bundles = await androidpublisher.edits.bundles.list({
      packageName: CONFIG.packageName,
      editId: edit.data.id,
    });
    
    await androidpublisher.edits.delete({
      packageName: CONFIG.packageName,
      editId: edit.data.id,
    });
    
    const bundleList = bundles.data.bundles || [];
    
    if (bundleList.length === 0) {
      log('  ℹ No bundles found in Play Store', 'gray');
      return [];
    }
    
    log(`  ✓ Found ${bundleList.length} bundle(s):`, 'green');
    const hashes = [];
    
    bundleList.forEach(bundle => {
      log(`    Version ${bundle.versionCode}:`, 'gray');
      log(`      SHA-1: ${bundle.sha1}`, 'gray');
      log(`      SHA-256: ${bundle.sha256}`, 'gray');
      hashes.push(bundle.sha1);
    });
    
    return hashes;
  } catch (error) {
    log(`  ✗ Error accessing Play Store API: ${error.message}`, 'red');
    log(`    Ensure service account has Android Publisher API access`, 'gray');
    return [];
  }
}

function syncPlayStoreHashes(playStoreHashes, firebaseHashes) {
  log('\nSyncing Play Store hashes with Firebase...', 'cyan');
  
  const missingHashes = playStoreHashes.filter(h => !firebaseHashes.includes(h));
  
  if (missingHashes.length === 0) {
    log('  ✓ All Play Store hashes are already registered', 'green');
    return true;
  }
  
  log(`  Found ${missingHashes.length} missing hash(es)`, 'yellow');
  
  let allSuccess = true;
  for (const hash of missingHashes) {
    const success = addShaToFirebase(hash);
    if (!success) allSuccess = false;
  }
  
  if (allSuccess) {
    refreshGoogleServicesJson();
  }
  
  return allSuccess;
}

// Main functions
async function verifyOnly() {
  log('========================================', 'cyan');
  log('Google Sign-In Verification Mode', 'cyan');
  log('========================================', 'cyan');
  
  checkPrerequisites();
  const localHashes = getLocalKeystoreSha1();
  const firebaseHashes = getFirebaseShaHashes();
  verifyGoogleServicesJson();
  
  log('\n========================================', 'cyan');
  log('Verification Complete', 'cyan');
  log('========================================', 'cyan');
  
  if (localHashes.debug && !firebaseHashes.includes(localHashes.debug)) {
    log('⚠ Debug keystore SHA-1 NOT registered in Firebase', 'yellow');
  }
  if (localHashes.release && !firebaseHashes.includes(localHashes.release)) {
    log('⚠ Release keystore SHA-1 NOT registered in Firebase', 'yellow');
  }
  
  log(`\nTotal Firebase SHA-1 hashes: ${firebaseHashes.length}`, 'white');
  log('Run with --fix to automatically register missing hashes', 'gray');
}

async function fixMode() {
  log('========================================', 'cyan');
  log('Google Sign-In Fix Mode', 'cyan');
  log('========================================', 'cyan');
  
  checkPrerequisites();
  const localHashes = getLocalKeystoreSha1();
  const firebaseHashes = getFirebaseShaHashes();
  
  let needsRefresh = false;
  
  // Check local keystores
  if (localHashes.debug && !firebaseHashes.includes(localHashes.debug)) {
    if (addShaToFirebase(localHashes.debug)) needsRefresh = true;
  }
  if (localHashes.release && !firebaseHashes.includes(localHashes.release)) {
    if (addShaToFirebase(localHashes.release)) needsRefresh = true;
  }
  
  // Check Play Store bundles
  const playStoreHashes = await checkPlayStoreBundles();
  const playStoreMissing = playStoreHashes.filter(h => !firebaseHashes.includes(h));
  
  if (playStoreMissing.length > 0) {
    log(`\nFound ${playStoreMissing.length} Play Store hash(es) not in Firebase`, 'yellow');
    for (const hash of playStoreMissing) {
      if (addShaToFirebase(hash)) needsRefresh = true;
    }
  }
  
  if (needsRefresh) {
    refreshGoogleServicesJson();
  }
  
  verifyGoogleServicesJson();
  
  log('\n========================================', 'cyan');
  log('Fix Complete', 'cyan');
  log('========================================', 'cyan');
  log('Next: Build and test Google Sign-In', 'white');
}

async function checkPlayStoreOnly() {
  log('========================================', 'cyan');
  log('Play Store Bundle Check', 'cyan');
  log('========================================', 'cyan');
  
  const playStoreHashes = await checkPlayStoreBundles();
  const firebaseHashes = getFirebaseShaHashes();
  
  syncPlayStoreHashes(playStoreHashes, firebaseHashes);
}

async function checkFirebaseOnly() {
  log('========================================', 'cyan');
  log('Firebase SHA-1 Check', 'cyan');
  log('========================================', 'cyan');
  
  const firebaseHashes = getFirebaseShaHashes();
  verifyGoogleServicesJson();
  
  log(`\nTotal SHA-1 hashes in Firebase: ${firebaseHashes.length}`, 'white');
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Google Sign-In Build Automation for ArchilyaMobil

Usage:
  node build-google-auth-check.js [options]

Options:
  --verify          Verify local keystores and Firebase registration (default)
  --fix             Fix missing SHA-1 hashes in Firebase
  --check-firebase  Check only Firebase registered hashes
  --check-playstore Check Play Store bundles and sync with Firebase
  --help            Show this help message

Examples:
  node build-google-auth-check.js --verify
  node build-google-auth-check.js --fix
  node build-google-auth-check.js --check-playstore
`);
    return;
  }
  
  if (args.includes('--fix')) {
    await fixMode();
  } else if (args.includes('--check-firebase')) {
    await checkFirebaseOnly();
  } else if (args.includes('--check-playstore')) {
    await checkPlayStoreOnly();
  } else {
    await verifyOnly();
  }
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});
