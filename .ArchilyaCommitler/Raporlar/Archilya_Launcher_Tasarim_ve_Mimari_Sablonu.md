# Archilya Launcher v2.0 — Tasarim ve Mimari Sablonu

**Proje:** Archilya Masaustu Launcher (Desktop Client v2.0)  
**Hazirlayan:** Kurmay Muhendis  
**Tarih:** 2026-05-01  
**Durum:** Mimari Tasarim ve Sablonlama  
**Teknoloji Stack:** Electron (veya Tauri), TypeScript, Node.js, chokidar, Firebase Admin SDK, Unreal Engine Asset Pipeline  

---

## Executive Summary

Archilya Launcher v2.0, mimarinin merkezinde **"yerel-first, bulut-senkron"** paradigmasiyla konumlandirilmistir. Kullanici kendi bilgisayarindaki `Belgelerim/Archilya` klasorunu bir **canli workspace** olarak kullanir; yapilan her degisiklik (yeni dosya, silme, guncelleme) arka planda Web Panel ve Mobil ile senkronize olur. Ayni sekilde Web veya Mobil'den yuklenen bir dosya, aninda masaustune iner.

Tasarimin uc ana diregi vardir:
1. **Tahmin Edilebilir Klasor Hiyerarsisi** — Kullanici dosyalarini nerede bulacagini her zaman bilir.
2. **Gorunmez Senkronizasyon** — Senkronizasyon bir "islem" degil, arka plan hizmetidir.
3. **Cakisma Guvenligi** — Ayni dosyanin birden fazla yerde degistirilmesi durumunda veri kaybi olmaz.

---

## 1. Yerel Klasor Hiyerarsisi

### 1.1 Felsefe

Klasor yapisi **"kullanici dostu"** ve **"programatik erisilebilir"** olmalidir. Kullanici dogrudan `Belgelerim/Archilya` klasorune gidip dosya yoneticisi ile calisabilmelidir. Launcher, bu klasoru izler ve degisiklikleri buluta yansitir.

### 1.2 Klasor Agaci (ASCII)

```
%USERPROFILE%\Documents\Archilya\          <-- Kok dizin (kullanici tarafindan degistirilebilir)
|
├── Projects\                              <-- Senkronize edilen proje dosyalari (CAD, PDF, IMG)
│   ├── Proje_Alpha\                       <-- Her proje bir klasordur; ismi Web Panel ile ayni
│   │   ├── CAD/
│   │   │   ├── tasarim_v1.dwg
│   │   │   └── tasarim_v2.dwg
│   │   ├── PDF/
│   │   │   └── rapor.pdf
│   │   ├── Images/
│   │   │   └── render_onizleme.png
│   │   └── .archilya-meta.json            <-- Proje metadata (ID, son senkronizasyon tarihi)
│   └── Proje_Beta\
│       └── ...
│
├── UnrealAssets\                          <-- Unreal Engine PAK dosyalari ve asset'ler
│   ├── Paks\                               <-- Derlenmis .pak dosyalari
│   │   └── Archilya_Content.pak
│   ├── Source\                             <-- Kaynak asset'ler (FBX, uasset, texture)
│   │   └── Characters/
│   │       └── Hero_Mesh.fbx
│   └── Maps\                               <-- Unreal level dosyalari
│       └── Level_01.umap
│
├── Downloads\                              <-- Web/Mobil'den indirilen dosyalarin gecici kuyrugu
│   ├── incoming/
│   │   └── [proje-id]_[dosya-adı].tmp
│   └── completed/
│       └── (basarili indirme sonrasi Projects'e tasınır)
│
├── Trash\                                 <-- Cop Kutusu (30 gun retention)
│   ├── 2026-05-01_Proje_Alpha_render.png   <-- Silinen dosyalar zaman damgali olarak tutulur
│   └── ...
│
├── Cache\                                  <-- Uygulama onbellegi (kullanici tarafindan silinebilir)
│   ├── Thumbnails\                         -- Proje onizleme gorselleri (128x128, 256x256)
│   ├── SyncState\                          -- Son senkronizasyon durum dosyalari (JSON)
│   └── Logs\                               -- Uygulama loglari (7 gunluk rotation)
│       └── launcher_2026-05-01.log
│
└── Config\                                 -- Kullanici ayarlari ve kimlik dogrulama
    ├── settings.json                        -- Tercihler (tema, bildirim, senkronizasyon araligi)
    ├── auth.token                           -- Firebase ID Token (sifreli)
    └── sync.db                              -- SQLite: yerel dosya hash'leri, durumlar
```

### 1.3 Klasorlerin Amaclari

| Klasor | icerik | Senkronize mi? | Temizlenebilir mi? |
|--------|--------|----------------|-------------------|
| `Projects/` | Kullanicinin proje dosyalari (CAD, PDF, IMG) | **Evet** (iki yonlu) | Hayir (kullanici verisi) |
| `UnrealAssets/` | Unreal Engine PAK ve kaynak dosyalari | Kismen (PAK'lar Storage'a, source yerel kalir) | Hayir |
| `Downloads/` | Gecici indirme kuyrugu | Gecici | Evet (otomatik) |
| `Trash/` | Silinen dosyalar (30 gun) | Evet (Web/Mobil cop kutusu ile senkron) | Evet (30 gun sonra otomatik) |
| `Cache/` | Onbellek, loglar, thumbnail'ler | Hayir | Evet (guvenli) |
| `Config/` | Ayarlar, tokenlar, local DB | Hayir | Hayir (token haric yeniden olusturulabilir) |

### 1.4 Proje Klasorunun Icerigi

Her proje klasoru (ornegin `Projects/Proje_Alpha/`) su alt klasorlere sahiptir:

```
Proje_Alpha/
├── CAD/                    -- .dwg, .dxf, .step dosyalari
├── PDF/                    -- .pdf raporlar, cizimler
├── Images/                 -- .png, .jpg, .exr render ciktilari
├── AIStudio/               -- AI tarafindan uretilen gorseller
│   ├── Renders/
│   └── Upscaled/
├── Documents/              -- .docx, .xlsx, genel dokumanlar
└── .archilya-meta.json     -- Gizli metadata dosyasi
```

**`.archilya-meta.json` Ornegi:**
```json
{
  "projectId": "proj_abc123",
  "firebasePath": "projects/proj_abc123",
  "lastSyncedAt": "2026-05-01T14:30:00Z",
  "localVersion": 12,
  "remoteVersion": 12,
  "isArchived": false,
  "syncEnabled": true,
  "ignorePatterns": ["*.tmp", "*.bak", "Thumbs.db"]
}
```

---

## 2. UI/UX Ekran Tasarimi

### 2.1 Felsefe

Launcher arayuzu, **modern SaaS masaustu uygulamalari** (Figma Desktop, Notion, Linear) referans alinarak tasarlanir:
- **Sol Sidebar:** Surekli gorunur navigasyon (sabit genislik: 240px)
- **Orta Icerik Alan:** Baglamsal icerik (grid, liste, detay)
- **Sag Detay Panel:** Opsiyonel (dosya ozellikleri, aktivite gecmisi)
- **Ust Toolbar:** Arama, senkronizasyon durumu, kullanici profili
- **Alt Status Bar:** Disk kullanimi, aktif senkronizasyon, baglanti durumu

### 2.2 Ana Pencere Iskeleti

```
+-------------------------------------------------------------+
|  [A] Toolbar (60px yukseklik)                               |
|  [Archilya Logo]  Arama...          [Sync: ✓]  [Kullanici]  |
+----------+----------------------------------------+---------+
|          |                                        |         |
| [B]      |  [C] Ana Icerik Alani                  | [D]     |
| Sidebar  |                                        | Detay   |
| (240px)  |                                        | Panel   |
|          |                                        | (280px) |
|          |                                        |         |
| Dashboard|  +----------------------------------+  |         |
| Projeler |  |  Grid / Liste / Detay            |  |         |
| Indirme  |  |                                  |  |         |
| Kuyrugu  |  |  [Kartlar] [Kartlar] [Kartlar]   |  |         |
| Senkron  |  |  [Kartlar] [Kartlar] [Kartlar]   |  |         |
| Durumu   |  |                                  |  |         |
| Cop      |  |                                  |  |         |
| Kutusu   |  +----------------------------------+  |         |
|          |                                        |         |
| AI       |                                        |         |
| Studio   |                                        |         |
|          |                                        |         |
| Ayarlar  |                                        |         |
|          |                                        |         |
+----------+----------------------------------------+---------+
|  [E] Status Bar (28px)                                      |
|  [Disk: 14.2 GB]  [Sync: Tum dosyalar senkronize]  [v2.0.1] |
+-------------------------------------------------------------+
```

### 2.3 Ekranlarin Detayli Tanimi

#### 2.3.1 Dashboard (Ana Sayfa)

**Amac:** Kullanicinin gunluk aktivite ozeti ve hizli erisim noktalari.

```
+-------------------------------------------------------------+
|  Hos Geldin, Ahmet Yilmaz          [14:30]  [Sync: ✓]      |
+-------------------------------------------------------------+
|  +-------------------+  +-------------------+  +---------+  |
|  | Aktif Projeler    |  | Son Senkronize    |  | Kredi   |  |
|  | [12]              |  | 2 dk once         |  | 450     |  |
|  +-------------------+  +-------------------+  +---------+  |
|                                                             |
|  Hizli Eylemler:                                           |
|  [+ Yeni Proje Olustur]  [AI Studio'yu Ac]  [Cop Kutusu]   |
|                                                             |
|  Son Dosyalar (Son 24 saat):                                |
|  +------------+ +------------+ +------------+ +------------+ |
|  | [PDF ikon] | | [CAD ikon] | | [IMG ikon] | | [PDF ikon] | |
|  | Rapor.pdf  | | Tasarim.dwg| | Render.png | | Plan.pdf   | |
|  | Proje_A    | | Proje_A    | | Proje_B    | | Proje_C    | |
|  | 2 MB       | | 14 MB      | | 8 MB       | | 3 MB       | |
|  +------------+ +------------+ +------------+ +------------+ |
+-------------------------------------------------------------+
```

**Bilesenler:**
- **Karsilama Banner:** Kullanici adi, tarih, senkronizasyon durumu
- **Istatistik Kartlari:** Aktif proje sayisi, son senkronizasyon zaman damgasi, mevcut kredi
- **Hizli Eylem Bar:** En sik kullanilan 3-5 eylem (proje olustur, AI ac, cop kutusu)
- **Son Dosyalar Grid'i:** Son 24 saatte senkronize olan dosyalar (thumbnail + metadata)

#### 2.3.2 Projeler (Proje Grid'i)

**Amac:** Tum projelerin gorunumu, arama, filtreleme, siralama.

```
+-------------------------------------------------------------+
|  Projeler                              [Liste] [Grid] [A-Z] |
|  [Arama projeler...]  [Filtre: Tumu ▼]  [+ Yeni Proje]      |
+-------------------------------------------------------------+
|  +-------------------+  +-------------------+  +---------+  |
|  | [Proje Thumbnail] |  | [Proje Thumbnail] |  | [Tmbnl] |  |
|  | Proje Alpha       |  | Proje Beta        |  | Gama    |  |
|  | 24 dosya | 1.2 GB |  | 8 dosya | 450 MB  |  | 3 | 120MB|  |
|  | Son: 2 saat once  |  | Son: Dun          |  | Dun     |  |
|  | [Sync: ✓]         |  | [Sync: ~]         |  | [Sync:✓]|  |
|  +-------------------+  +-------------------+  +---------+  |
|  +-------------------+  +-------------------+               |
|  | [Proje Thumbnail] |  | [Proje Thumbnail] |               |
|  | Proje Delta       |  | Proje Epsilon     |               |
|  | ...               |  | ...               |               |
|  +-------------------+  +-------------------+               |
+-------------------------------------------------------------+
```

**Kart Bilesenleri:**
- **Thumbnail:** Projedeki ilk goruntu dosyasinin onizlemesi (veya varsayilan ikon)
- **Proje Adi:** Kullanici tarafindan verilen isim
- **Dosya Ozeti:** "X dosya | Y GB"
- **Son Aktivite:** "2 saat once", "Dun"
- **Senkronizasyon Durumu:**
  - `✓` — Tamamen senkronize
  - `~` — Senkronizasyon devam ediyor
  - `!` — Hata / Cakisma var

#### 2.3.3 Indirme Kuyrugu

**Amac:** Web/Mobil'den gelen dosyalarin ve yerelden buluta yuklenen dosyalarin kuyruk yonetimi.

```
+-------------------------------------------------------------+
|  Indirme Kuyrugu                              [Tumunu Temizle]|
+-------------------------------------------------------------+
|  DEVAM EDEN (2)                                             |
|  [=================>    ]  Rapor_v2.pdf  (45 MB / 120 MB)   |
|  [====>                ]  Tasarim.dwg   (12 MB / 80 MB)    |
|                                                             |
|  BEKLEYEN (3)                                               |
|  [Bekliyor]  Render_Final.png  (proje: Alpha)               |
|  [Bekliyor]  Maliyet_Raporu.xlsx (proje: Beta)              |
|  [Bekliyor]  Karakter_Pak.fbx (proje: Gama)                 |
|                                                             |
|  TAMAMLANAN (Bugun)                                         |
|  [✓]  Plan_A1.pdf  --  14:30  --  8 MB                      |
|  [✓]  Texture_01.png  --  14:28  --  24 MB                   |
|  [✓]  Level_02.umap  --  14:15  --  156 MB                  |
+-------------------------------------------------------------+
```

**Ozellikler:**
- **Iptal:** Bekleyen veya devam eden bir islem iptal edilebilir
- **Yeniden Dene:** Hata alan bir islem tek tikla tekrar baslatilabilir
- **Oncelik:** Dosyalar surukle-birak ile kuyrukta yeniden siralanabilir
- **Simultane Limit:** Varsayilan olarak 3 paralel indirme/yukleme

#### 2.3.4 Senkronizasyon Durumu

**Amac:** Tum senkronizasyonun saglik kontrolu, hata ayiklama, cakisma cozumu.

```
+-------------------------------------------------------------+
|  Senkronizasyon Durumu                    [Simdi Senkronize Et]|
+-------------------------------------------------------------+
|  Genel Durum: [✓ Tum dosyalar senkronize]                  |
|                                                             |
|  SON SENKRONIZASYON: 2 dakika once                          |
|  YON: Yerel -> Bulut                                        |
|  BASARILI: 24 dosya                                         |
|  ATLANDI: 2 dosya (ignore listesi)                         |
|                                                             |
|  AKTIVITE GECMISI (Son 50 islem)                            |
|  [✓] 14:32  Yuklendi: Proje_Alpha/Render.png               |
|  [✓] 14:30  Indirildi: Proje_Beta/Rapor.pdf                |
|  [!] 14:28  CAKISMA: Proje_Alpha/Tasarim.dwg               |
|  [✓] 14:25  Yuklendi: Proje_Gama/Karakter.fbx              |
|                                                             |
|  CAKISMALAR (1)                                             |
|  [!] Proje_Alpha/Tasarim.dwg                                |
|      Yerel: 2026-05-01 14:20  |  Bulut: 2026-05-01 14:22   |
|      [Yereli Tut]  [Bulutu Tut]  [Her Ikisini Sakla]       |
+-------------------------------------------------------------+
```

#### 2.3.5 AI Studio (Masaustu)

**Amac:** Web Panel'deki AI Studio'nun masaustu eslenigi; daha hizli dosya erisimi.

```
+-------------------------------------------------------------+
|  AI Studio                                    [Kredi: 450]  |
+-------------------------------------------------------------+
|  [Render] [Upscale] [SceneEdit] [SketchToRender]           |
+-------------------------------------------------------------+
|  Kaynak Dosya: [Proje_Alpha/Render.png]  [Dosya Sec]       |
|                                                             |
|  Parametreler:                                              |
|  [Stil: Fotorealistik ▼]  [Cozunurluk: 4K ▼]              |
|  [Prompt: Modern villa, gunesli hava...      ]            |
|                                                             |
|  [Islemi Baslat]                                           |
|                                                             |
|  Sonuclar:                                                  |
|  +-------------------+  +-------------------+              |
|  | [AI Sonucu]       |  | [AI Sonucu]       |              |
|  | Render_v1.png     |  | Render_v2.png     |              |
|  | 8 MB | 14:30      |  | 8 MB | 14:35      |              |
|  +-------------------+  +-------------------+              |
+-------------------------------------------------------------+
```

#### 2.3.6 Cop Kutusu

**Amac:** Silinen dosyalarin yonetimi ve geri yukleme.

```
+-------------------------------------------------------------+
|  Cop Kutusu                                              [?] |
|  Dosyalar 30 gun sonra kalici olarak silinir.              |
+-------------------------------------------------------------+
|  [Tumunu Sec]  [Geri Yukle]  [Kalici Sil]  [Bosalt]       |
+-------------------------------------------------------------+
|  +--------+--------+--------------------------------+------+ |
|  | [Sec]  | [Turu] | [Adi]              | [Proje] | [Silinme] |
|  +--------+--------+--------------------------------+------+ |
|  | [x]    | [PDF]  | Rapor_v1.pdf       | Alpha   | 2 saat    |
|  | [x]    | [CAD]  | Eski_Tasarim.dwg   | Beta    | Dun      |
|  | [ ]    | [IMG]  | Render_onizleme.png| Gama    | 3 gun    |
|  +--------+--------+--------------------------------+------+ |
+-------------------------------------------------------------+
```

#### 2.3.7 Ayarlar

**Amac:** Kullanici tercihleri, hesap yonetimi, senkronizasyon kontrolu.

```
+-------------------------------------------------------------+
|  Ayarlar                                                    |
+----------+--------------------------------------------------+
| Genel    |  Hesap: ahmet@archilya.com                       |
| Senkron  |  [Cikis Yap]                                     |
| izasyon  |                                                  |
| Bildirim |  Proje Klasoru:                                  |
| ler      |  [C:\Users\Ahmet\Documents\Archilya] [Degistir]  |
| Disk     |                                                  |
| Kullanim |  Senkronizasyon:                                 |
| i        |  [x] Otomatik baslat (Windows acilisinda)       |
|          |  [x] Her zaman arka planda calis                 |
|          |  [ ] Sadece Wi-Fi uzerinde senkronize et         |
|          |                                                  |
|          |  Bandwidth Limiti:                               |
|          |  [----|----] 50 MB/sn  (Sınırsız: [ ])          |
|          |                                                  |
|          |  Dil: [Turkce ▼]  Tema: [Koyu ▼]               |
|          |                                                  |
|          |  [Ayarlari Sifirla]  [Kaydet]                    |
+----------+--------------------------------------------------+
```

### 2.4 Etkilesim ve Mikro-Etkilesimler

| Etkilesim | Davranis |
|-----------|----------|
| **Proje Karti Uzerine Gelme** | Kart hafifce yukari kalkar (shadow artar), "Ac" ve "Senkronize Et" mini butonlari belirir |
| **Dosya Surukle-Birak** | `Projects/` klasorune bir dosya birakildiginda: (1) Dosya kopyalanir, (2) Aninda yukleme baslar, (3) Progress gostergesi belirir |
| **Cift Tik** | Proje kartina cift tik: proje klasorunu Windows Explorer'da acar |
| **Sag Tik (Context Menu)** | Sag tik: "Bulutta Ac", "Yerel Klasoru Ac", "Senkronize Et", "Paylas", "Ozellikler" |
| **Tray Simgesi Cift Tik** | Ana pencereyi on plana getirir (minimize edilmisse restore eder) |
| **Global Kisa Yol** | `Ctrl + Shift + A`: Hizli arama popup'i acilir (Spotlight/Alfred tarzi) |

---

## 3. Dosya Senkronizasyon (Sync) Mantigi

### 3.1 Felsefe: "Cift Yonlu, Guvenilir, Gorunmez"

Senkronizasyon, kullanici icin **"bir sey degil"** olmalidir. Kullanici dosyasini `Projects/` klasorune atar; gerisini Launcher halleder. Ayni sekilde Web Panel'e bir dosya yuklendiginde, masaustune otomatik iner.

### 3.2 Mimari Katmanlari

```
+--------------------------+
|  UI Layer (React/Vue)    |  <-- Kullanici geri bildirimi
+--------------------------+
|  Sync Engine (Node.js)   |  <-- Cakisma cozumu, kuyruk yonetimi
+--------------------------+
|  Watcher (chokidar)      |  <-- Yerel dosya sistemini izler
+--------------------------+
|  Uploader (Firebase SDK) |  <-- Buluta yukleme
+--------------------------+
|  Downloader (Firebase)   |  <-- Buluttan indirme
+--------------------------+
|  Local DB (SQLite)       |  <-- Durum, hash, metadata
+--------------------------+
```

### 3.3 Yerel -> Bulut Senkronizasyonu (Upload)

**1. Izleme (Watch):**
```javascript
// chokidar ile yerel klasor izleme
const watcher = chokidar.watch(`${basePath}/Projects/**`, {
  ignored: /[\/~]\.|\.tmp$|\.bak$|Thumbs\.db/,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,  // 2 sn sabit kalinca "yazim tamamlandi"
    pollInterval: 100
  }
});

watcher
  .on('add',    path => queueUpload('add', path))
  .on('change', path => queueUpload('change', path))
  .on('unlink', path => queueUpload('delete', path));
```

**2. Hash Karsilastirma (Change Detection):**
Her dosya icin MD5 hash'i `sync.db` SQLite veritabaninda tutulur. Dosya degistiginde:
- Yeni hash hesaplanir
- Eski hash ile karsilastirilir
- Farkliysa kuyruga eklenir

**3. Yukleme Kuyrugu (Upload Queue):**
```
Kuyruk Yonetimi:
- Max paralel yukleme: 3
- Retry mantigi: 3 deneme, ustel geri cekilme (exponential backoff)
- Chunked upload: 5 MB+ dosyalar icin parcali yukleme (Firebase Storage resumable)
- Progress tracking: Her dosya icin yuzde bazli ilerleme
```

**4. Yukleme Akisi:**
```
1. Kullanici Projects/Proje_Alpha/CAD/tasarim.dwg dosyasini gunceller
2. chokidar 'change' event'i tetikler
3. Sync Engine: MD5 hash hesaplar, eski hash'den farkli oldugunu gorur
4. Upload Queue'ya eklenir (oncelik: normal)
5. Firebase Storage'a yukleme baslar (path: projects/{projectId}/files/tasarim.dwg)
6. Yukleme tamamlandiginda Firestore `files` belgesi guncellenir:
   { name: "tasarim.dwg", url: "...", size: 14500, updatedAt: Timestamp, hash: "abc123..." }
7. Web Panel ve Mobil, Firestore onSnapshot ile anlik olarak guncellenir
```

### 3.4 Bulut -> Yerel Senkronizasyonu (Download)

**1. Firestore Dinleyici:**
```javascript
// Proje dosyalarini dinle
const unsubscribe = onSnapshot(
  query(collection(db, 'projects', projectId, 'files')),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        queueDownload(change.doc.data());
      } else if (change.type === 'removed') {
        queueLocalDelete(change.doc.data());
      }
    });
  }
);
```

**2. Indirme Mantigi:**
- Yeni dosya eklendiginde: URL'den indir, `Projects/` altina yerlestir
- Dosya guncellendiginde: Hash karsilastir, farkliysa uzerine yaz
- Dosya silindiginde: Yerelden `Trash/` klasorune tasir (30 gunluk retention)

### 3.5 Cakisma (Conflict) Cozumu

**Cakisma Durumlari:**
1. **Ayni dosya, hem yerelde hem bulutta farkli zamanlarda degistirildi**
2. **Yerel dosya silindi, bulutta guncellendi**
3. **Yerel dosya guncellendi, bulutta silindi**

**Cozum Stratejisi: "Zaman Damgasi LWW + Akilli Birlestirme"**

```
Adim 1: Her iki versiyonun zaman damgasi karsilastirilir.
Adim 2: Yeni olan kazanir (LWW - Last Write Wins).
Adim 3: Eski versiyon Trash/'e "DosyaAdi_conflict_YYYYMMDD_HHMMSS.ext" olarak yedeklenir.
Adim 4: Kullanici bildirilir: "Cakisma cozuldu. Eski versiyon Cop Kutusu'nda."
```

**Conflict Resolution Matrisi:**

| Yerel Durum | Bulut Durum | Eylem | Kullanici Bildirimi |
|-------------|-------------|-------|---------------------|
| Yeni dosya | Yok | Yukle | Hayir |
| Guncellendi | Eski versiyon | Yukle | Hayir |
| Guncellendi | Farkli guncelleme | LWW + Yedekle | Evet (toast) |
| Silindi | Mevcut | Trash'e tasir (Web'de kalir) | Hayir |
| Mevcut | Silindi | Trash'e tasir (30 gun) | Evet (toast) |
| Degisiklik yok | Mevcut | Indir | Hayir |

**Cakisma Cozum Ekrani (Manuel Mudahale):**
```
+-------------------------------------------------------------+
|  CAKISMA ALGILANDI                                          |
+-------------------------------------------------------------+
|  Dosya: Proje_Alpha/Tasarim.dwg                             |
|                                                             |
|  Yerel Versiyon:              Bulut Versiyon:               |
|  Boyut: 145 KB               Boyut: 148 KB                  |
|  Tarih: 01.05.2026 14:20     Tarih: 01.05.2026 14:22       |
|  [Onizleme]                  [Onizleme]                     |
|                                                             |
|  [Yerel Versiyonu Tut]  [Bulut Versiyonunu Tut]            |
|  [Her Ikisini Sakla (Tasarim_local.dwg + Tasarim_cloud.dwg)]|
+-------------------------------------------------------------+
```

### 3.6 Senkronizasyon Durum Makinesi

Her dosya icin `sync.db` SQLite tablosunda bir durum kaydi tutulur:

```sql
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_path TEXT NOT NULL UNIQUE,
  remote_path TEXT NOT NULL,
  local_hash TEXT,
  remote_hash TEXT,
  local_modified_at INTEGER,
  remote_modified_at INTEGER,
  status TEXT CHECK(status IN ('synced', 'uploading', 'downloading', 'pending', 'conflict', 'error')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_sync_at INTEGER
);
```

**Durum Gecis Diyagrami:**
```
         +-----------+
         |  synced   | <------------------+
         +-----------+                    |
              |                           |
    local/remote degisiklik               |
              |                           |
              v                           |
         +-----------+    basarili        |
         |  pending  | ----------------->-+
         +-----------+
              |
     +--------+--------+
     |                 |
     v                 v
+-----------+    +-----------+
| uploading |    |downloading|
+-----------+    +-----------+
     |                 |
  hata/iptal      hata/iptal
     |                 |
     v                 v
+-----------+    +-----------+
|   error   | -> |  pending  | (retry)
+-----------+    +-----------+
     |
  3x basarisiz
     |
     v
+-----------+
| conflict  | -> Manuel cozum
+-----------+
```

---

## 4. Bildirim ve Tray (Sistem Tepsisi) Davranisi

### 4.1 Felsefe

Launcher, arka planda calisan bir **"sistem hizmeti"** hissi vermelidir. Kullanici, Launcher'i her zaman gormek zorunda kalmamalidir; sadece onemli olaylar oldugunda bilgilendirilmelidir.

### 4.2 Tray (Sistem Tepsisi) Simgesi

**Windows/macOS Tray Davranislari:**

| Durum | Simge Gorseli | Baloncuk Metni | Renk |
|-------|---------------|----------------|------|
| **Senkronize** | Bulut + onay isareti | "Archilya — Tum dosyalar senkronize" | Yesil/Beyaz |
| **Senkronizasyon devam ediyor** | Bulut + donen ok | "Archilya — 3 dosya senkronize ediliyor..." | Mavi |
| **Hata** | Bulut + unlem | "Archilya — Senkronizasyon hatasi (1 cakisma)" | Kirmizi |
| **Offline** | Bulut + carpi | "Archilya — Cevrimdisi mod (senkronizasyon bekliyor)" | Gri |
| **Indirme** | Asagi ok | "Archilya — Indirme devam ediyor (45 MB/s)" | Mavi |

**Context Menu (Sag Tik):**
```
+----------------------------+
|  Archilya Launcher v2.0    |
+----------------------------+
|  [Dashboard'u Ac]          |
|  [AI Studio'yu Ac]         |
|  [Proje Klasorunu Ac]      |
+----------------------------+
|  Senkronizasyon:           |
|  [✓] Otomatik Senkronize   |
|  [ ] Sadece Wi-Fi          |
|  [Simdi Senkronize Et]     |
+----------------------------+
|  Indirme Kuyrugu (2)       |
|  [Rapor_v2.pdf]  [Iptal]   |
|  [Tasarim.dwg]   [Iptal]   |
+----------------------------+
|  [Ayarlar]                 |
|  [Hakkinda]                |
|  [Cikis]                   |
+----------------------------+
```

### 4.3 Bildirim (Toast) Deneyimi

**Windows 10/11 Uyarlamali Bildirimleri:**

| Tetikleyici | Baslik | Icerik | Eylem Butonlari |
|-------------|--------|--------|-----------------|
| **Indirme Tamamlandi** | `✓ Indirme Tamamlandi` | `"Rapor_v2.pdf" basariyla indirildi. (Proje: Alpha)` | [Klasoru Ac] [Ac] |
| **Yukleme Tamamlandi** | `↑ Yukleme Tamamlandi` | `"Tasarim.dwg" buluta yuklendi.` | [Web'de Goruntule] |
| **Cakisma Algilandi** | `! Cakisma Algilandi` | `"Tasarim.dwg" hem yerelde hem bulutta degistirildi.` | [Coz] [Yoksay] |
| **Senkronizasyon Tamamlandi** | `✓ Senkronize` | `Tum dosyalar guncel. 24 dosya senkronize edildi.` | [Kuyrugu Goruntule] |
| **Kredi Dusuk** | `⚠ Kredi Dusuk` | `Kredi bakiyeniz 50'nin altina dustu. Yenileyin.` | [Kredi Yenile] |
| **Proje Daveti** | `📧 Yeni Davet` | `Ahmet Yilmaz sizi "Proje Beta"ya davet etti.` | [Kabul Et] [Reddet] |
| **Offline Mod** | `📡 Cevrimdisi` | `Internet baglantisi kesildi. Degisiklikler yerel olarak kaydedildi.` | [Yeniden Dene] |

**Bildirim Davranis Kurallari:**
1. **Grup Tekrari Engelleme:** Ayni turden 3+ bildirim gelirse, "5 yeni dosya senkronize edildi" gibi gruplu bir bildirim gosterilir.
2. **Sessiz Saatler:** 22:00 - 08:00 arasi sadece kritik bildirimler (cakisma, hata) gosterilir.
3. **Odak Noktasi:** Launcher penceresi aktifse, hafif (inline) bildirimler gosterilir; pencere arka plandaysa OS native toast kullanilir.

### 4.4 Baslangic (Startup) Davranisi

**Windows Baslangic Stratejisi:**

```
1. Kullanici Windows'a giris yapti
2. Archilya Launcher arka planda basladi (minimize)
3. Tray simgesi belirdi (durum: "Senkronizasyon kontrol ediliyor...")
4. 3 saniye icerisinde:
   - Eger internet var: Firebase'e baglan, senkronizasyon baslat
   - Eger internet yok: "Cevrimdisi" moduna gec, yerel degisiklikleri izlemeye basla
5. Kullanici simgeye cift tiklayana kadar ana pencere gosterilmez
```

**Baslangic Ayarlari:**
- `[x] Windows baslangicinda otomatik baslat` (varsayilan: acik)
- `[x] Baslangicta ana pencereyi gosterme` (varsayilan: acik)
- `[ ] Her zaman on planda baslat` (varsayilan: kapali)

---

## Ekler

### A. Teknoloji Stack Onerisi

| Katman | Onerilen Teknoloji | Alternatif |
|--------|-------------------|------------|
| **Masaustu Framework** | Electron (React + TypeScript) | Tauri (Rust + WebView) |
| **Dosya Izleme** | `chokidar` | `nsfw` (Node.js native) |
| **Bulut SDK** | Firebase Admin SDK | REST API + custom auth |
| **Local Database** | `better-sqlite3` | `LevelDB` |
| **Bildirimler** | `node-notifier` (Windows) / `electron-notification` | Native OS API |
| **Tray** | `electron.tray` | Native module |
| **Paketleme** | `electron-builder` (NSIS, MSI, DMG) | `electron-forge` |
| **Auto-Updater** | `electron-updater` + GitHub Releases / S3 | `update.electronjs.org` |

### B. Performans Hedefleri

| Metrik | Hedef |
|--------|-------|
| **Baslangic Suresi** | < 3 saniye (cold start) |
| **Senkronizasyon Gecikmesi** | < 5 saniye (yerel degisiklik -> bulut) |
| **Bellek Kullanimi** | < 300 MB RAM (idle) |
| **Disk Kullanimi** | Cache otomatik temizleme (7 gun) |
| **Ayni Andaki Dosya Sayisi** | 10,000+ dosya dizininde takilma olmamali |

### C. Guvenlik Kontrol Listesi

| # | Kontrol | Durum |
|---|---------|-------|
| 1 | Firebase Service Account key sifreli saklanmali (Windows DPAPI / macOS Keychain) | Tasarimda |
| 2 | Local `auth.token` dosyasi sifreli olmali | Tasarimda |
| 3 | SQLite `sync.db` dosyasi kullanici-dizeyinde erisim korumali olmali | Tasarimda |
| 4 | Tray context menu'de "Kopyala/Yapistir" hassas veriler icin devre disi olmali | Tasarimda |
| 5 | Auto-updater imza dogrulamasi yapilmali (code signing) | Tasarimda |

---

## Sonuc

Archilya Launcher v2.0 tasarimi, kullanicinin **"dosya yoneticisini dogrudan bir bulut workspace'i olarak hissetmesini"** hedefler. Yerel klasor hiyerarsisi tahmin edilebilir, senkronizasyon gorunmez, cakismalar guvenli sekilde cozulur ve sistem tepsisi arka planda duzenli bir hizmet sunar.

Bu sablon, gelistirme ekibinin bir sonraki asamasinda (prototipleme ve MVP) kullanilacak teknik referans dokumanidir.

---

*Tasarim sablonu sonu.*
