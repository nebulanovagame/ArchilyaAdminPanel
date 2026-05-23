import React, { useState } from 'react';
import type { CreateProjectData, FirebaseProjectStatus } from '../../shared/types';

interface AddProjectModalProps {
  loading:   boolean;
  onSubmit:  (data: CreateProjectData) => Promise<void>;
  onClose:   () => void;
}

const STATUS_OPTIONS: FirebaseProjectStatus[] = ['Aktif', 'Taslak', 'İncelemede', 'Tamamlandı'];

export const AddProjectModal: React.FC<AddProjectModalProps> = ({ loading, onSubmit, onClose }) => {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [status,      setStatus]      = useState<FirebaseProjectStatus>('Aktif');
  const [location,    setLocation]    = useState('');
  const [error,       setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Proje adı boş olamaz.');
      return;
    }
    setError('');
    await onSubmit({ name, description, status, location });
  };

  const inputClass = `
    w-full bg-archilya-dark/60 border border-white/10 rounded
    px-3 py-2 text-archilya-text text-xs font-mono
    focus:outline-none focus:border-archilya-gold/50
    placeholder:text-white/10 transition-colors duration-200
  `;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[440px] bg-archilya-panel border border-white/10 rounded-lg shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Üst çizgi */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-archilya-gold/50 to-transparent" />

        {/* Başlık */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <p className="text-[9px] text-archilya-gold/60 uppercase tracking-[0.3em] font-display">Proje Yönetimi</p>
            <h2 className="text-base font-display text-archilya-text tracking-wider mt-0.5">YENİ PROJE OLUŞTUR</h2>
          </div>
          <button
            onClick={onClose}
            className="text-archilya-text-dim hover:text-archilya-text transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Proje Adı */}
          <div>
            <label className="block text-[9px] text-archilya-gold/60 uppercase tracking-[0.2em] mb-1.5">
              Proje Adı *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Villa Noir, Ofis Tower..."
              className={inputClass}
              autoFocus
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-[9px] text-archilya-gold/60 uppercase tracking-[0.2em] mb-1.5">
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kısa bir açıklama..."
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Konum + Durum (yan yana) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] text-archilya-gold/60 uppercase tracking-[0.2em] mb-1.5">
                Konum
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="İstanbul, Ankara..."
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[9px] text-archilya-gold/60 uppercase tracking-[0.2em] mb-1.5">
                Durum
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FirebaseProjectStatus)}
                className={`${inputClass} appearance-none cursor-pointer`}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="bg-archilya-panel text-archilya-text">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hata */}
          {error && (
            <p className="text-[10px] text-red-400 border border-red-500/20 bg-red-500/5 px-3 py-2 rounded">
              {error}
            </p>
          )}

          {/* Butonlar */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 border border-white/10 text-archilya-text-dim hover:text-archilya-text text-[10px] font-display tracking-widest uppercase rounded transition-all disabled:opacity-50"
            >
              İPTAL
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2.5 bg-archilya-gold text-black text-[10px] font-display font-bold tracking-widest uppercase rounded hover:bg-[#F4CF57] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  OLUŞTURULUYOR...
                </>
              ) : 'OLUŞTUR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
