const { google } = require('googleapis');
const path = require('path');

async function checkPlayStoreStatus() {
  const keyFile = 'C:\\Users\\PC\\Desktop\\opencode-playstore-6996cdb18210.json';
  const packageName = 'com.archilya.app';

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  const androidpublisher = google.androidpublisher({
    version: 'v3',
    auth,
  });

  try {
    console.log('Play Store API sorgulanıyor...\n');

    // 1. Uygulama listesi / edit oluşturma denemesi
    const appEditRes = await androidpublisher.edits.insert({
      packageName,
    });
    const editId = appEditRes.data.id;
    console.log('✓ API erişimi aktif. Edit ID:', editId);

    // 2. Track'leri listele
    const tracksRes = await androidpublisher.edits.tracks.list({
      packageName,
      editId,
    });

    console.log('\n📦 Yayın Kanalları (Tracks):');
    console.log('----------------------------------------');

    if (!tracksRes.data.tracks || tracksRes.data.tracks.length === 0) {
      console.log('Henüz hiçbir yayın kanalı bulunamadı.');
    } else {
      for (const track of tracksRes.data.tracks) {
        const trackName = track.track;
        const releases = track.releases || [];
        
        console.log(`\n🚩 Kanal: ${trackName.toUpperCase()}`);
        
        if (releases.length === 0) {
          console.log('   Durum: Boş (henüz sürüm yüklenmemiş)');
        } else {
          for (const release of releases) {
            const status = release.status || 'bilinmiyor';
            const versionCodes = release.versionCodes || [];
            const name = release.name || 'İsimsiz';
            
            console.log(`   Sürüm: ${name}`);
            console.log(`   Durum: ${status}`);
            console.log(`   Version Kodları: ${versionCodes.join(', ')}`);
            
            if (release.userFraction) {
              console.log(`   Kullanıcı Oranı: %${(release.userFraction * 100).toFixed(1)}`);
            }
          }
        }
      }
    }

    // Edit'i silelim (temizlik)
    await androidpublisher.edits.delete({
      packageName,
      editId,
    });

    console.log('\n----------------------------------------');
    console.log('✅ Sorgu tamamlandı.');

  } catch (error) {
    console.error('\n❌ HATA:', error.message);
    
    if (error.code === 403) {
      console.error('\nGoogle Play Developer API aktif değil veya izin eksik.');
      console.error('Google Cloud Console → API Library → "Google Play Android Developer API" aktif edin.');
    }
    if (error.code === 404) {
      console.error('\nUygulama bulunamadı. Package name yanlış olabilir.');
    }
    if (error.code === 401) {
      console.error('\nService account yetkisi eksik. Play Console → API erişimi → izinleri kontrol edin.');
    }
  }
}

checkPlayStoreStatus();
