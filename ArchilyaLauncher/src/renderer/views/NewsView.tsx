import React from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type UrgencyLevel = 'critical' | 'warning' | 'safe';

interface DeliveryItem {
  id: string;
  projectName: string;
  deadline: string;
  urgency: UrgencyLevel;
}

interface ApprovalItem {
  id: string;
  description: string;
  waitingTime: string;
  fileType: string;
}

interface ActivityEntry {
  id: string;
  person: string;
  action: string;
  timestamp: string;
  color: string;
}

// ── Urgency helpers ───────────────────────────────────────────────────────────

const URGENCY_STYLES: Record<UrgencyLevel, { text: string; border: string; bg: string; dot: string }> = {
  critical: {
    text: 'text-red-400',
    border: 'border-red-400/20',
    bg: 'bg-red-500/[0.08]',
    dot: 'bg-red-400',
  },
  warning: {
    text: 'text-amber-400',
    border: 'border-amber-400/20',
    bg: 'bg-amber-500/[0.08]',
    dot: 'bg-amber-400',
  },
  safe: {
    text: 'text-emerald-400',
    border: 'border-emerald-400/20',
    bg: 'bg-emerald-500/[0.08]',
    dot: 'bg-emerald-400',
  },
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const DELIVERIES: DeliveryItem[] = [
  {
    id: 'd1',
    projectName: 'Villa Alpha Detay Projesi',
    deadline: 'Son 3 Gün',
    urgency: 'critical',
  },
  {
    id: 'd2',
    projectName: 'Ofis Kompleksi Beta Ruhsat',
    deadline: 'Son 1 Hafta',
    urgency: 'warning',
  },
  {
    id: 'd3',
    projectName: 'Konut Sitesi Gama İhale',
    deadline: 'Son 14 Gün',
    urgency: 'safe',
  },
  {
    id: 'd4',
    projectName: 'AVM Delta Şematik',
    deadline: 'Son 2 Gün',
    urgency: 'critical',
  },
];

const APPROVALS: ApprovalItem[] = [
  {
    id: 'a1',
    description: "Ahmet Bey'den Revit modeli onayı",
    waitingTime: '2 gün',
    fileType: 'RVT',
  },
  {
    id: 'a2',
    description: 'Yapı mühendisinden zemin kat planı',
    waitingTime: '5 gün',
    fileType: 'DWG',
  },
  {
    id: 'a3',
    description: 'Müşteri onayı cephe malzeme',
    waitingTime: '1 gün',
    fileType: 'PDF',
  },
  {
    id: 'a4',
    description: 'Elektrik mühendisinden şartname',
    waitingTime: '3 gün',
    fileType: 'DOC',
  },
];

const ACTIVITIES: ActivityEntry[] = [
  {
    id: 'r1',
    person: 'Zeynep',
    action: '01_Zemin_Kat.dwg güncelledi',
    timestamp: '5 dk',
    color: 'bg-emerald-400',
  },
  {
    id: 'r2',
    person: 'Mehmet',
    action: 'Villa Alpha VR render',
    timestamp: '12 dk',
    color: 'bg-archilya-gold',
  },
  {
    id: 'r3',
    person: 'Ayşe',
    action: 'Cephe_A_B.pdf onayladı',
    timestamp: '25 dk',
    color: 'bg-blue-400',
  },
  {
    id: 'r4',
    person: 'Burak',
    action: 'ruhsat evrakları yükledi',
    timestamp: '1 saat',
    color: 'bg-amber-400',
  },
  {
    id: 'r5',
    person: 'Selin',
    action: '3D model Revizyon B',
    timestamp: '2 saat',
    color: 'bg-violet-400',
  },
  {
    id: 'r6',
    person: 'Deniz',
    action: 'AI Render isteği',
    timestamp: '3 saat',
    color: 'bg-rose-400',
  },
];

// ── File-type badge colors ─────────────────────────────────────────────────────

const FILE_TYPE_COLORS: Record<string, string> = {
  RVT: 'text-blue-400 bg-blue-500/[0.08] border-blue-400/20',
  DWG: 'text-emerald-400 bg-emerald-500/[0.08] border-emerald-400/20',
  PDF: 'text-red-400 bg-red-500/[0.08] border-red-400/20',
  DOC: 'text-amber-400 bg-amber-500/[0.08] border-amber-400/20',
};

// ── Icons (inline SVG) ─────────────────────────────────────────────────────────

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" />
  </svg>
);

const RadioIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" /><circle cx="12" cy="12" r="1" />
  </svg>
);

// ── Sub-components ─────────────────────────────────────────────────────────────

const DeliveryCard: React.FC<{ item: DeliveryItem }> = ({ item }) => {
  const style = URGENCY_STYLES[item.urgency];

  return (
    <div
      className={`rounded-2xl border ${style.border} ${style.bg} p-4 transition-all duration-200 hover:bg-white/[0.04] hover:border-archilya-gold/20`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-[13px] tracking-wide text-archilya-text/90 truncate">
            {item.projectName}
          </h4>
        </div>
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${style.text} flex-shrink-0 ml-3`}>
          {item.deadline}
        </span>
      </div>
      <div className="flex items-center justify-end">
        <div className={`w-2 h-2 rounded-full ${style.dot}`} />
      </div>
    </div>
  );
};

const ApprovalRow: React.FC<{ item: ApprovalItem }> = ({ item }) => {
  const badgeColors = FILE_TYPE_COLORS[item.fileType] ?? 'text-archilya-text-dim bg-white/[0.04] border-white/[0.08]';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-b-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-archilya-text/85 leading-relaxed">
          {item.description}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-mono text-archilya-text-dim/50 tracking-wide">
            {item.waitingTime}
          </span>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeColors}`}>
            {item.fileType}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
        <button
          type="button"
          className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/70 hover:text-emerald-400 transition-colors px-2 py-1 rounded hover:bg-emerald-500/[0.08]"
        >
          Onayla
        </button>
        <button
          type="button"
          className="text-[10px] font-mono uppercase tracking-wider text-red-400/70 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/[0.08]"
        >
          Reddet
        </button>
      </div>
    </div>
  );
};

const ActivityRow: React.FC<{ entry: ActivityEntry }> = ({ entry }) => {
  return (
    <div className="flex items-start gap-3 py-3 group">
      <div className={`w-2 h-2 rounded-full ${entry.color} flex-shrink-0 mt-1.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-archilya-text-dim/65 leading-relaxed">
          <span className="text-archilya-text/85 font-medium">{entry.person}</span>
          {' '}{entry.action}
        </p>
        <span className="text-[9px] font-mono text-archilya-text-dim/40 tracking-wide">
          {entry.timestamp}
        </span>
      </div>
    </div>
  );
};

// ── Main view ──────────────────────────────────────────────────────────────────

export const NewsView: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-archilya-gold/60 mb-2">
          Komuta Merkezi
        </p>
        <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase">
          Ofis Radarı
        </h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.35em] text-archilya-text-dim/50">
          Proje teslimleri, onaylar ve gerçek zamanlı ekip aktivitesi
        </p>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT COLUMN — Deliveries + Approvals */}
        <div className="flex-1 lg:w-[60%] flex flex-col gap-6 min-w-0">
          {/* ── Panel 1: Yaklaşan Teslimler ──────────────────────────────── */}
          <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-archilya-gold/70">
                <ClockIcon />
              </span>
              <h2 className="font-display text-[14px] tracking-[0.18em] text-archilya-text uppercase">
                Yaklaşan Teslimler
              </h2>
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-archilya-gold/60 mb-5">
              Proje teslim tarihleri ve acil durumlar
            </p>

            <div className="grid grid-cols-2 gap-3">
              {DELIVERIES.map((item) => (
                <DeliveryCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          {/* ── Panel 2: Bekleyen Onaylar ─────────────────────────────────── */}
          <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-archilya-gold/70">
                <CheckCircleIcon />
              </span>
              <h2 className="font-display text-[14px] tracking-[0.18em] text-archilya-text uppercase">
                Bekleyen Onaylar
              </h2>
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-archilya-gold/60 mb-5">
              Ekip ve müşteri onayları
            </p>

            <div>
              {APPROVALS.map((item) => (
                <ApprovalRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN — Office Radar */}
        <aside className="lg:w-[40%]">
          <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 h-full">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-archilya-gold/70">
                <RadioIcon />
              </span>
              <h2 className="font-display text-[14px] tracking-[0.18em] text-archilya-text uppercase">
                Ofis Radarı
              </h2>
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-archilya-gold/60 mb-5">
              Gerçek zamanlı ekip aktivitesi
            </p>

            <div className="divide-y divide-white/[0.04]">
              {ACTIVITIES.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Live indicator */}
            <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-emerald-400/70">
                Canlı
              </span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
