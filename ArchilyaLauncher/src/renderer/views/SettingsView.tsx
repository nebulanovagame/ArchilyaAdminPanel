import React, { useEffect, useState } from 'react';
import type { LauncherSettings, UserData } from '../../shared/types';

const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between gap-4 py-2.5 border-b border-white/[0.03] last:border-0 cursor-pointer group">
    <span className="text-[12px] text-archilya-text-dim/75 group-hover:text-archilya-text/85 transition-colors">
      {label}
    </span>
    <button
      type="button"
      onClick={onChange}
      className={`relative w-8 h-4 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none ${
        checked ? 'bg-archilya-gold/30' : 'bg-white/[0.06]'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-3 w-3 rounded-full transition-all duration-200 ${
          checked
            ? 'left-[calc(100%-0.875rem)] bg-archilya-gold'
            : 'left-0.5 bg-archilya-text-dim/40'
        }`}
      />
    </button>
  </label>
);

interface SettingsViewProps {
  workMode: 'solo' | 'office';
  onWorkModeChange: (mode: 'solo' | 'office') => void;
  onLogout?: () => void;
  user: UserData;
}

const defaultSettings: LauncherSettings = {
  autoStart: true,
  backgroundSync: true,
  wifiOnly: false,
  notifSync: true,
  notifLock: true,
  notifProject: false,
  notifSystem: true,
  syncSpeed: 'unlimited',
  themeMode: 'dark',
  storagePath: 'C:\\Belgelerim\\Archilya',
};

export const SettingsView: React.FC<SettingsViewProps> = ({ workMode, onWorkModeChange, onLogout, user }) => {
  const [settings, setSettings] = useState<LauncherSettings>(defaultSettings);

  useEffect(() => {
    window.api.getSettings()
      .then((response) => {
        if (response.success && response.settings) {
          setSettings({ ...defaultSettings, ...response.settings });
        }
      })
      .catch(() => {
        // keep defaults
      });
  }, []);

  const updateSetting = <K extends keyof LauncherSettings>(key: K, value: LauncherSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    void window.api.updateSettings({ [key]: value });
  };

  const { autoStart, backgroundSync, wifiOnly, notifSync, notifLock, notifProject, notifSystem, syncSpeed, themeMode, storagePath } = settings;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-8">
      <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase mb-8">
        Ayarlar
      </h1>

      <div className="max-w-2xl space-y-5">
        {/* Hesap */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Hesap
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 shrink-0 rounded-full bg-archilya-gold/[0.08] border border-archilya-gold/20 flex items-center justify-center">
                <span className="text-[14px] font-display text-archilya-gold font-bold">
                  {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : user.email?.slice(0, 2).toUpperCase() || '?'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-archilya-text font-medium truncate">
                  {user.displayName || 'Kullanıcı'}
                </p>
                <p className="text-[11px] text-archilya-text-dim/65 truncate">
                  {user.email || ''}
                </p>
                <span className="inline-flex rounded-full border border-archilya-gold/15 bg-archilya-gold/[0.06] px-2 py-0.5 text-[10px] font-mono text-archilya-gold/80 mt-1">
                  {user.isGuest ? 'Misafir' : 'Kullanıcı'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-archilya-text font-medium truncate">
                  {user.displayName || 'Kullanıcı'}
                </p>
                <p className="text-[11px] text-archilya-text-dim/65 truncate">
                  {user.email || ''}
                </p>
                <span className="inline-flex rounded-full border border-archilya-gold/15 bg-archilya-gold/[0.06] px-2 py-0.5 text-[10px] font-mono text-archilya-gold/80 mt-1">
                  {user.isGuest ? 'Misafir' : 'Kullanıcı'}
                </span>
              </div>
            </div>
              <button
              type="button"
              onClick={async () => {
                if (window.confirm('Oturumu kapatmak istediginize emin misiniz?')) {
                  await window.api.logout();
                  onLogout?.();
                }
              }}
              className="text-[10px] font-display tracking-wider text-red-400/70 hover:text-red-400 border border-red-400/10 hover:border-red-400/30 px-3 py-1.5 rounded transition-all flex-shrink-0"
            >
              CIKIS YAP
            </button>
          </div>
        </div>

        {/* Çalışma Modu */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Calisma Modu
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-archilya-text-dim/75 mb-1">
                {workMode === 'solo' ? 'Solo (1 Kisi)' : 'Ofis (5+ Kisi)'}
              </p>
              <p className="text-[10px] text-archilya-text-dim/45">
                {workMode === 'solo'
                  ? 'Panolar ve Aktivite gizlendi. Odaklanmis tasarım arayuzu.'
                  : 'Tam kurumsal deneyim. Kanban, aktivite ve ekip yonetimi.'}
              </p>
            </div>
            <div className="flex items-center rounded-lg border border-white/[0.06] overflow-hidden flex-shrink-0">
              <button
                type="button"
                onClick={() => onWorkModeChange('solo')}
                className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors ${
                  workMode === 'solo'
                    ? 'bg-archilya-gold/[0.12] text-archilya-gold border-r border-white/[0.06]'
                    : 'text-archilya-text-dim/50 hover:text-archilya-text/70 border-r border-white/[0.06]'
                }`}
              >
                SOLO
              </button>
              <button
                type="button"
                onClick={() => onWorkModeChange('office')}
                className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors ${
                  workMode === 'office'
                    ? 'bg-archilya-gold/[0.12] text-archilya-gold'
                    : 'text-archilya-text-dim/50 hover:text-archilya-text/70'
                }`}
              >
                OFIS
              </button>
            </div>
          </div>
        </div>

        {/* Proje Klasoru */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Proje Klasoru
          </p>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 font-mono text-[11px] text-archilya-text-dim/75">
              C:\Users\Ahmet\Documents\Archilya
            </div>
            <button className="text-[10px] font-display tracking-wider text-archilya-gold/70 hover:text-archilya-gold border border-archilya-gold/10 hover:border-archilya-gold/25 px-3 py-2 rounded transition-all flex-shrink-0">
              DEGISTIR
            </button>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-archilya-text-dim/50">
                Disk Kullanimi
              </span>
              <span className="text-[10px] font-mono text-archilya-text-dim/50">
                68%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full w-[68%] rounded-full bg-archilya-gold/60" />
            </div>
            <p className="text-[9px] font-mono text-archilya-text-dim/40 mt-1">
              845 GB / 1.2 TB kullaniliyor
            </p>
          </div>
        </div>

        {/* Yerel Depolama Yolu */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Yerel Depolama Yolu
          </p>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 font-mono text-[11px] text-archilya-text-dim/75">
              {storagePath}
            </div>
            <button
              type="button"
              onClick={() => updateSetting('storagePath', 'C:\\Users\\Ahmet\\Belgelerim\\Archilya')}
              className="text-[10px] font-display tracking-wider text-archilya-gold/70 hover:text-archilya-gold border border-archilya-gold/10 hover:border-archilya-gold/25 px-3 py-2 rounded transition-all flex-shrink-0"
            >
              KLASORU DEGISTIR
            </button>
          </div>
        </div>

        {/* Senkronizasyon Hız Sınırı */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Senkronizasyon Hiz Siniri
          </p>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-archilya-text-dim/75">
              Agdan maksimum senkronizasyon hizi
            </span>
            <span className="text-[11px] font-mono text-archilya-gold/80">
              {syncSpeed === 'unlimited' ? 'Limitsiz' : syncSpeed === '5mbps' ? '5 MB/s' : '1 MB/s'}
            </span>
          </div>
          <div className="flex items-center rounded-lg border border-white/[0.06] overflow-hidden flex-shrink-0 w-fit">
            <button
              type="button"
              onClick={() => updateSetting('syncSpeed', 'unlimited')}
              className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors border-r border-white/[0.06] ${
                syncSpeed === 'unlimited'
                  ? 'bg-archilya-gold/[0.12] text-archilya-gold'
                  : 'text-archilya-text-dim/50 hover:text-archilya-text/70'
              }`}
            >
              LIMITSIZ
            </button>
            <button
              type="button"
              onClick={() => updateSetting('syncSpeed', '5mbps')}
              className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors border-r border-white/[0.06] ${
                syncSpeed === '5mbps'
                  ? 'bg-archilya-gold/[0.12] text-archilya-gold'
                  : 'text-archilya-text-dim/50 hover:text-archilya-text/70'
              }`}
            >
              5 MB/s
            </button>
            <button
              type="button"
              onClick={() => updateSetting('syncSpeed', '1mbps')}
              className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors ${
                syncSpeed === '1mbps'
                  ? 'bg-archilya-gold/[0.12] text-archilya-gold'
                  : 'text-archilya-text-dim/50 hover:text-archilya-text/70'
              }`}
            >
              1 MB/s
            </button>
          </div>
        </div>

        {/* Senkronizasyon */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Senkronizasyon
          </p>
          <div className="space-y-0">
            <ToggleRow
              label="Otomatik baslat (Windows acilisinda)"
              checked={autoStart}
              onChange={() => updateSetting('autoStart', !autoStart)}
            />
            <ToggleRow
              label="Her zaman arka planda calis"
              checked={backgroundSync}
              onChange={() => updateSetting('backgroundSync', !backgroundSync)}
            />
            <ToggleRow
              label="Sadece Wi-Fi uzerinde senkronize et"
              checked={wifiOnly}
              onChange={() => updateSetting('wifiOnly', !wifiOnly)}
            />
          </div>
        </div>

        {/* Bant Genisligi */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Bant Genisligi
          </p>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-archilya-text-dim/75">
              Maksimum hiz siniri
            </span>
            <span className="text-[11px] font-mono text-archilya-gold/80">
              50 MB/s
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-white/[0.05]">
            <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-archilya-gold/60" />
            <div className="absolute top-1/2 left-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border border-archilya-gold/60 bg-[#111] shadow-lg shadow-black/40" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[9px] font-mono text-archilya-text-dim/40">
              10 MB/s
            </span>
            <span className="text-[9px] font-mono text-archilya-text-dim/40">
              100 MB/s
            </span>
          </div>
        </div>

        {/* Tema Tercihi */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Tema Tercihi
          </p>
          <div className="flex items-center rounded-lg border border-white/[0.06] overflow-hidden flex-shrink-0 w-fit mb-4">
            <button
              type="button"
              onClick={() => updateSetting('themeMode', 'dark')}
              className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors border-r border-white/[0.06] ${
                themeMode === 'dark'
                  ? 'bg-archilya-gold/[0.12] text-archilya-gold'
                  : 'text-archilya-text-dim/50 hover:text-archilya-text/70'
              }`}
            >
              KOYU
            </button>
            <button
              type="button"
              onClick={() => updateSetting('themeMode', 'light')}
              className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors border-r border-white/[0.06] ${
                themeMode === 'light'
                  ? 'bg-archilya-gold/[0.12] text-archilya-gold'
                  : 'text-archilya-text-dim/50 hover:text-archilya-text/70'
              }`}
            >
              ACIK
            </button>
            <button
              type="button"
              onClick={() => updateSetting('themeMode', 'system')}
              className={`px-3 py-1.5 text-[10px] font-mono tracking-wider transition-colors ${
                themeMode === 'system'
                  ? 'bg-archilya-gold/[0.12] text-archilya-gold'
                  : 'text-archilya-text-dim/50 hover:text-archilya-text/70'
              }`}
            >
              SISTEM
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className={`w-16 h-10 rounded-lg border flex items-center justify-center transition-all ${
                themeMode === 'dark' ? 'border-2 border-archilya-gold/35 bg-[#0a0a0a]' : 'border border-white/[0.06] bg-[#0a0a0a] opacity-60'
              }`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={themeMode === 'dark' ? 'text-archilya-gold/70' : 'text-archilya-text-dim/40'}
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              </div>
              <span className={`text-[10px] font-mono ${themeMode === 'dark' ? 'text-archilya-gold/80' : 'text-archilya-text-dim/40'}`}>
                Koyu
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-16 h-10 rounded-lg border flex items-center justify-center transition-all ${
                themeMode === 'light' ? 'border-2 border-archilya-gold/35 bg-white/80' : 'border border-white/[0.06] bg-white/80 opacity-60'
              }`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={themeMode === 'light' ? 'text-archilya-dark' : 'text-archilya-dark opacity-40'}
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              </div>
              <span className={`text-[10px] font-mono ${themeMode === 'light' ? 'text-archilya-gold/80' : 'text-archilya-text-dim/40'}`}>
                Acik
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-16 h-10 rounded-lg border flex items-center justify-center transition-all ${
                themeMode === 'system' ? 'border-2 border-archilya-gold/35 bg-white/[0.05]' : 'border border-white/[0.06] bg-white/[0.05] opacity-60'
              }`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={themeMode === 'system' ? 'text-archilya-gold/70' : 'text-archilya-text-dim/40'}
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <span className={`text-[10px] font-mono ${themeMode === 'system' ? 'text-archilya-gold/80' : 'text-archilya-text-dim/40'}`}>
                Sistem
              </span>
            </div>
          </div>
        </div>

        {/* Bildirim Tercihleri */}
        <div className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
            Bildirim Tercihleri
          </p>
          <div className="space-y-0">
            <ToggleRow
              label="Dosya senkronizasyonu"
              checked={notifSync}
              onChange={() => updateSetting('notifSync', !notifSync)}
            />
            <ToggleRow
              label="Kilit uyarlari"
              checked={notifLock}
              onChange={() => updateSetting('notifLock', !notifLock)}
            />
            <ToggleRow
              label="Proje degisiklikleri"
              checked={notifProject}
              onChange={() => updateSetting('notifProject', !notifProject)}
            />
            <ToggleRow
              label="Sistem guncellemeleri"
              checked={notifSystem}
              onChange={() => updateSetting('notifSystem', !notifSystem)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
