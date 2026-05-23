import React, { useState, useCallback, useEffect } from 'react';

interface AiPromptSuggestionsProps {
  imageDataUrl: string | null;
  onSuggestionClick: (text: string) => void;
  toolType: 'render' | 'style' | 'enhance' | 'scene' | 'plan';
}

const MOCK_SUGGESTIONS: Record<string, string[]> = {
  render: [
    "Altın saat ışığında, Akdeniz manzaralı, infinity havuzlu lüks villa",
    "Sisli sabah, orman içinde, büyük cam cepheli minimalist ev",
    "Gece şehir manzaralı, modern rezidans, sıcak iç mekan aydınlatması",
  ],
  style: [
    "Cepheye doğal taş kaplama ekle, rustik lüks hissi ver",
    "Daha fazla yeşil alan ve su öğesi ekle, huzurlu atmosfer",
    "Endüstriyel çelik detaylar ekle, New York loft tarzı",
  ],
  enhance: [
    "Malzeme dokularını zenginleştir, beton ve ahşap dokusu belirgin olsun",
    "Atmosferik perspektif ekle, sisli arka plan, derinlik hissi",
    "Işık-gölge kontrastını artır, dramatik ama doğal aydınlatma",
  ],
  scene: [
    "Balkonu kapat, camlı kış bahçesi yap, bitki örtüsü ekle",
    "Ön cepheye küçük bir su öğesi/refleksyon havuzu ekle",
    "Girişe modern bir pergola ve asma bitkiler ekle",
  ],
  plan: [
    "Sıcak tonlar, doğal ahşap ve taş dokusu, kış mekan hissi",
    "Soğuk tonlar, beyaz mermer ve cam, minimalist modern his",
    "Nötr tonlar, bej ve gri, zamansız ve elegan his",
  ],
};

export const AiPromptSuggestions: React.FC<AiPromptSuggestionsProps> = ({
  imageDataUrl,
  onSuggestionClick,
  toolType,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  useEffect(() => {
    if (!imageDataUrl) {
      setSuggestions([]);
      setHasAnalyzed(false);
      return;
    }

    if (hasAnalyzed) return;

    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      const pool = MOCK_SUGGESTIONS[toolType] || MOCK_SUGGESTIONS.render;
      // Pick 3 random but deterministic based on image length
      const seed = imageDataUrl.length % pool.length;
      const picks: string[] = [];
      for (let i = 0; i < 3; i++) {
        picks.push(pool[(seed + i) % pool.length]);
      }
      setSuggestions(picks);
      setIsAnalyzing(false);
      setHasAnalyzed(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [imageDataUrl, toolType, hasAnalyzed]);

  const handleReset = useCallback(() => {
    setHasAnalyzed(false);
    setSuggestions([]);
  }, []);

  if (!imageDataUrl) return null;

  if (isAnalyzing) {
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 border-2 border-archilya-gold/30 border-t-archilya-gold rounded-full animate-spin" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 animate-pulse">
            Görsel analiz ediliyor...
          </p>
        </div>
        <div className="space-y-2">
          <div className="h-8 rounded-lg bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          <div className="h-8 rounded-lg bg-white/[0.02] border border-white/[0.04] animate-pulse" />
          <div className="h-8 rounded-lg bg-white/[0.02] border border-white/[0.04] animate-pulse" />
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
          AI Önerileri
        </p>
        <button
          onClick={handleReset}
          className="text-[10px] font-mono text-archilya-text-dim/40 hover:text-archilya-gold transition-colors"
        >
          Yenile
        </button>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSuggestionClick(suggestion)}
            className="w-full text-left px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-archilya-gold/30 hover:bg-archilya-gold/[0.05] transition-all duration-200 group"
          >
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-mono text-archilya-gold/50 mt-0.5 shrink-0">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-[12px] text-archilya-text-dim/70 group-hover:text-archilya-text transition-colors leading-relaxed">
                {suggestion}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
