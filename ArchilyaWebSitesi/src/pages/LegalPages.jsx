import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const LEGAL_LAST_UPDATED = '17.04.2026';

function LegalLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-background text-white">
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary transition-colors text-xs uppercase tracking-widest mb-10">
            <ArrowLeft className="w-3.5 h-3.5" />
            Ana Sayfaya Dön
          </Link>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] mb-3">Yasal</p>
          <h1 className="font-serif text-4xl text-white italic mb-10">{title}</h1>
          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-gray-400 font-sans text-sm leading-relaxed">
            {children}
          </div>
          <div className="mt-16 pt-8 border-t border-white/5 text-xs text-gray-700 font-sans">
            <p>NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ</p>
            <p>Silahtar&#x131;ağa Mah. Üniversite 1. Sk. No:13/1 İç Kapı No:Z109, 59000 Çorlu / TEKİRDAĞ</p>
            <p>Tel: 0 (282) 606 06 39 | E-posta: info@nebulanovagames.com</p>
          </div>
        </Motion.div>
      </div>
    </div>
  );
}

export function Hakkimizda() {
  return (
    <LegalLayout title="Hakkımızda">
      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Biz Kimiz?</h2>
        <p>
          Archilya, mimarlık ve inşaat sektörüne özel olarak geliştirilmiş bulut tabanlı bir proje yönetim ve yapay zeka entegreli tasarım platformudur. <strong>NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ</strong> çatısı altında, mimari süreçleri dijitalleştirerek daha verimli ve modern hale getirmek vizyonuyla kurulmuştur.
        </p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Misyonumuz</h2>
        <p>
          Mimarlık ofislerinin, bağımsız mimarların ve mühendislerin karmaşık projeleri tek bir merkezden güvenle yönetmelerini sağlamak; aynı zamanda entegre yapay zeka araçları ve sanal gerçeklik (VR) çözümleri ile tasarım süreçlerinde zaman tasarrufu yaratarak yenilikçi iş modellerinin önünü açmaktır.
        </p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Vizyonumuz</h2>
        <p>
          Mimari tasarımda geleceğin teknolojilerini günümüze taşımak, sürdürülebilir ve verimlilik odaklı yazılımlarımızla sektörde dijital dönüşümün öncüsü ve Türkiye merkezli global bir marka olmaktır.
        </p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Şirket Bilgileri</h2>
        <ul className="list-none space-y-1 mt-2 text-gray-300">
          <li><strong>Unvan:</strong> NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ</li>
          <li><strong>Adres:</strong> Silahtarağa Mah. Üniversite 1. Sk. No:13/1 İç Kapı No:Z109, 59000 Çorlu / TEKİRDAĞ</li>
          <li><strong>Telefon:</strong> 0 (282) 606 06 39</li>
          <li><strong>E-posta:</strong> info@nebulanovagames.com</li>
        </ul>
      </section>
    </LegalLayout>
  );
}

export function GizlilikPolitikasi() {
  return (
    <LegalLayout title="Gizlilik Politikası">
      <p><strong className="text-gray-200">Son Güncelleme:</strong> {LEGAL_LAST_UPDATED}</p>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">1. Veri Sorumlusu</h2>
        <p>Bu Gizlilik Politikası, Archilya platformunu işleten NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ ("Şirket") tarafından hazırlanmıştır. Kişisel verilerinizin işlenmesinde veri sorumlusu sıfatıyla hareket etmekteyiz.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">2. Toplanan Veriler</h2>
        <p>Platformumuzu kullandığınızda aşağıdaki kişisel veriler toplanabilir:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Ad, soyad ve e-posta adresi (kayıt ve iletişim için)</li>
          <li>IP adresi ve tarayıcı bilgileri (güvenlik ve analiz için)</li>
          <li>Platform kullanım verileri (oturum bilgileri, tıklamalar)</li>
          <li>Yüklenen görseller ve proje dosyaları (hizmet sunumu için)</li>
          <li>Ödeme bilgileri (kart bilgileri Iyzico tarafından işlenir, Şirketimizde saklanmaz)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">3. Verilerin Kullanım Amaçları</h2>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Hizmetlerin sunulması ve geliştirilmesi</li>
          <li>Kullanıcı hesabının yönetimi</li>
          <li>Ödeme işlemlerinin gerçekleştirilmesi</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Güvenlik ve dolandırıcılık önleme</li>
          <li>Rıza alınması halinde pazarlama iletişimi</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">4. Üçüncü Taraflarla Paylaşım</h2>
        <p>Kişisel verileriniz; hizmet sağlayıcılar (Firebase/Google, Iyzico, Replicate, Hugging Face), yasal zorunluluk halinde yetkili kamu kuruluşları ile paylaşılabilir. Verileriniz üçüncü taraflara ticari amaçla satılmaz veya kiralanmaz.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">5. Çerezler (Cookies)</h2>
        <p>Platformumuz, oturum yönetimi ve kullanıcı deneyimini iyileştirmek için zorunlu çerezler kullanmaktadır. Tarayıcı ayarlarınızdan çerezleri yönetebilirsiniz; ancak bazı işlevler kısıtlanabilir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">6. Veri Güvenliği</h2>
        <p>Kişisel verileriniz 256-bit SSL şifrelemesi, Firebase güvenlik kuralları ve erişim kontrolleri ile korunmaktadır. Veri ihlali durumunda yasal süre içinde ilgili makamlar ve kullanıcılar bilgilendirilir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">7. Haklarınız</h2>
        <p>6698 sayılı KVKK kapsamında; verilerinize erişim, düzeltme, silme, işlemeyi kısıtlama ve itiraz etme haklarına sahipsiniz. Taleplerinizi <strong className="text-gray-300">info@nebulanovagames.com</strong> adresine iletebilirsiniz.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">8. İletişim</h2>
        <p>Gizlilik politikamıza ilişkin sorularınız için: <strong className="text-gray-300">info@nebulanovagames.com</strong></p>
      </section>
    </LegalLayout>
  );
}

export function KVKK() {
  return (
    <LegalLayout title="KVKK Aydınlatma Metni">
      <p><strong className="text-gray-200">Son Güncelleme:</strong> {LEGAL_LAST_UPDATED}</p>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Veri Sorumlusu</h2>
        <p>6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz; veri sorumlusu sıfatıyla <strong className="text-gray-300">NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ</strong> tarafından aşağıda açıklanan kapsamda işlenmektedir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">İşlenen Kişisel Veriler</h2>
        <p>Kimlik (ad, soyad), iletişim (e-posta, telefon), işlem güvenliği (IP adresi, oturum bilgileri), finansal (ödeme bilgileri — Iyzico üzerinden) ve kullanım verileri (platform davranışları) işlenmektedir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Kişisel Verilerin İşlenme Amaçları</h2>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Sözleşmenin ifası (KVKK Madde 5/2-c)</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi (KVKK Madde 5/2-ç)</li>
          <li>Meşru menfaat kapsamında güvenlik ve dolandırıcılık önleme (KVKK Madde 5/2-f)</li>
          <li>Açık rızanıza dayalı pazarlama iletişimi (KVKK Madde 5/1)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Aktarım</h2>
        <p>Verileriniz; hizmet alınan yurt içi ve yurt dışı teknoloji sağlayıcıları (Google/Firebase, Iyzico, Replicate, Hugging Face) ile yasal zorunluluk halinde kamu kuruluşlarıyla paylaşılabilir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">KVKK Kapsamındaki Haklarınız</h2>
        <p>KVKK'nın 11. maddesi uyarınca aşağıdaki haklarınızı kullanabilirsiniz:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse bilgi talep etme</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>Kanun'un 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme</li>
          <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
          <li>Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
        </ul>
        <p className="mt-3">Başvurularınızı <strong className="text-gray-300">info@nebulanovagames.com</strong> adresine yazılı olarak iletebilirsiniz.</p>
      </section>
    </LegalLayout>
  );
}

export function KullanimKosullari() {
  return (
    <LegalLayout title="Kullanım Koşulları">
      <p><strong className="text-gray-200">Son Güncelleme:</strong> {LEGAL_LAST_UPDATED}</p>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">1. Kabul</h2>
        <p>Archilya platformunu ("Platform") kullanarak bu Kullanım Koşulları'nı kabul etmiş sayılırsınız. Koşulları kabul etmiyorsanız platformu kullanmayınız.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">2. Hizmetin Tanımı</h2>
        <p>Archilya; mimari proje yönetimi, yapay zeka destekli görsel üretim (AI Stüdyo) ve profesyonel mimarlık danışmanlığı hizmetleri sunan bir SaaS platformudur. Platform, NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ tarafından işletilmektedir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">3. Hesap Sorumluluğu</h2>
        <p>Hesabınızın güvenliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmamalı, yetkisiz erişim durumunda derhal bize bildirmelisiniz. 18 yaşın altındaysanız platform hizmetlerini kullanamazsınız.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">4. Kredi ve Ödeme</h2>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Satın alınan krediler, aktif plan modeline göre bireysel hesaba veya workspace havuzuna tanımlanır; bu haklar kullanıcılar arasında keyfi olarak devredilemez.</li>
          <li>Kullanılmış kredilerin iadesi yapılmaz; hiç kullanılmamış kredi ve paketlerde iade değerlendirmesi ilgili iade politikasına göre yapılır.</li>
          <li>Plan ve kota ödemeleri satın alma akışında gösterilen bedel üzerinden tahsil edilir; aktifleşme ödeme doğrulamasından sonra hesabınıza tanımlanır.</li>
          <li>Fiyatlar KDV hariç TL cinsinden belirtilmiştir.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">5. Kabul Edilemez Kullanım</h2>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Platformun güvenliğini tehdit eden eylemler</li>
          <li>Telif hakkı ihlali oluşturacak içerik yüklemek</li>
          <li>Spam, kötü amaçlı yazılım veya yanıltıcı içerik yaymak</li>
          <li>Platformun kaynaklarını aşırı ve haksız şekilde tüketmek</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">6. Fikri Mülkiyet</h2>
        <p>Platform üzerinde ürettiğiniz görseller size aittir. Platformun tasarımı, kodu ve marka unsurları NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ'ne aittir; izinsiz kopyalanamaz veya dağıtılamaz.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">7. Sorumluluğun Sınırlandırılması</h2>
        <p>Platform "olduğu gibi" sunulmaktadır. Hizmet kesintileri, veri kayıpları veya üçüncü taraf hizmetlerinden kaynaklanan sorunlar için azami sorumluluğumuz, son 3 ay içinde ödediğiniz ücretle sınırlıdır.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">8. Değişiklikler ve Fesih</h2>
        <p>Bu koşulları önceden bildirmeksizin değiştirme hakkımız saklıdır. Devam eden kullanım, güncel koşulların kabulü anlamına gelir. İhlal durumunda hesabınızı askıya alma veya sonlandırma hakkımız mevcuttur.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">9. Uygulanacak Hukuk</h2>
        <p>Bu koşullar Türkiye Cumhuriyeti hukuku kapsamında yorumlanır. Uyuşmazlıklarda Tekirdağ Mahkemeleri yetkilidir.</p>
      </section>
    </LegalLayout>
  );
}

export function IptalIade() {
  return (
    <LegalLayout title="İptal ve İade Koşulları">
      <p><strong className="text-gray-200">Son Güncelleme:</strong> {LEGAL_LAST_UPDATED}</p>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">1. Dijital Hizmetler ve Krediler</h2>
        <p>6502 sayılı Tüketicinin Korunması Hakkında Kanun'un 49. maddesi uyarınca; dijital içerik ve hizmetlerde, tüketicinin onayı ile teslimat başladıktan sonra cayma hakkı kullanılamaz.</p>
        <p className="mt-2">Bu çerçevede:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li><strong className="text-gray-300">AI Kredileri:</strong> Satın alınan ve kullanılmış krediler iade edilmez. Teknik hata nedeniyle harcanan krediler otomatik olarak iade edilir.</li>
          <li><strong className="text-gray-300">Kullanılmamış Krediler:</strong> Satın alım tarihinden itibaren 14 gün içinde hiç kullanılmamış krediler için iade talep edilebilir.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">2. Abonelik İptali</h2>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Plan değişikliği, düşürme veya kapatma talepleri satın alma modeli ve aktif hizmet kapsamına göre değerlendirilir.</li>
          <li>Devam, yenileme veya kapatma koşulları satın alma akışında ya da size sunulan özel teklifte ayrıca belirtilir.</li>
          <li>Plan değişikliği sonrası hesabınızın hangi pakete döneceği, aktif haklar ve depolama durumu destek ekibi tarafından yazılı olarak teyit edilir.</li>
          <li>Bu konudaki talepler için Dashboard destek kanalı veya info@nebulanovagames.com kullanılabilir.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">3. Mimari Danışmanlık Hizmetleri</h2>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Proje başlangıcından önce yapılan ödemeler, tarafların mutabık kaldığı durumlarda iade edilebilir.</li>
          <li>Proje süreci başladıktan sonra (çizim, render veya ruhsat süreci) gerçekleşen harcamalar düşülerek kalan tutar iade edilir.</li>
          <li>Tamamlanmış ve teslim edilmiş hizmetlerin bedeli iade edilmez.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">4. İade Süreci</h2>
        <p>Geçerli iade taleplerinizi <strong className="text-gray-300">info@nebulanovagames.com</strong> adresine sipariş numaranızla birlikte iletebilirsiniz. İadeler 5-10 iş günü içinde ödeme yönteminize gerçekleştirilir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">5. İletişim</h2>
        <p>İptal ve iade talepleriniz için: <strong className="text-gray-300">info@nebulanovagames.com</strong> veya 0 (282) 606 06 39</p>
      </section>
    </LegalLayout>
  );
}

export function MesafeliSatis() {
  return (
    <LegalLayout title="Mesafeli Satış Sözleşmesi">
      <p><strong className="text-gray-200">Son Güncelleme:</strong> {LEGAL_LAST_UPDATED}</p>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Madde 1 — Taraflar</h2>
        <div className="space-y-3">
          <div>
            <p className="text-gray-300 font-bold mb-1">Satıcı:</p>
            <p>NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ</p>
            <p>Silahtar&#x131;ağa Mah. Üniversite 1. Sk. No:13/1 İç Kapı No:Z109, 59000 Çorlu / TEKİRDAĞ</p>
            <p>Tel: 0 (282) 606 06 39 | E-posta: info@nebulanovagames.com</p>
          </div>
          <div>
            <p className="text-gray-300 font-bold mb-1">Alıcı (Tüketici):</p>
            <p>Platforma kayıtlı kullanıcı (ad, e-posta ve ödeme bilgileri kayıt sırasında belirtilmiştir).</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Madde 2 — Sözleşmenin Konusu</h2>
        <p>Bu sözleşme; Alıcı'nın Archilya platformu üzerinden satın aldığı dijital hizmetleri (Ek İşlem Paketleri, Keşif / Solo / Pro / Studio Abonelik Planları) ile mimari danışmanlık hizmetleri (Konsept Tasarım, İç Mekan Tasarımı, Peyzaj ve Çevre Düzenleme, Profesyonel Modelleme, Görselleştirme, Ruhsat ve Uygulama) ve Archilya VR hizmetlerini (Materyalsiz Aktarma, Materyalli 4K Aktarma, Full Etkileşimli 4K Aktarma, Materyalsiz Modelleme, Materyalli Modelleme, Full Etkileşimli Materyalli Modelleme, VR Aktarma — Emlak, VR Modelleme — Emlak) kapsamaktadır.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Madde 3 — Ürün / Hizmet Bilgileri ve Fiyat</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse mt-2">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-4 text-gray-400 font-bold uppercase tracking-wider">Hizmet</th>
                <th className="text-left py-2 pr-4 text-gray-400 font-bold uppercase tracking-wider">Fiyat (KDV Hariç)</th>
              </tr>
            </thead>
            <tbody className="space-y-2">
              {[
                ['Keşif Abonelik', 'Ücretsiz (5 GB Depolama, 3 Proje, 150 İşlem/ay)'],
                ['Solo Abonelik', '₺699 / ay (30 GB Depolama, 15 Proje, 1.000 İşlem/ay) · Yıllık kurumsal teklif ayrıca sunulur'],
                ['Pro Abonelik', '₺1.499 / ay (100 GB Depolama, 100 Proje, 2.200 İşlem/ay, 5 Kişilik Ekip) · Yıllık kurumsal teklif ayrıca sunulur'],
                ['Studio Abonelik', '₺4.999 / ay (750 GB Depolama, Sınırsız Proje, 7.000 İşlem/ay, 20 Kişilik Ekip) · Yıllık kurumsal teklif ayrıca sunulur'],
                ['500 Ek İşlem — Akış Takviyesi', 'Abone: ₺350 · Standart: ₺450'],
                ['1.500 Ek İşlem — Proje Hızı', 'Abone: ₺900 · Standart: ₺1.150'],
                ['4.000 Ek İşlem — İhale Sprinti', 'Abone: ₺2.200 · Standart: ₺2.700'],
                ['Konsept Tasarım (100m² baz)', '₺18.000 · Abonelere: ₺14.400'],
                ['İç Mekan Tasarımı (100m² baz)', '₺18.000 · Abonelere: ₺14.400'],
                ['Peyzaj ve Çevre Düzenleme (100m² baz)', '₺8.000 · Abonelere: ₺6.400'],
                ['Profesyonel Modelleme (100m² baz)', '₺14.000 · Abonelere: ₺11.200'],
                ['Görselleştirme / Render (100m² baz)', '₺15.000 · Abonelere: ₺12.000'],
                ['Ruhsat ve Uygulama (100m² baz)', '₺10.000 · Abonelere: ₺8.000'],
                ['Materyalsiz Aktarma', 'Normal: ₺6.000 · Abone: ₺4.800'],
                ['Materyalli 4K Aktarma', 'Normal: ₺12.000 · Abone: ₺9.600'],
                ['Full Etkileşimli 4K Aktarma', 'Temel: ₺22.000 · Orta: ₺32.000 · Geniş: ₺45.000+ · Abone: %20 indirim'],
                ['Materyalsiz Modelleme', 'Normal: ₺8.000 · Abone: ₺6.400'],
                ['Materyalli Modelleme', 'Normal: ₺18.000 · Abone: ₺14.400'],
                ['Full Etkileşimli Materyalli Modelleme', 'Temel: ₺32.000 · Orta: ₺48.000 · Geniş: ₺65.000+ · Abone: %20 indirim'],
                ['VR Aktarma — Emlak', '₺5.500–₺9.000 / daire · Abone: ek %20 indirim'],
                ['VR Modelleme — Emlak', '₺11.000–₺18.000 / daire · Abone: ek %20 indirim'],
              ].map(([hizmet, fiyat]) => (
                <tr key={hizmet} className="border-b border-white/5">
                  <td className="py-2 pr-4 text-gray-300">{hizmet}</td>
                  <td className="py-2 text-primary font-bold">{fiyat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-gray-600 text-xs">*KDV oranı %20 olarak uygulanır. Fatura kesilirken KDV ayrıca tahsil edilir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Madde 4 — Ödeme Koşulları</h2>
        <p>Ödemeler Iyzico altyapısı üzerinden güvenli şekilde Türk Lirası cinsinden alınır. Kredi kartı ile taksitli ödeme imkânı sunulur. Ödeme bilgileri Şirketimizde saklanmaz; Iyzico'nun PCI-DSS uyumlu altyapısında güvence altında tutulur.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Madde 5 — Teslimat</h2>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li><strong className="text-gray-300">AI Kredileri ve Abonelik:</strong> Ödeme onayından sonra anlık olarak hesabınıza tanımlanır.</li>
          <li><strong className="text-gray-300">Mimari Danışmanlık Hizmetleri:</strong> Proje kapsamı ve taraflarca belirlenen takvime göre teslim edilir. Teslimat süresi sözleşme imzalanmasını takip eden en geç 90 iş günüdür.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Madde 6 — Cayma Hakkı</h2>
        <p>6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca; dijital içerik ve hizmetlerde alıcının onayı ile teslimat/ifaya başlandığından cayma hakkı kullanılamaz. Fiziksel danışmanlık hizmetleri için hizmet ifasına başlanmadan önce 14 gün cayma hakkı mevcuttur.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Madde 7 — Uyuşmazlık Çözümü</h2>
        <p>Uyuşmazlıklarda T.C. Ticaret Bakanlığı tarafından belirlenen değer sınırları dahilinde Tüketici Hakem Heyeti veya Tüketici Mahkemeleri yetkilidir.</p>
      </section>

      <section>
        <h2 className="text-white font-serif text-xl italic mb-3">Madde 8 — Yürürlük</h2>
        <p>İşbu sözleşme, Alıcı'nın ödeme işlemini tamamlaması ve "Ödemeyi Onayla" butonuna tıklaması ile elektronik ortamda kurulmuş ve yürürlüğe girmiş sayılır.</p>
      </section>
    </LegalLayout>
  );
}
