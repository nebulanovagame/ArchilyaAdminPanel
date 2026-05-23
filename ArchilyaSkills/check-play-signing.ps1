# Google Sign-In Play App Signing Diagnosis Script
# ArchilyaMobil - Play Store Edition
# Run: .\ArchilyaSkills\check-play-signing.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Google Sign-In Play App Signing Checker" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$googleServicesPath = "..\ArchilyaMobil\android\app\google-services.json"

if (-not (Test-Path $googleServicesPath)) {
    Write-Host "ERROR: google-services.json not found at: $googleServicesPath" -ForegroundColor Red
    Write-Host "Make sure you're running this from the repo root." -ForegroundColor Yellow
    exit 1
}

$json = Get-Content $googleServicesPath -Raw | ConvertFrom-Json

Write-Host "Project: $($json.project_info.project_id)" -ForegroundColor Green
Write-Host "Package: $($json.client[0].client_info.android_client_info.package_name)" -ForegroundColor Green
Write-Host "App ID:  $($json.client[0].client_info.mobilesdk_app_id)" -ForegroundColor Green
Write-Host ""

# Extract OAuth clients
$androidClients = $json.client[0].oauth_client | Where-Object { $_.client_type -eq 1 }
$webClient = $json.client[0].oauth_client | Where-Object { $_.client_type -eq 3 }

Write-Host "Registered Android OAuth Clients (SHA-1):" -ForegroundColor Yellow
Write-Host "------------------------------------------" -ForegroundColor Yellow

foreach ($client in $androidClients) {
    $hash = $client.android_info.certificate_hash
    $shortHash = $hash.Substring(0, 8) + "..."
    Write-Host "  SHA-1: $hash" -ForegroundColor White
    Write-Host "  Client: $($client.client_id)" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Web Client (for native auth):" -ForegroundColor Yellow
Write-Host "  $($webClient.client_id)" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSIS CHECKLIST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($androidClients.Count -lt 2) {
    Write-Host "WARNING: Only $($androidClients.Count) Android OAuth client found." -ForegroundColor Red
    Write-Host "Expected: At least 2 (debug + release)." -ForegroundColor Yellow
    Write-Host "If Play App Signing is active, you need 3 (debug + release + play signing)." -ForegroundColor Yellow
} else {
    Write-Host "OK: $($androidClients.Count) Android OAuth client(s) registered." -ForegroundColor Green
}

Write-Host ""
Write-Host "NEXT STEPS FOR PLAY APP SIGNING:" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open Google Play Console:" -ForegroundColor White
Write-Host "   https://play.google.com/console" -ForegroundColor Blue
Write-Host ""
Write-Host "2. Navigate to:" -ForegroundColor White
Write-Host "   Release → Setup → App Integrity" -ForegroundColor White
Write-Host ""
Write-Host "3. Find 'App signing key certificate' and copy SHA-1" -ForegroundColor White
Write-Host "   (This is Google's key, NOT your archilya-release.keystore)" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Open Firebase Console:" -ForegroundColor White
Write-Host "   https://console.firebase.google.com/project/nng-toma/settings/general/android:com.archilya.app" -ForegroundColor Blue
Write-Host ""
Write-Host "5. Click 'Add fingerprint' and paste the Play Console SHA-1" -ForegroundColor White
Write-Host "   Also add SHA-256 if available" -ForegroundColor White
Write-Host ""
Write-Host "6. Download fresh google-services.json and replace:" -ForegroundColor White
Write-Host "   ArchilyaMobil\android\app\google-services.json" -ForegroundColor White
Write-Host ""
Write-Host "7. Rebuild and test" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# Check for common issues
Write-Host ""
Write-Host "KNOWN HASHES IN THIS REPO:" -ForegroundColor Cyan
Write-Host "  Debug:    5e8f16062ea3cd2c4a0d547876baa6f38cabf625" -ForegroundColor Gray
Write-Host "  Release:  037c0ec137d50ee9a92e1909bd0388c124326a36" -ForegroundColor Gray
Write-Host "  (Play Signing hash should be DIFFERENT from both)" -ForegroundColor Yellow
Write-Host ""
