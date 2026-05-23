export interface PromptTemplate {
  id: string;
  label: string;
  text: string;
}

export const TEXT_TO_RENDER_TEMPLATES: PromptTemplate[] = [
  { id: 'ttr-1', label: 'Akdeniz Villa', text: 'Akdeniz manzaralı modern villa, infinity havuz, altın saat ışığı' },
  { id: 'ttr-2', label: 'Orman Ev', text: 'Orman içinde minimalist ahşap ev, sisli sabah, büyük cam cepheler' },
  { id: 'ttr-3', label: 'Lüks Rezidans', text: 'Şehir merkezinde lüks rezidans, gece, neon aydınlatma' },
  { id: 'ttr-4', label: 'Gelecekçi Cam', text: 'Gelecekçi cam yapı, dağ manzaralı, yıldızlı gece' },
];

export const SKETCHUP_RENDER_TEMPLATES: PromptTemplate[] = [
  { id: 'skr-1', label: 'Dış Mekan', text: 'Photorealistic dış mekan render, doğal ışık, peyzaj' },
  { id: 'skr-2', label: 'Gece İç Mekan', text: 'Gece render, iç mekan aydınlatma, sıcak atmosfer' },
  { id: 'skr-3', label: 'Drone Açısı', text: 'Havadan drone açısı, site plan, çevre dokusu' },
];

export const STYLE_TRANSFER_TEMPLATES: PromptTemplate[] = [
  { id: 'st-1', label: 'Yeşil Cephe', text: 'Cepheye daha fazla yeşil bitki örtüsü ekle' },
  { id: 'st-2', label: 'Premium Hissi', text: 'Daha lüks ve premium malzeme hissi ver' },
  { id: 'st-3', label: 'Altın Saat', text: 'Altın saat ışığında sıcak atmosfer yarat' },
  { id: 'st-4', label: 'Kış Manzarası', text: 'Kış manzarası, karlı zemin, soğuk ışık' },
];

export const ENHANCE_TEMPLATES: PromptTemplate[] = [
  { id: 'enh-1', label: 'Golden Hour', text: 'Golden hour ışığı öncelikli olsun' },
  { id: 'enh-2', label: 'Malzeme Doku', text: 'Malzeme dokularını daha belirgin hale getir' },
  { id: 'enh-3', label: 'Arka Plan', text: 'Arka planı daha gerçekçi ve atmosferik yap' },
  { id: 'enh-4', label: 'Gölge Derinliği', text: 'Gölge derinliğini artır, kontrast zenginleştir' },
];

export const SCENE_EDIT_TEMPLATES: PromptTemplate[] = [
  { id: 'se-1', label: 'Kış Bahçesi', text: 'Balkonu kapat ve camlı bir kış bahçesi yap' },
  { id: 'se-2', label: 'Havuz', text: 'Ön bahçeye küçük bir havuz ekle' },
  { id: 'se-3', label: 'Ahşap Cephe', text: 'Cepheyi ahşap panelle kapla' },
  { id: 'se-4', label: 'Outdoor Mobilya', text: 'Terasa modern outdoor mobilya yerleştir' },
];

export const PLAN_COLOR_TEMPLATES: PromptTemplate[] = [
  { id: 'pc-1', label: 'Sıcak Tonlar', text: 'Sıcak tonlar, ahşap ve taş malzemeler' },
  { id: 'pc-2', label: 'Soğuk Tonlar', text: 'Soğuk tonlar, mermer ve cam ağırlıklı' },
  { id: 'pc-3', label: 'Modern Kontrast', text: 'Modern kontrast, siyah-beyaz + tek vurgu rengi' },
];

export const ARCH_REPORT_TEMPLATES: PromptTemplate[] = [
  { id: 'ar-1', label: 'Kompozisyon', text: 'Render açısı ve kompozisyon hakkında yorum yap' },
  { id: 'ar-2', label: 'İkna Potansiyeli', text: 'Müşteri ikna potansiyelini değerlendir' },
  { id: 'ar-3', label: 'Sürdürülebilirlik', text: 'Sürdürülebilirlik ve enerji verimliliği analizi' },
  { id: 'ar-4', label: 'Malzeme Analizi', text: 'Malzeme kalitesi ve maliyet-etkinlik önerileri' },
];

export function getTemplatesForTool(toolId: string): PromptTemplate[] {
  switch (toolId) {
    case 'render-from-scratch':
      return TEXT_TO_RENDER_TEMPLATES;
    case 'sketchup-render':
      return SKETCHUP_RENDER_TEMPLATES;
    case 'style-transfer':
      return STYLE_TRANSFER_TEMPLATES;
    case 'enhance':
      return ENHANCE_TEMPLATES;
    case 'scene-edit':
      return SCENE_EDIT_TEMPLATES;
    case 'plancolor':
      return PLAN_COLOR_TEMPLATES;
    case 'arch-report':
      return ARCH_REPORT_TEMPLATES;
    default:
      return [];
  }
}