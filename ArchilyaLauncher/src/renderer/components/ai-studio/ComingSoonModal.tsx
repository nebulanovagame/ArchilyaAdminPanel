import React, { useState } from 'react';
import { saveInterest } from '../../lib/coming-soon/storage';
import type { AiTool } from '../../data/aiStudioMockData';

interface ComingSoonModalProps {
  tool: AiTool | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  tool,
  isOpen,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !tool) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    saveInterest({ toolId: tool.id, email: email.trim(), submittedAt: Date.now() });
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#0f1115] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.04]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-archilya-text-dim/30">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-display text-archilya-text">{tool.name}</h2>
              <span className="text-[9px] font-mono text-archilya-text-dim/30 tracking-wider uppercase">
                Ar-Ge Aşamasında
              </span>
            </div>
          </div>
          <p className="text-[11px] text-archilya-text-dim/50 leading-relaxed">{tool.description}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-mono text-archilya-text-dim/30">
                <span className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]">
                  {tool.engineShort}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-archilya-gold/[0.06] border border-archilya-gold/10 text-archilya-gold/50">
                  {tool.creditCost} Kredi
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]">
                  Q3 2026
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-archilya-text-dim/40 uppercase tracking-wider mb-1.5">
                  E-posta adresiniz
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@archilya.com"
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/20 focus:outline-none focus:border-archilya-gold/30 transition-colors"
                  required
                />
                <p className="text-[9px] text-archilya-text-dim/20 mt-1.5">
                  Bu araç kullanıma sunulduğunda ilk siz haberdar olun.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded bg-archilya-gold/[0.08] border border-archilya-gold/25 text-[11px] font-display tracking-widest text-archilya-gold hover:bg-archilya-gold hover:text-black transition-all"
              >
                Beni Haberdar Et
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-[12px] text-archilya-text">Kaydınız alındı!</p>
              <p className="text-[11px] text-archilya-text-dim/40">
                {tool.name} kullanıma sunulduğunda {email} adresine bilgilendirme göndereceğiz.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded border border-white/[0.06] bg-white/[0.02] text-[11px] text-archilya-text-dim/50 hover:text-archilya-text hover:bg-white/[0.04] transition-all"
              >
                Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
