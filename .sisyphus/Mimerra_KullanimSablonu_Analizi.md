# Mimerra — Tam UI / Kullanım Şablonu Analizi

> **Kaynak**: 32 adet HTML snapshot (mimerra.com/design-studio), React JS bundle (2433 satır), CSS bundle, Playwright DOM snapshot, AI Analiz Raporu
> 
> **Tarih**: 27 Mayıs 2026
> 
> **Durum**: ✅ Tamamlandı

---

## 1. TEKNOLOJİ MİMARİSİ

| Bileşen | Detay |
|---|---|
| **Framework** | React 19.2 SPA (CDN: aistudiocdn.com) |
| **Router** | React Router v7 |
| **AI Motoru** | Google Gemini AI (`@google/genai` v1.28) — `generativelanguage.googleapis.com/v1beta` |
| **Backend API** | `mimerra.com/api/render` (Node.js / Firebase Functions) |
| **Auth** | Firebase Auth 12.5 (Google OAuth) |
| **Veri** | Firestore (NoSQL), Firebase Storage |
| **3D** | Three.js r166 / r181 (`three@^0.166.0` / `three@^0.181.0`) |
| **Canvas/Plan** | Fabric.js 5.5.2 |
| **PDF** | jsPDF 2.5.1 + jspdf-autotable |
| **Zip** | JSZip 3.10.1 |
| **Stil** | Tailwind CSS (derlenmiş inline class'lar) |
| **İkonlar** | Material Symbols (Outlined + Rounded), Material Icons Round |
| **Dil** | Türkçe (i18n sistemi — key'ler: `dashboard.menu.*`, `dashboard.renderType.*`) |
| **Analitik** | Facebook Pixel (ID: 726461563623510), Cloudflare Web Analytics |
| **CDN** | aistudiocdn.com (React, Firebase, Three.js, jsPDF, JSZip) |

---

## 2. SAYFA / ROUTE HİYERARŞİSİ

```
mimerra.com/
├── / (landing)
│   Hero → Features → Stats → Gallery → SSS → Footer
│
├── /login (Firebase Auth — Google OAuth)
│
└── /design-studio (giriş sonrası — SPA)
    │
    ├── /generate
    │   ├── /exterior-render       → Dış Mekan Render form sayfası
    │   └── /interior-render       → İç Mekan Render form sayfası
    │
    ├── /render-enhancement        → Render iyileştirme araçları
    │
    ├── /technical-drawing         → Teknik çizim araçları
    │
    ├── /add-product-photo         → Ürün fotoğrafı araçları
    │
    └── /add-product-to-render-selection → Model tabanlı araçlar
```

**Route kalıbı**: Tüm tool'lar `/design-studio` altında, her tool için ayrı route. Dashboard'da `yG()` component'i render tipi seçimini yönetir (interior/exterior), seçime göre yönlendirme yapar.

---

## 3. GLOBAL APP SHELL (HER SAYFADA ORTAK)

```
┌─────────────────────────────────────────────────────┐
│  HEADER (fixed, z-40)                               │
│  bg-[#181A20]/95 backdrop-blur-md                   │
│  border-b border-[#2b3139]                          │
│  ┌──────────────────────┬────────────────────────┐  │
│  │  Logo (altın sarısı) │  [TR ▼]  [Hesabım ▼]  │  │
│  │  h-10 sm:h-12        │                        │  │
│  └──────────────────────┴────────────────────────┘  │
│                                                      │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  MAIN CONTENT                                       │
│  container mx-auto px-4 sm:px-6 lg:px-8             │
│  pt-28 sm:pt-32 lg:pt-36                            │
│  pb-6 sm:pb-8                                       │
│                                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │                                                 ││
│  │  (Sayfa içeriği — tool grid / form / sonuç)    ││
│  │                                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  ┌─── FLOATING BUTTONLAR (fixed bottom-right) ────┐ │
│  │  [Talep Bildir]  (gold rounded-full, z-50)     │ │
│  │  [İletişim]      (mail icon, hover genişler)   │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Header Component'leri

| Eleman | CSS | Detay |
|---|---|---|
| Logo | `h-10 sm:h-12 object-contain` | "Mimerra Logo - Sarı.png" (altın) |
| Dil seçici | `rounded-full border border-gray-700/50` | TR dropdown, hover gold border |
| Hesabım | `bg-[#1e2026]/50 hover:bg-[#2b3139]/50 rounded-full` | Dropdown menü |

### Floating Butonlar

| Buton | Pozisyon | CSS |
|---|---|---|
| Talep Bildir | `bottom-6 right-6` | `bg-[#F0B90B]/80 hover:bg-[#FCD535] rounded-full` |
| İletişim | `bottom-24 right-6` | `bg-[#F0B90B]/80 hover:bg-[#FCD535] rounded-full p-4` |

---

## 4. LANDING PAGE (PUBLIC — mimerra.com/)

```
┌─────────────────────────────────────────────────────┐
│  HERO                                               │
│  "Hayaliniz, Mimerra ile Hayat Buluyor."           │
│  "Mimari görselleştirme, tasarım ve üretim için    │
│   sınırsız bir platform."                          │
│                                                     │
│  ◄ Render görsel carousel (11 adet) ►              │
│  ◄ 3D model carousel (8 adet) ►                    │
│                                                     │
│  [Ücretsiz Deneyin] (CTA butonu)                   │
├─────────────────────────────────────────────────────┤
│  STATS                                              │
│  10K+ Oluşturulan Proje | 60sn Ortalama İşlem      │
│  4.9/5 Kullanıcı Puanı | %95+ İşlem Doğruluğu      │
├─────────────────────────────────────────────────────┤
│  "Sınırsız Olanaklar"                              │
│  "Geleceği Şekillendiren Araçlar"                  │
│  ◄ İkonlu tool carousel (10 araç döngü) ►          │
│  Render Oluştur | Video Oluştur | Etkileşimli 360° │
│  Model Segmentasyonu | Plan Oluşturma | Çok Açılı  │
│  Mobilyadan Üretim Çizimi | Renderdan AutoCAD      │
│  Kesim-Malzeme Listesi | 3D Model Üretme           │
│  [Şimdi Başlayın]                                  │
├─────────────────────────────────────────────────────┤
│  GALERİ                                             │
│  "Mimerra ile oluşturulan mekânlar"                │
│  24 adet render görseli (carousel)                 │
├─────────────────────────────────────────────────────┤
│  "Boş mekânları etkileyici iç mekânlara dönüştürün"│
│  Önce/Sonra gösterimi + video iframe               │
├─────────────────────────────────────────────────────┤
│  SORUN & ÇÖZÜM                                     │
│  ┌───────────────┬──────────────────────────┐      │
│  │ ❌ Eski Yöntem│ ✅ Mimerra Yöntemi       │      │
│  │ Pahalı lisans │ Bulut tabanlı, anında    │      │
│  │ Kopuk iş akışı│ Tek platformda tüm akış  │      │
│  │ Aylar öğrenme │ Sezgisel, hızlı kullanım │      │
│  │ Yavaş revizyon│ Anında iterasyon         │      │
│  └───────────────┴──────────────────────────┘      │
├─────────────────────────────────────────────────────┤
│  YARATICI SÜRECİNİZ (Workflow)                     │
│  Proje Girdileri → Konsept Tasarım →              │
│  2D Tasarım Üretimi → 3D Tasarım Üretimi →        │
│  Maliyet Analizi & Teklif → Üretim                 │
├─────────────────────────────────────────────────────┤
│  ÖNCE / SONRA (3 adet before-after slider)         │
├─────────────────────────────────────────────────────┤
│  MIMERRA KİMLER İÇİN?                              │
│  [Mimarlar] [İç Mimarlar] [İnşaat Şirketleri]     │
│  [Emlak] [Ev Sahipleri] [Üreticiler] [Freelance]  │
├─────────────────────────────────────────────────────┤
│  ÖZELLİKLER                                        │
│  🔒 Gizlilik %100 Güvende                         │
│  🛡️ Akıllı AI Motoru                               │
│  👨‍💼 7/24 Destek                                    │
│  ⚡ Işık Hızında Üretim                            │
├─────────────────────────────────────────────────────┤
│  SSS (Accordion)                                   │
│  "Mimerra nedir?" → cevap                         │
│  "Render ne kadar sürede?" → 2-10 sn              │
│  "Kredi sistemi?" → kullanım bazlı                │
│  "Tüm cihazlarda?" → evet, bulut tabanlı          │
│  "Profesyonel projelerde?" → evet                 │
├─────────────────────────────────────────────────────┤
│  FOOTER                                            │
│  Logo | Hakkımızda | Blog | Yasal (Kullanım        │
│  Şartları, Gizlilik Politikası) | İletişim         │
│  Adres: Ulubey, Önder mah. Altınay cad, Şenkal Sk. │
│  Tel: 0537 314 66 18                               │
│  Sosyal: Instagram | Twitter | GitHub | LinkedIn   │
│  © 2025 Mimerra All rights reserved.               │
└─────────────────────────────────────────────────────┘
```

---

## 5. TOOL DASHBOARD (GİRİŞ SONRASI — `/design-studio`)

```
┌─────────────────────────────────────────────────────┐
│  Hoş geldin, [name]                                │
│  "bugün neyi geliştirmek istersin?"                │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  ANA MENÜ                                   │    │
│  │  ┌──────────────┬──────────────┬──────────┐ │    │
│  │  │ 🖼 Tasarım    │ 📐 Teknik    │ ⚙️ Admin  │ │    │
│  │  │               │              │ (rol=admin)│ │    │
│  │  └──────────────┴──────────────┴──────────┘ │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  TOOL GRID (3-column responsive)            │    │
│  │  grid-cols-1 md:grid-cols-2 lg:grid-cols-3  │    │
│  │  gap-6                                      │    │
│  │                                             │    │
│  │  ┌──────────────┬──────────────┬──────────┐ │    │
│  │  │  [Görsel]    │  [Görsel]    │ [Görsel] │ │    │
│  │  │  ─────────── │  ─────────── │ ──────── │ │    │
│  │  │  Tool Adı    │  Tool Adı    │ Tool Adı │ │    │
│  │  │  Açıklama..  │  Açıklama..  │ Açıklama │ │    │
│  │  │  ✓ Özellik 1 │  ✓ Özellik 1 │ ✓ Özel 1 │ │    │
│  │  │  ✓ Özellik 2 │  ✓ Özellik 2 │ ✓ Özel 2 │ │    │
│  │  │  ✓ Özellik 3 │              │          │ │    │
│  │  │  [Seç]       │  [Seç]       │ [Seç]    │ │    │
│  │  └──────────────┴──────────────┴──────────┘ │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Tool Card Hover Efekti

```css
/* Her tool kartı hover'da: */
hover:border-[#FCD535]/30
hover:shadow-[0_10px_20px_rgba(0,0,0,0.3),0_0_20px_7px_rgba(252,213,53,0.1)]
group-hover:scale-105  /* görsel zoom */
```

### Admin Rolü

Admin kullanıcılar için ayrı bir "Admin" menü butonu gösterilir (`null==n?void 0:n.role`):
```
bg-[#F0B90B] hover:bg-[#FCD535]
text-[#181A20] font-bold py-3 px-6 rounded-lg
shadow-md shadow-[#F0B90B]/30
```

---

## 6. TOOL FORM SAYFASI (WIZARD YAPISI)

Her tool seçildiğinde **step-by-step form wizard** açılır.

### 6.1. Sub-tool Seçim Ekranı (Render Tipi)

Sıfırdan Render Üret tool'una tıklayınca önce alt kategori seçilir:

```
┌─────────────────────────────────────────────────────┐
│  ◄ Geri           Sıfırdan Render Üret             │
│                    Hangi tür render oluşturmak       │
│                    istediğinizi seçerek başlayın.    │
│                                                     │
│  ┌──────────────┬──────────────────────────────┐    │
│  │ 🏢 Dış Mekan  │ 🛋 İç Mekan Render Üret     │    │
│  │   Render Üret  │                              │    │
│  │              │                              │    │
│  │ Yapı cephe.. │ Oda bazlı tasarım..          │    │
│  │              │                              │    │
│  │ ✓ Bina cep.  │ ✓ Oda bazlı tasarım          │    │
│  │ ✓ Bahçe      │ ✓ Mobilya yerleştirme        │    │
│  │ ✓ Gece/gün.  │ ✓ Farklı tarz/renk           │    │
│  │ ✓ Gerçekçi   │ ✓ Aydınlatma kontrolü        │    │
│  │              │                              │    │
│  │  [Seç]       │  [Seç]                       │    │
│  └──────────────┴──────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 6.2. Ana Form Sayfası (Örn: Dış Mekan Render Üret)

```
┌─────────────────────────────────────────────────────┐
│  ◄ Geri                                              │
│  Dış Mekan Render Üret                               │
│  Dış mekan render oluşturmak için projenin           │
│  özelliklerini belirtin.                             │
├─────────────────────────────────────────────────────┤
│  ⚠️ (*) ile işaretlenmiş alanlar zorunludur.        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  📎 Referans Görsel (Stil için)                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │   │
│  │  │                                         │ │   │
│  │  │        📷 Stil görseli seçin...        │ │   │
│  │  │           PNG, JPG, vb.                │ │   │
│  │  │                                         │ │   │
│  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │   │
│  │  (border-2 border-dashed, h-48)            │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  📋 Hazır Şablonlar                                  │
│  ┌──────────────────────────────────────────────┐   │
│  │  Bir şablon seçerek formu doldurun...      ▼│   │
│  │  ──────────────────────────────────────────  │   │
│  │  • Ultra lüks modern villa                   │   │
│  │  • Ultra lüks klasik villa                   │   │
│  │  • Ultra lüks villa / prestijli konut        │   │
│  │  • Ultra lüks futuristik villa               │   │
│  └──────────────────────────────────────────────┘   │
│  * Şablon seçildiğinde form alanları otomatik        │
│    dolacaktır. Seçim sonrası düzenleme yapabilirsiniz.│
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  FORM ALANLARI (grid-cols-1 md:grid-cols-2)  │   │
│  │                                              │   │
│  │  ┌─────────────┬──────────────────────┐      │   │
│  │  │ Bina Tipi*  │ Bina Stili*          │      │   │
│  │  │ [________]  │ [Modern ▼]           │      │   │
│  │  ├─────────────┴──────────────────────┤      │   │
│  │  │ Dış Cephe Malzemeleri             │      │   │
│  │  │ [____________________________]    │      │   │
│  │  ├───────────────────────────────────┤      │   │
│  │  │ Çevre ve Peyzaj                   │      │   │
│  │  │ [textarea 3 satır]               │      │   │
│  │  ├─────────────┬─────────────────────┤      │   │
│  │  │ Zaman       │                     │      │   │
│  │  │ [Gündüz ▼]  │                     │      │   │
│  │  ├─────────────┴─────────────────────┤      │   │
│  │  │ Genel Açıklama                    │      │   │
│  │  │ [textarea 4 satır]               │      │   │
│  │  └───────────────────────────────────┘      │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  [Dış Mekan Renderları Oluştur]   [🗑 Formu  │   │
│  │  (altın gradient, disabled support)  Temizle] │   │
│  └──────────────────────────────────────────────┘   │
│  (shadow-lg shadow-[#F0B90B]/30)                    │
└─────────────────────────────────────────────────────┘
```

### Form Elemanları (Tool'a Göre Değişen)

| Eleman Tipi | CSS | Örnekler |
|---|---|---|
| `text input` | `w-full bg-[#1e2026] border border-[#2b3139] rounded-lg px-4 py-3` | Bina tipi, malzemeler |
| `select dropdown` | `w-full bg-[#181A20] border border-[#2b3139] rounded-lg px-4 py-3 appearance-none cursor-pointer` | Stil, zaman, şablon |
| `textarea` | `w-full bg-[#1e2026] border border-[#2b3139] rounded-lg px-4 py-3` rows="3-4" | Açıklamalar |
| `file input` | `hidden` tipi + custom drag-drop zone | Referans görsel |
| `checkbox` | Material Icons check_circle | Özellik listeleri |
| `submit button` | `bg-gradient-to-r from-[#F0B90B] to-[#FCD535] disabled:bg-[#2b3139]` | Ana aksiyon |
| `clear button` | `bg-[#1e2026] hover:bg-[#2b3139] border border-[#2b3139]` | Form temizleme |

### Drag-Drop Upload Zone

```
┌──────────────────────────────────────────────┐
│  📷                                         │
│  Stil görseli seçin...                      │
│  PNG, JPG, vb.                              │
│                                              │
│  hover:border-[#FCD535]                     │
│  bg-[#1e2026] border-2 border-dashed        │
│  border-[#2b3139] → hover gold              │
│  h-48 flex flex-col items-center justify-   │
│  center                                      │
└──────────────────────────────────────────────┘
```

---

## 7. FURNITURE PALETTE (YAN PANEL — 3D/Plan Tool'larında)

```
┌─────────────────────────────┐
│  MOBİLYA PALETİ             │
│  ─────────────────────────  │
│                             │
│  ▼ Mobilya (accordion)      │
│  ┌─────┬─────┬─────┬─────┐ │
│  │ 🛋  │ 🪑  │ 🛏️  │ 🪞  │ │
│  │Koltuk│Sandal│Yatak│Ayna │ │
│  └─────┴─────┴─────┴─────┘ │
│                             │
│  ▼ Aydınlatma              │
│  ┌─────┬─────┬─────┐       │
│  │ 💡  │ 🔦  │ 🕯️  │       │
│  │Avize│Lamba│Mum │       │
│  └─────┴─────┴─────┘       │
│                             │
│  ▼ Aksesuar                │
│  ┌─────┬─────┐             │
│  │ 🖼️  │ 🏺  │             │
│  │Tablo│Vazo │             │
│  └─────┴─────┘             │
└─────────────────────────────┘
```

**CSS Sınıfları:**
- `.furniture-palette` — Ana container
- `.furniture-palette-header h3` — `color:#fcd535`, `text-transform:uppercase`
- `.furniture-category` — `border:1px solid #2b3139`, `background:#1e2026`
- `.furniture-category-header` — `background:#2b3139` (clickable accordion)
- `.furniture-palette-items` — `grid-template-columns:repeat(2,1fr)`, `gap:8px`
- `.furniture-palette-item` — `border:2px solid transparent`, hover'da gold border
- Scrollbar: 4px, `.furniture-palette-items` scrollbar gold `#fcd535`

---

## 8. OUTPUT / SONUÇ EKRANI

AI işlem tamamlandıktan sonra:

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  ✅ Render başarıyla oluşturuldu!                   │
│  (AI'dan gelen text mesajı: "Harika bir modern      │
│   yatak odası tasarımı! İşte fotogerçekçi render:") │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  │         RENDER GÖRSELİ (geniş)               │   │
│  │                                              │   │
│  │         (Gemini IMAGE modality)              │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  🔄 Yeniden Üret    📥 İndir (PNG)          │   │
│  │  (gold buton)        (border buton)          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  🔗 Başka bir araca gönder:                  │   │
│  │  [Render Analizi Çıkar ▼]  [➡]              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┤─ Önerilen sonraki adımlar                        │
│     • Render Analizi Çıkar                          │
│     • Render Varyasyonları Üret                     │
│     • Renderdan Video Üret                          │
└─────────────────────────────────────────────────────┘
```

---

## 9. API VE PROMPT MİMARİSİ

### 9.1. API Endpoint

```
POST https://mimerra.com/api/render
```

### 9.2. Request Body

```json
{
  "contents": [{ "parts": [] }],
  "config": {
    "responseModalities": ["TEXT", "IMAGE"]
  },
  "details": {
    "roomType": "Yatak Odası",
    "dimensions": "4m x 5m, Tavan 2.8m",
    "materials": "Meşe parke, antrasit duvarlar, pirinç detaylar",
    "furniture": "Geniş L koltuk, mermer orta sehpa, büyük soyut tablo",
    "style": "Modern",
    "projectDescription": "",
    "technicalWidth": "",
    "technicalDepth": "",
    "technicalCeilingHeight": "",
    "technicalDoorInfo": "",
    "technicalWindowInfo": "",
    "technicalFurnitureInfo": "",
    "technicalMaterialInfo": "",
    "variant": 0
  },
  "hasPlanFile": false,
  "hasReferenceImage": false,
  "variant": 0
}
```

> **Önemli**: `contents.parts` dizisi BOŞ gönderilir. Asıl prompt **backend tarafında** dinamik oluşturulur.

### 9.3. Prompt Akış Şeması

```
Kullanıcı Formu (React Frontend)
  → Oda tipi, boyutlar, malzemeler, mobilya, stil
    ↓
POST /api/render (JSON payload)
  → details objesi backend'e iletilir
    ↓
Mimerra Backend
  → Form verileri + Türkçe system prompt şablonu birleştirilir
    ↓
Google Gemini API (v1beta)
  → generativelanguage.googleapis.com/v1beta
  → x-goog-api-key header ile auth
  → Retry: max 2 kez
  → Stream desteği: SSE (Server-Sent Events)
    ↓
Response: TEXT + IMAGE modality
  → Render görseli + AI açıklama metni
```

### 9.4. Prompt Mühendisliği Teknikleri (Backend)

**System Instruction (Rol Atama):**
```
"Sen bir iç mimarlık ve görselleştirme uzmanısın.
Görevin, kullanıcının verdiği detaylara sadık kalarak
fotogerçekçi mimari render görüntüleri üretmektir."
```

**Context Injection (Bağlam):**
```
"Oda Tipi: Yatak Odası
Boyutlar: 4m x 5m, Tavan yüksekliği 2.8m
Malzemeler: Meşe parke, antrasit duvarlar, pirinç detaylar
Mobilya: Geniş L koltuk, mermer orta sehpa, büyük soyut tablo
Stil: Modern"
```

**Negative Prompting:**
- "Gerçek dışı oranlardan kaçın"
- "Müşteri tarafından talep edilmeyen objeler ekleme"
- "Bozuk perspektif ve deforme mobilyalar üretme"

**Few-Shot Prompting:**
- Hazır şablonlar ("Ultra lüks modern salon", "Yemek odası", "Lüks yatak odası")
- Şablon seçildiğinde backend önceden test edilmiş parametreleri kullanır

---

## 10. TÜM TOOL KATALOĞU (29 ARAÇ — 7 KATEGORİ)

### KATEGORİ 1: RENDER ÜRETİMİ (8 Araç)

| # | Araç | Girdi | Çıktı | Parametreler |
|---|---|---|---|---|
| 1 | **Sıfırdan Render Üret** | Text prompt | Render görseli | Stil, boyut, çevre tipi |
| 2 | **İç Mekan Render Üret** | Text + ref görsel | İç mekan render | Oda tipi, stil, renk paleti, aydınlatma |
| 3 | **Dış Mekan Render Üret** | Text + ref görsel | Dış cephe render | Bina stili, çevre, zaman, açı |
| 4 | **Sıfırdan Oda Planı ile Render** | 2D oda planı (upload) | Render | Plan tipi, ölçek, stil |
| 5 | **El Çiziminden Render Al** | Sketch/çizim (upload) | Render | Stil koruma seviyesi |
| 6 | **AutoCAD DXF'ten Render** | .dxf dosyası | 3D render | Ölçek, malzeme, kamera açısı |
| 7 | **SketchUp Çiziminden Render Al** | SketchUp model | Render | Malzeme eşleme, ışık preset |
| 8 | **Kendi Modellerinden Render Üret** | 3D model (upload) | Render sahnesi | Model yerleşim, kompozisyon |

### KATEGORİ 2: PROJE PLANLAMA (3 Araç)

| # | Araç | Girdi | Çıktı | Parametreler |
|---|---|---|---|---|
| 9 | **Plan Üret** | Text prompt + ref | Mimari plan | Plan tipi, boyut, oda sayısı |
| 10 | **Boş Arsadan Proje Oluştur** | Arsa ölçüleri, konum | Proje önerisi | Arsa büyüklüğü, imar durumu |
| 11 | **Mobilya Yerleşim Varyasyonları Üret** | Plan + mobilya envanteri | Layout opsiyonları | Yerleşim stili, trafik akışı |

### KATEGORİ 3: TEKNİK ÇİZİM (5 Araç)

| # | Araç | Girdi | Çıktı | Parametreler |
|---|---|---|---|---|
| 12 | **Teknik AutoCAD Çizimi Oluştur** | Tasarım açıklaması | DWG çizimi | Ölçek, görünüşler, katman |
| 13 | **Teknik ve Üretim Çizimi** | Spec'ler | Üretim çizim seti | Çizim tipi, detay seviyesi |
| 14 | **Mobilya Üretim Çizimi Oluştur** | Mobilya tasarımı | İmalat çizimi | Birleştirme tipleri, malzeme |
| 15 | **Kesim Listesi Oluştur** | Tasarım dosyası | Kesim listesi (PDF) | Malzeme, kerf, optimizasyon |
| 16 | **Malzeme Listesi Oluştur** | Proje dosyaları | BOM (Malzeme listesi) | Kategoriler, birim maliyet |

### KATEGORİ 4: VARYASYON (4 Araç)

| # | Araç | Girdi | Çıktı | Parametreler |
|---|---|---|---|---|
| 17 | **Farklı Malzeme Senaryoları Üret** | Render + malzeme seçimi | Çoklu malzeme render | Malzeme kütüphanesi, renk |
| 18 | **Render Varyasyonları Üret** | Render + varyasyon param | Stil varyasyonları | Işık, renk, atmosfer, mevsim |
| 19 | **Modele Kumaş Ataması** | 3D model + kumaş tipi | Kumaş kaplı model | Kumaş tipi, renk, desen, fizik |
| 20 | **Mobilya Yerleşim Varyasyonları** (11 numara ile aynı olabilir, yukarıda) | | | |

### KATEGORİ 5: İYİLEŞTİRME & ANALİZ (5 Araç)

| # | Araç | Girdi | Çıktı | Parametreler |
|---|---|---|---|---|
| 21 | **Render Kalitesini Yükselt** | Düşük kalite render | 4K/8K render | Kalite seviyesi, detay |
| 22 | **Odamı Tasarla** | Oda fotoğrafı | Yeniden tasarlanmış oda | Stil, renk paleti, mobilya |
| 23 | **Mevcut Odamı Yenile** | Oda fotoğrafı | Renovasyon görseli | Tip, bütçe, stil |
| 24 | **Hazır Oda Görseli Üzerinden Düzenleme** | Görsel + talimat | Düzenlenmiş görsel | Eleman değiştirme (duvar, mobilya) |
| 25 | **Render Analizi Çıkar** | Render görseli | Analiz raporu | Analiz tipi, skor kriteri |

### KATEGORİ 6: VİDEO & SUNUM (3 Araç)

| # | Araç | Girdi | Çıktı | Parametreler |
|---|---|---|---|---|
| 26 | **Renderdan Video Üret** | Render + kamera yolu | Animasyon video | Kamera, süre, geçişler, müzik |
| 27 | **Dış Mekan Drone Çekimi Al** | Dış mekan render | Drone flyover video | Uçuş yolu, irtifa, hız |
| 28 | **Proje Tanıtım Dökümanı Oluştur** | Render + plan | PDF sunum | Format, layout, bölümler |

### KATEGORİ 7: ÜRÜN TASARIMI (2 Araç)

| # | Araç | Girdi | Çıktı | Parametreler |
|---|---|---|---|---|
| 29 | **Ürün Tasarla ve Model Oluştur** | Açıklama/eskiz | 3D model + spec | Ürün tipi, malzeme, boyut |
| 30 | **Ürün Katalog Görselleri Üret** | Model + sahne | Katalog görselleri | Arkaplan, ışık, kompozisyon |

---

## 11. KULLANICI AKIŞI (END-TO-END JOURNEY)

```
1. LANDING (mimerra.com)
   ├── Hero, CTA, Özellikler, Galeri, SSS
   └── [Ücretsiz Deneyin] → /login

2. AUTH (Firebase Auth — Google OAuth)
   ├── Giriş sonrası → /design-studio
   └── Rol kontrolü (admin → admin menüsü)

3. TOOL DASHBOARD (/design-studio)
   ├── "Hoş geldin, [name]"
   ├── Ana menü: Tasarım | Teknik | Admin
   └── Tool grid (29 araç, 3-column)

4. TOOL SELECTION
   ├── Tıkla → route yönlendirmesi
   ├── Sub-tool seçimi (interior/exterior vb.)
   └── Form wizard açılır

5. FORM DOLDURMA (STEP 1)
   ├── File upload (referans görsel)
   ├── Şablon seçimi (opsiyonel)
   ├── Metin alanları
   └── Parametre dropdown'ları

6. AI PROCESSING (STEP 2)
   ├── POST /api/render
   ├── Backend prompt oluşturur
   ├── Gemini AI response (TEXT + IMAGE)
   └── 2-10 saniye

7. RESULT PREVIEW (STEP 3)
   ├── Render görseli
   ├── AI açıklama metni
   ├── [Yeniden Üret] [İndir] [Paylaş]
   └── Başka araca yönlendirme

8. POST-PROCESSING
   ├── Render Analizi Çıkar
   ├── Render Varyasyonları Üret
   ├── Renderdan Video Üret
   ├── Projeye kaydet
   └── Dashboard'a dön
```

---

## 12. TASARIM TOKEN'LARI

### Renk Paleti

```
// ANA RENKLER
bg-main (sayfa):           #181A20
bg-alt (header):           #181A20/95  (backdrop-blur-md)
bg-card:                   #1e2026
bg-hover:                  #2b3139
bg-input:                  #1e2026
bg-loading:                #111827

// BORDER
border-default:            #2b3139
border-hover-gold:         #FCD535

// TEXT
text-primary:              #EAECEF
text-secondary:            #848E9C  (veya EAECEF/70)
text-gold:                 #FCD535 / #F3BF14

// AKSAN (Altın)
gold-primary:              #FCD535
gold-secondary:            #F3BF14
gold-button:               #F0B90B
gold-gradient:             from-[#F0B90B] to-[#FCD535]
gold-hover:                hover:from-[#FCD535] hover:to-[#F0B90B]
gold-glow:                 shadow-[0_10px_20px_rgba(0,0,0,0.3),0_0_20px_7px_rgba(252,213,53,0.1)]

// STATE
gold-disabled:             #2b3139
gold-error-bg:             #F0B90B/10
gold-error-border:         #F0B90B/30

// SPINNER
loader-border:             #3b82f6  (mavi)
```

### Tipografi

```
// FONT AİLELERİ
body:        Inter (400-900)
heading:     Montserrat (400-900), Playfair Display (400-600), Poppins (300-400),
             Raleway (400-900), Abril Fatface, Cinzel, Markazi Text

// BOYUTLAR
h1:          text-2xl sm:text-3xl md:text-4xl font-bold
h2:          text-xl sm:text-2xl font-bold
h3:          text-lg sm:text-xl font-bold
body:        text-sm sm:text-base
caption:     text-xs sm:text-sm
label:       text-xs sm:text-sm font-semibold uppercase tracking-wider

// ÖZEL
hero-title:  text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight
             font-heading (Playfair Display / Cinzel)
```

### Shape & Radius

```
button:      rounded-lg (8px), rounded-xl (12px), rounded-full (50%)
card:        rounded-xl (12px), rounded-2xl (16px)
input:       rounded-lg (8px)
upload-zone: rounded-lg (8px)
border:      border (1px)
```

### Gölgeler

```
card-shadow:       shadow-lg shadow-[#F0B90B]/30 (gold glow)
hover-shadow:      hover:shadow-xl
hover-glow:        hover:shadow-[0_10px_20px_rgba(0,0,0,0.3),0_0_20px_7px_rgba(252,213,53,0.1)]
```

### Responsive Breakpoints

```
sm:   640px
md:   768px
lg:   1024px
xl:   1280px
2xl:  1536px

Grid: grid-cols-1 (mobile) → md:grid-cols-2 → lg:grid-cols-3
```

---

## 13. ÖNEMLİ NOTLAR

### Dosya Yapısı (Snapshot'taki)

| Dosya | Kaynak URL | İçerik |
|---|---|---|
| `Mimerra.html` | `/design-studio/generate` | Tool dashboard (ana sayfa) |
| `Sıfırdan Render Üret Mimerra.html` | `/design-studio/generate/exterior-render` | Dış mekan render formu |
| `İç Mekan Render Üret Mimerra.html` | `/design-studio/generate/interior-render` | İç mekan render formu |
| `Odamı Tasarla Mimerra.html` | `/design-studio/render-enhancement` | Oda tasarım aracı |
| `Mevcut Odamı Yenile Mimerra.html` | `/design-studio` | Mevcut oda yenileme |
| `Diğer 27 HTML` | `/design-studio/*` | Her biri farklı bir tool |
| `Mimerra_AI_Analiz_Raporu.html` | — | Prompt sistemi analiz raporu |
| `Mimerra_Render_Sonuc.html` | — | Render sonuç sayfası (8.4 MB) |

### Firebase Config

```json
{
  "projectId": "muttimoai",
  "storageBucket": "muttimoai.firebasestorage.app",
  "apiKey": "AIzaSyAqgHhK_srZTPglM4x6tIiwRet1JFMU2VE"
}
```

> ⚠️ Bu config **Mimerra'nın kendi projesine** ait (`muttimoai`), Archilya'nın `nng-toma` projesinden farklı.

### Gemini API

```javascript
class GeminiNextGenAPIClient {
  baseURL = "https://generativelanguage.googleapis.com";
  apiVersion = "v1beta";
  // Auth: x-goog-api-key header
  // Retry: max 2 kez
  // Stream: SSE support
}
```

---

*Analiz, Mimerra platformunun 32 HTML snapshot'ı, React JS bundle'ı, CSS bundle'ı ve Playwright DOM snapshot'ından çıkartılmıştır. Tüm bulgular canlı sitenin Mayıs 2026 itibarıyla kopyalarına dayanmaktadır.*
