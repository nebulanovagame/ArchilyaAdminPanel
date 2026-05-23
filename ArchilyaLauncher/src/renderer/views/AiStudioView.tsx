import React, { useState } from 'react';
import { TextToRenderPanel } from '../components/ai-studio/TextToRenderPanel';
import { SketchupRenderPanel } from '../components/ai-studio/SketchupRenderPanel';
import { StyleTransferPanel } from '../components/ai-studio/StyleTransferPanel';
import { EnhancePanel } from '../components/ai-studio/EnhancePanel';
import { SceneEditPanel } from '../components/ai-studio/SceneEditPanel';
import { PlanColorPanel } from '../components/ai-studio/PlanColorPanel';
import { ArchReportPanel } from '../components/ai-studio/ArchReportPanel';
import { RenderQualityPanel } from '../components/ai-studio/RenderQualityPanel';
import { MaterialListPanel } from '../components/ai-studio/MaterialListPanel';
import { ComingSoonModal } from '../components/ai-studio/ComingSoonModal';
import { AI_TOOLS, AI_TOOL_CATEGORY_LABELS } from '../data/aiStudioMockData';
import type { AiTool } from '../data/aiStudioMockData';

const CATEGORY_ORDER: Array<keyof typeof AI_TOOL_CATEGORY_LABELS> = [
  'core',
  'conversion',
  'analysis-doc',
  'rd',
];

const ToolIcon: React.FC<{ path: string; className?: string }> = ({ path, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {path.split(' M').map((segment, i) => (
      <path key={i} d={i === 0 ? segment : 'M' + segment} />
    ))}
  </svg>
);

const ToolCard: React.FC<{
  tool: AiTool;
  onClick: () => void;
}> = ({ tool, onClick }) => {
  const isLocked = !tool.active;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      className={`
        relative group text-left rounded-xl border transition-all duration-300 overflow-hidden
        ${isLocked
          ? 'opacity-40 border-white/[0.04] bg-white/[0.015] cursor-not-allowed'
          : 'border-white/[0.08] bg-white/[0.03] hover:border-archilya-gold/25 hover:bg-white/[0.06] hover:shadow-[0_0_24px_rgba(212,175,55,0.06)] cursor-pointer'
        }
      `}
    >
      {/* Top accent line */}
      <div className={`
        absolute top-0 left-0 right-0 h-[1.5px] transition-opacity duration-300
        ${isLocked ? 'bg-archilya-text-dim/10' : 'bg-archilya-gold/0 group-hover:bg-archilya-gold/40'}
      `} />

      <div className="p-5 flex flex-col gap-3">
        {/* Header: Icon + Name + Lock */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center border transition-colors duration-300
              ${isLocked
                ? 'bg-white/[0.02] border-white/[0.05] text-archilya-text-dim/30'
                : 'bg-archilya-gold/[0.06] border-archilya-gold/15 text-archilya-gold/70 group-hover:text-archilya-gold group-hover:bg-archilya-gold/[0.10]'
              }
            `}>
              <ToolIcon path={tool.iconSvg} />
            </div>
            <div>
              <h3 className={`
                font-display text-[13px] tracking-[0.12em] uppercase transition-colors
                ${isLocked ? 'text-archilya-text-dim/40' : 'text-archilya-text group-hover:text-archilya-gold/90'}
              `}>
                {tool.name}
              </h3>
              <p className="text-[10px] font-mono text-archilya-text-dim/40 tracking-wider mt-0.5">
                {AI_TOOL_CATEGORY_LABELS[tool.category]}
              </p>
            </div>
          </div>
          {isLocked && (
            <div className="flex items-center gap-1 text-archilya-text-dim/30">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          )}
        </div>

        {/* Description */}
        <p className={`
          text-[11px] leading-relaxed transition-colors
          ${isLocked ? 'text-archilya-text-dim/25' : 'text-archilya-text-dim/55 group-hover:text-archilya-text-dim/70'}
        `}>
          {tool.description}
        </p>

        {/* Footer: Engine + Credits */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <span className="text-[9px] font-mono text-archilya-text-dim/35 tracking-wider uppercase">
            {tool.engineShort}
          </span>
          {tool.active ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-archilya-gold/70">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2z"/>
              </svg>
              {tool.creditCost} Kredi
            </span>
          ) : (
            <span className="text-[10px] font-mono text-archilya-text-dim/30 tracking-wider uppercase">
              Yakında
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const ToolWorkspace: React.FC<{
  tool: AiTool;
  onBack: () => void;
}> = ({ tool, onBack }) => {
  const renderPanel = () => {
    switch (tool.id) {
      case 'render-from-scratch':
        return <TextToRenderPanel />;
      case 'sketchup-render':
        return <SketchupRenderPanel />;
      case 'style-transfer':
        return <StyleTransferPanel />;
      case 'enhance':
        return <EnhancePanel />;
      case 'scene-edit':
        return <SceneEditPanel />;
      case 'plancolor':
        return <PlanColorPanel />;
      case 'arch-report':
        return <ArchReportPanel />;
      case 'render-quality':
        return <RenderQualityPanel />;
      case 'material-list':
        return <MaterialListPanel />;
      default:
        return (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-8 text-center">
            <p className="text-archilya-text-dim/50 text-sm">Bu araç yakında kullanıma sunulacak.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back Button + Tool Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-archilya-gold/25 bg-archilya-gold/[0.08] text-[11px] font-display tracking-widest text-archilya-gold transition-all hover:border-archilya-gold/45 hover:bg-archilya-gold/15 hover:text-[#F4CF57]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Araçlara Dön
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-archilya-gold/[0.08] border border-archilya-gold/15 flex items-center justify-center text-archilya-gold/70">
            <ToolIcon path={tool.iconSvg} className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
              {tool.name}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-archilya-text-dim/40 tracking-wider">
                {tool.engineShort}
              </span>
              <span className="text-[10px] font-mono text-archilya-gold/60">
                {tool.creditCost} Kredi
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel */}
      {renderPanel()}
    </div>
  );
};

export const AiStudioView: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<AiTool | null>(null);
  const [comingSoonTool, setComingSoonTool] = useState<AiTool | null>(null);

  const handleSelectTool = (tool: AiTool) => {
    if (!tool.active) {
      setComingSoonTool(tool);
      return;
    }
    setSelectedTool(tool);
  };

  const handleBack = () => {
    setSelectedTool(null);
  };

  // Group tools by category preserving order from AI_TOOLS array
  const toolsByCategory = React.useMemo(() => {
    const grouped = new Map<string, AiTool[]>();
    for (const tool of AI_TOOLS) {
      const cat = tool.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(tool);
    }
    return grouped;
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 lg:p-6">
      {selectedTool ? (
        <div className="max-w-5xl mx-auto">
          <ToolWorkspace tool={selectedTool} onBack={handleBack} />
        </div>
      ) : (
        <>
        <ComingSoonModal
          tool={comingSoonTool}
          isOpen={!!comingSoonTool}
          onClose={() => setComingSoonTool(null)}
        />
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase">
              Yapay Zeka Cephaneliği
            </h1>
            <p className="mt-2 text-[12px] text-archilya-text-dim/65 tracking-wide">
              Mimerra ve Archilya Web Panel motorlarını birleştiren üretim araçları — 15+ AI yeteneği, 4 kategori
            </p>
          </div>

          {/* Category Groups */}
          <div className="space-y-8">
            {CATEGORY_ORDER.map((category) => {
              const tools = toolsByCategory.get(category) || [];
              if (tools.length === 0) return null;

              return (
                <div key={category}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-archilya-gold/60">
                      {AI_TOOL_CATEGORY_LABELS[category]}
                    </h2>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                    <span className="text-[10px] font-mono text-archilya-text-dim/30">
                      {tools.filter((t) => t.active).length} / {tools.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {tools.map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        onClick={() => handleSelectTool(tool)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Batch Generation Placeholder */}
          <div className="mt-8 pt-6 border-t border-white/[0.04]">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-archilya-gold/60">
                Toplu Üretim
              </h2>
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-archilya-gold/[0.08] text-archilya-gold/50 border border-archilya-gold/15">
                Yakında
              </span>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-6 flex flex-col items-center gap-3 text-archilya-text-dim/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
              <p className="text-[12px] font-display tracking-wide">Toplu AI Üretimi</p>
              <p className="text-[11px] text-archilya-text-dim/15 text-center max-w-md">
                Birden fazla prompt ve stili aynı anda sıraya ekleyip toplu render alabileceksiniz.
                Her bir üretim ayrı ayrı kredi düşecek ve galeriye kaydedilecek.
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-10 pt-6 border-t border-white/[0.04]">
            <p className="text-[10px] font-mono text-archilya-text-dim/30 tracking-wider text-center">
              Tüm AI işlemleri Google Gemini ve Replicate altyapısı üzerinden çalışır.
              Kredi maliyetleri işlem başına tahmini değerlerdir.
            </p>
          </div>
        </div>
        </>
      )}
    </div>
  );
};
