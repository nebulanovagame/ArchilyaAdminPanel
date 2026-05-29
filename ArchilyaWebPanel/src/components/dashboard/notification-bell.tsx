"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Bell,
} from "lucide-react";

function NotificationPanel({
  onClose,
  bellRef,
}: {
  onClose: () => void;
  bellRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("dashboard.header");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const clickedBell = bellRef.current?.contains(target);

      if (clickedBell) return;

      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, bellRef]);

  return (
    <motion.div
      ref={panelRef}
      id="notification-panel"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 w-72 bg-[#0d0f13] border border-white/10 rounded-sm shadow-2xl overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <p className="text-xs font-sans font-bold text-white uppercase tracking-widest">
          {t("notifications")}
        </p>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
        <Bell className="w-6 h-6 text-gray-700 mb-3" />
        <p className="text-[11px] font-sans text-gray-600">
          Henüz bildiriminiz yok
        </p>
      </div>
    </motion.div>
  );
}

export default function NotificationBell() {
  const t = useTranslations("dashboard.header");
  const [notifOpen, setNotifOpen] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={bellContainerRef} className="relative">
      <button
        type="button"
        onClick={() => setNotifOpen((prev) => !prev)}
        aria-label={t("notifications")}
        aria-expanded={notifOpen}
        aria-controls="notification-panel"
        className={`relative w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${
          notifOpen
            ? "bg-primary/10 text-primary"
            : "text-gray-500 hover:text-white hover:bg-white/5"
        }`}
      >
        <Bell className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {notifOpen && (
          <NotificationPanel
            onClose={() => setNotifOpen(false)}
            bellRef={bellContainerRef}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
