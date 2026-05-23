import React, { useState, useEffect, useRef } from 'react';

interface Notification {
  id: string;
  title: string;
  meta: string;
  tone: 'project' | 'news' | 'system';
}

const NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'Ayşe Hanım Zemin Kat Planını kilitledi', meta: '2 dk önce', tone: 'project' },
  { id: 'n2', title: 'Yeni Mimari Yarışma eklendi', meta: 'Bugün', tone: 'news' },
  { id: 'n3', title: 'Archilya v2.1 yayında!', meta: 'Dün', tone: 'system' },
];

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        aria-label="Bildirimleri aç"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="relative w-10 h-8 flex items-center justify-center text-archilya-text/60 hover:text-archilya-gold/80 hover:bg-white/[0.03] transition-all duration-300 rounded-md"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <span className="absolute top-1 right-1 min-w-4 h-4 rounded-full bg-red-500 text-[8px] font-mono font-bold text-white flex items-center justify-center border border-[#0a0a0a]">
          3
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-80 z-[9999] rounded-xl border border-white/[0.08] bg-[#0a0a0a]/95 backdrop-blur-xl p-2"
        >
          <div className="flex flex-col">
            {NOTIFICATIONS.map((notification) => (
              <div
                key={notification.id}
                className="rounded-lg px-3 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0"
                role="menuitem"
              >
                <p className="text-[11px] text-archilya-text/85">{notification.title}</p>
                <p className="text-[9px] text-archilya-text-dim/50 mt-1">{notification.meta}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
