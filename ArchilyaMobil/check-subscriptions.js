const { google } = require('googleapis');
const path = require('path');

async function checkPlayStoreSubscriptions() {
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
    console.log('Play Store API ile abonelikler sorgulanıyor...\n');

    // 1. Tüm ürünleri listele (in-app + subscription)
    const productsRes = await androidpublisher.inappproducts.list({
      packageName,
    });

    console.log('📦 Ürünler (In-app Products):');
    console.log('----------------------------------------');
    
    if (!productsRes.data.inappproduct || productsRes.data.inappproduct.length === 0) {
      console.log('Henüz hiç ürün bulunamadı.');
    } else {
      for (const product of productsRes.data.inappproduct) {
        const sku = product.sku;
        const status = product.status;
        const purchaseType = product.purchaseType;
        const defaultPrice = product.defaultPrice;
        
        console.log(`\n🆔 SKU: ${sku}`);
        console.log(`   Durum: ${status}`);
        console.log(`   Tip: ${purchaseType}`);
        if (defaultPrice) {
          console.log(`   Fiyat: ${defaultPrice.priceMicros} micros (${defaultPrice.currency})`);
        }
        
        if (product.subscriptionPeriod) {
          console.log(`   Abonelik Periyot: ${product.subscriptionPeriod}`);
        }
        if (product.listings && product.listings['tr-TR']) {
          const trListing = product.listings['tr-TR'];
          console.log(`   TR Başlık: ${trListing.title}`);
          console.log(`   TR Açıklama: ${trListing.description}`);
        }
      }
    }

    // 2. Subscription ürünleri (inappproducts.list zaten hepsini getirir, 
    // ama abonelik özel bilgileri için ayrıca getirelim)
    console.log('\n\n📋 Subscription Detayları:');
    console.log('----------------------------------------');
    
    const subscriptionSkus = [
      'pro_monthly',
      'pro_annual', 
      'studio_monthly',
      'studio_annual'
    ];

    for (const sku of subscriptionSkus) {
      try {
        const productRes = await androidpublisher.inappproducts.get({
          packageName,
          sku,
        });
        
        const product = productRes.data;
        console.log(`\n✅ ${sku} - BULUNDU`);
        console.log(`   Durum: ${product.status}`);
        if (product.defaultPrice) {
          const priceTry = Number(product.defaultPrice.priceMicros) / 1000000;
          console.log(`   Fiyat: ${priceTry} ${product.defaultPrice.currency}`);
        }
        if (product.subscriptionPeriod) {
          console.log(`   Periyot: ${product.subscriptionPeriod}`);
        }
        if (product.listings) {
          const locales = Object.keys(product.listings);
          console.log(`   Lokaller: ${locales.join(', ')}`);
        }
        
        // Abonelik özel detayları
        if (product.subscriptionPricing) {
          console.log(`   Fiyatlandırma Modu: ${product.subscriptionPricing.pricingMode}`);
        }
        if (product.taxCompliance) {
          console.log(`   Vergi Uyumu: ${JSON.stringify(product.taxCompliance)}`);
        }
        
      } catch (err) {
        if (err.code === 404) {
          console.log(`\n❌ ${sku} - BULUNAMADI (Henüz oluşturulmamış)`);
        } else {
          console.log(`\n⚠️ ${sku} - HATA: ${err.message}`);
        }
      }
    }

    console.log('\n----------------------------------------');
    console.log('✅ Sorgu tamamlandı.');
    console.log('\n📝 Not: API erişimi sadece mevcut ürünleri GÖRÜNTÜLEME yetkisine sahiptir.');
    console.log('   Yeni ürün oluşturma, fiyat güncelleme gibi işlemler için');
    console.log('   Play Console web arayüzü kullanılmalıdır.');

  } catch (error) {
    console.error('\n❌ HATA:', error.message);
    
    if (error.code === 403) {
      console.error('\nAPI erişim izni eksik veya Google Play Android Developer API aktif değil.');
    }
    if (error.code === 404) {
      console.error('\nPackage name bulunamadı.');
    }
  }
}

checkPlayStoreSubscriptions();
